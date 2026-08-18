import type { ToolSet } from 'ai';
import { runAgentLoop, type AskOptions } from '../agent-loop.js';
import { runSqlTool } from '../../tools/run-sql/run-sql-tool.js';
import type {
  ModelIntake,
  CaseRecommendation,
} from '../../cases/case-schema.js';
import {
  ADVISOR_SYSTEM_PROMPT,
  buildAdvisorQuestion,
} from './advisor-prompt.js';
import { parseRecommendation } from './recommendation-parser.js';

// advisor-agent.ts — az AJÁNLÓ agent: ügyfél-igényből növénycsomag-TERVEZET.
// Egy agent = prompt + toolok + loop:
//   prompt: advisor-prompt.ts (szerep, séma, szabályok, eszkaláció, JSON kimeneti szerződés)
//   toolok: runSql (read-only SELECT a katalóguson)
//   loop:   a közös agent-loop (agent-loop.ts)
//
// Két dologban tér el a query-agenttől:
//   1. STRUKTURÁLT kimenetet vár (JSON), amit Zod validál — a szabad szöveg nem elég egy
//      jóváhagyási folyamathoz;
//   2. MÉR: a ToolReporter-en át gyűjti a lefuttatott SQL-eket és a hibás futásokat
//      (mérési terv: "hibás vagy sikertelen SQL-lekérdezések aránya").
//
// SOHA NEM DOB: LLM- vagy DB-hiba esetén is eredményt ad vissza, eszkalációs okkal — a
// use case szerint a bizonytalanság emberhez irányít, nem 500-as hibához.

export interface AdvisorResult {
  /** A validált ajánlás, vagy null, ha nem született használható tervezet. */
  recommendation: CaseRecommendation | null;
  /** Ha ki van töltve, emberi döntés kell (az agent kérte vagy a futás hibázott). */
  escalationReason: string | null;
  /** A ténylegesen lefuttatott SQL-ek — a lakberendezői nézet ezt mutatja. */
  sqlQueries: string[];
  sqlAttemptCount: number;
  sqlErrorCount: number;
  /** Az agent nyers válasza — hibakereséshez. */
  rawAnswer: string;
}

export type AdvisorRunner = (intake: ModelIntake) => Promise<AdvisorResult>;

export async function runAdvisorAgent(
  intake: ModelIntake,
  options: AskOptions = {},
): Promise<AdvisorResult> {
  const sqlQueries: string[] = [];
  let sqlAttemptCount = 0;
  let sqlErrorCount = 0;

  try {
    const result = await runAgentLoop(
      buildAdvisorQuestion(intake),
      {
        systemPrompt: ADVISOR_SYSTEM_PROMPT,
        buildTools: (report): ToolSet => ({
          runSql: runSqlTool((toolCallId, name, input, outcome) => {
            sqlAttemptCount += 1;
            if (outcome.isError) {
              sqlErrorCount += 1;
            }
            if (outcome.summary) {
              sqlQueries.push(outcome.summary);
            }
            report(toolCallId, name, input, outcome);
          }),
        }),
        maxSteps: 8,
        // A JSON-tervezet (3-5 tétel, indoklás) hosszabb, mint egy chat-válasz.
        maxOutputTokens: 2048,
        emptyAnswer: '',
      },
      { print: options.print ?? false, ...options },
    );

    const parsed = parseRecommendation(result.answer);
    if (!parsed.ok) {
      return {
        recommendation: null,
        escalationReason: `Az agent nem adott feldolgozható ajánlatot: ${parsed.reason}`,
        sqlQueries,
        sqlAttemptCount,
        sqlErrorCount,
        rawAnswer: result.answer,
      };
    }
    return {
      recommendation: parsed.recommendation,
      escalationReason: parsed.recommendation.escalationReason,
      sqlQueries,
      sqlAttemptCount,
      sqlErrorCount,
      rawAnswer: result.answer,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      recommendation: null,
      escalationReason: `Az ajánló agent futása hibára futott: ${message}`,
      sqlQueries,
      sqlAttemptCount,
      sqlErrorCount,
      rawAnswer: '',
    };
  }
}
