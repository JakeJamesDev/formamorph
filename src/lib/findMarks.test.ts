import { describe, it, expect } from 'vitest';
import {
  findHits, markFindHits, markFraction, parseFindTerms, planFindHits,
} from '@/lib/findMarks';

/** A segment shaped like the AI-context viewer's: text plus whatever the dictionary pass marked. */
interface Seg { text: string; color?: string; chip?: { entryId: string } }
const seg = (text: string, over: Omit<Seg, 'text'> = {}): Seg => ({ text, ...over });

describe('parseFindTerms', () => {
  it('splits on whitespace and lowercases', () => {
    expect(parseFindTerms('  Maren   Sedge ')).toEqual(['maren', 'sedge']);
  });

  it('returns nothing for an empty query', () => {
    expect(parseFindTerms('   ')).toEqual([]);
  });
});

describe('findHits', () => {
  it('locates a term case-insensitively', () => {
    expect(findHits('Maren waits', ['maren'])).toEqual([{ start: 0, end: 5 }]);
  });

  it('returns every occurrence in document order', () => {
    expect(findHits('one two one', ['one'])).toEqual([
      { start: 0, end: 3 },
      { start: 8, end: 11 },
    ]);
  });

  it('orders hits from several terms by position', () => {
    expect(findHits('sedge and maren', ['maren', 'sedge'])).toEqual([
      { start: 0, end: 5 },
      { start: 10, end: 15 },
    ]);
  });

  it('keeps the longest term where two overlap', () => {
    expect(findHits('Maren', ['mar', 'maren'])).toEqual([{ start: 0, end: 5 }]);
  });

  it('keeps offsets true after a letter that lowercases to two characters', () => {
    // "İ" lowercases to two code units, so a scan over a lowercased copy would report "Maren" one
    // character late and mark the wrong span.
    const text = 'İstanbul and Maren';
    expect(findHits(text, ['maren'])).toEqual([{ start: text.indexOf('Maren'), end: text.length }]);
  });

  it('finds nothing without text or terms', () => {
    expect(findHits('', ['maren'])).toEqual([]);
    expect(findHits('Maren', [])).toEqual([]);
  });
});

describe('planFindHits', () => {
  it('numbers hits across blocks in order', () => {
    const plan = planFindHits(['maren maren', 'nothing here', 'maren'], ['maren']);
    expect(plan.total).toBe(3);
    expect(plan.blocks.map((b) => b.base)).toEqual([0, 2, 2]);
    expect(plan.blocks.map((b) => b.hits.length)).toEqual([2, 0, 1]);
  });

  it('reports no hits for an empty query', () => {
    const plan = planFindHits(['maren'], []);
    expect(plan.total).toBe(0);
    expect(plan.blocks[0].hits).toEqual([]);
  });
});

describe('markFindHits', () => {
  it('splits a plain segment around the hit', () => {
    const out = markFindHits([seg('say maren now')], findHits('say maren now', ['maren']), 0, 0);
    expect(out.map((s) => s.text)).toEqual(['say ', 'maren', ' now']);
    expect(out.map((s) => s.find?.index)).toEqual([undefined, 0, undefined]);
  });

  it('keeps the marks the dictionary pass already made', () => {
    const segs = [seg('a '), seg('Maren', { color: '#fde68a', chip: { entryId: 'e1' } })];
    const out = markFindHits(segs, findHits('a Maren', ['are']), 0, 0);
    expect(out.map((s) => s.text)).toEqual(['a ', 'M', 'are', 'n']);
    // Every piece of the chip stays a chip; only the middle one is also a find hit.
    expect(out.slice(1).every((s) => s.color === '#fde68a')).toBe(true);
    expect(out.map((s) => s.find?.index)).toEqual([undefined, undefined, 0, undefined]);
  });

  it('marks a hit that crosses a segment edge as one hit', () => {
    const segs = [seg('Mar', { color: '#fde68a' }), seg('en waits')];
    const out = markFindHits(segs, findHits('Maren waits', ['maren']), 0, 0);
    expect(out.map((s) => s.text)).toEqual(['Mar', 'en', ' waits']);
    expect(out.map((s) => s.find?.index)).toEqual([0, 0, undefined]);
    // Only the piece holding the hit's start is its head, so one hit scrolls to one place.
    expect(out.map((s) => s.find?.head)).toEqual([true, false, undefined]);
  });

  it('numbers hits from the document base and clips to the slice', () => {
    // The slice is "maren" at offset 6 of "quiet maren waits", whose hit is the turn's third.
    const hits = findHits('quiet maren waits', ['maren']);
    const out = markFindHits([seg('maren')], hits, 6, 2);
    expect(out.map((s) => s.find?.index)).toEqual([2]);
  });

  it('passes segments through untouched when nothing matches', () => {
    const segs = [seg('quiet'), seg(' night')];
    expect(markFindHits(segs, [], 0, 0)).toEqual(segs);
  });
});

describe('markFraction', () => {
  it('is the offset over the scrollable height', () => {
    expect(markFraction(250, 1000)).toBe(0.25);
  });

  it('clamps outside the track', () => {
    expect(markFraction(-40, 1000)).toBe(0);
    expect(markFraction(1400, 1000)).toBe(1);
  });

  it('is zero when there is nothing to scroll', () => {
    expect(markFraction(120, 0)).toBe(0);
  });
});
