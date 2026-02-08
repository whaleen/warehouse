import { useEffect, useState } from 'react';
import { AppHeader } from '@/components/Navigation/AppHeader';
import { PageContainer } from '@/components/Layout/PageContainer';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription as DialogDescriptionText, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Check, ChevronDown } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import type { AgentProvider } from '@/lib/agent/client';
import { useAgentKeys, useUpsertAgentKey } from '@/hooks/queries/useAgentKeys';
import { AssistantRuntimeProvider } from '@assistant-ui/react';
import { useAgentAISDKRuntime } from '@/lib/agent/ai-sdk-runtime';
import { Thread } from '@/components/assistant-ui/thread';

const providerLabel: Record<AgentProvider, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  groq: 'Groq',
  gemini: 'Google Gemini',
};

const defaultModels: Record<AgentProvider, string> = {
  openai: 'gpt-4o-mini',
  anthropic: 'claude-3-5-sonnet-20241022',
  groq: 'llama-3.3-70b-versatile',
  gemini: 'gemini-1.5-flash',
};

export function AgentView({ onMenuClick }: { onMenuClick?: () => void }) {
  const isMobile = useIsMobile();
  const agentKeysQuery = useAgentKeys();
  const upsertKeyMutation = useUpsertAgentKey();

  const [provider, setProvider] = useState<AgentProvider>('groq');
  const [model, setModel] = useState('');
  const [showKeyInstructions, setShowKeyInstructions] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Local state for key inputs
  const [openaiKeyInput, setOpenaiKeyInput] = useState('');
  const [anthropicKeyInput, setAnthropicKeyInput] = useState('');
  const [groqKeyInput, setGroqKeyInput] = useState('');
  const [geminiKeyInput, setGeminiKeyInput] = useState('');

  // Load keys from database
  useEffect(() => {
    if (agentKeysQuery.data) {
      agentKeysQuery.data.forEach((key) => {
        if (key.provider === 'openai') setOpenaiKeyInput(key.api_key);
        if (key.provider === 'anthropic') setAnthropicKeyInput(key.api_key);
        if (key.provider === 'groq') setGroqKeyInput(key.api_key);
        if (key.provider === 'gemini') setGeminiKeyInput(key.api_key);
      });
    }
  }, [agentKeysQuery.data]);

  // Auto-save key changes
  const handleKeyChange = (provider: AgentProvider, value: string) => {
    if (provider === 'openai') setOpenaiKeyInput(value);
    else if (provider === 'anthropic') setAnthropicKeyInput(value);
    else if (provider === 'groq') setGroqKeyInput(value);
    else setGeminiKeyInput(value);

    if (value.trim()) {
      upsertKeyMutation.mutate({ provider, apiKey: value });
    }
  };

  const activeKey =
    provider === 'openai' ? openaiKeyInput :
    provider === 'anthropic' ? anthropicKeyInput :
    provider === 'groq' ? groqKeyInput :
    geminiKeyInput;

  const resolvedModel = model.trim() || defaultModels[provider];

  // Create runtime using AI SDK
  const runtime = useAgentAISDKRuntime(provider, activeKey, resolvedModel);

  return (
    <div className="min-h-screen bg-background">
      {!isMobile && <AppHeader title="Agent" onMenuClick={onMenuClick} />}
      <PageContainer className="py-6 pb-24">
        <div className="mx-auto max-w-5xl">
          <Card className="overflow-hidden">
            <CardHeader className="space-y-1">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <CardTitle>Agent Chat</CardTitle>
                  <CardDescription>
                    Ask questions about inventory, scans, and workflow.
                  </CardDescription>
                </div>
                <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline">Settings</Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                      <DialogTitle>Agent Settings</DialogTitle>
                      <DialogDescriptionText>
                        Bring your own API key. Keys are stored in the database.
                      </DialogDescriptionText>
                    </DialogHeader>
                    <div className="space-y-5">
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label>Provider</Label>
                          <Select value={provider} onValueChange={(value) => setProvider(value as AgentProvider)}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="groq">{providerLabel.groq} (FREE)</SelectItem>
                              <SelectItem value="gemini">{providerLabel.gemini} (FREE)</SelectItem>
                              <SelectItem value="openai">{providerLabel.openai}</SelectItem>
                              <SelectItem value="anthropic">{providerLabel.anthropic}</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label>Model (optional)</Label>
                          <Input
                            value={model}
                            onChange={(e) => setModel(e.target.value)}
                            placeholder={defaultModels[provider]}
                          />
                          <p className="text-xs text-muted-foreground">
                            Leave blank to use the provider default.
                          </p>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Label>{providerLabel[provider]} API Key</Label>
                          {upsertKeyMutation.isPending && (
                            <span className="text-xs text-muted-foreground">Saving...</span>
                          )}
                          {upsertKeyMutation.isSuccess && !upsertKeyMutation.isPending && (
                            <div className="flex items-center gap-1 text-xs text-green-600">
                              <Check className="h-3 w-3" />
                              Saved
                            </div>
                          )}
                        </div>
                        <Input
                          type="password"
                          value={activeKey}
                          onChange={(e) => handleKeyChange(provider, e.target.value)}
                          placeholder={
                            provider === 'openai' ? 'sk-...' :
                            provider === 'anthropic' ? 'sk-ant-...' :
                            provider === 'groq' ? 'gsk_...' :
                            'AIza...'
                          }
                        />
                        <p className="text-xs text-muted-foreground">
                          Keys are autosaved as you type.
                        </p>
                      </div>

                      <Collapsible open={showKeyInstructions} onOpenChange={setShowKeyInstructions}>
                        <CollapsibleTrigger className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground">
                          <ChevronDown className={`h-3 w-3 transition-transform ${showKeyInstructions ? 'rotate-180' : ''}`} />
                          How to get API keys
                        </CollapsibleTrigger>
                        <CollapsibleContent className="mt-3 space-y-3 text-xs text-muted-foreground">
                          <div>
                            <div className="font-semibold text-foreground">Groq (FREE)</div>
                            <div>1. Visit <a href="https://console.groq.com" target="_blank" rel="noopener" className="text-primary hover:underline">console.groq.com</a></div>
                            <div>2. Create API Key</div>
                          </div>
                          <div>
                            <div className="font-semibold text-foreground">Google Gemini (FREE)</div>
                            <div>1. Visit <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener" className="text-primary hover:underline">aistudio.google.com/apikey</a></div>
                            <div>2. Create API Key</div>
                          </div>
                          <div>
                            <div className="font-semibold text-foreground">OpenAI</div>
                            <div>1. Visit <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener" className="text-primary hover:underline">platform.openai.com/api-keys</a></div>
                            <div>2. Create secret key</div>
                          </div>
                          <div>
                            <div className="font-semibold text-foreground">Anthropic (Claude)</div>
                            <div>1. Visit <a href="https://console.anthropic.com" target="_blank" rel="noopener" className="text-primary hover:underline">console.anthropic.com</a></div>
                            <div>2. Create Key ($5 free credits)</div>
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {isMobile ? (
                <div className="m-6 rounded border border-dashed p-8 text-sm text-muted-foreground">
                  Agent chat is designed for desktop use.
                </div>
              ) : !activeKey ? (
                <div className="m-6 rounded border border-dashed p-8 text-sm text-muted-foreground">
                  Enter an API key in Settings to start chatting.
                </div>
              ) : (
                <AssistantRuntimeProvider runtime={runtime}>
                  <div className="h-[520px] lg:h-[640px]">
                    <Thread />
                  </div>
                </AssistantRuntimeProvider>
              )}
            </CardContent>
          </Card>
        </div>
      </PageContainer>
    </div>
  );
}
