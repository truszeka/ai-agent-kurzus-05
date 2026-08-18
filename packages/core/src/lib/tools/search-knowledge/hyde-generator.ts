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
