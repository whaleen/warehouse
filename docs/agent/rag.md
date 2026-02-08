# RAG System Architecture

## Overview

The agent chat uses a **RAG (Retrieval-Augmented Generation)** system to answer questions about the warehouse app and GE DMS. RAG grounds the LLM's responses in actual documentation rather than relying on the model's training data or hallucinating answers.

## What is RAG?

**Retrieval-Augmented Generation** is a technique that combines:
1. **Retrieval**: Search a document corpus to find relevant information
2. **Augmentation**: Inject the retrieved docs into the LLM's context
3. **Generation**: LLM generates answers grounded in the retrieved docs

This ensures answers are accurate, up-to-date, and cite specific sources.

## Our RAG Pipeline

```
User Question
    ↓
Query Classification (does it need docs/data/both?)
    ↓
Document Retrieval (token-based search with scoring)
    ↓
Context Building (top 8 chunks formatted for LLM)
    ↓
System Prompt + Retrieved Context + User Query
    ↓
LLM Generation (with citations)
    ↓
Grounded Answer
```

## Implementation Details

### 1. Document Indexing

**Location**: `services/ge-sync/src/agent/docs.ts`

**Indexed paths**:
```typescript
const targets = [
  path.join(repoRoot, 'docs'),                           // All docs
  path.join(repoRoot, 'README.md'),                      // Main README
  path.join(repoRoot, 'services', 'ge-sync', 'docs'),   // Service docs
  path.join(repoRoot, 'src', 'components', 'Map', 'README.md'), // Component docs
];
```

**Chunking strategy**:
- Split markdown files by headings (h1, h2, h3)
- Each section becomes a separate chunk
- Chunks include section title + content
- Maximum chunk size: 1600 characters (configurable)

**Example**:
```markdown
# Loads

## Request a Sanity Check
Steps to request...

## Complete a Sanity Check
Steps to complete...
```

Becomes two chunks:
- Chunk 1: "Request a Sanity Check" section
- Chunk 2: "Complete a Sanity Check" section

**Caching**:
- Doc chunks are built on first query after service start
- Cached in memory for subsequent queries
- Hot-reload rebuilds cache when source files change

### 2. Query Classification

**Location**: `services/ge-sync/src/agent/agentChat.ts`

Before retrieval, classify the query intent:
- **needsDocs**: User asks "how to" or needs explanation → retrieve docs
- **needsData**: User asks for counts, lists, live data → query database
- **generalChat**: Greetings, small talk → skip retrieval

**Classification logic**:
```typescript
const needsDocs = /\b(how do i|how to|steps|guide|walk me through|where do i|what is|explain)\b/
const needsData = /\b(how many|count|list|show me|which|today|agenda|pending|open|active|tasks|to do)\b/
```

### 3. Document Retrieval

**Token-based search** (not vector embeddings):

#### Tokenization
```typescript
const tokenize = (input: string) =>
  input
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 1);
```

Query: "How do I request a sanity check for a load?"
Tokens: `["how", "do", "request", "sanity", "check", "for", "load"]`

#### Scoring Algorithm

**Base scoring**:
```typescript
queryTokens.forEach((token) => {
  // Section title matches are worth 3 points
  if (chunk.section.toLowerCase().includes(token)) score += 3;

  // Count occurrences in full text (section + content)
  const matches = haystack.split(token).length - 1;
  score += matches;
});
```

**Section title matching boost**:
```typescript
const tokensInSection = queryTokens.filter(token =>
  sectionLower.includes(token)
).length;

if (tokensInSection >= 3) {
  score *= 10; // 10x for exact section matches
} else if (tokensInSection >= 2) {
  score *= 3;  // 3x for partial matches
}
```

**Path-based multipliers**:
```typescript
// Warehouse operational docs (highest priority)
if (chunk.path.includes('docs/warehouse/')) {
  score *= 6;
}

// GE DMS docs
if (chunk.path.includes('docs/ge-dms/')) {
  score *= 2;
}

// Agent-specific docs
if (chunk.path.includes('docs/agent/')) {
  score *= 3;
}

// README (reduce - too general)
if (chunk.path === 'README.md') {
  score *= 0.5;
}
```

**Example scoring**:

Query: "How do I request a sanity check?"

Chunk: `docs/warehouse/loads.md` section "Request a Sanity Check"
- Base score: section matches "request" (+3), "sanity" (+3), "check" (+3) = 9
- Content matches: ~10 more occurrences = ~25 total
- Section title boost: 3 tokens match → 25 × 10 = 250
- Warehouse path multiplier: 250 × 6 = **1500**

vs

Chunk: `docs/ge-dms/exports.md` section "Related Docs"
- Base score: content mentions "check" a few times = ~40
- Section title boost: 0 tokens match → no boost = 40
- GE DMS path multiplier: 40 × 2 = **80**

Result: Warehouse doc ranks 18x higher ✅

#### Filtering

