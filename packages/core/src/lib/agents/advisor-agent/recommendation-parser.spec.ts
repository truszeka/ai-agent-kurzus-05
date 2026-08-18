import { describe, it, expect } from 'vitest';
import {
  extractJsonBlock,
  parseRecommendation,
} from './recommendation-parser.js';

const VALID = JSON.stringify({
  items: [
    {
      name: 'Zamiokulkasz',
      latinName: 'Zamioculcas zamiifolia',
      priceHuf: 5990,
      reason: 'árnyéktűrő',
    },
  ],
  totalPriceHuf: 5990,
  reasoning: 'Alacsony fényigényű, kezdőbarát növény.',
  warnings: [],
  confidence: 0.9,
  escalationReason: null,
});

describe('parseRecommendation', () => {
  it('should accept a bare JSON answer', () => {
    const result = parseRecommendation(VALID);
    expect(result.ok).toBe(true);
  });

  it('should accept a fenced JSON answer', () => {
    const result = parseRecommendation(
      `Íme az ajánlat:\n\`\`\`json\n${VALID}\n\`\`\`\n`,
    );
    expect(result.ok && result.recommendation.items[0]?.name).toBe(
      'Zamiokulkasz',
    );
  });

  it('should accept JSON surrounded by prose', () => {
    const result = parseRecommendation(
      `Összeállítottam.\n${VALID}\nRemélem megfelel.`,
    );
    expect(result.ok).toBe(true);
  });

  it('should reject an answer without JSON', () => {
    const result = parseRecommendation('Sajnos nem tudok most ajánlatot adni.');
    expect(result.ok).toBe(false);
  });

  it('should reject malformed JSON', () => {
    const result = parseRecommendation('{ "items": [ , }');
    expect(result.ok).toBe(false);
  });

  it('should reject a confidence outside the 0..1 range', () => {
    const broken = JSON.parse(VALID) as Record<string, unknown>;
    broken['confidence'] = 4;
    const result = parseRecommendation(JSON.stringify(broken));
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.reason).toContain('confidence');
  });

  it('should reject a missing required field', () => {
    const broken = JSON.parse(VALID) as Record<string, unknown>;
    delete broken['totalPriceHuf'];
    expect(parseRecommendation(JSON.stringify(broken)).ok).toBe(false);
  });

  it('should not be confused by braces inside strings', () => {
    const withBraces = JSON.parse(VALID) as Record<string, unknown>;
    withBraces['reasoning'] = 'A polcra { ilyen } növény való.';
    const text = `előszó ${JSON.stringify(withBraces)} utószó`;
    const result = parseRecommendation(text);
    expect(result.ok && result.recommendation.reasoning).toContain('{ ilyen }');
  });

  it('should return null when no object starts in the text', () => {
    expect(extractJsonBlock('nincs itt semmi')).toBeNull();
  });
});
