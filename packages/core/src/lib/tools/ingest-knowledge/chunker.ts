import { parse as parseYaml } from 'yaml';

export interface Chunk {
  docPath: string;
  docTitle: string;
  docSource: string;
  category: string;
  chunkIndex: number;
  heading: string | null;
  content: string;
}

interface Frontmatter {
  title: string;
  source: string;
  category: string;
}

const MAX_WORDS = 250;

function parseFrontmatter(raw: string): { fm: Frontmatter; body: string } {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) {
    return {
      fm: { title: '', source: '', category: '' },
      body: raw,
    };
  }
  const fm = parseYaml(match[1]!) as Frontmatter;
  return { fm, body: match[2]! };
}

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function lastSentence(text: string): string {
  const sentences = text.match(/[^.!?]+[.!?]+/g);
  return sentences ? (sentences[sentences.length - 1]?.trim() ?? '') : '';
}

function paragraphFallback(
  body: string,
  fm: Frontmatter,
  docPath: string,
): Chunk[] {
  const paragraphs = body.split(/\n\n+/).map((p) => p.trim()).filter(Boolean);
  const chunks: Chunk[] = [];
  let buffer = '';

  for (const para of paragraphs) {
    if (para.startsWith('#')) continue;
    const candidate = buffer ? `${buffer}\n\n${para}` : para;
    if (wordCount(candidate) > MAX_WORDS && buffer) {
      chunks.push({
        docPath,
        docTitle: fm.title,
        docSource: fm.source,
        category: fm.category,
        chunkIndex: chunks.length,
        heading: null,
        content: buffer.trim(),
      });
      buffer = para;
    } else {
      buffer = candidate;
    }
  }
  if (buffer.trim() && wordCount(buffer) > 5) {
    chunks.push({
      docPath,
      docTitle: fm.title,
      docSource: fm.source,
      category: fm.category,
      chunkIndex: chunks.length,
      heading: null,
      content: buffer.trim(),
    });
  }
  return chunks;
}

export function chunkDocument(raw: string, docPath: string): Chunk[] {
  const { fm, body } = parseFrontmatter(raw);

  // Keresünk ## vagy ### szintű headingeket
  const sectionRegex = /^(#{2,3})\s+(.+)$/m;
  if (!sectionRegex.test(body)) {
    return paragraphFallback(body, fm, docPath);
  }

  // Szekciókra bontás ## / ### mentén
  const lines = body.split('\n');
  const sections: Array<{ heading: string; lines: string[] }> = [];
  let currentHeading = '';
  let currentLines: string[] = [];

  for (const line of lines) {
    const headingMatch = line.match(/^#{2,3}\s+(.+)$/);
    if (headingMatch) {
      if (currentLines.some((l) => l.trim())) {
        sections.push({ heading: currentHeading, lines: currentLines });
      }
      currentHeading = headingMatch[1]!.trim();
      currentLines = [];
    } else {
      currentLines.push(line);
    }
  }
  if (currentLines.some((l) => l.trim())) {
    sections.push({ heading: currentHeading, lines: currentLines });
  }

  if (sections.length === 0) {
    return paragraphFallback(body, fm, docPath);
  }

  const chunks: Chunk[] = [];
  let prevOverlap = '';

  for (const section of sections) {
    const sectionText = section.lines.join('\n').trim();
    if (!sectionText) continue;

    const contentWithOverlap = prevOverlap
      ? `${prevOverlap}\n\n${sectionText}`
      : sectionText;

    if (wordCount(contentWithOverlap) > MAX_WORDS) {
      // Hosszú szekció: bekezdés-alapon feldaraboljuk
      const paras = sectionText.split(/\n\n+/).map((p) => p.trim()).filter(Boolean);
      let buffer = prevOverlap;
      for (const para of paras) {
        const candidate = buffer ? `${buffer}\n\n${para}` : para;
        if (wordCount(candidate) > MAX_WORDS && buffer) {
          chunks.push({
            docPath,
            docTitle: fm.title,
            docSource: fm.source,
            category: fm.category,
            chunkIndex: chunks.length,
            heading: section.heading || null,
            content: buffer.trim(),
          });
          prevOverlap = lastSentence(buffer);
          buffer = `${prevOverlap}\n\n${para}`;
        } else {
          buffer = candidate;
        }
      }
      if (buffer.trim() && wordCount(buffer) > 5) {
        chunks.push({
          docPath,
          docTitle: fm.title,
          docSource: fm.source,
          category: fm.category,
          chunkIndex: chunks.length,
          heading: section.heading || null,
          content: buffer.trim(),
        });
        prevOverlap = lastSentence(buffer);
      }
    } else {
      chunks.push({
        docPath,
        docTitle: fm.title,
        docSource: fm.source,
        category: fm.category,
        chunkIndex: chunks.length,
        heading: section.heading || null,
        content: contentWithOverlap,
      });
      prevOverlap = lastSentence(sectionText);
    }
  }

  return chunks;
}
