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
