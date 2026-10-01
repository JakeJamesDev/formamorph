/**
 * The general-knowledge marker: the line a help answer starts with when the guide sections do not cover
 * the question. The help session reads it to flag the answer and removes it, so the player never sees it.
 */
export const GENERAL_KNOWLEDGE_MARKER = '[NOT IN GUIDE]';

/** The marker as models write it: any case, in bold, with "the", or with a colon after it. */
const MARKER = /\*{0,2}\[\s*not\s+in\s+(?:the\s+)?guide\s*\]\*{0,2}:?/gi;

/** The written forms a start of an answer can still grow into. */
const MARKER_FORMS = ['[not in guide]', '[not in the guide]'];

/** True when the text is a start that can still grow into the marker. */
function startsMarker(text: string): boolean {
  const start = text.replace(/^\*+/, '').toLowerCase().replace(/\s+/g, ' ').replace(/^\[ /, '[');
  return start === '' || MARKER_FORMS.some((form) => form.startsWith(start));
}

export interface MarkedAnswer {
  /** The answer text with every marker removed. */
  text: string;
  /** The text holds the marker. */
  marked: boolean;
}

/**
 * Reads and removes the marker. While the stream runs, a start that can still grow into the marker
 * reads as empty, so a marker split across chunks never shows; with `final` that start is answer text.
 */
export function readMarker(text: string, { final = false }: { final?: boolean } = {}): MarkedAnswer {
  const trimmed = text.trim();
  const marked = MARKER.test(trimmed);
  MARKER.lastIndex = 0;
  if (marked) return { text: trimmed.replace(MARKER, '').trim(), marked };
  if (!final && trimmed && startsMarker(trimmed)) return { text: '', marked };
  return { text: trimmed, marked };
}
