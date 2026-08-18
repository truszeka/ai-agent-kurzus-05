# RAG Pipeline HF3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A teljes RAG pipeline megépítése a meglévő Plantbase kurzus-03 kódbázisra: pgvector ingest, HyDE + Cohere rerank keresés, grounded válasz forráshivatkozással, a meglévő `ask` parancsba integrálva fallback-kel.

**Architecture:** A `packages/core` kiegészül két új tool-könyvtárral (`ingest-knowledge/`, `search-knowledge/`) és egy új agent-tel (`rag-agent/`), a meglévő konvenciók szerint (egy tool = egy könyvtár, egy agent = prompt + toolok + loop). A `packages/db` Prisma-sémája bővül a `knowledge_chunks` táblával (pgvector extension). A `apps/cli/src/main.ts` `ask` parancsa runtime-detektálja, hogy van-e tudásbázis, és ha igen, `askRagAgent`-et hív, különben fallback a meglévő `askAgent`-re.

**Tech Stack:** TypeScript strict, Nx monorepo, pnpm, Vitest. Anthropic SDK (`@ai-sdk/anthropic`, `ai`) a generáláshoz + HyDE-hoz. OpenAI `text-embedding-3-small` az embeddinghez (`openai` npm package). Cohere `rerank-english-v3.0` a rerank-hoz (`cohere-ai` npm package). Prisma + pgvector a vektoros tároláshoz.

## Global Constraints

- TypeScript `strict` mód minden fájlban; Zod boundary validáció minden külső API-választ.
- Egy tool = egy könyvtár a `packages/core/src/lib/tools/` alatt; a könyvtár tartalmazza a tool-t, a klienseket, és a teszteket.
- A `ToolOutcome` interfész (`packages/core/src/lib/tools/tool-outcome.ts`) használata kötelező; az `execute` függvények soha nem dobnak kivételt, hiba esetén `isError: true` ToolOutcome-ot adnak vissza.
- `knowledge_chunks` tábla és a pgvector extension CSAK a `packages/db` Prisma-migrációján keresztül kerül a DB-be.
- Chunking: szekció-alapú (B opció) — Markdown `##`/`###` heading határ, `targetWords: 120`, `maxWords: 250`, `overlapSentences: 1`. Minden cikknél fallback bekezdés-bontásra ha nincs `##`.
- Embedding: `text-embedding-3-small`, dim=1536. Rerank: `rerank-english-v3.0`. Válasz-generálás: `claude-sonnet-4-6`. HyDE doc: `claude-haiku-4-5-20251001`.
- Az `OPENAI_API_KEY` és `COHERE_API_KEY` env-változók kötelezőek a RAG útvonalhoz; `loadConfig()` lazy-validálja őket (csak RAG híváskor, nem mindig).
- A RAG nem ír a `products` táblába.
- Min. 3 unit teszt a `chunker.spec.ts`-ben (határesetek: fejléc nélküli doc, max-szó felett, overlap).
- Commit minden task végén.

---

### Task 1: pgvector DB migráció és Prisma séma

**Files:**
- Modify: `packages/db/prisma/schema.prisma`
- Create: `packages/db/prisma/migrations/<timestamp>_add_knowledge_chunks/migration.sql`

**Interfaces:**
- Produces: `KnowledgeChunk` Prisma model, `knowledge_chunks` tábla pgvector extension-nel; `packages/db/generated/client` frissített típusok.

- [ ] **Step 1: pgvector extension engedélyezése a docker Postgres-ben**

```bash
docker compose exec db psql -U plantbase -c "CREATE EXTENSION IF NOT EXISTS vector;"
```

Elvárt kimenet: `CREATE EXTENSION`

- [ ] **Step 2: `schema.prisma` bővítése**

A fájl végére add hozzá (a meglévő `model Product` után):

```prisma
model KnowledgeChunk {
  id          Int      @id @default(autoincrement())
  docPath     String   @map("doc_path")
  docTitle    String   @map("doc_title")
  docSource   String   @map("doc_source")
  category    String
  chunkIndex  Int      @map("chunk_index")
  heading     String?
  content     String
  embedding   Unsupported("vector(1536)")?
  createdAt   DateTime @default(now()) @map("created_at")

  @@map("knowledge_chunks")
}
```

- [ ] **Step 3: Migráció generálása**

```bash
pnpm db:migrate
```

Ha a Prisma panaszkodik az `Unsupported` típusra, adj nevet a migrációnak: `add_knowledge_chunks`. Ellenőrizd, hogy a generált `migration.sql` tartalmazza:

```sql
CREATE EXTENSION IF NOT EXISTS "vector";
CREATE TABLE "knowledge_chunks" ( ... "embedding" vector(1536) ... );
```

- [ ] **Step 4: Prisma kliens újragenerálása**

```bash
pnpm nx build @plantbase/db
```

Elvárt: build success, `packages/db/generated/client` frissült.

- [ ] **Step 5: Commit**

```bash
git add packages/db/prisma/schema.prisma packages/db/prisma/migrations/
git commit -m "feat(db): add knowledge_chunks table with pgvector"
```

---

### Task 2: Config bővítés — OPENAI_API_KEY és COHERE_API_KEY

**Files:**
- Modify: `packages/core/src/lib/config.ts`
- Modify: `packages/core/src/lib/config.spec.ts`
- Modify: `.env.example` (ha létezik a projekt gyökerében)

**Interfaces:**
- Produces: `loadRagConfig(): RagConfig` — külön függvény, ami csak a RAG env-változókat validálja; `RagConfig` interfész `{ openaiApiKey: string; cohereApiKey: string }`.

- [ ] **Step 1: Failing test írása**

A `config.spec.ts` végére add:

```ts
describe('loadRagConfig', () => {
  beforeEach(() => resetConfigCache());

  it('throws ConfigError if OPENAI_API_KEY is missing', () => {
    const orig = process.env['OPENAI_API_KEY'];
    delete process.env['OPENAI_API_KEY'];
    expect(() => loadRagConfig()).toThrow(ConfigError);
    if (orig !== undefined) process.env['OPENAI_API_KEY'] = orig;
  });

  it('throws ConfigError if COHERE_API_KEY is missing', () => {
    process.env['OPENAI_API_KEY'] = 'sk-test';
    const orig = process.env['COHERE_API_KEY'];
    delete process.env['COHERE_API_KEY'];
    expect(() => loadRagConfig()).toThrow(ConfigError);
    if (orig !== undefined) process.env['COHERE_API_KEY'] = orig;
    delete process.env['OPENAI_API_KEY'];
  });

  it('returns both keys when present', () => {
    process.env['OPENAI_API_KEY'] = 'sk-openai-test';
    process.env['COHERE_API_KEY'] = 'cohere-test';
    const cfg = loadRagConfig();
    expect(cfg.openaiApiKey).toBe('sk-openai-test');
    expect(cfg.cohereApiKey).toBe('cohere-test');
    delete process.env['OPENAI_API_KEY'];
    delete process.env['COHERE_API_KEY'];
  });
});
```

