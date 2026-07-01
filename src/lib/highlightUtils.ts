import { escapeRegExp } from "./utils";

/** Shared pastel palette for color-coding in the AI context viewer and the prompt-variable chips, so
 *  the same accent means the same thing across both. Black text reads well on every entry. */
export const HIGHLIGHT_PALETTE = [
  "#fde68a", "#bbf7d0", "#bfdbfe", "#fbcfe8",
  "#ddd6fe", "#fed7aa", "#a5f3fc", "#fecaca",
  "#d9f99d", "#99f6e4", "#fecdd3",
];

export interface HighlightRule {
  term: string;
  color: string;
}

export interface HighlightSegment {
  text: string;
  color?: string;
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
