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
