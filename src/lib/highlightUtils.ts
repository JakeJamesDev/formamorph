export interface HighlightRule {
  term: string;
  color: string;
}

export interface HighlightSegment {
  text: string;
  color?: string;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Split `text` into segments, marking spans that match any rule's term with that rule's color
 * (case-insensitive). Longer terms win over shorter overlapping ones.
 */
export function highlightSegments(
  text: string,
  rules: HighlightRule[],
): HighlightSegment[] {
  const valid = rules.filter((r) => r.term && r.term.trim());
  if (!text || valid.length === 0) return [{ text }];

  // Longest first so e.g. "fire dragon" wins over "dragon" at the same position.
  const sorted = [...valid].sort((a, b) => b.term.length - a.term.length);
  const colorByTerm = new Map(sorted.map((r) => [r.term.toLowerCase(), r.color]));
  const regex = new RegExp(`(${sorted.map((r) => escapeRegExp(r.term)).join('|')})`, 'gi');

  const segments: HighlightSegment[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ text: text.slice(lastIndex, match.index) });
    }
    segments.push({ text: match[0], color: colorByTerm.get(match[0].toLowerCase()) });
    lastIndex = match.index + match[0].length;
    if (match.index === regex.lastIndex) regex.lastIndex++; // guard against zero-length matches
  }
  if (lastIndex < text.length) segments.push({ text: text.slice(lastIndex) });
  return segments;
}
