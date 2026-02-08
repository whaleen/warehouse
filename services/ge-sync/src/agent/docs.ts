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
  console.log('[Docs] Building doc chunks...');
  const chunks: DocChunk[] = [];
  const files = await getDocFiles();
  console.log(`[Docs] Found ${files.length} files to index`);

  for (const filePath of files) {
    const normalized = normalizePath(filePath);
    if (EXCLUDED_PATHS.has(normalized)) continue;

    const content = await fs.readFile(filePath, 'utf8');
    const sections = splitIntoSections(content);

    // Log loads.md specifically to debug
    if (normalized.includes('loads.md')) {
      console.log(`[Docs] Processing loads.md - found ${sections.length} sections:`, sections.map(s => s.title));
    }

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

  console.log(`[Docs] Built ${chunks.length} total chunks`);
  return chunks;
};

let docChunks: DocChunk[] | null = null;

const getDocChunks = async () => {
  if (!docChunks) {
    console.log('[Docs] No cached chunks, building fresh...');
    try {
      docChunks = await buildDocChunks();
    } catch (error) {
      console.error('[Docs] Error building doc chunks:', error);
      docChunks = [];
    }
  } else {
    console.log('[Docs] Using cached chunks:', docChunks.length);
  }
  return docChunks || [];
};

const tokenize = (input: string) =>
  input
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 1);

const scoreChunk = (queryTokens: string[], chunk: DocChunk) => {
  const sectionLower = chunk.section.toLowerCase();
  const haystack = `${sectionLower}\n${chunk.content}`.toLowerCase();
  let score = 0;

  // Count token matches
  queryTokens.forEach((token) => {
    if (!token) return;
    if (sectionLower.includes(token)) score += 3;
    const matches = haystack.split(token).length - 1;
    score += matches;
  });

  // MASSIVE boost for section title exact matches
  // If 3+ query tokens appear in the section title, this is likely the exact section they want
  const tokensInSection = queryTokens.filter(token => token && sectionLower.includes(token)).length;
  if (tokensInSection >= 3) {
    score *= 10; // 10x multiplier for high relevance section titles
  } else if (tokensInSection >= 2) {
    score *= 3; // 3x for moderate relevance
  }

  // Path-based multipliers (applied after section matching bonus)
  // Warehouse operational docs (highest priority for user-facing workflows)
  if (chunk.path.includes('docs/warehouse/')) {
    score *= 6; // Increased from 4 to 6
  }

  // GE DMS docs
  if (chunk.path.includes('docs/ge-dms/')) {
    score *= 2; // Reduced from 3 to 2 to prioritize warehouse docs
  }

  if (chunk.path.includes('services/ge-sync/docs/')) {
    score *= 2;
  }

  if (chunk.path.includes('docs/agent/')) {
    score *= 3;
  }

  // Reduce code file relevance
  if (chunk.path.includes('.tsx') || chunk.path.includes('.ts')) {
    score *= 0.3;
  }

  // Reduce README relevance (too general)
  if (chunk.path === 'README.md') {
    score *= 0.5;
  }

  return score;
};

export const searchDocChunks = async (query: string, limit = 6): Promise<DocChunk[]> => {
  console.log('[Docs] Searching for:', query);
  const tokens = tokenize(query);
  if (!tokens.length) return [];

  const geDmsKeywords = ['inbound', 'order', 'load', 'truck', 'delivery', 'manifest', 'checkin', 'pod', 'download', 'report', 'dms', 'ge'];
  const isGeDmsQuery = tokens.some((token) => geDmsKeywords.includes(token));

  let candidates = await getDocChunks();
  if (!candidates || !Array.isArray(candidates)) {
    console.error('[Docs] getDocChunks returned invalid data:', candidates);
    return [];
  }

  console.log(`[Docs] Total chunks before filtering: ${candidates.length}`);
  console.log(`[Docs] Is GE DMS query: ${isGeDmsQuery}`);

  if (isGeDmsQuery) {
    const beforeCount = candidates.length;
    candidates = candidates.filter((chunk) =>
      chunk.path.includes('docs/warehouse/') ||
      chunk.path.includes('docs/ge-dms/') ||
      chunk.path.includes('services/ge-sync/docs/') ||
      chunk.path.includes('docs/agent/') ||
      chunk.path.includes('docs/features/') ||
      chunk.path === 'README.md'
    );
    console.log(`[Docs] After GE DMS filter: ${beforeCount} -> ${candidates.length} chunks`);

    // Log warehouse chunks specifically
    const warehouseChunks = candidates.filter(c => c.path.includes('docs/warehouse/'));
    console.log(`[Docs] Warehouse chunks in candidates: ${warehouseChunks.length}`);
    if (warehouseChunks.length > 0) {
      console.log('[Docs] Warehouse sections:', warehouseChunks.slice(0, 5).map(c => `${c.path} (${c.section})`));
    }
  } else {
    const hasAgentDocs = candidates.some((chunk) => chunk.path.includes('docs/agent/'));
    if (hasAgentDocs) {
      candidates = candidates.filter((chunk) => chunk.path.includes('docs/agent/') || chunk.path.includes('docs/'));
    }
  }

  const scored = candidates
    .map((chunk) => ({ chunk, score: scoreChunk(tokens, chunk) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);

  // Log loads.md chunks specifically with their scores
  const loadsChunks = scored.filter(s => s.chunk.path.includes('loads.md'));
  if (loadsChunks.length > 0) {
    console.log(`[Docs] loads.md chunks (${loadsChunks.length} total):`);
    loadsChunks.slice(0, 5).forEach((r) => {
      console.log(`  - ${r.chunk.section}: score ${r.score}`);
    });
  }

  const results = scored.slice(0, limit);

  console.log(`[Docs] Top ${results.length} results:`);
  results.forEach((r, i) => {
    console.log(`  ${i + 1}. ${r.chunk.path} (${r.chunk.section}) - score: ${r.score}`);
  });

  return results.map((entry) => entry.chunk);
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
