#!/usr/bin/env node
import process from 'node:process';
import path from 'node:path';
import fs from 'node:fs';
import { promises as fsp } from 'node:fs';
import dotenv from 'dotenv';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateText } from 'ai';

const repoRoot = process.cwd();
['.env.local', '.env'].forEach((file) => {
  const fullPath = path.join(repoRoot, file);
  if (fs.existsSync(fullPath)) {
    dotenv.config({ path: fullPath });
  }
});

const args = process.argv.slice(2);
const query = args.filter((arg) => !arg.startsWith('--')).join(' ').trim();
const topArg = args.find((arg) => arg.startsWith('--top='));
const topCount = topArg ? Number(topArg.split('=')[1]) : 8;

if (!query) {
  console.error('Usage: node scripts/docs-audit.mjs "your question" [--top=8]');
  process.exit(1);
}

const env = process.env;
const provider = env.DOC_AUDIT_PROVIDER || env.AGENT_PROVIDER || 'openai';
const defaultModelByProvider = {
  openai: 'gpt-4o-mini',
  anthropic: 'claude-3-5-sonnet-20241022',
  gemini: 'gemini-1.5-flash',
  groq: 'gpt-4o-mini',
};
const model = env.DOC_AUDIT_MODEL || env.AGENT_MODEL || defaultModelByProvider[provider] || 'gpt-4o-mini';

const resolveModelKey = (providerName) => {
  if (env.DOC_AUDIT_API_KEY) return env.DOC_AUDIT_API_KEY;
  if (env.AGENT_LLM_API_KEY) return env.AGENT_LLM_API_KEY;
  if (providerName === 'openai') return env.OPENAI_API_KEY;
  if (providerName === 'anthropic') return env.ANTHROPIC_API_KEY;
  if (providerName === 'groq') return env.GROQ_API_KEY;
  if (providerName === 'gemini') return env.GOOGLE_GENERATIVE_AI_API_KEY || env.GEMINI_API_KEY;
  return undefined;
};

const apiKey = resolveModelKey(provider);
if (!apiKey) {
  console.error(`Missing API key for provider "${provider}".`);
  console.error('Set DOC_AUDIT_API_KEY or provider-specific env (e.g. OPENAI_API_KEY).');
  process.exit(1);
}

const getModel = () => {
  switch (provider) {
    case 'openai':
      return createOpenAI({ apiKey })(model);
    case 'anthropic':
      return createAnthropic({ apiKey })(model);
    case 'gemini':
      return createGoogleGenerativeAI({ apiKey })(model);
    case 'groq':
      throw new Error('Groq models are not supported by the AI SDK version in this repo. Use openai/anthropic/gemini instead.');
    default:
      throw new Error(`Unsupported provider: ${provider}`);
  }
};

const walkMarkdown = async (dir) => {
  const entries = await fsp.readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walkMarkdown(fullPath)));
      continue;
    }
    if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) {
      files.push(fullPath);
    }
  }

  return files;
};

const safeRead = async (filePath) => {
  try {
    return await fsp.readFile(filePath, 'utf8');
  } catch {
    return null;
  }
};

const docsRoot = path.join(repoRoot, 'docs');
const markdownFiles = (await walkMarkdown(docsRoot)).map((filePath) => path.relative(repoRoot, filePath));
const extraFiles = [
  'README.md',
  'docs/README.md',
  'services/ge-sync/README.md',
  'src/components/Map/README.md',
];

const allFiles = Array.from(new Set([...markdownFiles, ...extraFiles]));

const tokens = query
  .toLowerCase()
  .split(/[^a-z0-9]+/g)
  .map((token) => token.trim())
  .filter(Boolean);

const scored = [];
for (const file of allFiles) {
  const content = await safeRead(path.join(repoRoot, file));
  if (!content) continue;
  const lower = content.toLowerCase();
  let score = 0;
  for (const token of tokens) {
    if (!token) continue;
    const hits = lower.split(token).length - 1;
    score += hits;
  }
  scored.push({ file, content, score });
}

scored.sort((a, b) => b.score - a.score);
const topMatches = scored.filter((entry) => entry.score > 0).slice(0, topCount);
const fallback = scored.slice(0, topCount);
const selected = topMatches.length ? topMatches : fallback;

const trimContent = (content, maxChars = 4000) => {
  if (content.length <= maxChars) return content;
  return `${content.slice(0, maxChars)}\n\n[Truncated]`;
};

const context = selected
  .map((entry) => `FILE: ${entry.file}\n${trimContent(entry.content)}`)
  .join('\n\n---\n\n');

const prompt = [
  'You are a documentation auditor for the Warehouse app and GE DMS docs.',
  'Answer the user question using only the provided doc context when it is about the app or GE DMS.',
  'Cite sources by file path in parentheses, e.g. (docs/warehouse/overview.md).',
  'If the docs do not cover part of the question, say what is missing under "Gaps".',
  'Keep the answer concise and structured.',
  '',
  `Question: ${query}`,
  '',
  'Context:',
  context || '[No docs loaded]',
].join('\n');

const { text } = await generateText({
  model: getModel(),
  prompt,
  temperature: 0.2,
});

process.stdout.write(text.trim());
process.stdout.write('\n');
