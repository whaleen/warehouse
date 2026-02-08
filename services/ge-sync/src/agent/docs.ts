import fs from 'node:fs/promises';
import path from 'node:path';

type DocChunk = {
  path: string;
  section: string;
  content: string;
};

const EXCLUDED_PATHS = new Set([
  'services/ge-sync/docs/SECRETS.md',
]);

const repoRoot = path.resolve(process.cwd(), '..', '..');

const normalizePath = (fullPath: string) => {
  return fullPath.replace(repoRoot, '').replace(/^\//, '');
};

const splitIntoSections = (content: string) => {
  const lines = content.split('\n');
  const sections: Array<{ title: string; content: string[] }> = [];
  let currentTitle = 'Overview';
  let buffer: string[] = [];

  const flush = () => {
    const text = buffer.join('\n').trim();
    if (text) {
      sections.push({ title: currentTitle, content: text.split('\n') });
    }
    buffer = [];
  };

  lines.forEach((line) => {
    const headingMatch = /^#{1,3}\s+(.*)$/.exec(line.trim());
    if (headingMatch) {
      flush();
      currentTitle = headingMatch[1].trim();
      return;
    }
    buffer.push(line);
  });

  flush();
  return sections;
};

const chunkSection = (textLines: string[], maxChars = 1600) => {
  const chunks: string[] = [];
  let buffer: string[] = [];
  let size = 0;

  const flush = () => {
    const text = buffer.join('\n').trim();
    if (text) chunks.push(text);
    buffer = [];
    size = 0;
  };

  textLines.forEach((line) => {
    const nextSize = size + line.length + 1;
    if (nextSize > maxChars && buffer.length > 0) {
      flush();
    }
    buffer.push(line);
    size += line.length + 1;
  });

  flush();
  return chunks;
};

const walkMarkdownFiles = async (dirPath: string, output: string[]) => {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      await walkMarkdownFiles(fullPath, output);
      continue;
    }
    if (entry.isFile() && entry.name.endsWith('.md')) {
      output.push(fullPath);
    }
  }
};

const getDocFiles = async () => {
  const files: string[] = [];

  const targets = [
    path.join(repoRoot, 'docs'),
    path.join(repoRoot, 'README.md'),
    path.join(repoRoot, 'services', 'ge-sync', 'docs'),
    path.join(repoRoot, 'src', 'components', 'Map', 'README.md'),
  ];

  for (const target of targets) {
    try {
      const stat = await fs.stat(target);
      if (stat.isDirectory()) {
        await walkMarkdownFiles(target, files);
      } else if (stat.isFile() && target.endsWith('.md')) {
        files.push(target);
      }
    } catch {
      // Ignore missing paths
    }
  }

  return files;
};

const buildDocChunks = async (): Promise<DocChunk[]> => {
  const chunks: DocChunk[] = [];
  const files = await getDocFiles();

  for (const filePath of files) {
    const normalized = normalizePath(filePath);
    if (EXCLUDED_PATHS.has(normalized)) continue;

    const content = await fs.readFile(filePath, 'utf8');
    const sections = splitIntoSections(content);
    sections.forEach((section) => {
      const sectionChunks = chunkSection(section.content);
      sectionChunks.forEach((chunk) => {
        chunks.push({
          path: normalized,
          section: section.title,
          content: chunk,
        });
      });
    });
  }

  return chunks;
};

let docChunks: DocChunk[] | null = null;

const getDocChunks = async () => {
  if (!docChunks) {
    docChunks = await buildDocChunks();
  }
  return docChunks;
};

const tokenize = (input: string) =>
  input
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 1);

const scoreChunk = (queryTokens: string[], chunk: DocChunk) => {
  const haystack = `${chunk.section}\n${chunk.content}`.toLowerCase();
  let score = 0;
  queryTokens.forEach((token) => {
    if (!token) return;
    if (chunk.section.toLowerCase().includes(token)) score += 3;
    const matches = haystack.split(token).length - 1;
    score += matches;
  });

  if (chunk.path.includes('services/ge-sync/docs/')) {
    score *= 2;
  }

  if (chunk.path.includes('docs/agent/')) {
    score *= 3;
  }

  if (chunk.path.includes('.tsx') || chunk.path.includes('.ts')) {
    score *= 0.3;
  }

  return score;
};

export const searchDocChunks = async (query: string, limit = 6): Promise<DocChunk[]> => {
  const tokens = tokenize(query);
  if (!tokens.length) return [];

  const geDmsKeywords = ['inbound', 'order', 'load', 'truck', 'delivery', 'manifest', 'checkin', 'pod', 'download', 'report', 'dms', 'ge'];
  const isGeDmsQuery = tokens.some((token) => geDmsKeywords.includes(token));

  let candidates = await getDocChunks();

  if (isGeDmsQuery) {
    candidates = candidates.filter((chunk) =>
      chunk.path.includes('services/ge-sync/docs/') ||
      chunk.path.includes('docs/agent/') ||
      chunk.path.includes('docs/features/') ||
      chunk.path === 'README.md'
    );
  } else {
    const hasAgentDocs = candidates.some((chunk) => chunk.path.includes('docs/agent/'));
    if (hasAgentDocs) {
      candidates = candidates.filter((chunk) => chunk.path.includes('docs/agent/') || chunk.path.includes('docs/'));
    }
  }

  return candidates
    .map((chunk) => ({ chunk, score: scoreChunk(tokens, chunk) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((entry) => entry.chunk);
};

export const buildContextBlock = (chunks: DocChunk[]) => {
  if (!chunks.length) return '';
  return chunks
    .map((chunk, index) => {
      return `Source ${index + 1}: ${chunk.path} (${chunk.section})\n${chunk.content}`;
    })
    .join('\n\n');
};

export const getDocChunksByPath = async (pathHint: string): Promise<DocChunk[]> => {
  const chunks = await getDocChunks();
  return chunks.filter((chunk) => chunk.path === pathHint);
};

export type { DocChunk };
