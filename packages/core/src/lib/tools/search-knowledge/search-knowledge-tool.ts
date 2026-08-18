import { tool } from 'ai';
import { z } from 'zod';
import type { ToolReporter } from '../tool-outcome.js';
import { generateHyDE } from './hyde-generator.js';
import { rerankChunks } from './cohere-rerank.js';
import { embedText } from '../ingest-knowledge/embedder.js';
import { similaritySearch } from '../ingest-knowledge/db-vector.js';

const SIMILARITY_TOP_K = 20;
const RERANK_TOP_N = 5;
const MIN_SCORE = 0.3;

export function searchKnowledgeTool(report?: ToolReporter) {
  return tool({
    description:
      'Keresés a növénygondozási tudásbázisban. Adj meg egy kérdést, ' +
      'a tool visszaadja a legrelevánsabb cikkrészleteket forrással.',
    inputSchema: z.object({
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
          report?.(toolCallId, toolName, input, outcome);
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
          report?.(toolCallId, toolName, input, outcome);
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
        report?.(toolCallId, toolName, input, outcome);
        return outcome.content;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        const outcome = {
          content: `Keresési hiba: ${message}`,
          isError: true,
          summary: `Hiba: ${message}`,
          rowCount: null,
        };
        report?.(toolCallId, toolName, input, outcome);
        return outcome.content;
      }
    },
  });
}
