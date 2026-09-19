import { describe, it, expect } from 'vitest';
import { OPENING_SCENE_CUE } from '@/components/game/GamePrompts';
import type { Opening, WorldOverview } from '@/types';
import {
  addOpening, DEFAULT_OPENING, drawOpening, isOpeningFieldKey, moveOpening, openingChances, openingFieldKey,
  openingPool, openingsEnabled, openingTexts, removeOpening, resolveOpening, setOpeningText, setOpeningWeight,
} from './openings';

/** Mulberry32: a small seeded source, so a draw test is repeatable without mocking a global. */
const seeded = (seed: number) => () => {
  let t = (seed += 0x6d2b79f5);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const action = (id: string, text = `Opening ${id}.`): Opening => ({ id, text, kind: 'action' });

const overview = (over: Partial<WorldOverview> = {}): WorldOverview => ({
  name: 'W', description: '', author: '', thumbnail: null, bgm: null,
  systemPrompt: '', use3DModel: false, tags: [], ...over,
});

/** How often each opening comes up over many seeded draws. */
const tally = (ov: WorldOverview, draws = 20000, seed = 7) => {
  const random = seeded(seed);
  const pool = openingPool({ overview: ov });
  const counts: Record<string, number> = {};
  for (let i = 0; i < draws; i++) {
    const id = drawOpening(pool, random).id;
    counts[id] = (counts[id] ?? 0) + 1;
  }
  return counts;
};

describe('the draw', () => {
  it('returns the shipped default Opening Action for an empty pool', () => {
    for (const ov of [overview(), overview({ openings: [] }), null, undefined]) {
      expect(resolveOpening(ov, seeded(1))).toEqual(DEFAULT_OPENING);
    }
    expect(DEFAULT_OPENING).toMatchObject({ kind: 'action', text: OPENING_SCENE_CUE });
  });

  it('returns the default when the list is switched off, and keeps the rows', () => {
    const ov = overview({ openings: [action('a')], openingsEnabled: false });
    expect(openingsEnabled(ov)).toBe(false);
    expect(resolveOpening(ov, seeded(1))).toEqual(DEFAULT_OPENING);
    expect(ov.openings).toHaveLength(1);
  });

  it('counts an absent switch as on', () => {
    expect(openingsEnabled(overview())).toBe(true);
    expect(resolveOpening(overview({ openings: [action('a')] }), seeded(1)).id).toBe('a');
  });

  it('returns the default when every row weighs 0', () => {
    const ov = overview({ openings: [action('a'), action('b')], openingWeights: { a: 0, b: 0 } });
    expect(resolveOpening(ov, seeded(1))).toEqual(DEFAULT_OPENING);
  });

  it('never draws a weight 0 row', () => {
    const counts = tally(overview({ openings: [action('a'), action('b')], openingWeights: { b: 0 } }));
    expect(counts).toEqual({ a: 20000 });
  });

  it('never draws a blank row', () => {
    const ov = overview({ openings: [action('a', '  \n '), action('b')] });
    expect(tally(ov)).toEqual({ b: 20000 });
    expect(resolveOpening(overview({ openings: [action('a', '')] }), seeded(1))).toEqual(DEFAULT_OPENING);
  });

  it('draws by weight, with a missing weight counting as 1', () => {
    const counts = tally(overview({ openings: [action('a'), action('b'), action('c')], openingWeights: { b: 3 } }));
    // Expected shares 1:3:1 of 20000 draws.
    expect(counts.a / 20000).toBeCloseTo(0.2, 1);
    expect(counts.b / 20000).toBeCloseTo(0.6, 1);
    expect(counts.c / 20000).toBeCloseTo(0.2, 1);
  });

  it('maps the random source onto the rows in authored order', () => {
    const pool = openingPool({ overview: overview({ openings: [action('a'), action('b')], openingWeights: { a: 3 } }) });
    expect(drawOpening(pool, () => 0).id).toBe('a');
    expect(drawOpening(pool, () => 0.74).id).toBe('a');
    expect(drawOpening(pool, () => 0.76).id).toBe('b');
    expect(drawOpening(pool, () => 0.999).id).toBe('b');
  });
});

describe('the chance each row shows', () => {
  it('agrees with the draw, blank and benched rows at 0', () => {
    const ov = overview({
      openings: [action('a'), action('b'), action('c'), action('d', ' ')],
      openingWeights: { b: 3, c: 0 },
    });
    expect(openingChances(ov)).toEqual({ a: 25, b: 75, c: 0, d: 0 });
  });

  it('reads 0 on every row when the list draws nothing', () => {
    expect(openingChances(overview({ openings: [action('a')], openingWeights: { a: 0 } }))).toEqual({ a: 0 });
  });
});

describe('what the editor writes', () => {
  it('adds an empty Opening Action at the end under a fresh id', () => {
    const ov = overview({ openings: [action('a')] });
    const next = addOpening(ov).openings!;
    expect(next).toHaveLength(2);
    expect(next[0]).toBe(ov.openings![0]);
    expect(next[1]).toMatchObject({ text: '', kind: 'action' });
    expect(next[1].id).not.toBe('a');
  });

  it('drops a removed row together with its weight', () => {
    const ov = overview({ openings: [action('a'), action('b')], openingWeights: { a: 2, b: 5 } });
    expect(removeOpening(ov, 'b')).toEqual({ openings: [action('a')], openingWeights: { a: 2 } });
    expect(removeOpening(ov, 'b').openingWeights).toEqual({ a: 2 });
    expect(removeOpening({ ...ov, openingWeights: { b: 5 } }, 'b')).toEqual({ openings: [action('a')], openingWeights: undefined });
  });

  it('stores only a weight that differs from 1', () => {
    const ov = overview({ openings: [action('a')] });
    expect(setOpeningWeight(ov, 'a', 4)).toEqual({ openingWeights: { a: 4 } });
    expect(setOpeningWeight({ ...ov, openingWeights: { a: 4 } }, 'a', 1)).toEqual({ openingWeights: undefined });
    expect(setOpeningWeight(ov, 'a', 0)).toEqual({ openingWeights: { a: 0 } });
  });

  it('edits text in place and moves rows without touching weights', () => {
    const ov = overview({ openings: [action('a'), action('b'), action('c')], openingWeights: { c: 2 } });
    expect(setOpeningText(ov, 'b', 'New.').openings!.map((o) => o.text)).toEqual(['Opening a.', 'New.', 'Opening c.']);
    expect(moveOpening(ov, 2, 0)).toEqual({ openings: [action('c'), action('a'), action('b')] });
  });
});

describe('where openings are found', () => {
  it('lists every row text for chip priming and search, switched off or not', () => {
    const ov = overview({ openings: [action('a'), action('b')], openingsEnabled: false });
    expect(openingTexts(ov)).toEqual(['Opening a.', 'Opening b.']);
    expect(openingTexts(null)).toEqual([]);
  });

  it('names each row with a find-bar key the panel recognizes', () => {
    expect(isOpeningFieldKey(openingFieldKey('a'))).toBe(true);
    expect(isOpeningFieldKey('readme')).toBe(false);
    expect(isOpeningFieldKey(undefined)).toBe(false);
  });
});