**GE DMS query detection**:
```typescript
const geDmsKeywords = [
  'inbound', 'order', 'load', 'truck', 'delivery',
  'manifest', 'checkin', 'pod', 'download', 'report', 'dms', 'ge'
];
const isGeDmsQuery = tokens.some(token => geDmsKeywords.includes(token));
```

If GE DMS query, filter to relevant paths:
```typescript
if (isGeDmsQuery) {
  candidates = candidates.filter((chunk) =>
    chunk.path.includes('docs/warehouse/') ||
    chunk.path.includes('docs/ge-dms/') ||
    chunk.path.includes('services/ge-sync/docs/') ||
    chunk.path.includes('docs/agent/') ||
    chunk.path.includes('docs/features/') ||
    chunk.path === 'README.md'
  );
}
```

**Result**: Top 8 chunks sorted by score

### 4. Context Augmentation

**Location**: `services/ge-sync/src/agent/docs.ts`

```typescript
export const buildContextBlock = (chunks: DocChunk[]) => {
  if (!chunks.length) return '';
  return chunks
    .map((chunk, index) => {
      return `Source ${index + 1}: ${chunk.path} (${chunk.section})\n${chunk.content}`;
    })
    .join('\n\n');
};
```

**Example output**:
```
Source 1: docs/warehouse/loads.md (Request a Sanity Check)
When GE asks for verification of load contents:
1. Open **Loads** from the sidebar
2. Click the load to open its detail panel
...

Source 2: docs/warehouse/loads.md (Complete a Sanity Check)
After verifying the load contents match GE records:
...
```

### 5. Generation

**System prompt structure**:
```typescript
const systemPrompt = buildSystemPrompt(contextBlock);
```

