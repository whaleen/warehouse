import type { Request as ExpressRequest, Response as ExpressResponse } from 'express';
import { Readable } from 'node:stream';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createGroq } from '@ai-sdk/groq';
import { streamText, generateText, tool, zodSchema } from 'ai';
import { z } from 'zod';
import { buildContextBlock, searchDocChunks } from './docs.js';
import { DATABASE_SCHEMA, executeSQLQuery, findItemByIdentifier } from './sql.js';

type AgentProvider = 'openai' | 'anthropic' | 'groq' | 'gemini';
type StreamTextArgs = Parameters<typeof streamText>[0];
type StreamMessages = NonNullable<StreamTextArgs['messages']>;
type StreamTools = NonNullable<StreamTextArgs['tools']>;
type StreamToolChoice = StreamTextArgs['toolChoice'];
type StreamModel = StreamTextArgs['model'];

const defaultModels: Record<AgentProvider, string> = {
  openai: 'gpt-4o-mini',
  anthropic: 'claude-3-5-sonnet-20241022',
  groq: 'llama-3.3-70b-versatile',
  gemini: 'gemini-2.0-flash',
};

const buildSystemPrompt = (contextBlock: string) => {
  const contextIntro = contextBlock
    ? `Use the following docs to answer. Cite sources by file path for factual app/GE DMS answers.\n\n${contextBlock}`
    : 'You can answer general questions using your own knowledge. For app or GE DMS specifics, do not guess without sources.';

  return [
    'You are the Warehouse Agent helping warehouse workers navigate the GE DMS system and Warehouse app.',
    '',
    'CRITICAL RULES:',
    '1. NEVER make up information - if you don\'t know, say "I don\'t have that information"',
    '2. NEVER invent data, names, numbers, or passwords',
    '3. INSTRUCT the user what to do - don\'t role-play doing it yourself',
    '   - Say: "Navigate to the Warehouse Map and open the Inventory drawer"',
    '   - NOT: "Let me navigate to the map for you..."',
    '4. Be conversational. Respond naturally to greetings or small talk, then steer back to how you can help.',
    '4b. For clearly off-topic questions (WiFi, hours, facilities), explain it\'s outside scope and suggest asking a supervisor or IT. Avoid repeating the same sentence.',
    '4c. Questions about today\'s tasks or agenda are in-scope. Use live data when possible.',
    '5. When describing app or GE DMS features, only mention controls that appear in the provided sources. If no source applies, say you don\'t have that information.',
    '6. Do NOT use speculative language ("likely", "probably", "maybe").',
    '7. Include file-path citations from the provided sources for factual app/GE DMS answers. For casual conversation, no citations needed.',
    '8. Do NOT claim knowledge of a UI feature or workflow unless it appears in the sources or tool results.',
    '9. Do NOT mention "Tasks", "Schedule", or GE DMS pages unless explicitly stated in sources or returned by tools.',
    '10. Avoid meta statements like "trained on" or "I was trained". If asked what information you have, say you can use provided docs (when supplied), live data tools (when enabled), and general knowledge for non-app topics.',
    '',
    'TOOLS AVAILABLE:',
    '- find_item: When a user provides a serial number, CSO, or model number and asks about location or status, use this tool. Examples: "where is 12345678", "is ABC123 ready", "find serial XYZ". Extract the identifier from their message and call find_item.',
    '- query_database: For complex queries about counts, lists, or aggregations (enabled when needed).',
    '',
    'IMPORTANT: Prioritize end-user workflows over technical/developer details.',
    'When users ask about GE DMS tasks (inbound, orders, reports), explain the GE DMS UI steps.',
    'When users ask about the Warehouse app (scanning, sessions, map), explain app features.',
    'Be concise and practical. Focus on what buttons to click and what pages to visit. Offer a helpful follow-up question when appropriate.',
    contextIntro,
  ].join('\n\n');
};

const createModel = (provider: AgentProvider, apiKey: string, modelName?: string) => {
  const resolvedModel = modelName || defaultModels[provider];

  switch (provider) {
    case 'openai': {
      const openai = createOpenAI({ apiKey });
      return openai(resolvedModel);
    }
    case 'anthropic': {
      const anthropic = createAnthropic({ apiKey });
      return anthropic(resolvedModel);
    }
    case 'gemini': {
      const google = createGoogleGenerativeAI({ apiKey });
      return google(resolvedModel);
    }
    case 'groq': {
      const groq = createGroq({ apiKey });
      return groq(resolvedModel);
    }
    default:
      return null;
  }
};

