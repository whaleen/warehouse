import type { DocChunk } from './docs';
import { DATABASE_SCHEMA, executeSQLQuery } from './sql';

export type AgentProvider = 'openai' | 'anthropic' | 'groq' | 'gemini';

type AgentMessage = {
  role: 'user' | 'assistant';
  content: string;
};

type AgentResponse = {
  content: string;
  citations: DocChunk[];
};

const defaultModels: Record<AgentProvider, string> = {
  openai: 'gpt-4o-mini',
  anthropic: 'claude-3-5-sonnet-20241022',
  groq: 'llama-3.3-70b-versatile',
  gemini: 'gemini-1.5-flash-002',
};

const buildSystemPrompt = (contextBlock: string, sqlEnabled: boolean = false) => {
  const contextIntro = contextBlock
    ? `Use the following docs to answer. Cite sources by file path.\n\n${contextBlock}`
    : 'Answer using your general knowledge of this app and GE DMS.';

  const sqlInstructions = sqlEnabled
    ? `\n\nDATA QUERIES:
When users ask factual questions about inventory data (counts, items, locations, etc.),
use the query_database function to get the data, then respond in natural language.

Example:
User: "how many dishwashers do we have?"
You: [call query_database with SQL] → "You have 19 dishwashers in inventory."`
    : '';

  return [
    'You are the Warehouse Agent helping warehouse workers navigate the GE DMS system and Warehouse app.',
    '',
    'CRITICAL RULES:',
    '1. NEVER make up information - if you don\'t know, say "I don\'t have that information"',
    '2. NEVER invent data, names, numbers, or passwords',
    '3. INSTRUCT the user what to do - don\'t role-play doing it yourself',
    '   - Say: "Navigate to the Warehouse Map and filter by..." ✓',
    '   - NOT: "Let me navigate to the map for you..." ✗',
    '4. For off-topic questions (WiFi, hours, facilities), say: "That\'s outside my scope - please ask your supervisor or IT department"',
    '',
    'IMPORTANT: Prioritize end-user workflows over technical/developer details.',
    'When users ask about GE DMS tasks (inbound, orders, reports), explain the GE DMS UI steps.',
    'When users ask about the Warehouse app (scanning, sessions, map), explain app features.',
    'Be concise and practical. Focus on what buttons to click and what pages to visit.',
    contextIntro,
    sqlInstructions,
  ].join('\n\n');
};

const buildOpenAiMessages = (system: string, messages: AgentMessage[]) => {
  return [
    { role: 'system', content: system },
    ...messages.map((message) => ({ role: message.role, content: message.content })),
  ];
};

const buildAnthropicMessages = (messages: AgentMessage[]) => {
  return messages.map((message) => ({ role: message.role, content: message.content }));
};

// Tool definition for database queries
const DATABASE_QUERY_TOOL = {
  type: 'function',
  function: {
    name: 'query_database',
    description: `Query the warehouse database to get inventory data. Returns results as JSON array.

Database schema:
${DATABASE_SCHEMA}

Only SELECT queries allowed. Use ILIKE for case-insensitive text matching.`,
    parameters: {
      type: 'object',
      properties: {
        sql: {
          type: 'string',
          description: 'SQL SELECT query to execute. Must start with SELECT.',
        },
      },
      required: ['sql'],
    },
  },
};

