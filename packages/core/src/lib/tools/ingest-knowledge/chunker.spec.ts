import { describe, it, expect } from 'vitest';
import { chunkDocument } from './chunker.js';

const FRONTMATTER = `---
title: Test Plant Care
source: https://example.com/test
category: the-basics
---`;

describe('chunkDocument', () => {
  it('returns empty array for empty content', () => {
    const result = chunkDocument(`${FRONTMATTER}\n\n`, 'seed/knowledge/test.md');
    expect(result).toEqual([]);
  });

  it('splits on ## headings and attaches heading to chunk', () => {
    const raw = `${FRONTMATTER}

# Main Title

Intro paragraph.

## Watering

Water once a week. Keep the soil moist but not soggy. Avoid letting it dry out completely.

## Light Requirements

Place in bright indirect light. Avoid direct afternoon sun which can scorch the leaves.
`;
    const chunks = chunkDocument(raw, 'seed/knowledge/test.md');
    expect(chunks.length).toBeGreaterThanOrEqual(2);
    const wateringChunk = chunks.find((c) => c.heading === 'Watering');
    expect(wateringChunk).toBeDefined();
    expect(wateringChunk!.content).toContain('Water once a week');
    expect(wateringChunk!.docTitle).toBe('Test Plant Care');
    expect(wateringChunk!.category).toBe('the-basics');
  });

  it('falls back to paragraph splitting when no ## headings', () => {
    const raw = `${FRONTMATTER}

# Title Only

First paragraph with enough words to be standalone content here.

Second paragraph also with enough words to qualify as its own chunk unit.
`;
    const chunks = chunkDocument(raw, 'seed/knowledge/test.md');
    expect(chunks.length).toBeGreaterThanOrEqual(1);
    chunks.forEach((c) => expect(c.heading).toBeNull());
  });

  it('assigns sequential chunkIndex values starting at 0', () => {
    const raw = `${FRONTMATTER}

## Section A

Content for section A with some text here.

## Section B

Content for section B with some other text.
`;
    const chunks = chunkDocument(raw, 'seed/knowledge/test.md');
    chunks.forEach((c, i) => expect(c.chunkIndex).toBe(i));
  });

  it('carries over last sentence of chunk as overlap to next chunk', () => {
    const raw = `${FRONTMATTER}

## First Section

Sentence one is here. Sentence two follows it. This is the final sentence of first section.

## Second Section

Beginning of second section content here.
`;
    const chunks = chunkDocument(raw, 'seed/knowledge/test.md');
    if (chunks.length >= 2) {
      const lastSentenceOfFirst = 'This is the final sentence of first section.';
      expect(chunks[1]!.content).toContain(lastSentenceOfFirst);
    }
  });

  it('sets docPath, docSource from frontmatter', () => {
    const raw = `${FRONTMATTER}

## Section

Some content here.
`;
    const chunks = chunkDocument(raw, 'seed/knowledge/test.md');
    expect(chunks[0]!.docPath).toBe('seed/knowledge/test.md');
    expect(chunks[0]!.docSource).toBe('https://example.com/test');
  });
});