const databaseTool = tool({
  description: `Query the warehouse database to get inventory data. Returns results as JSON array.

Database schema:
${DATABASE_SCHEMA}

Only SELECT queries allowed. Use ILIKE for case-insensitive text matching.`,
  inputSchema: zodSchema(
    z.object({
      sql: z.string().describe('SQL SELECT query to execute. Must start with SELECT.'),
    })
  ),
  execute: async ({ sql }: { sql: string }) => {
    const { data, error } = await executeSQLQuery(sql);
    if (error) {
      return { error };
    }
    return { data };
  },
});

const findItemTool = tool({
  description: `Find an inventory item by serial number, CSO number, or model number. Returns item details including current GPS location, last scan time, and load association. Use this when the user asks "where is [identifier]" or provides an identifier and asks about its location or status.`,
  inputSchema: zodSchema(
    z.object({
      identifier: z.string().describe('Serial number, CSO number, or model number to search for'),
    })
  ),
  execute: async ({ identifier }: { identifier: string }) => {
    const { data, error } = await findItemByIdentifier(identifier);
    if (error) {
      return { error, found: false };
    }
    if (!data || data.length === 0) {
      return { found: false, message: `No items found matching "${identifier}"` };
    }
    return { found: true, items: data, count: data.length };
  },
});

const getLastUserText = (messages: unknown[]) => {
  try {
    if (!Array.isArray(messages) || messages.length === 0) return '';

    for (let i = messages.length - 1; i >= 0; i -= 1) {
      const message = messages[i] as { role?: string; content?: unknown } | undefined;
      if (!message || message.role !== 'user') continue;

      if (typeof message.content === 'string') return message.content;
      if (Array.isArray(message.content) && message.content.length > 0) {
        const textParts = message.content
          .map((part) => (part && typeof part === 'object' && (part as { type?: string; text?: string }).type === 'text'
            ? (part as { text?: string }).text
            : null))
          .filter((part): part is string => Boolean(part));
        if (textParts.length) return textParts.join('\n');
      }
    }
  } catch (error) {
    console.error('Error extracting user text from messages:', error);
  }

  return '';
};

const classifyIntent = (query: string) => {
  const normalized = query.toLowerCase();
  const needsDocs = /\b(how do i|how to|steps|guide|walk me through|where do i|what is|explain)\b/.test(normalized);
  const needsData = /\b(how many|count|list|show me|which|today|agenda|pending|open|active|tasks|to do)\b/.test(normalized);
  const generalChat = !needsDocs && !needsData;
  return { needsDocs, needsData, generalChat };
};

const classifyIntentWithModel = async (model: StreamModel, query: string) => {
  if (!query) return { needsDocs: false, needsData: false, generalChat: true };
  const routerPrompt = [
    'Classify the user message for a warehouse assistant.',
    'Return JSON with keys: needsDocs, needsData, generalChat (boolean).',
    'needsDocs=true if the user asks for how-to steps, explanations, or app/GE DMS workflow guidance.',
    'needsData=true if the user asks for live counts, lists, statuses, or anything time-bound (today, active, pending).',
    'generalChat=true for greetings, small talk, or general questions that do not require app/GE DMS details or live data.',
    'If ambiguous, set all three to false.',
    'Only output JSON. No extra text.',
    '',
    `Message: """${query}"""`,
  ].join('\n');

  try {
    const { text } = await generateText({
      model,
      prompt: routerPrompt,
      temperature: 0,
    });
    const parsed = JSON.parse(text.trim()) as { needsDocs?: boolean; needsData?: boolean; generalChat?: boolean };
    const generalChat = Boolean(parsed.generalChat);
    return {
      needsDocs: generalChat ? false : Boolean(parsed.needsDocs),
      needsData: generalChat ? false : Boolean(parsed.needsData),
      generalChat,
    };
  } catch {
    return classifyIntent(query);
  }
};