- [ ] **Step 2: Teszt futtatása — ellenőrizd, hogy FAIL**

```bash
pnpm nx test @plantbase/core -- run src/lib/config.spec.ts
```

Elvárt: `loadRagConfig is not a function` típusú hiba.

- [ ] **Step 3: Implementáció a `config.ts`-be**

A `loadConfig` után add hozzá:

```ts
const RagConfigSchema = z.object({
  OPENAI_API_KEY: z.string().min(1),
  COHERE_API_KEY: z.string().min(1),
});

export interface RagConfig {
  openaiApiKey: string;
  cohereApiKey: string;
}

let cachedRag: RagConfig | null = null;

export function loadRagConfig(): RagConfig {
  if (cachedRag) return cachedRag;
  const parsed = RagConfigSchema.safeParse(process.env);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const field = issue?.path.join('.') || 'env';
    throw new ConfigError(
      `Hiányzó RAG konfiguráció (${field}): ${issue?.message ?? 'ismeretlen'}. ` +
        'Add meg az OPENAI_API_KEY-t és COHERE_API_KEY-t a .env fájlban.',
    );
  }
  cachedRag = {
    openaiApiKey: parsed.data.OPENAI_API_KEY,
    cohereApiKey: parsed.data.COHERE_API_KEY,
  };
  return cachedRag;
}

export function resetRagConfigCache(): void {
  cachedRag = null;
}
```

A `resetConfigCache` függvényt bővítsd:

```ts
export function resetConfigCache(): void {
  cached = null;
  cachedRag = null;
}
```

- [ ] **Step 4: Tesztek futtatása — ellenőrizd, hogy PASS**

```bash
pnpm nx test @plantbase/core -- run src/lib/config.spec.ts
```

Elvárt: minden config teszt PASS.

- [ ] **Step 5: `.env.example` bővítése**

Ha létezik `.env.example`, add ezeket a sorokat:

```
OPENAI_API_KEY=sk-...        # OpenAI embedding (text-embedding-3-small)
COHERE_API_KEY=...            # Cohere rerank (rerank-english-v3.0)
```

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/lib/config.ts packages/core/src/lib/config.spec.ts .env.example
git commit -m "feat(core): add loadRagConfig for OpenAI and Cohere keys"
```

---

### Task 3: npm függőségek telepítése

**Files:**
- Modify: `packages/core/package.json`

**Interfaces:**
- Produces: `openai` és `cohere-ai` npm csomagok elérhetők a `@plantbase/core`-ban.

- [ ] **Step 1: Csomagok telepítése**

```bash
pnpm add --filter @plantbase/core openai cohere-ai
```

- [ ] **Step 2: Ellenőrzés**

```bash
cat packages/core/package.json | grep -E "openai|cohere"
```

Elvárt: mindkét csomag megjelenik a `dependencies`-ben.

- [ ] **Step 3: Commit**

```bash
git add packages/core/package.json pnpm-lock.yaml
git commit -m "feat(core): add openai and cohere-ai dependencies"
```

---

### Task 4: Chunker (B szekció-alapú stratégia) + unit tesztek

**Files:**
- Create: `packages/core/src/lib/tools/ingest-knowledge/chunker.ts`
- Create: `packages/core/src/lib/tools/ingest-knowledge/chunker.spec.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface Chunk {
    docPath: string;
    docTitle: string;
    docSource: string;
    category: string;
    chunkIndex: number;
    heading: string | null;
    content: string;
  }
  export function chunkDocument(raw: string, docPath: string): Chunk[]
  ```

- [ ] **Step 1: Failing tesztek írása (`chunker.spec.ts`)**

```ts
import { describe, it, expect } from 'vitest';
import { chunkDocument } from './chunker.js';

const FRONTMATTER = `---
title: Test Plant Care
source: https://example.com/test
category: the-basics
---`;

describe('chunkDocument', () => {
  it('returns empty array for empty content', () => {
    const result = chunkDocument(`${FRONTMATTER}\n\n`, 'seed/knowledge/test.md');
    expect(result).toEqual([]);
  });

  it('splits on ## headings and attaches heading to chunk', () => {
    const raw = `${FRONTMATTER}

# Main Title

Intro paragraph.

## Watering

Water once a week. Keep the soil moist but not soggy. Avoid letting it dry out completely.

## Light Requirements

Place in bright indirect light. Avoid direct afternoon sun which can scorch the leaves.
`;
    const chunks = chunkDocument(raw, 'seed/knowledge/test.md');
    expect(chunks.length).toBeGreaterThanOrEqual(2);
    const wateringChunk = chunks.find((c) => c.heading === 'Watering');
    expect(wateringChunk).toBeDefined();
    expect(wateringChunk!.content).toContain('Water once a week');
    expect(wateringChunk!.docTitle).toBe('Test Plant Care');
    expect(wateringChunk!.category).toBe('the-basics');
  });

  it('falls back to paragraph splitting when no ## headings', () => {
    const raw = `${FRONTMATTER}

# Title Only

First paragraph with enough words to be standalone content here.

Second paragraph also with enough words to qualify as its own chunk unit.
`;
    const chunks = chunkDocument(raw, 'seed/knowledge/test.md');
    expect(chunks.length).toBeGreaterThanOrEqual(1);
    chunks.forEach((c) => expect(c.heading).toBeNull());
  });

  it('assigns sequential chunkIndex values starting at 0', () => {
    const raw = `${FRONTMATTER}

## Section A

Content for section A with some text here.

## Section B

Content for section B with some other text.
`;
    const chunks = chunkDocument(raw, 'seed/knowledge/test.md');
    chunks.forEach((c, i) => expect(c.chunkIndex).toBe(i));
  });

  it('carries over last sentence of chunk as overlap to next chunk', () => {
    const raw = `${FRONTMATTER}

## First Section

Sentence one is here. Sentence two follows it. This is the final sentence of first section.

## Second Section

Beginning of second section content here.
`;
    const chunks = chunkDocument(raw, 'seed/knowledge/test.md');
    if (chunks.length >= 2) {
      const lastSentenceOfFirst = 'This is the final sentence of first section.';
      expect(chunks[1]!.content).toContain(lastSentenceOfFirst);
    }
  });

  it('sets docPath, docSource from frontmatter', () => {
    const raw = `${FRONTMATTER}

## Section

Some content here.
`;
    const chunks = chunkDocument(raw, 'seed/knowledge/test.md');
    expect(chunks[0]!.docPath).toBe('seed/knowledge/test.md');
    expect(chunks[0]!.docSource).toBe('https://example.com/test');
  });
});
```

- [ ] **Step 2: Tesztek futtatása — ellenőrizd, hogy FAIL**

```bash
pnpm nx test @plantbase/core -- run src/lib/tools/ingest-knowledge/chunker.spec.ts
```

Elvárt: `Cannot find module './chunker.js'`

- [ ] **Step 3: Chunker implementáció (`chunker.ts`)**

```ts
import { parse as parseYaml } from 'yaml';