export async function createAgentReply(options: {
  provider: AgentProvider;
  apiKey: string;
  model?: string;
  messages: AgentMessage[];
  context: DocChunk[];
  enableSQL?: boolean;
}): Promise<AgentResponse> {
  const { provider, apiKey, messages, context, enableSQL = true } = options;
  const model = options.model || defaultModels[provider];
  const contextBlock = context
    .map((chunk, index) => `Source ${index + 1}: ${chunk.path} (${chunk.section})\n${chunk.content}`)
    .join('\n\n');
  const systemPrompt = buildSystemPrompt(contextBlock, enableSQL);

  if (provider === 'openai' || provider === 'groq') {
    const endpoint = provider === 'openai'
      ? 'https://api.openai.com/v1/chat/completions'
      : 'https://api.groq.com/openai/v1/chat/completions';

    const conversationMessages = buildOpenAiMessages(systemPrompt, messages);

    // Initial request with tools
    let response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: conversationMessages,
        temperature: 0.2,
        tools: enableSQL ? [DATABASE_QUERY_TOOL] : undefined,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || `${provider} request failed`);
    }

    let data = await response.json();
    const assistantMessage = data?.choices?.[0]?.message;

    // Check if agent wants to call a tool
    if (enableSQL && assistantMessage?.tool_calls && assistantMessage.tool_calls.length > 0) {
      const toolCall = assistantMessage.tool_calls[0];
      const functionArgs = JSON.parse(toolCall.function.arguments);
      const sqlQuery = functionArgs.sql;

      // Execute the SQL
      const { data: queryData, error: queryError } = await executeSQLQuery(sqlQuery);
      const toolResult = queryError
        ? { error: queryError }
        : { data: queryData };

      // Send tool result back to agent
      conversationMessages.push(assistantMessage);
      conversationMessages.push({
        role: 'tool',
        tool_call_id: toolCall.id,
        content: JSON.stringify(toolResult),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);

      // Get final response
      response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: conversationMessages,
          temperature: 0.2,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || `${provider} request failed`);
      }

      data = await response.json();
    }

    const content = data?.choices?.[0]?.message?.content?.trim();
    if (!content) {
      throw new Error(`${provider} returned an empty response`);
    }

    return { content, citations: context };
  }

  if (provider === 'gemini') {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: systemPrompt },
                ...messages.map((msg) => ({
                  text: `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`,
                })),
              ],
            },
          ],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 800,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || 'Gemini request failed');
    }

    const data = await response.json();
    const content = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!content) {
      throw new Error('Gemini returned an empty response');
    }
    return { content, citations: context };
  }

  const conversationMessages = buildAnthropicMessages(messages);

  // Anthropic tool definition format
  const anthropicTools = enableSQL ? [{
    name: 'query_database',
    description: `Query the warehouse database. Only SELECT queries allowed.\n\nDatabase schema:\n${DATABASE_SCHEMA}`,
    input_schema: {
      type: 'object',
      properties: {
        sql: {
          type: 'string',
          description: 'SQL SELECT query to execute',
        },
      },
      required: ['sql'],
    },
  }] : undefined;

  let response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 800,
      system: systemPrompt,
      messages: conversationMessages,
      temperature: 0.2,
      tools: anthropicTools,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || 'Anthropic request failed');
  }

  let data = await response.json();

  // Check for tool use
  interface ContentBlock { type: string; input?: { sql: string }; id?: string }
  if (enableSQL && data?.content?.some((c: ContentBlock) => c.type === 'tool_use')) {
    const toolUse = data.content.find((c: ContentBlock) => c.type === 'tool_use');
    const sqlQuery = toolUse.input.sql;

    // Execute SQL
    const { data: queryData, error: queryError } = await executeSQLQuery(sqlQuery);
    const toolResult = queryError
      ? { error: queryError }
      : { data: queryData };

    // Send tool result back
    conversationMessages.push({ role: 'assistant', content: data.content
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    conversationMessages.push({
      role: 'user',
      content: [{
        type: 'tool_result',
        tool_use_id: toolUse.id,
        content: JSON.stringify(toolResult),
      }],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    // Get final response
    response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: 800,
        system: systemPrompt,
        messages: conversationMessages,
        temperature: 0.2,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || 'Anthropic request failed');
    }

    data = await response.json();
  }

  const content = data?.content?.[0]?.text?.trim();
  if (!content) {
    throw new Error('Anthropic returned an empty response');
  }

  return { content, citations: context };
}

export type { AgentMessage, AgentResponse };
