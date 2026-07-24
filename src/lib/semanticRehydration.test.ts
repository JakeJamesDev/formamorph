import { describe, it, expect } from 'vitest';
import {
  REHYDRATE_SIM_THRESHOLD,
  REHYDRATE_DUP_THRESHOLD,
  REHYDRATE_MAX,
  REHYDRATE_COOLDOWN_TURNS,
  selectSemanticRehydrations,
  rehydrationCooldownBlocked,
} from './semanticRehydration';
import { vectorKey } from './memoryRelevance';
import type { BandTurn } from './turnBanding';
import type { ChatMessage } from '@/types';

const turn = (i: number, summary?: string): BandTurn => ({
  index: i * 2 + 1,
  turnId: `t${i}`,
  userMsg: { role: 'user', content: `a${i}` } as ChatMessage,
  gameText: `g${i}`,
  summary,
});

// 3-dim unit-ish vectors are enough: cosine of pre-normalized vectors is the dot product.
const vec = (...vals: number[]) => new Float32Array(vals);
const vectors = (entries: Array<[string, Float32Array]>) =>
  new Map(entries.map(([text, v]) => [vectorKey(text), v] as const));

describe('selectSemanticRehydrations', () => {
  const query = vec(1, 0, 0);

  it('ranks by similarity, drops sub-threshold turns, and caps the count', () => {
    const band = [turn(0, 'far'), turn(1, 'best'), turn(2, 'good'), turn(3, 'ok')];
    const v = vectors([
      ['far', vec(0.1, 0.99, 0)],   // below threshold
      ['best', vec(0.9, 0, 0.44)],
      ['good', vec(0.7, 0.71, 0)],
      ['ok', vec(0.5, 0, 0.87)],
    ]);
    const out = selectSemanticRehydrations(band, [], query, v);
    expect(out).toEqual(['t1', 't2']); // best-first, capped at REHYDRATE_MAX
    expect(REHYDRATE_MAX).toBe(2);
  });

  it('skips a near-duplicate of an already-chosen turn — the freeze guard', () => {
    const band = [turn(0, 'charged one'), turn(1, 'charged two'), turn(2, 'distinct')];
    const v = vectors([
      ['charged one', vec(0.9, 0.44, 0)],
      ['charged two', vec(0.89, 0.46, 0)], // ~0.99 similar to the first
      ['distinct', vec(0.5, -0.6, 0.62)],
    ]);
    const out = selectSemanticRehydrations(band, [], query, v);
    expect(out).toEqual(['t0', 't2']); // the twin is skipped, the distinct scene takes the slot
  });

  it('skips a near-duplicate of a floor turn — the scene already rides verbatim', () => {
    const band = [turn(0, 'old charged')];
    const floor = [turn(9, 'recent charged')];
    const v = vectors([
      ['old charged', vec(0.9, 0.44, 0)],
      ['recent charged', vec(0.9, 0.43, 0)],
    ]);
    expect(selectSemanticRehydrations(band, floor, query, v)).toEqual([]);
  });

  it('ignores turns without a cached vector or digest instead of failing', () => {
    const band = [turn(0, 'unembedded'), turn(1, undefined), turn(2, 'ready')];
    const v = vectors([['ready', vec(0.9, 0, 0.44)]]);
    expect(selectSemanticRehydrations(band, [], query, v)).toEqual(['t2']);
  });

  it('excludes blocked (cooling-down) turns and lets the runner-up take the slot', () => {
    const band = [turn(0, 'best'), turn(1, 'good'), turn(2, 'ok')];
    const v = vectors([
      ['best', vec(0.9, 0, 0.44)],
      ['good', vec(0.7, 0.71, 0)],
      ['ok', vec(0.5, 0, 0.87)],
    ]);
    const out = selectSemanticRehydrations(band, [], query, v, new Set(['t0']));
    expect(out).toEqual(['t1', 't2']);
  });

  it('ships with sane guards', () => {
    expect(REHYDRATE_SIM_THRESHOLD).toBeGreaterThan(0);
    expect(REHYDRATE_DUP_THRESHOLD).toBeGreaterThan(REHYDRATE_SIM_THRESHOLD);
    expect(REHYDRATE_DUP_THRESHOLD).toBeLessThan(1);
  });
});

describe('rehydrationCooldownBlocked', () => {
  it('blocks a scene for the cooldown window, then releases it — no consecutive-turn repeat', () => {
    const fired = new Map([['t0', 29]]);
    // Fired on turn 29 with N=3: blocked on 30 and 31, eligible again on 32.
    expect(rehydrationCooldownBlocked(fired, 30).has('t0')).toBe(true);
    expect(rehydrationCooldownBlocked(fired, 31).has('t0')).toBe(true);
    expect(rehydrationCooldownBlocked(fired, 32).has('t0')).toBe(false);
    expect(REHYDRATE_COOLDOWN_TURNS).toBe(3);
  });

  it('does not block a same-turn re-roll or a rolled-back save', () => {
    const fired = new Map([['t0', 29]]);
    expect(rehydrationCooldownBlocked(fired, 29).size).toBe(0); // re-roll of the firing turn
    expect(rehydrationCooldownBlocked(fired, 20).size).toBe(0); // load of an earlier save
  });
});
