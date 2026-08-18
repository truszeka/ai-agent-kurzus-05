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
