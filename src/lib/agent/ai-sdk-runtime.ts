import { useEffect, useState } from 'react';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { useLocalRuntime } from '@assistant-ui/react';
import type { ChatModelAdapter } from '@assistant-ui/react';
import type { AgentProvider } from './client';
import { searchDocChunks } from './docs';
import { DATABASE_SCHEMA, executeSQLQuery } from './sql';

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
    '   - Say: "Navigate to the Warehouse Map and filter by..." ✓',
    '   - NOT: "Let me navigate to the map for you..." ✗',
    '4. For off-topic questions (WiFi, hours, facilities), say: "That\'s outside my scope - please ask your supervisor or IT department"',
    '',
    'IMPORTANT: Prioritize end-user workflows over technical/developer details.',
    'When users ask about GE DMS tasks (inbound, orders, reports), explain the GE DMS UI steps.',
    'When users ask about the Warehouse app (scanning, sessions, map), explain app features.',
    'Be concise and practical. Focus on what buttons to click and what pages to visit.',
    contextIntro,
  ].join('\n\n');
};

const databaseTool = {
  description: `Query the warehouse database to get inventory data. Returns results as JSON array.

Database schema:
${DATABASE_SCHEMA}

Only SELECT queries allowed. Use ILIKE for case-insensitive text matching.`,
  parameters: {
    type: 'object' as const,
    properties: {
      sql: {
        type: 'string' as const,
        description: 'SQL SELECT query to execute. Must start with SELECT.',
      },
    },
    required: ['sql'],
  },
  execute: async ({ sql }: { sql: string }) => {
    const { data, error } = await executeSQLQuery(sql);
    if (error) {
      return { error };
    }
    return { data };
  },
};

export function useAISDKRuntime(
  provider: AgentProvider,
  apiKey: string,
  modelName?: string
) {
  const [adapter, setAdapter] = useState<ChatModelAdapter | null>(null);

  useEffect(() => {
    console.log('useAISDKRuntime:', { provider, apiKey: apiKey ? '***' : 'none', modelName });

    if (!apiKey.trim()) {
      setAdapter(null);
      return;
    }

    // Create provider-specific client
    let languageModel;

    if (provider === 'openai') {
      const openai = createOpenAI({ apiKey: apiKey.trim() });
      languageModel = openai(modelName || 'gpt-4o-mini');
    } else if (provider === 'anthropic') {
      const anthropic = createAnthropic({ apiKey: apiKey.trim() });
      languageModel = anthropic(modelName || 'claude-3-5-sonnet-20241022');
    } else if (provider === 'gemini') {
      const google = createGoogleGenerativeAI({ apiKey: apiKey.trim() });
      languageModel = google(modelName || 'gemini-1.5-flash');
    } else if (provider === 'groq') {
      // Groq uses OpenAI-compatible API
      const groq = createOpenAI({
        apiKey: apiKey.trim(),
        baseURL: 'https://api.groq.com/openai/v1',
      });
      languageModel = groq(modelName || 'llama-3.3-70b-versatile');
    }

    if (!languageModel) {
      setAdapter(null);
      return;
    }

    // Create adapter with AI SDK model
    const chatAdapter: ChatModelAdapter = {
      async *run({ messages, abortSignal }) {
        console.log('ChatAdapter.run called with', messages.length, 'messages');

        // Get last user message for doc search
        const lastMessage = messages[messages.length - 1];
        const query =
          lastMessage?.content?.[0]?.type === 'text'
            ? lastMessage.content[0].text
            : '';

        // Search docs for context
        const context = query ? searchDocChunks(query, 6) : [];
        const contextBlock = context
          .map(
            (chunk, index) =>
              `Source ${index + 1}: ${chunk.path} (${chunk.section})\n${chunk.content}`
          )
          .join('\n\n');
        const systemPrompt = buildSystemPrompt(contextBlock);

        // Convert assistant-ui messages to AI SDK format
        const aiMessages = messages.map((m) => ({
          role: m.role,
          content: m.content
            .filter((c) => c.type === 'text')
            .map((c) => c.text)
            .join('\n'),
        }));

        try {
          // Import streamText dynamically to avoid issues
          const { streamText } = await import('ai');

          console.log('Calling streamText with', { provider, modelName, messagesCount: aiMessages.length });

          const { textStream } = streamText({
            model: languageModel,
            system: systemPrompt,
            messages: aiMessages,
            tools: {
              query_database: databaseTool,
            },
            maxSteps: 5,
            abortSignal,
          });

          // Stream the response with proper yielding
          let fullText = '';
          let chunkCount = 0;
          console.log('Starting to iterate textStream...');
          for await (const chunk of textStream) {
            fullText += chunk;
            chunkCount++;
            if (chunkCount === 1) {
              console.log('First chunk received:', chunk);
            }
            yield {
              content: [{ type: 'text', text: fullText }],
            };
          }
          console.log('Streaming complete. Total chunks:', chunkCount);
        } catch (error) {
          console.error('AI SDK error:', error);
          throw error;
        }
      },
    };

    setAdapter(chatAdapter);
  }, [provider, apiKey, modelName]);

  return adapter;
}

// Dummy adapter for when no API key is provided
const dummyAdapter: ChatModelAdapter = {
  async run() {
    return {
      content: [
        {
          type: 'text',
          text: 'Please enter an API key to start chatting.',
        },
      ],
    };
  },
};

export function useAgentAISDKRuntime(
  provider: AgentProvider,
  apiKey: string,
  modelName?: string
) {
  const adapter = useAISDKRuntime(provider, apiKey, modelName);
  return useLocalRuntime(adapter || dummyAdapter);
}
