import { describe, expect, it } from 'vitest';
import { parseHostedState } from './hostedState';

const BASE = { tier: 'supporter_plus', state: 'ready', percentUsed: 20, turnsLeft: 50, resetAt: '2026-11-09T00:00:00.000Z' };
const parse = (patch: Record<string, unknown>) => parseHostedState({ ...BASE, ...patch });

describe('parseHostedState breakdown', () => {
  it('reads the breakdown and its threshold', () => {
    expect(parse({ breakdown: { narration: 61.2, other: 0.4 }, breakdownThreshold: 10 })).toMatchObject({
      breakdown: { narration: 61.2, other: 0.4 }, breakdownThreshold: 10,
    });
  });

  it('keeps an empty week as an empty map', () => {
    expect(parse({ breakdown: {}, breakdownThreshold: 10 })?.breakdown).toEqual({});
  });

  it.each([
    ['absent', {}],
    ['null', { breakdown: null, breakdownThreshold: null }],
    ['an array', { breakdown: [1, 2], breakdownThreshold: 10 }],
    ['a non-number share', { breakdown: { narration: '61' }, breakdownThreshold: 10 }],
    ['a negative share', { breakdown: { narration: -1 }, breakdownThreshold: 10 }],
    ['no threshold', { breakdown: { narration: 100 } }],
    ['a threshold out of range', { breakdown: { narration: 100 }, breakdownThreshold: 0 }],
    ['a fractional threshold', { breakdown: { narration: 100 }, breakdownThreshold: 10.5 }],
  ])('shows no breakdown for %s, and the usage lines still read', (_name, patch) => {
    const state = parse(patch);
    expect(state?.breakdown).toBeNull();
    expect(state?.breakdownThreshold).toBeNull();
    expect(state).toMatchObject({ percentUsed: 20, turnsLeft: 50 });
  });
});
