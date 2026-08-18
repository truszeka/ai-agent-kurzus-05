import {
  CaseRecommendationSchema,
  type CaseRecommendation,
} from '../../cases/case-schema.js';

// recommendation-parser.ts — az LLM-kimenet MEGBÍZHATATLAN (konvenciok.md): a modell szövegét
// itt vágjuk vissza egyetlen JSON objektumra, és Zod-dal validáljuk. Ami nem fér bele a sémába,
// az nem lesz "majdnem jó ajánlat", hanem elutasított kimenet → az ügy emberhez kerül.

export type ParseResult =
  | { ok: true; recommendation: CaseRecommendation }
  | { ok: false; reason: string };

/** A ```json ... ``` kódblokk vagy az első teljes JSON objektum kivágása a szövegből. */
export function extractJsonBlock(text: string): string | null {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(text);
  const source = fenced?.[1] ?? text;
  const start = source.indexOf('{');
  if (start === -1) {
    return null;
  }
  // Zárójel-számlálás, string-literálokat átugorva — így a leírásban lévő { } nem zavar be.
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < source.length; index += 1) {
    const char = source[index];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }
    if (char === '"') {
      inString = true;
    } else if (char === '{') {
      depth += 1;
    } else if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        return source.slice(start, index + 1);
      }
    }
  }
  return null;
}

/** Modell-szöveg → validált ajánlás. Soha nem dob. */
export function parseRecommendation(text: string): ParseResult {
  const block = extractJsonBlock(text);
  if (block === null) {
    return {
      ok: false,
      reason: 'Az agent válasza nem tartalmazott JSON objektumot.',
    };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(block);
  } catch {
    return {
      ok: false,
      reason: 'Az agent válaszának JSON része hibás formátumú.',
    };
  }
  const result = CaseRecommendationSchema.safeParse(parsed);
  if (!result.success) {
    const issue = result.error.issues[0];
    const field = issue?.path.join('.') || 'ismeretlen mező';
    return {
      ok: false,
      reason: `Az agent ajánlása nem felel meg a sémának (${field}): ${issue?.message ?? 'ismeretlen hiba'}.`,
    };
  }
  return { ok: true, recommendation: result.data };
}
