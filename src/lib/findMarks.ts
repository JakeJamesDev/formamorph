import { escapeRegExp } from './utils';

/**
 * Find-term marking for the AI-context viewer's search.
 *
 * The viewer never rewrites the text it shows: a search marks hits in place, on top of whatever the
 * dictionary pass already marked. This module owns that composition. It locates the hits in a block's
 * text, numbers them in document order across the whole turn, and splits already-segmented text at the
 * hit boundaries so a mark can sit on, inside, or across a dictionary chip. Rendering stays in the viewer.
 *
 * A hit's number is its position in the turn, so it survives re-rendering and identifies the same mention
 * whatever the reader has collapsed.
 */

/** One matched span, as offsets into the text it was found in. */
export interface FindHit {
  start: number;
  end: number;
}

/** The hits of one block, and the document number its first hit takes. */
export interface FindBlockPlan {
  hits: FindHit[];
  base: number;
}

/** Every block of a turn, numbered end to end. */
export interface FindPlan {
  blocks: FindBlockPlan[];
  total: number;
}

/** Which hit a rendered run belongs to. `head` marks the run holding the hit's first character — the one
 *  place to scroll to, even where the hit is cut across two runs. */
export interface FindMark {
  index: number;
  head: boolean;
}

/** A segment with the find mark laid over whatever it already carried. */
export type FindMarked<T> = T & { find?: FindMark };

/** Split a query into search terms: lowercased, space-separated, empties dropped. */
export function parseFindTerms(query: string): string[] {
  return query.trim().toLowerCase().split(/\s+/).filter(Boolean);
}

/**
 * Every term hit in `text`, in document order. Matching is case-insensitive, and where two terms could
 * match at once the longer one wins, so each character is marked once and the count matches what the
 * reader sees.
 *
 * The scan runs case-insensitively over the original string rather than over a lowercased copy: lowering
 * some letters changes their length (Turkish `İ` becomes two code units), which would shift every offset
 * after one of them and mark the wrong characters.
 */
export function findHits(text: string, terms: string[]): FindHit[] {
  const usable = terms.filter(Boolean);
  if (!text || usable.length === 0) return [];
  // Longest first so the alternation prefers the longer term where both match in the same place.
  const sorted = [...usable].sort((a, b) => b.length - a.length);
  const scanner = new RegExp(sorted.map(escapeRegExp).join('|'), 'gi');
  const found: FindHit[] = [];
  let match: RegExpExecArray | null;
  while ((match = scanner.exec(text)) !== null) {
    if (match[0].length === 0) { scanner.lastIndex += 1; continue; }
    found.push({ start: match.index, end: match.index + match[0].length });
  }
  return found;
}

/** Number the hits of `texts` end to end, in the order the blocks are drawn. */
export function planFindHits(texts: string[], terms: string[]): FindPlan {
  let base = 0;
  const blocks = texts.map((text) => {
    const hits = findHits(text, terms);
    const plan = { hits, base };
    base += hits.length;
    return plan;
  });
  return { blocks, total: base };
}

/**
 * Split `segs` further at the hit boundaries, carrying each piece's existing marks over.
 *
 * `segs` spell out `[offset, offset + their length)` of the block whose hits are `hits`, and `base` is the
 * document number of `hits[0]` — so a slice of a block marks the same hits with the same numbers as the
 * whole block would. Segments that no hit touches are returned as they came in.
 */
export function markFindHits<T extends { text: string }>(
  segs: T[],
  hits: FindHit[],
  offset = 0,
  base = 0,
): FindMarked<T>[] {
  if (hits.length === 0) return segs;
  const out: FindMarked<T>[] = [];
  let pos = offset;
  for (const seg of segs) {
    const segStart = pos;
    const segEnd = segStart + seg.text.length;
    pos = segEnd;
    let cut = segStart;
    hits.forEach((hit, i) => {
      const start = Math.max(hit.start, segStart);
      const end = Math.min(hit.end, segEnd);
      if (start >= end) return;
      if (start > cut) out.push({ ...seg, text: seg.text.slice(cut - segStart, start - segStart) });
      out.push({
        ...seg,
        text: seg.text.slice(start - segStart, end - segStart),
        find: { index: base + i, head: hit.start >= segStart && hit.start < segEnd },
      });
      cut = end;
    });
    if (cut === segStart) out.push(seg);
    else if (cut < segEnd) out.push({ ...seg, text: seg.text.slice(cut - segStart) });
  }
  return out;
}

/** Where a hit sits in the scroll bar's track, as a 0–1 fraction of the scrollable height. */
export function markFraction(offsetTop: number, scrollHeight: number): number {
  if (!(scrollHeight > 0)) return 0;
  return Math.min(1, Math.max(0, offsetTop / scrollHeight));
}
