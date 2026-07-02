// Pure helpers for the karaoke-style sentence highlighter: mapping the audio playhead to a sentence
// index, and mapping a spoken sentence to a DOM Range over the rendered (markdown) narration. Kept
// side-effect free (no CSS.highlights registration) so they can be unit-tested under jsdom.

import { escapeRegExp } from '@/lib/utils';

/** Sentence boundary: whitespace following a terminator. Matches the TTS chunker's segmentation. */
const SENTENCE_BOUNDARY = /(?<=[.!?…])\s+/g;

/** Minimal chunk shape the playhead→sentence lookup needs. */
export interface HighlightChunk { start: number; sentenceIndex: number }

/**
 * The sentence at `position` seconds: the last chunk whose start is at or before the playhead.
 * Chunks are in play order (ascending start). Returns −1 when there are none.
 */
export function positionToSentenceIndex(chunks: HighlightChunk[], position: number): number {
  let idx = -1;
  for (const chunk of chunks) {
    if (chunk.start <= position) idx = chunk.sentenceIndex;
    else break;
  }
  return idx;
}

/** A flattened text-node map of a container: the visible string plus each char's (node, offset). */
export interface CharMap { text: string; charAt: { node: Text; offset: number }[] }

/** Walk `container`'s text nodes into a visible string with a per-character (node, offset) index. */
export function buildCharMap(container: Node): CharMap {
  const walker = container.ownerDocument!.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  let text = '';
  const charAt: { node: Text; offset: number }[] = [];
  let node = walker.nextNode() as Text | null;
  while (node) {
    const data = node.data;
    for (let i = 0; i < data.length; i++) charAt.push({ node, offset: i });
    text += data;
    node = walker.nextNode() as Text | null;
  }
  return { text, charAt };
}

/** Build a DOM Range spanning [startRaw, endRaw) chars of the map, or null if out of bounds. */
function rangeFromRaw(map: CharMap, startRaw: number, endRaw: number): Range | null {
  if (startRaw < 0 || endRaw <= startRaw || endRaw > map.charAt.length) return null;
  const a = map.charAt[startRaw];
  const b = map.charAt[endRaw - 1];
  const range = a.node.ownerDocument!.createRange();
  range.setStart(a.node, a.offset);
  range.setEnd(b.node, b.offset + 1);
  return range;
}

/**
 * Find `needle` in the map's text at or after `fromChar`, matching whitespace-flexibly (the spoken
 * needle and the rendered text can differ in whitespace). Returns the Range and a cursor past the
 * match (for the next sentence), or null if not found.
 */
export function findSentenceRange(
  map: CharMap,
  needle: string,
  fromChar: number,
): { range: Range; nextCursor: number } | null {
  const words = needle.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return null;
  const re = new RegExp(words.map(escapeRegExp).join('\\s+'));
  const m = re.exec(map.text.slice(fromChar));
  if (!m) return null;
  const startRaw = fromChar + m.index;
  const endRaw = startRaw + m[0].length;
  const range = rangeFromRaw(map, startRaw, endRaw);
  return range ? { range, nextCursor: endRaw } : null;
}

/**
 * Range for the sentence at `index`, anchored by text: walk sentences 0..index with a forward cursor
 * so duplicate/short sentences and count drift self-correct. Null if any step can't be located.
 */
export function findNthSentenceRange(map: CharMap, sentenceTexts: string[], index: number): Range | null {
  let cursor = 0;
  let range: Range | null = null;
  for (let i = 0; i <= index; i++) {
    const needle = sentenceTexts[i];
    if (needle == null) return null;
    const found = findSentenceRange(map, needle, cursor);
    if (!found) return null;
    range = found.range;
    cursor = found.nextCursor;
  }
  return range;
}

/** Fallback: segment the rendered text itself by sentence boundary and take the `index`-th span. */
export function segmentRangeByIndex(map: CharMap, index: number): Range | null {
  const spans: { start: number; end: number }[] = [];
  let start = 0;
  let m: RegExpExecArray | null;
  SENTENCE_BOUNDARY.lastIndex = 0;
  while ((m = SENTENCE_BOUNDARY.exec(map.text))) {
    spans.push({ start, end: m.index });
    start = m.index + m[0].length;
  }
  if (start < map.text.length) spans.push({ start, end: map.text.length });
  const span = spans[index];
  return span ? rangeFromRaw(map, span.start, span.end) : null;
}

/**
 * Best-effort Range for the sentence at `index`: text-anchored first, index-segmentation as fallback.
 * Null when neither locates it (e.g. audio is ahead of the still-streaming DOM).
 */
export function sentenceRange(container: Node, sentenceTexts: string[], index: number): Range | null {
  if (index < 0) return null;
  const map = buildCharMap(container);
  return findNthSentenceRange(map, sentenceTexts, index) ?? segmentRangeByIndex(map, index);
}