const isGreeting = (query: string) => {
  const normalized = query.trim().toLowerCase();
  return /^(hi|hello|hey|yo|sup|what's up|whats up|good morning|good afternoon|good evening)\b/.test(normalized);
};

const convertMessages = async (messages: unknown[]) => {
  const aiModule = (await import('ai')) as unknown as {
    convertToModelMessages?: (input: unknown[]) => Promise<unknown[]>;
    convertToCoreMessages?: (input: unknown[]) => Promise<unknown[]>;
  };

  if (aiModule.convertToModelMessages) {
    return aiModule.convertToModelMessages(messages);
  }

  if (aiModule.convertToCoreMessages) {
    return aiModule.convertToCoreMessages(messages);
  }

  return messages;
};

export async function handleAgentChat(req: ExpressRequest, res: ExpressResponse) {
  try {
    const { messages, provider, model, apiKey } = req.body ?? {};
    const acceptHeader = req.header('accept') ?? '';
    const wantsText = acceptHeader.includes('text/plain') || req.query?.format === 'text';

    if (!apiKey || typeof apiKey !== 'string') {
      return res.status(400).json({ error: 'Missing apiKey' });
    }

    if (!provider || typeof provider !== 'string') {
      return res.status(400).json({ error: 'Missing provider' });
    }

    if (!Array.isArray(messages)) {
      return res.status(400).json({ error: 'Missing messages' });
    }

    const typedProvider = provider as AgentProvider;
    const languageModel = createModel(typedProvider, apiKey, typeof model === 'string' ? model : undefined);
    if (!languageModel) {
      return res.status(400).json({ error: 'Unsupported provider' });
    }
    const streamModel = languageModel as unknown as StreamModel;

    const query = getLastUserText(messages);
    const intent = await classifyIntentWithModel(streamModel, query);

    // Safely search docs with error handling
    let context: Awaited<ReturnType<typeof searchDocChunks>> = [];
    try {
      context = query && !isGreeting(query) ? await searchDocChunks(query, 8) : [];
    } catch (docError) {
      console.error('Doc search error:', docError);
      // Continue without docs rather than failing completely
    }

    const contextBlock = buildContextBlock(context);
    if (intent.needsDocs && context.length === 0) {
      res.json({
        id: `unknown-${Date.now()}`,
        role: 'assistant',
        content: "I don't have that information.",
      });
      return;
    }

    const dataRequirement = intent.needsData
      ? '\n\nData requirement: Use the query_database tool to fetch live data. Only answer using tool results. If the tool fails or returns no data, say you do not have that information. Do not mention unrelated UI pages.'
      : '';
    const docRequirement = intent.needsDocs
      ? '\n\nDocumentation requirement: Answer only using the provided sources and include citations. If sources are missing, say you do not have that information.'
      : '';
    const systemPrompt = buildSystemPrompt(contextBlock + dataRequirement + docRequirement);

    // Convert messages with error handling
    let convertedMessages: unknown[] = messages;
    try {
      convertedMessages = await convertMessages(messages);
    } catch (convertError) {
      console.error('Message conversion error, using original messages:', convertError);
      // Fall back to using messages as-is
    }
    const streamMessages = (Array.isArray(convertedMessages) ? convertedMessages : messages) as StreamMessages;

    // Build tools - findItem is always available, database query only when needed
    const tools: StreamTools = {
      find_item: findItemTool,
      ...(intent.needsData ? { query_database: databaseTool } : {}),
    } as StreamTools;

    const result = streamText({
      model: streamModel,
      system: systemPrompt,
      messages: streamMessages,
      temperature: 0.2,
      tools,
      toolChoice: intent.needsData
        ? ({ type: 'tool', toolName: 'query_database' } as StreamToolChoice)
        : undefined,
    });

    const response = (wantsText
      ? (result as unknown as { toTextStreamResponse?: () => Response }).toTextStreamResponse?.()
      : undefined)
      ?? (result as unknown as {
      toUIMessageStreamResponse?: () => Response;
      toDataStreamResponse?: () => Response;
    }).toUIMessageStreamResponse?.()
      ?? (result as unknown as { toDataStreamResponse?: () => Response }).toDataStreamResponse?.();

    if (!response) {
      res.status(500).json({ error: 'Streaming response unavailable' });
      return;
    }
    res.status(response.status);
    response.headers.forEach((value: string, key: string) => {
      res.setHeader(key, value);
    });

    if (!response.body) {
      res.end();
      return;
    }

    Readable.fromWeb(response.body).pipe(res);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const stack = error instanceof Error ? error.stack : undefined;
    console.error('Agent chat error:', message, stack);
    res.status(500).json({ error: message });
  }
}
