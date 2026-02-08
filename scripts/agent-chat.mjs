#!/usr/bin/env node
import process from 'node:process';
import readline from 'node:readline';

const args = process.argv.slice(2);
const env = process.env;

const resolveApiUrl = () => {
  if (env.AGENT_API_URL) return env.AGENT_API_URL;
  if (env.VITE_AGENT_API_URL) return env.VITE_AGENT_API_URL;
  if (env.GE_SYNC_URL) return `${env.GE_SYNC_URL.replace(/\/+$/, '')}/agent/chat`;
  if (env.VITE_GE_SYNC_URL) return `${env.VITE_GE_SYNC_URL.replace(/\/+$/, '')}/agent/chat`;
  return 'http://localhost:3001/agent/chat';
};

const resolveModelKey = (provider) => {
  if (env.AGENT_LLM_API_KEY) return env.AGENT_LLM_API_KEY;
  if (provider === 'openai') return env.OPENAI_API_KEY;
  if (provider === 'anthropic') return env.ANTHROPIC_API_KEY;
  if (provider === 'groq') return env.GROQ_API_KEY;
  if (provider === 'gemini') return env.GOOGLE_GENERATIVE_AI_API_KEY || env.GEMINI_API_KEY;
  return undefined;
};

const parseArgs = (rawArgs) => {
  const parsed = {
    interactive: false,
    agents: undefined,
    message: '',
  };

  const remaining = [];
  for (let i = 0; i < rawArgs.length; i += 1) {
    const arg = rawArgs[i];
    if (arg === '--interactive' || arg === '--multi-turn') {
      parsed.interactive = true;
      continue;
    }
    if (arg === '--agents') {
      parsed.agents = rawArgs[i + 1];
      i += 1;
      continue;
    }
    remaining.push(arg);
  }

  parsed.message = remaining.join(' ').trim();
  return parsed;
};

const parseAgents = (agentsInput) => {
  if (!agentsInput) return null;
  return agentsInput.split(',').map((entry) => {
    const [provider, model] = entry.split(':').map((part) => part.trim()).filter(Boolean);
    return { provider, model: model || undefined };
  }).filter((entry) => entry.provider);
};

const apiUrl = resolveApiUrl();
const serviceKey = env.AGENT_SERVICE_KEY
  || env.VITE_AGENT_API_KEY
  || env.GE_SYNC_API_KEY
  || env.VITE_GE_SYNC_API_KEY;
const locationId = env.AGENT_LOCATION_ID || env.LOCATION_ID || undefined;

const buildHeaders = () => ({
  'Content-Type': 'application/json',
  Accept: 'text/plain',
  ...(serviceKey ? { 'X-API-Key': serviceKey } : {}),
});

const callAgent = async ({ provider, model, apiKey, messages }) => {
  const body = {
    provider,
    apiKey,
    messages,
    ...(model ? { model } : {}),
    ...(locationId ? { locationId } : {}),
  };

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: buildHeaders(),
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Agent request failed (${response.status}): ${errorText}`);
  }

  if (!response.body) {
    return await response.text();
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let output = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    if (value) output += decoder.decode(value);
  }

  return output.trim();
};

const formatAgentLabel = ({ provider, model }) => {
  if (model) return `${provider}:${model}`;
  return provider;
};

const parsed = parseArgs(args);
const agentsList = parseAgents(parsed.agents) || [
  { provider: env.AGENT_PROVIDER || 'openai', model: env.AGENT_MODEL || undefined },
];

for (const agent of agentsList) {
  const apiKey = resolveModelKey(agent.provider);
  if (!apiKey) {
    console.error(`Missing LLM API key for provider "${agent.provider}".`);
    console.error('Set AGENT_LLM_API_KEY or a provider-specific env var (e.g. OPENAI_API_KEY).');
    process.exit(1);
  }
  agent.apiKey = apiKey;
}

if (!parsed.interactive && !parsed.message) {
  console.error('Usage: node scripts/agent-chat.mjs "your message"');
  console.error('Options: --interactive | --multi-turn, --agents "openai:gpt-4o-mini,anthropic:claude-3-5-sonnet"');
  console.error('Set AGENT_LLM_API_KEY (or provider-specific env) and optionally GE_SYNC_URL.');
  process.exit(1);
}

const runSingleTurn = async (message) => {
  const calls = agentsList.map(async (agent) => {
    const reply = await callAgent({
      provider: agent.provider,
      model: agent.model,
      apiKey: agent.apiKey,
      messages: [{ role: 'user', content: message }],
    });
    return { agent, reply };
  });

  const results = await Promise.all(calls);
  results.forEach(({ agent, reply }) => {
    if (agentsList.length > 1) {
      process.stdout.write(`\n[${formatAgentLabel(agent)}]\n`);
    }
    process.stdout.write(`${reply}\n`);
  });
};

const runInteractive = async () => {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true,
  });

  const histories = new Map();
  agentsList.forEach((agent) => {
    histories.set(agent, []);
  });

  const ask = () => new Promise((resolve) => {
    rl.question('You: ', (line) => resolve(line));
  });

  while (true) {
    const line = await ask();
    const message = String(line).trim();
    if (!message) continue;
    if (message.toLowerCase() === 'exit' || message.toLowerCase() === 'quit') break;

    const calls = agentsList.map(async (agent) => {
      const history = histories.get(agent) || [];
      const nextMessages = [...history, { role: 'user', content: message }];
      const reply = await callAgent({
        provider: agent.provider,
        model: agent.model,
        apiKey: agent.apiKey,
        messages: nextMessages,
      });
      histories.set(agent, [...nextMessages, { role: 'assistant', content: reply }]);
      return { agent, reply };
    });

    const results = await Promise.all(calls);
    results.forEach(({ agent, reply }) => {
      if (agentsList.length > 1) {
        process.stdout.write(`\n[${formatAgentLabel(agent)}]\n`);
      }
      process.stdout.write(`${reply}\n`);
    });
  }

  rl.close();
};

if (parsed.interactive) {
  await runInteractive();
} else {
  await runSingleTurn(parsed.message);
}
