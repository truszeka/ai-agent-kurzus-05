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
