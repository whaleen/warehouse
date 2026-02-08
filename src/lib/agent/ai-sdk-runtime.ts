import { AssistantChatTransport, useChatRuntime } from '@assistant-ui/react-ai-sdk';
import type { AgentProvider } from './client';
import { getActiveLocationContext } from '@/lib/tenant';

const getAgentApiUrl = () => {
  const explicitUrl = import.meta.env.VITE_AGENT_API_URL as string | undefined;
  if (explicitUrl) return explicitUrl;

  const geSyncUrl = import.meta.env.VITE_GE_SYNC_URL as string | undefined;
  if (geSyncUrl) return `${geSyncUrl.replace(/\/+$/, '')}/agent/chat`;

  return '/agent/chat';
};

const getAgentApiKey = () => {
  return (import.meta.env.VITE_AGENT_API_KEY as string | undefined)
    ?? (import.meta.env.VITE_GE_SYNC_API_KEY as string | undefined);
};

export function useAgentAISDKRuntime(
  provider: AgentProvider,
  apiKey: string,
  modelName?: string
){
  const api = getAgentApiUrl();
  const serviceKey = getAgentApiKey();
  const trimmedKey = apiKey.trim();
  const { locationId } = getActiveLocationContext();

  return useChatRuntime({
    transport: new AssistantChatTransport({
      api,
      headers: serviceKey ? { 'X-API-Key': serviceKey } : undefined,
      body: {
        provider,
        model: modelName,
        apiKey: trimmedKey,
        locationId: locationId ?? undefined,
      },
    }),
  });
}