export interface Chunk {
  docPath: string;
  docTitle: string;
  docSource: string;
  category: string;
  chunkIndex: number;
  heading: string | null;
  content: string;
}

interface Frontmatter {
  title: string;
  source: string;
  category: string;
}

const TARGET_WORDS = 120;
const MAX_WORDS = 250;

function parseFrontmatter(raw: string): { fm: Frontmatter; body: string } {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) {
    return {
      fm: { title: '', source: '', category: '' },
      body: raw,
    };
  }
  const fm = parseYaml(match[1]!) as Frontmatter;
  return { fm, body: match[2]! };
}

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function lastSentence(text: string): string {
  const sentences = text.match(/[^.!?]+[.!?]+/g);
  return sentences ? (sentences[sentences.length - 1]?.trim() ?? '') : '';
}

function paragraphFallback(
  body: string,
  fm: Frontmatter,
  docPath: string,
): Chunk[] {
  const paragraphs = body.split(/\n\n+/).map((p) => p.trim()).filter(Boolean);
  const chunks: Chunk[] = [];
  let buffer = '';

  for (const para of paragraphs) {
    if (para.startsWith('#')) continue;
    const candidate = buffer ? `${buffer}\n\n${para}` : para;
    if (wordCount(candidate) > MAX_WORDS && buffer) {
      chunks.push({
        docPath,
        docTitle: fm.title,
        docSource: fm.source,
        category: fm.category,
        chunkIndex: chunks.length,
        heading: null,
        content: buffer.trim(),
      });
      buffer = para;
    } else {
      buffer = candidate;
    }
  }
  if (buffer.trim() && wordCount(buffer) > 5) {
    chunks.push({
      docPath,
      docTitle: fm.title,
      docSource: fm.source,
      category: fm.category,
      chunkIndex: chunks.length,
      heading: null,
      content: buffer.trim(),
    });
  }
  return chunks;
}

