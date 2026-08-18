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
      emptyAnswer: 'Nem sikerült választ adni. Próbáld pontosítani a kérdést.',
    },
    options,
  );
}