The system prompt includes:
- Agent identity and role
- Critical rules (never hallucinate, instruct don't role-play, cite sources)
- The retrieved documentation context
- Requirements based on query intent (docs/data/both)

**Example prompt**:
```
You are the Warehouse Agent helping warehouse workers...

CRITICAL RULES:
1. NEVER make up information
2. INSTRUCT the user what to do
3. Cite sources by file path
...

Use the following docs to answer:

Source 1: docs/warehouse/loads.md (Request a Sanity Check)
[Retrieved content...]

Source 2: docs/warehouse/loads.md (Complete a Sanity Check)
[Retrieved content...]
```

**LLM call**:
```typescript
const result = streamText({
  model: streamModel,
  system: systemPrompt,
  messages: streamMessages,
  temperature: 0.2,  // Low temperature for factual accuracy
});
```

**Streaming response** sent back to frontend with citations.

## Tuning the RAG System

### When to Adjust Scoring

**Symptoms of poor retrieval**:
- Agent gives wrong answers despite correct docs existing
- Wrong documents rank in top 8
- Correct documents score too low

**Check the logs**:
```bash
tail -f /tmp/ge-sync-debug.log | grep "\[Docs\]"
```

Look for:
```
[Docs] loads.md chunks (11 total):
  - Request a Sanity Check: score 1320
  - Complete a Sanity Check: score 306

[Docs] Top 8 results:
  1. docs/warehouse/loads.md (Request a Sanity Check) - score: 1320
```

### Tuning Parameters

**1. Path multipliers** (`scoreChunk` function):
```typescript
// Increase if warehouse docs rank too low
if (chunk.path.includes('docs/warehouse/')) {
  score *= 6;  // Adjust this value
}
```

**2. Section title boost**:
```typescript
// Increase if section title matches aren't ranking high enough
if (tokensInSection >= 3) {
  score *= 10;  // Adjust this value
}
```

**3. Filtering logic**:
```typescript
// Add keywords to trigger GE DMS filtering
const geDmsKeywords = ['inbound', 'order', 'load', ...];

// Add paths to include in GE DMS queries
if (isGeDmsQuery) {
  candidates = candidates.filter((chunk) =>
    chunk.path.includes('docs/warehouse/') || // Add new paths here
    ...
  );
}
```

**4. Chunk size**:
```typescript
const chunkSection = (textLines: string[], maxChars = 1600) => {
  // Increase maxChars if chunks are too small
  // Decrease if chunks are too large for LLM context
}
```

### Adding New Document Paths

To index new documentation:

**Backend** (`services/ge-sync/src/agent/docs.ts`):
```typescript
const targets = [
  path.join(repoRoot, 'docs'),
  path.join(repoRoot, 'your-new-path'),  // Add here
];
```

**Frontend** (`src/components/Docs/DocsView.tsx`):
```typescript
const docModules = import.meta.glob(
  [
    '../../../docs/**/*.md',
    '../../../your-new-path/**/*.md',  // Add here
  ],
  { as: 'raw', eager: true }
);
```

## Debugging Retrieval Issues

### Problem: Correct doc exists but doesn't rank in top 8

**Diagnosis**:
1. Check if doc is being indexed:
   ```
   [Docs] Found 55 files to index
   ```
   If count is wrong, check `getDocFiles()` targets

2. Check if doc is being filtered out:
   ```
   [Docs] Total chunks before filtering: 503
   [Docs] After GE DMS filter: 503 -> 260 chunks
   [Docs] Warehouse chunks in candidates: 85
   ```
   If warehouse chunks = 0, fix the filter logic

3. Check the score:
   ```
   [Docs] loads.md chunks (11 total):
     - Request a Sanity Check: score 1320
   ```
   If score < 100, increase multipliers or improve section title matches

**Solution**:
- If filtered out: Add path to filter includes
- If score too low: Increase path multiplier
- If no section matches: Improve doc section titles to match user queries

### Problem: Agent hallucinates despite docs

**Possible causes**:
1. **Docs don't contain the information** → Write the docs
2. **Retrieval returns wrong docs** → Tune scoring
3. **LLM ignores the context** → Strengthen system prompt rules
4. **Docs are vague/incomplete** → Add step-by-step instructions

**Check**:
```
[Docs] Top 8 results:
  1. docs/warehouse/loads.md (Request a Sanity Check) - score: 1320
```

If the right doc is #1 but answer is still wrong, the doc content needs improvement.

### Problem: Agent says "I don't have that information" when docs exist

**Cause**: Query intent classification may be wrong

**Check**:
```typescript
const intent = await classifyIntentWithModel(streamModel, query);
// Check if needsDocs = true
```

If `needsDocs = false`, the system skips retrieval entirely.

**Solution**: Adjust classification patterns or improve query understanding.

## Performance Considerations

**Current performance**:
- ~500 chunks indexed in <100ms
- Token-based search is O(n×m) where n=chunks, m=tokens
- Typically <50ms for search with 500 chunks

**Bottlenecks**:
- First query after restart (builds cache)
- Large queries with many tokens
- Very large documentation corpus (>1000 chunks)

**Optimization opportunities**:
1. Pre-compute token frequencies at index time
2. Use inverted index for faster token lookups
3. Cache search results for common queries
4. Implement query deduplication

## Future Improvements

### 1. Vector Embeddings (Semantic Search)

**Current limitation**: Token matching can't handle synonyms or semantic similarity

**Example**:
- Query: "How do I mark a load as ready?"
- Doc section: "Update Prep Status"
- Problem: No token overlap between "mark ready" and "prep status"

**Solution**: Use vector embeddings (e.g., OpenAI embeddings, Sentence Transformers)
- Embed all chunks at index time
- Embed query at search time
- Cosine similarity for ranking

**Trade-offs**:
- ✅ Better semantic matching
- ✅ Handles synonyms and paraphrasing
- ❌ Slower (embedding API calls)
- ❌ More complex (vector database needed)
- ❌ Less explainable (why did this rank high?)

### 2. Hybrid Search

Combine token matching + vector embeddings:
```
final_score = (0.5 × token_score) + (0.5 × semantic_score)
```

Best of both worlds:
- Keyword precision from token matching
- Semantic understanding from embeddings

### 3. Reranking

Two-stage retrieval:
1. Fast retrieval: Get top 50 candidates (token matching)
2. Rerank: Use cross-encoder model to rerank top 50 → top 8

More accurate but slower.

### 4. User Feedback Loop

Track when users indicate wrong answers:
- "That's not correct" button
- Thumbs down on responses
- Manual corrections

Use feedback to:
- Identify problematic queries
- Tune scoring weights
- Find documentation gaps

### 5. Query Expansion

Expand query with synonyms before search:
- "request sanity check" → ["request", "ask for", "initiate", "sanity", "check", "verification"]

Improves recall but may reduce precision.

## Testing the RAG System

See `docs/agent/testing.md` for the complete testing workflow.

**Quick validation**:
1. Ask a question
2. Check logs for retrieved docs
3. Verify correct doc ranks in top 3
4. Confirm answer matches doc content

**Systematic testing**:
1. Work through all app features
2. Ask agent about each feature
3. Compare answer to actual implementation
4. Update docs or tune retrieval as needed

## Related Documentation

- `docs/agent/testing.md` - How to test the agent and iterate on docs
- `services/ge-sync/docs/` - Technical implementation details
- `docs/warehouse/` - Warehouse operational documentation (primary corpus)
- `docs/ge-dms/` - GE DMS documentation (secondary corpus)

## Summary

Our RAG system:
- ✅ **Simple**: Token-based search, no external dependencies
- ✅ **Fast**: In-memory search, <50ms typically
- ✅ **Explainable**: Clear scoring logic, easy to debug
- ✅ **Tunable**: Multipliers and filters adjust ranking
- ✅ **Effective**: Correctly ranks relevant docs when tuned

**Key insight**: The quality of RAG output depends equally on:
1. **Retrieval quality** (are the right docs found?)
2. **Documentation quality** (do the docs contain accurate, step-by-step info?)
3. **Generation quality** (does the LLM follow instructions?)

Improve all three iteratively through testing and refinement.