export function chunkDocument(raw: string, docPath: string): Chunk[] {
  const { fm, body } = parseFrontmatter(raw);

  // Keresünk ## vagy ### szintű headingeket
  const sectionRegex = /^(#{2,3})\s+(.+)$/m;
  if (!sectionRegex.test(body)) {
    return paragraphFallback(body, fm, docPath);
  }

  // Szekciókra bontás ## / ### mentén
  const lines = body.split('\n');
  const sections: Array<{ heading: string; lines: string[] }> = [];
  let currentHeading = '';
  let currentLines: string[] = [];

  for (const line of lines) {
    const headingMatch = line.match(/^#{2,3}\s+(.+)$/);
    if (headingMatch) {
      if (currentLines.some((l) => l.trim())) {
        sections.push({ heading: currentHeading, lines: currentLines });
      }
      currentHeading = headingMatch[1]!.trim();
      currentLines = [];
    } else {
      currentLines.push(line);
    }
  }
  if (currentLines.some((l) => l.trim())) {
    sections.push({ heading: currentHeading, lines: currentLines });
  }

  if (sections.length === 0) {
    return paragraphFallback(body, fm, docPath);
  }

  const chunks: Chunk[] = [];
  let prevOverlap = '';

  for (const section of sections) {
    const sectionText = section.lines.join('\n').trim();
    if (!sectionText) continue;

    const contentWithOverlap = prevOverlap
      ? `${prevOverlap}\n\n${sectionText}`
      : sectionText;

    if (wordCount(contentWithOverlap) > MAX_WORDS) {
      // Hosszú szekció: bekezdés-alapon feldaraboljuk
      const paras = sectionText.split(/\n\n+/).map((p) => p.trim()).filter(Boolean);
      let buffer = prevOverlap;
      for (const para of paras) {
        const candidate = buffer ? `${buffer}\n\n${para}` : para;
        if (wordCount(candidate) > MAX_WORDS && buffer) {
          chunks.push({
            docPath,
            docTitle: fm.title,
            docSource: fm.source,
            category: fm.category,
            chunkIndex: chunks.length,
            heading: section.heading || null,
            content: buffer.trim(),
          });
          prevOverlap = lastSentence(buffer);
          buffer = `${prevOverlap}\n\n${para}`;
        } else {
          buffer = candidate;
        }
      }
      if (buffer.trim() && wordCount(buffer) > 5) {
        chunks.push({
          docPath,
          docTitle: fm.title,
          docSource: fm.source,
          category: fm.category,
          chunkIndex: chunks.length,
          heading: section.heading || null,
          content: buffer.trim(),
        });
        prevOverlap = lastSentence(buffer);
      }
    } else {
      chunks.push({
        docPath,
        docTitle: fm.title,
        docSource: fm.source,
        category: fm.category,
        chunkIndex: chunks.length,
        heading: section.heading || null,
        content: contentWithOverlap,
      });
      prevOverlap = lastSentence(sectionText);
    }
  }

  return chunks;
}
```

- [ ] **Step 4: `yaml` dependency telepítése (ha nem létezik)**

```bash
pnpm add --filter @plantbase/core yaml
```

- [ ] **Step 5: Tesztek futtatása — ellenőrizd, hogy PASS**

```bash
pnpm nx test @plantbase/core -- run src/lib/tools/ingest-knowledge/chunker.spec.ts
```

Elvárt: minden teszt PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/lib/tools/ingest-knowledge/
git commit -m "feat(core): section-based chunker with overlap and paragraph fallback"
```

---

### Task 5: Embedder — OpenAI text-embedding-3-small

**Files:**
- Create: `packages/core/src/lib/tools/ingest-knowledge/embedder.ts`

**Interfaces:**
- Consumes: `loadRagConfig(): RagConfig` (Task 2)
- Produces:
  ```ts
  export async function embedTexts(texts: string[]): Promise<number[][]>
  export async function embedText(text: string): Promise<number[]>
  ```

- [ ] **Step 1: `embedder.ts` implementáció**

```ts
import OpenAI from 'openai';
import { loadRagConfig } from '../../config.js';

let client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!client) {
    const { openaiApiKey } = loadRagConfig();
    client = new OpenAI({ apiKey: openaiApiKey });
  }
  return client;
}

const MODEL = 'text-embedding-3-small';
const BATCH_SIZE = 100;

export async function embedTexts(texts: string[]): Promise<number[][]> {
  const openai = getClient();
  const results: number[][] = [];
  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    const response = await openai.embeddings.create({
      model: MODEL,
      input: batch,
    });
    for (const item of response.data) {
      results.push(item.embedding);
    }
  }
  return results;
}

export async function embedText(text: string): Promise<number[]> {
  const [embedding] = await embedTexts([text]);
  if (!embedding) throw new Error('Embedding visszatérési hiba: üres eredmény');
  return embedding;
}
```

- [ ] **Step 2: Typecheck**

```bash
pnpm nx typecheck @plantbase/core 2>&1 | head -20
```

Elvárt: nincs hiba az `embedder.ts`-ben.

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/lib/tools/ingest-knowledge/embedder.ts
git commit -m "feat(core): OpenAI text-embedding-3-small embedder"
```

---

### Task 6: DB vector réteg — pgvector írás/olvasás

**Files:**
- Create: `packages/core/src/lib/tools/ingest-knowledge/db-vector.ts`

**Interfaces:**
- Consumes: `DATABASE_URL` env var (read-write Prisma connection), `knowledge_chunks` tábla (Task 1)
- Produces:
  ```ts
  export async function upsertChunks(chunks: ChunkWithEmbedding[]): Promise<void>
  export async function similaritySearch(embedding: number[], topK: number): Promise<KnowledgeRow[]>
  export async function knowledgeChunksExist(): Promise<boolean>
  export async function clearKnowledgeChunks(): Promise<void>

  export interface ChunkWithEmbedding extends Chunk {
    embedding: number[];
  }

  export interface KnowledgeRow {
    docPath: string;
    docTitle: string;
    docSource: string;
    category: string;
    heading: string | null;
    content: string;
    score: number;
  }
  ```

- [ ] **Step 1: `db-vector.ts` implementáció**

```ts
import { Pool } from 'pg';
import { z } from 'zod';
import type { Chunk } from './chunker.js';

export interface ChunkWithEmbedding extends Chunk {
  embedding: number[];
}

export interface KnowledgeRow {
  docPath: string;
  docTitle: string;
  docSource: string;
  category: string;
  heading: string | null;
  content: string;
  score: number;
}

const RowSchema = z.object({
  doc_path: z.string(),
  doc_title: z.string(),
  doc_source: z.string(),
  category: z.string(),
  heading: z.string().nullable(),
  content: z.string(),
  score: z.coerce.number(),
});

let pool: Pool | null = null;

function getPool(): Pool {
  if (!pool) {
    const url = process.env['DATABASE_URL'];
    if (!url) throw new Error('DATABASE_URL nincs beállítva');
    pool = new Pool({ connectionString: url });
  }
  return pool;
}

export async function upsertChunks(chunks: ChunkWithEmbedding[]): Promise<void> {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    for (const chunk of chunks) {
      const vec = `[${chunk.embedding.join(',')}]`;
      await client.query(
        `INSERT INTO knowledge_chunks
           (doc_path, doc_title, doc_source, category, chunk_index, heading, content, embedding)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8::vector)
         ON CONFLICT (doc_path, chunk_index) DO UPDATE SET
           doc_title = EXCLUDED.doc_title,
           doc_source = EXCLUDED.doc_source,
           heading = EXCLUDED.heading,
           content = EXCLUDED.content,
           embedding = EXCLUDED.embedding`,
        [
          chunk.docPath,
          chunk.docTitle,
          chunk.docSource,
          chunk.category,
          chunk.chunkIndex,
          chunk.heading,
          chunk.content,
          vec,
        ],
      );
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function similaritySearch(
  embedding: number[],
  topK: number,
): Promise<KnowledgeRow[]> {
  const vec = `[${embedding.join(',')}]`;
  const result = await getPool().query(
    `SELECT doc_path, doc_title, doc_source, category, heading, content,
            1 - (embedding <=> $1::vector) AS score
     FROM knowledge_chunks
     ORDER BY embedding <=> $1::vector
     LIMIT $2`,
    [vec, topK],
  );
  return result.rows.map((row: unknown) => {
    const parsed = RowSchema.parse(row);
    return {
      docPath: parsed.doc_path,
      docTitle: parsed.doc_title,
      docSource: parsed.doc_source,
      category: parsed.category,
      heading: parsed.heading,
      content: parsed.content,
      score: parsed.score,
    };
  });
}

export async function knowledgeChunksExist(): Promise<boolean> {
  const result = await getPool().query(
    'SELECT EXISTS(SELECT 1 FROM knowledge_chunks LIMIT 1) AS exists',
  );
  return (result.rows[0] as { exists: boolean }).exists;
}

export async function clearKnowledgeChunks(): Promise<void> {
  await getPool().query('TRUNCATE knowledge_chunks');
}

export async function closeVectorPool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
```

- [ ] **Step 2: `UNIQUE` constraint hozzáadása a migrációhoz**

A `packages/db/prisma/schema.prisma`-ban a `KnowledgeChunk` modellhez add:

```prisma
  @@unique([docPath, chunkIndex], map: "knowledge_chunks_doc_path_chunk_index_key")
```

Aztán futtasd újra a migrációt:

```bash
pnpm db:migrate
```

- [ ] **Step 3: Typecheck**

```bash
pnpm nx typecheck @plantbase/core 2>&1 | head -20
```

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/lib/tools/ingest-knowledge/db-vector.ts packages/db/prisma/
git commit -m "feat(core): pgvector db layer for knowledge chunks upsert and similarity search"
```

---

### Task 7: Ingest tool + CLI ingest parancs

**Files:**
- Create: `packages/core/src/lib/tools/ingest-knowledge/ingest-knowledge-tool.ts`
- Modify: `apps/cli/src/main.ts`
- Modify: `packages/core/src/index.ts`

**Interfaces:**
- Consumes: `chunkDocument()` (Task 4), `embedTexts()` (Task 5), `upsertChunks()` (Task 6)
- Produces: `ingestKnowledgeBase(knowledgeDir: string, options?: { print?: boolean }): Promise<IngestResult>`
  ```ts
  export interface IngestResult {
    totalDocs: number;
    totalChunks: number;
    skipped: number;
  }
  ```

- [ ] **Step 1: `ingest-knowledge-tool.ts` implementáció**

```ts
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { chunkDocument } from './chunker.js';
import { embedTexts } from './embedder.js';
import { upsertChunks, type ChunkWithEmbedding } from './db-vector.js';

export interface IngestResult {
  totalDocs: number;
  totalChunks: number;
  skipped: number;
}

export async function ingestKnowledgeBase(
  knowledgeDir: string,
  options: { print?: boolean } = {},
): Promise<IngestResult> {
  const files = (await readdir(knowledgeDir)).filter((f) => f.endsWith('.md'));
  let totalChunks = 0;
  let skipped = 0;

  for (let i = 0; i < files.length; i++) {
    const file = files[i]!;
    const docPath = `seed/knowledge/${file}`;
    const raw = await readFile(join(knowledgeDir, file), 'utf-8');
    const chunks = chunkDocument(raw, docPath);

    if (chunks.length === 0) {
      skipped++;
      continue;
    }

    if (options.print) {
      process.stdout.write(
        `[${i + 1}/${files.length}] ${file} → ${chunks.length} chunk\n`,
      );
    }

    const texts = chunks.map((c) => {
      const headingPrefix = c.heading ? `${c.heading}\n\n` : '';
      return `${headingPrefix}${c.content}`;
    });

    const embeddings = await embedTexts(texts);
    const chunksWithEmbeddings: ChunkWithEmbedding[] = chunks.map((c, idx) => ({
      ...c,
      embedding: embeddings[idx]!,
    }));

    await upsertChunks(chunksWithEmbeddings);
    totalChunks += chunks.length;
  }

  return { totalDocs: files.length - skipped, totalChunks, skipped };
}
```

- [ ] **Step 2: CLI `knowledge-ingest` parancs hozzáadása a `main.ts`-be**

A meglévő `ingest` parancs utáni blokk után add (a `program.parseAsync` sor elé):

```ts
program
  .command('knowledge-ingest')
  .description(
    'Betölti a seed/knowledge/ Markdown cikkeket pgvector-ba (idempotens).',
  )
  .option('--quiet', 'ne írja ki a haladást', false)
  .action(async (options: { quiet: boolean }) => {
    try {
      loadConfig();
    } catch (error: unknown) {
      if (error instanceof ConfigError) {
        console.error(`plantbase: ${error.message}`);
        process.exit(1);
      }
      throw error;
    }

    const { ingestKnowledgeBase } = await import('@plantbase/core');
    const { join } = await import('node:path');
    const knowledgeDir = join(process.cwd(), 'seed', 'knowledge');

    try {
      const result = await ingestKnowledgeBase(knowledgeDir, {
        print: !options.quiet,
      });
      console.log(
        `\nKész: ${result.totalDocs} dokumentum, ${result.totalChunks} chunk betöltve` +
          (result.skipped > 0 ? `, ${result.skipped} kihagyva (üres)` : '') +
          '.',
      );
    } finally {
      const { closeVectorPool } = await import('@plantbase/core');
      await closeVectorPool();
    }
  });
```

Az importokat a `main.ts` tetejére add (a meglévő import-blokk bővítéseként):

```ts
import {
  askAgent,
  askIngestAgent,
  loadConfig,
  ConfigError,
  closeReadOnlyPool,
  closeReadWritePool,
  setWatchLog,
  ingestKnowledgeBase,   // ← új
  closeVectorPool,        // ← új
} from '@plantbase/core';
```

- [ ] **Step 3: Export bővítése az `index.ts`-ben**

```ts
// RAG — ingest
export * from './lib/tools/ingest-knowledge/chunker.js';
export * from './lib/tools/ingest-knowledge/embedder.js';
export * from './lib/tools/ingest-knowledge/db-vector.js';
export * from './lib/tools/ingest-knowledge/ingest-knowledge-tool.js';
```

- [ ] **Step 4: Typecheck**

```bash
pnpm nx typecheck @plantbase/core && pnpm nx typecheck @plantbase/cli 2>&1 | head -30
```

- [ ] **Step 5: Manuális ingest teszt (csak ha van .env)**

```bash
pnpm cli knowledge-ingest
```

Elvárt kimenet: `[1/202] ask-the-sill__...md → N chunk` sorok, majd `Kész: 202 dokumentum, XXXX chunk betöltve.`

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/lib/tools/ingest-knowledge/ packages/core/src/index.ts apps/cli/src/main.ts
git commit -m "feat(core,cli): knowledge-ingest command — chunk + embed + pgvector upsert"
```

---

### Task 8: HyDE generator + Cohere rerank kliens

**Files:**
- Create: `packages/core/src/lib/tools/search-knowledge/hyde-generator.ts`
- Create: `packages/core/src/lib/tools/search-knowledge/cohere-rerank.ts`

**Interfaces:**
- Consumes: `loadConfig(): Config` (Anthropic key), `loadRagConfig(): RagConfig` (Cohere key), `KnowledgeRow` (Task 6)
- Produces:
  ```ts
  // hyde-generator.ts
  export async function generateHyDE(question: string): Promise<string>

  // cohere-rerank.ts
  export async function rerankChunks(
    query: string,
    chunks: KnowledgeRow[],
    topN: number,
  ): Promise<KnowledgeRow[]>
  ```

- [ ] **Step 1: `hyde-generator.ts` implementáció**

```ts
import { generateText } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { loadConfig } from '../../config.js';

const HYDE_MODEL = 'claude-haiku-4-5-20251001';

export async function generateHyDE(question: string): Promise<string> {
  const { apiKey } = loadConfig();
  const anthropic = createAnthropic({ apiKey });

  const { text } = await generateText({
    model: anthropic(HYDE_MODEL),
    maxOutputTokens: 300,
    system:
      'You are a plant care expert. Write a short, factual paragraph (2-4 sentences) ' +
      'that would be found in a plant care article and directly answers the given question. ' +
      'Write in English. Be specific and practical.',
    prompt: question,
  });

  return text.trim();
}
```

- [ ] **Step 2: `cohere-rerank.ts` implementáció**

```ts
import { CohereClient } from 'cohere-ai';
import { loadRagConfig } from '../../config.js';
import type { KnowledgeRow } from '../ingest-knowledge/db-vector.js';

let client: CohereClient | null = null;

function getClient(): CohereClient {
  if (!client) {
    const { cohereApiKey } = loadRagConfig();
    client = new CohereClient({ token: cohereApiKey });
  }
  return client;
}

const RERANK_MODEL = 'rerank-english-v3.0';

export async function rerankChunks(
  query: string,
  chunks: KnowledgeRow[],
  topN: number,
): Promise<KnowledgeRow[]> {
  if (chunks.length === 0) return [];

  const cohere = getClient();
  const response = await cohere.rerank({
    model: RERANK_MODEL,
    query,
    documents: chunks.map((c) => c.content),
    topN: Math.min(topN, chunks.length),
  });

  return response.results.map((result) => ({
    ...chunks[result.index]!,
    score: result.relevanceScore,
  }));
}
```

- [ ] **Step 3: Typecheck**

```bash
pnpm nx typecheck @plantbase/core 2>&1 | head -20
```

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/lib/tools/search-knowledge/
git commit -m "feat(core): HyDE generator (haiku) and Cohere rerank client"
```

---

### Task 9: search-knowledge tool

**Files:**
- Create: `packages/core/src/lib/tools/search-knowledge/search-knowledge-tool.ts`
- Modify: `packages/core/src/index.ts`

**Interfaces:**
- Consumes: `generateHyDE()` (Task 8), `embedText()` (Task 5), `similaritySearch()` (Task 6), `rerankChunks()` (Task 8)
- Produces:
  ```ts
  export function searchKnowledgeTool(report: ToolReporter): Tool
  // Tool input: { question: string }
  // Tool output (content-ben): top-5 chunk szövege forrással, vagy "Nincs releváns találat."
  ```

- [ ] **Step 1: `search-knowledge-tool.ts` implementáció**

```ts
import { tool } from 'ai';
import { z } from 'zod';
import type { ToolReporter } from '../../tools/tool-outcome.js';
import { generateHyDE } from './hyde-generator.js';
import { rerankChunks } from './cohere-rerank.js';
import { embedText } from '../ingest-knowledge/embedder.js';
import { similaritySearch } from '../ingest-knowledge/db-vector.js';

const SIMILARITY_TOP_K = 20;
const RERANK_TOP_N = 5;
const MIN_SCORE = 0.3;

export function searchKnowledgeTool(report: ToolReporter) {
  return tool({
    description:
      'Keresés a növénygondozási tudásbázisban. Adj meg egy kérdést, ' +
      'a tool visszaadja a legrelevánsabb cikkrészleteket forrással.',
    parameters: z.object({
      question: z
        .string()
        .min(3)
        .describe('A megválaszolandó kérdés, lehetőleg angolul.'),
    }),
    execute: async (input, { toolCallId }) => {
      const toolName = 'searchKnowledge';
      try {
        const hydeDoc = await generateHyDE(input.question);
        const hydeEmbedding = await embedText(hydeDoc);
        const rawResults = await similaritySearch(hydeEmbedding, SIMILARITY_TOP_K);

        if (rawResults.length === 0) {
          const outcome = {
            content: 'Nincs releváns találat a tudásbázisban.',
            isError: false,
            summary: 'Találat: 0',
            rowCount: 0,
          };
          report(toolCallId, toolName, input, outcome);
          return outcome.content;
        }

        const reranked = await rerankChunks(input.question, rawResults, RERANK_TOP_N);
        const relevant = reranked.filter((r) => r.score >= MIN_SCORE);

        if (relevant.length === 0) {
          const outcome = {
            content: 'Nincs elegendően releváns találat a tudásbázisban.',
            isError: false,
            summary: 'Relevancia alatt: összes találat',
            rowCount: 0,
          };
          report(toolCallId, toolName, input, outcome);
          return outcome.content;
        }

        const formatted = relevant
          .map(
            (r, i) =>
              `[${i + 1}] Forrás: "${r.docTitle}" (${r.docPath})\n` +
              (r.heading ? `Szekció: ${r.heading}\n` : '') +
              `${r.content}`,
          )
          .join('\n\n---\n\n');

        const outcome = {
          content: formatted,
          isError: false,
          summary: `${relevant.length} releváns chunk (HyDE + rerank)`,
          rowCount: relevant.length,
        };
        report(toolCallId, toolName, input, outcome);
        return outcome.content;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        const outcome = {
          content: `Keresési hiba: ${message}`,
          isError: true,
          summary: `Hiba: ${message}`,
          rowCount: null,
        };
        report(toolCallId, toolName, input, outcome);
        return outcome.content;
      }
    },
  });
}
```

- [ ] **Step 2: Export bővítése az `index.ts`-ben**

```ts
// RAG — keresés
export * from './lib/tools/search-knowledge/hyde-generator.js';
export * from './lib/tools/search-knowledge/cohere-rerank.js';
export * from './lib/tools/search-knowledge/search-knowledge-tool.js';
```

- [ ] **Step 3: Typecheck**

```bash
pnpm nx typecheck @plantbase/core 2>&1 | head -20
```

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/lib/tools/search-knowledge/ packages/core/src/index.ts
git commit -m "feat(core): search-knowledge tool (HyDE + embedding + rerank)"
```

---

### Task 10: RAG agent

**Files:**
- Create: `packages/core/src/lib/agents/rag-agent/rag-prompt.ts`
- Create: `packages/core/src/lib/agents/rag-agent/rag-agent.ts`
- Modify: `packages/core/src/index.ts`

**Interfaces:**
- Consumes: `runAgentLoop()` (agent-loop.ts), `searchKnowledgeTool()` (Task 9), `loadConfig(): Config`
- Produces:
  ```ts
  export async function askRagAgent(
    question: string,
    options?: AskOptions,
  ): Promise<AskResult>
  ```

- [ ] **Step 1: `rag-prompt.ts` implementáció**

```ts
export function buildRagPrompt(): string {
  return `
<role>
Te a Plantbase tudásbázis-asszisztens vagy: növénygondozási kérdésekre válaszolsz
cikkrészletek alapján. Magyar nyelvű válaszokat adsz.
</role>

<task>
Hívd meg a searchKnowledge toolt a kérdéssel (angolul fogalmazd meg a tool-nak),
és a visszakapott cikkrészletek alapján adj pontos, forrásokra hivatkozó választ.
</task>

<grounding_rules>
- Minden válasz végén sorold fel a felhasznált forrásokat: "Forrás: [cím] ([fájlnév])"
- Ha a tool "Nincs releváns találat" vagy "Nincs elegendően releváns találat" üzenetet ad,
  NE találj ki választ — mondd meg, hogy erről a témáról nincs információd a tudásbázisban.
- Ne adj meg olyan URL-t vagy forrást, ami nem szerepelt a tool visszajelzésében.
- Ha a tool hibát ad vissza, jelezd, hogy a keresés nem sikerült, és kérd a kérdés
  pontosítását.
</grounding_rules>

<behavior>
- A tool-t MINDIG hívd meg; ne válaszolj a saját tudásodból a keresési lépés kihagyásával.
- Ha a találat nem elég specifikus, jelezd ezt a válasz elején.
- Légy tömör: 3-6 mondat + forráslista.
</behavior>

<tools>
- searchKnowledge(question): keresés a növénygondozási tudásbázisban. A question paramétert
  angolul add meg (jobb szemantikai embedding-minőség).
</tools>
`.trim();
}
```

- [ ] **Step 2: `rag-agent.ts` implementáció**

```ts
import type { ToolSet } from 'ai';
import { runAgentLoop, type AskOptions, type AskResult } from '../agent-loop.js';
import { searchKnowledgeTool } from '../../tools/search-knowledge/search-knowledge-tool.js';
import { buildRagPrompt } from './rag-prompt.js';

export async function askRagAgent(
  question: string,
  options: AskOptions = {},
): Promise<AskResult> {
  const trimmed = question.trim();
  if (trimmed === '') {
    throw new Error('Üres kérdést nem lehet feltenni.');
  }

  return runAgentLoop(
    trimmed,
    {
      systemPrompt: buildRagPrompt(),
      buildTools: (report): ToolSet => ({
        searchKnowledge: searchKnowledgeTool(report),
      }),
      maxSteps: 4,
      maxOutputTokens: 1024,
      emptyAnswer:
        'Nem sikerült választ adni. Próbáld pontosítani a kérdést.',
    },
    options,
  );
}
```

- [ ] **Step 3: Export bővítése az `index.ts`-ben**

```ts
// RAG — agent
export * from './lib/agents/rag-agent/rag-agent.js';
export * from './lib/agents/rag-agent/rag-prompt.js';
```

- [ ] **Step 4: Typecheck**

```bash
pnpm nx typecheck @plantbase/core 2>&1 | head -20
```

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/lib/agents/rag-agent/ packages/core/src/index.ts
git commit -m "feat(core): RAG agent with grounding rules and searchKnowledge tool"
```

---

### Task 11: CLI `ask` parancs bővítése RAG fallback-kel

**Files:**
- Modify: `apps/cli/src/main.ts`

**Interfaces:**
- Consumes: `askRagAgent()` (Task 10), `knowledgeChunksExist()` (Task 6), `askAgent()` (meglévő)
- Produces: `pnpm cli ask "kérdés"` automatikusan RAG-et hív ha van tudásbázis, különben SQL-agentet.

- [ ] **Step 1: Import bővítése a `main.ts`-ben**

Módosítsd a meglévő importot:

```ts
import {
  askAgent,
  askRagAgent,                // ← új
  knowledgeChunksExist,       // ← új
  askIngestAgent,
  ingestKnowledgeBase,
  loadConfig,
  ConfigError,
  closeReadOnlyPool,
  closeReadWritePool,
  closeVectorPool,
  setWatchLog,
} from '@plantbase/core';
```

- [ ] **Step 2: Az `ask` action bővítése**

Az `ask` parancs `.action` callback-jében a `question !== ''` ágban cseréld le a hívást:

```ts
} else {
  const useRag = await knowledgeChunksExist();
  const result = useRag
    ? await askRagAgent(question, { print: !options.quiet })
    : await askAgent(question, { print: !options.quiet });
  if (options.quiet) {
    console.log(result.answer);
  }
}
```

A `finally` blokkban add a vector pool zárását:

```ts
} finally {
  await Promise.all([closeReadOnlyPool(), closeVectorPool()]);
}
```

- [ ] **Step 3: Typecheck és build**

```bash
pnpm nx typecheck @plantbase/cli && pnpm nx build @plantbase/cli 2>&1 | tail -10
```

- [ ] **Step 4: Manuális teszt** (csak ha van `.env` és be van töltve a tudásbázis)

```bash
pnpm cli ask "How often should I water a ZZ plant?"
```

Elvárt: magyar válasz forráslistával, pl. `Forrás: "The Ultimate Low Light Plant" (seed/knowledge/ask-the-sill__best-low-light-plant.md)`

```bash
pnpm cli ask "What is the exact gram weight of a pineapple fruit?"
```

Elvárt: az agent jelzi, hogy erről nincs adat a tudásbázisban (negatív teszt).

- [ ] **Step 5: Commit**

```bash
git add apps/cli/src/main.ts
git commit -m "feat(cli): ask command auto-routes to RAG agent when knowledge base is loaded"
```

---

### Task 12: Dokumentáció — README, golden set, ARCHITEKTURA.md, költségbecslés

**Files:**
- Create: `docs/golden-set.md`
- Create: `docs/ARCHITEKTURA.md`
- Modify: `README.md`

**Interfaces:**
- Produces: a leadandók dokumentációs részei (CAP-6, CAP-7, CAP-8, CAP-4 indoklás).

- [ ] **Step 1: Golden set futtatása és dokumentálása**

Futtasd le mind a 7 kérdést kétféleképpen. Raw (csak embedding, rerank nélkül — ehhez ideiglenesen kommenteld ki a `rerankChunks` hívást a `search-knowledge-tool.ts`-ben és térj vissza a top-5 raw találattal), majd full pipeline-nal.

Töltsd ki a `docs/golden-set.md` sablont:

```markdown
# Golden Set — RAG Pipeline HF3

## Kérdések és eredmények

| # | Kérdés | Raw top-3 forrás | Full pipeline top-3 forrás | Rerank átrendezett? | Megjegyzés |
|---|--------|-----------------|---------------------------|---------------------|------------|
| 1 | How often should I water a ZZ plant? | ... | ... | Igen/Nem | ... |
| 2 | What plants are safe for cats? | ... | ... | Igen/Nem | ... |
| 3 | Which plants survive in low light? | ... | ... | Igen/Nem | ... |
| 4 | How do I deal with fungus gnats? | ... | ... | Igen/Nem | ... |
| 5 | What is the best way to propagate plants? | ... | ... | Igen/Nem | ... |
| 6 | How do I care for a succulent? | ... | ... | Igen/Nem | ... |
| 7 | *(NEGATÍV)* What is the exact weight in grams of a ripe pineapple fruit? | — | — | — | Nincs adat a tudásbázisban |

## Rerank hatása — részletes elemzés

*(Töltsd ki: melyik kérdésnél rendezett át, és miért jobb az új sorrend.)*

## Negatív teszt eredménye

*(Töltsd ki: mit mondott az agent a 7. kérdésre.)*
```

- [ ] **Step 2: `docs/ARCHITEKTURA.md` megírása**

```markdown
# Tudásbázis karbantartás — architektúra-spec

## Inkrementális frissítés terve

### Változásérzékelés

A `seed/knowledge/` mappában tárolt Markdown fájlok tartalmát SHA-256 hash-sel követjük.
A hash-eket egy `knowledge_doc_hashes` táblában tároljuk (`doc_path`, `content_hash`, `updated_at`).
Az ingest-script befutáskor összehasonlítja az aktuális fájl hash-ét a tárolttal:
- Ha egyezik → kihagyja (nem vektorizál újra).
- Ha eltér vagy új → újrachunkolja és újraembeddeli.

### Új dokumentum kezelése

1. A fájl megjelenik a `seed/knowledge/` mappában.
2. Az ingest-script detektálja (nincs hash-bejegyzés).
3. Chunkol → embeddel → upsert a `knowledge_chunks`-ba → hash mentése.

### Módosított dokumentum kezelése

1. Hash comparison → eltérés detektálva.
2. A régi doc_path-hoz tartozó összes chunk DELETE-elése.
3. Újrachunkolás + embeddelés + upsert.
4. Hash frissítése.

### Törölt dokumentum kezelése

1. Az ingest-script a fájl-lista alapján detektálja, hogy egy korábban indexelt path eltűnt.
2. DELETE FROM knowledge_chunks WHERE doc_path = '...'
3. Hash-bejegyzés törlése.

### Trigger

- **Manuális:** `pnpm cli knowledge-ingest` (fejlesztők, hotfix).
- **CI/CD:** GitHub Actions workflow fut, ha a `seed/knowledge/` mappában változás detektálható (`on: push: paths: ['seed/knowledge/**']`).
- **Scheduled:** Heti cron (ha a forrás-URL-ek tartalmát is frissíteni kell — ez outside scope itt).

## Architektúra-ábra

*(Szúrd be ide a Miro/draw.io export screenshot-ját: forrás → hash-check → chunk → embed → pgvector → törlés/módosítás útja)*
```

- [ ] **Step 3: README bővítése — költségbecslés + multi-provider indoklás**

A README-be add ezeket a szakaszokat (a saját futtatás számaival):

```markdown
## RAG Pipeline

### Multi-provider szereposztás

| Feladat | Provider | Modell | Indoklás |
|---------|----------|--------|----------|
| Válasz-generálás | Anthropic | claude-sonnet-4-6 | Már integrált, magyar szöveg, XML-tag prompt |
| HyDE document | Anthropic | claude-haiku-4-5-20251001 | Olcsóbb, csak rövid hypothetical doc kell |
| Embedding | OpenAI | text-embedding-3-small | Anthropic nem biztosít embedding API-t; legolcsóbb stabil opció |
| Rerank | Cohere | rerank-english-v3.0 | Dokumentált rerank API, kurzus-követelmény |

### Chunking stratégia — B (szekció-alapú)

A 202 gondozási cikk Markdown `##`/`###` headingek mentén kerül szétbontásra (target: 120 szó, max: 250 szó, 1 mondatos overlap). Indoklás: a cikkek heading-struktúráltak (minden cikknél van `##`), a szekciók természetes szemantikai határokat képeznek (pl. „Watering", „Light Requirements"), és az overlap csökkenti a határon elveszett kontextust.

### Költségbecslés

**Ingest (202 dokumentum, ~XXXX chunk):**
- Embedding: ~XXXX token × $0.02/1M = ~$X.XX

**Egy kérdés (teljes pipeline):**
- HyDE generálás (haiku): ~300 token output ≈ $0.00X
- Embedding (1 kérdés): ~50 token ≈ $0.000001
- Cohere rerank (top-20): ~$0.001
- Válasz-generálás (sonnet): ~800 token input + ~300 output ≈ $0.00X
- **Összesen egy kérdés: ~$0.00X–0.0X**

*(Töltsd ki a tényleges futtatás számaiból.)*
```

- [ ] **Step 4: Commit**

```bash
git add docs/golden-set.md docs/ARCHITEKTURA.md README.md
git commit -m "docs: golden set template, architecture spec, cost estimate, provider rationale"
```

---

## Self-Review

**Spec coverage:**
- CAP-1 (ingest): Task 4-7 ✓
- CAP-2 (HyDE + rerank): Task 8-9 ✓
- CAP-3 (grounding): Task 10, rag-prompt.ts grounding szabályok ✓
- CAP-4 (multi-provider): Task 8 + Task 12 dokumentáció ✓
- CAP-5 (chunking unit tesztek): Task 4, 6 teszt ✓
- CAP-6 (golden set): Task 12 ✓
- CAP-7 (ARCHITEKTURA.md): Task 12 ✓
- CAP-8 (költségbecslés): Task 12 ✓

**Placeholder scan:** Nincs TBD. A golden set táblázat és a ARCHITEKTURA.md ábra futtatás-dependens adatokat igényel (saját számok) — ezek tudatos placeholderek, az értékelő is elvárja a saját méréseket.

**Type consistency:** `Chunk` → `ChunkWithEmbedding` → `upsertChunks` → minden Task hivatkozik az előző Task-ban definiált típusra. `KnowledgeRow` (Task 6) felhasználva Task 8 és Task 9-ben. `ToolReporter` a meglévő `tool-outcome.ts`-ből.
