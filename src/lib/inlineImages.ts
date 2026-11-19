// Where During AI Output images sit in a turn's narration: after their anchor sentence, once it is on screen.

import { splitSentenceSegments } from './ttsChunks';
import { segmentQuotes } from './quoteSegments';
import type { ScriptImageTell } from './scriptTells';

/** One piece of a turn's narration: a run of its text, or an image between two runs. */
export type NarrationPart = { kind: 'text'; text: string } | { kind: 'image'; image: ScriptImageTell };

/** The offset each sentence of `text` ends at, in the Narration Stream's sentence order. */
function sentenceEnds(text: string): number[] {
  const ends: number[] = [];
  let cursor = 0;
  for (const segment of splitSentenceSegments(text)) {
    cursor = text.indexOf(segment, cursor) + segment.length;
    ends.push(cursor);
  }
  return ends;
}

/** Whether a quote stands open at `end`. A line break ends a quote, as it does in the renderer. */
const quoteOpenAt = (text: string, end: number): boolean =>
  !/^[^\S\n]*\n/.test(text.slice(end)) && segmentQuotes(text.slice(text.lastIndexOf('\n', end - 1) + 1, end)).open;

/** How many sentences of `text` are on screen. A settled turn shows all; a live fade reveal shows whole
 *  sentences, and the crawl's last one may still be typing (Q28). */
export function shownSentences(text: string, live: boolean, paced: boolean): number {
  if (!live) return Number.POSITIVE_INFINITY;
  if (!text.trim()) return 0;
  return splitSentenceSegments(text).length - (paced ? 0 : 1);
}

/**
 * `text` cut after each image's anchor sentence, with the images in call order between the runs. An anchor
 * past the last sentence takes the last (Q27), and one inside an open quote moves to where the quote ends
 * (Q26). An image waits until `shown` covers its anchor; a live quote still open holds it.
 */
export function narrationParts(text: string, images: readonly ScriptImageTell[], shown: number): NarrationPart[] {
  if (!images.length) return [{ kind: 'text', text }];
  const ends = sentenceEnds(text);
  const last = ends.length - 1;
  const settled = shown === Number.POSITIVE_INFINITY;
  const anchored = new Map<number, ScriptImageTell[]>();
  for (const image of images) {
    // While live, a later sentence is one that hasn't arrived yet.
    let anchor = image.sentence ?? last;
    if (anchor > last && !settled) continue;
    anchor = Math.min(anchor, last);
    while (anchor < last && quoteOpenAt(text, ends[anchor])) anchor += 1;
    if (anchor >= shown || (!settled && quoteOpenAt(text, ends[anchor]))) continue;
    anchored.set(anchor, [...(anchored.get(anchor) ?? []), image]);
  }
  const parts: NarrationPart[] = [];
  let cursor = 0;
  for (const anchor of [...anchored.keys()].sort((a, b) => a - b)) {
    const run = text.slice(cursor, ends[anchor]);
    if (run.trim()) parts.push({ kind: 'text', text: run });
    for (const image of anchored.get(anchor) ?? []) parts.push({ kind: 'image', image });
    cursor = ends[anchor];
  }
  const rest = text.slice(cursor);
  if (rest.trim() || !parts.length) parts.push({ kind: 'text', text: rest });
  return parts;
}
