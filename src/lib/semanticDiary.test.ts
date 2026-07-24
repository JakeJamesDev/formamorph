import { describe, it, expect } from 'vitest';
import {
  DIARY_RECENT_KEEP,
  DIARY_RETRIEVE_MAX,
  DIARY_SIM_THRESHOLD,
  DIARY_DUP_THRESHOLD,
  selectRelevantDiary,
} from './semanticDiary';
import { vectorKey } from './memoryRelevance';

const vec = (...vals: number[]) => new Float32Array(vals);
const vectors = (entries: Array<[string, Float32Array]>) =>
  new Map(entries.map(([text, v]) => [vectorKey(text), v] as const));
const query = vec(1, 0, 0);

describe('selectRelevantDiary', () => {
  it('returns everything unchanged when the diary fits the combined budget', () => {
    const entries = ['one', 'two', 'three', 'four', 'five'];
    expect(selectRelevantDiary(entries, query, new Map())).toEqual(entries);
  });

  it('keeps the recent tail and pulls relevant older entries back in chronological order', () => {
    const entries = ['blade-old', 'noise-a', 'noise-b', 'recent-1', 'recent-2', 'recent-3'];
    const v = vectors([
      ['blade-old', vec(0.9, 0.44, 0)],  // relevant
      ['noise-a', vec(0, 1, 0)],
      ['noise-b', vec(0, 0, 1)],
    ]);
    const out = selectRelevantDiary(entries, query, v);
    expect(out).toEqual(['blade-old', 'recent-1', 'recent-2', 'recent-3']);
  });

  it('never retrieves below the similarity threshold and caps retrieved count', () => {
    const entries = ['hit-1', 'hit-2', 'hit-3', 'weak', 'r1', 'r2', 'r3'];
    const v = vectors([
      ['hit-1', vec(0.9, 0.44, 0)],
      ['hit-2', vec(0.8, 0, 0.6)],
      ['hit-3', vec(0.7, 0.6, -0.39)],
      ['weak', vec(0.2, 0.98, 0)], // below threshold
    ]);
    const out = selectRelevantDiary(entries, query, v);
    // Two best hits retrieved (cap 2), weak and hit-3 left out, recent tail intact.
    expect(out).toEqual(['hit-1', 'hit-2', 'r1', 'r2', 'r3']);
    expect(DIARY_RETRIEVE_MAX).toBe(2);
  });

  it('skips near-duplicates of the recent tail and of earlier picks — the brooding-character guard', () => {
    const entries = ['distrust-old', 'distinct-old', 'filler', 'distrust-recent', 'r2', 'r3'];
    const v = vectors([
      ['distrust-old', vec(0.9, 0.43, 0)],
      ['distinct-old', vec(0.6, -0.5, 0.62)],
      ['filler', vec(0, 1, 0)],
      ['distrust-recent', vec(0.9, 0.44, 0)], // recent twin of distrust-old
    ]);
    const out = selectRelevantDiary(entries, query, v);
    // distrust-old (~0.99 similar to the recent twin) is skipped; the distinct memory comes back.
    expect(out).toEqual(['distinct-old', 'distrust-recent', 'r2', 'r3']);
  });

  it('ignores older entries without cached vectors instead of failing', () => {
    const entries = ['unembedded', 'ready', 'x', 'r1', 'r2', 'r3'];
    const v = vectors([['ready', vec(0.9, 0, 0.44)], ['x', vec(0, 1, 0)]]);
    expect(selectRelevantDiary(entries, query, v)).toEqual(['ready', 'r1', 'r2', 'r3']);
  });

  it('ships token-neutral: recent + retrieved equals the old pure-recency count', () => {
    expect(DIARY_RECENT_KEEP + DIARY_RETRIEVE_MAX).toBe(5);
    expect(DIARY_SIM_THRESHOLD).toBeLessThan(DIARY_DUP_THRESHOLD);
  });
});
