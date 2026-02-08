import type { Request as ExpressRequest, Response as ExpressResponse } from 'express';
import { Readable } from 'node:stream';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createGroq } from '@ai-sdk/groq';
import { streamText, tool, zodSchema } from 'ai';
import { z } from 'zod';
import { buildContextBlock, searchDocChunks } from './docs.js';
import { DATABASE_SCHEMA, executeSQLQuery } from './sql.js';

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
  gemini: 'gemini-1.5-flash',
};

const buildSystemPrompt = (contextBlock: string) => {
  const contextIntro = contextBlock
    ? `Use the following docs to answer. Cite sources by file path.\n\n${contextBlock}`
    : 'Answer using your general knowledge of this app and GE DMS.';

  return [
    'You are the Warehouse Agent helping warehouse workers navigate the GE DMS system and Warehouse app.',
    '',
    'CRITICAL RULES:',
    '1. NEVER make up information - if you don\'t know, say "I don\'t have that information"',
    '2. NEVER invent data, names, numbers, or passwords',
    '3. INSTRUCT the user what to do - don\'t role-play doing it yourself',
    '   - Say: "Navigate to the Warehouse Map and open the Inventory drawer"',
    '   - NOT: "Let me navigate to the map for you..."',
    '4. For off-topic questions (WiFi, hours, facilities), say: "That\'s outside my scope - please ask your supervisor or IT department"',
    '4b. Questions about today\'s tasks or agenda are in-scope. Use live data when possible.',
    '5. When describing app features, only mention controls that appear in the provided sources. If no source applies, say you don\'t have that information.',
    '6. Do NOT use speculative language ("likely", "probably", "maybe").',
    '7. Include file-path citations from the provided sources when possible. If you cannot cite, say you don\'t have that information.',
    '8. Do NOT claim knowledge of a UI feature or workflow unless it appears in the sources or tool results.',
    '9. Do NOT mention "Tasks", "Schedule", or GE DMS pages unless explicitly stated in sources or returned by tools.',
    '',
    'IMPORTANT: Prioritize end-user workflows over technical/developer details.',
    'When users ask about GE DMS tasks (inbound, orders, reports), explain the GE DMS UI steps.',
    'When users ask about the Warehouse app (scanning, sessions, map), explain app features.',
    'Be concise and practical. Focus on what buttons to click and what pages to visit.',
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

const getLastUserText = (messages: unknown[]) => {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i] as { role?: string; content?: unknown } | undefined;
    if (message?.role !== 'user') continue;

    if (typeof message.content === 'string') return message.content;
    if (Array.isArray(message.content)) {
      const textParts = message.content
        .map((part) => (part && typeof part === 'object' && (part as { type?: string; text?: string }).type === 'text'
          ? (part as { text?: string }).text
          : null))
        .filter((part): part is string => Boolean(part));
      if (textParts.length) return textParts.join('\n');
    }
  }

  return '';
};

const classifyIntent = (query: string) => {
  const normalized = query.toLowerCase();
  const needsDocs = /\b(how do i|how to|steps|guide|walk me through|where do i|what is|explain)\b/.test(normalized);
  const needsData = /\b(how many|count|list|show me|which|today|agenda|pending|open|active|tasks|to do)\b/.test(normalized);
  return { needsDocs, needsData };
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

    const query = getLastUserText(messages);
    const normalizedQuery = query.toLowerCase();
    const intent = classifyIntent(normalizedQuery);
    const context = query ? await searchDocChunks(query, 8) : [];
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

    const convertedMessages = await convertMessages(messages);
    const streamMessages = (Array.isArray(convertedMessages) ? convertedMessages : []) as StreamMessages;
    const streamModel = languageModel as unknown as StreamModel;

    const result = streamText({
      model: streamModel,
      system: systemPrompt,
      messages: streamMessages,
      temperature: 0.2,
      tools: {
        query_database: databaseTool,
      } as StreamTools,
      toolChoice: intent.needsData
        ? ({ type: 'tool', toolName: 'query_database' } as StreamToolChoice)
        : undefined,
    });

    const response = (result as unknown as {
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
    res.status(500).json({ error: message });
  }
}
