import { describe, expect, it } from 'vitest';
import {
  DEFAULT_MASCOT_TRANSITION, DISSOLVE_RANGES, JELLY_RANGES, jellyDipMs, mascotTransitionAt, parseMascotTransition,
  type JellyTuning, type MascotTransition,
} from './mascotTransition';

const jelly = (tuning: JellyTuning): MascotTransition => ({ ...DEFAULT_MASCOT_TRANSITION, mode: 'jelly', jelly: tuning });
const dissolve = (durationMs: number): MascotTransition => ({ ...DEFAULT_MASCOT_TRANSITION, mode: 'dissolve', dissolve: { durationMs } });
const none: MascotTransition = { ...DEFAULT_MASCOT_TRANSITION, mode: 'none' };

const heights = (transition: MascotTransition, durationMs: number, steps = 1000): number[] =>
  Array.from({ length: steps + 1 }, (_, i) => mascotTransitionAt((durationMs * i) / steps, transition).scaleY);

const rangeEnd = (end: 'min' | 'max'): JellyTuning => ({
  durationMs: JELLY_RANGES.durationMs[end],
  squash: JELLY_RANGES.squash[end],
  overshoot: JELLY_RANGES.overshoot[end],
  settle: JELLY_RANGES.settle[end],
});

/** The defaults, every range end of one tuning with the others at their defaults, and every tuning at its floor or ceiling. */
const JELLY_CASES: readonly [string, JellyTuning][] = [
  ['the defaults', DEFAULT_MASCOT_TRANSITION.jelly],
  ['the range floor', rangeEnd('min')],
  ['the range ceiling', rangeEnd('max')],
  ...(Object.keys(JELLY_RANGES) as (keyof JellyTuning)[]).flatMap((key) => (['min', 'max'] as const).map((end): [string, JellyTuning] =>
    [`${key} at its ${end}`, { ...DEFAULT_MASCOT_TRANSITION.jelly, [key]: JELLY_RANGES[key][end] }])),
];

describe('mascotTransitionAt', () => {
  it('steps at once for None: the new look, at full size and opacity, done', () => {
    expect(mascotTransitionAt(0, none)).toEqual({ scaleX: 1, scaleY: 1, opacity: 1, swapped: true, done: true });
  });

  it('fades the new look in from nothing to full opacity over the Dissolve duration, at full size', () => {
    for (const durationMs of [DISSOLVE_RANGES.durationMs.min, DEFAULT_MASCOT_TRANSITION.dissolve.durationMs, DISSOLVE_RANGES.durationMs.max]) {
      const at = (ms: number) => mascotTransitionAt(ms, dissolve(durationMs));
      expect(at(0)).toMatchObject({ opacity: 0, swapped: true, done: false });
      expect(at(durationMs / 2).opacity).toBeCloseTo(0.5, 6);
      expect(at(durationMs)).toEqual({ scaleX: 1, scaleY: 1, opacity: 1, swapped: true, done: true });
      const opacities = Array.from({ length: 101 }, (_, i) => at((durationMs * i) / 100).opacity);
      expect(opacities.every((value, i) => i === 0 || value >= opacities[i - 1])).toBe(true);
    }
  });

  it.each(JELLY_CASES)('starts and ends Jelly at height one, at full opacity, for %s', (_, tuning) => {
    const scales = heights(jelly(tuning), tuning.durationMs);
    expect(scales[0]).toBeCloseTo(1, 6);
    expect(scales.at(-1)).toBe(1);
    expect(mascotTransitionAt(tuning.durationMs, jelly(tuning))).toEqual({ scaleX: 1, scaleY: 1, opacity: 1, swapped: true, done: true });
    expect(mascotTransitionAt(tuning.durationMs / 3, jelly(tuning)).opacity).toBe(1);
  });

  it.each(JELLY_CASES)('dips below one, then passes above one, within the duration, for %s', (_, tuning) => {
    const scales = heights(jelly(tuning), tuning.durationMs, 4000);
    const low = Math.min(...scales);
    const high = Math.max(...scales);
    // A tuning at 0 keeps the height flat on that side. With no squash, only the settle swings after the peak go below one.
    if (tuning.squash > 0) expect(low).toBeCloseTo(1 - tuning.squash, 3);
    else expect(Math.min(...scales.slice(0, scales.indexOf(high) + 1))).toBeCloseTo(1, 6);
    if (tuning.overshoot > 0) expect(high).toBeCloseTo(1 + tuning.overshoot, 3);
    else expect(high).toBeCloseTo(1, 6);
    if (tuning.squash > 0 && tuning.overshoot > 0) expect(scales.indexOf(low)).toBeLessThan(scales.indexOf(high));
  });

  it('dips to 82% at 100 ms and peaks at 112% at 200 ms at the defaults', () => {
    const transition = jelly(DEFAULT_MASCOT_TRANSITION.jelly);
    expect(mascotTransitionAt(100, transition).scaleY).toBeCloseTo(0.82, 6);
    expect(mascotTransitionAt(200, transition).scaleY).toBeCloseTo(1.12, 6);
  });

  it('swaps the look at the dip and not before', () => {
    const transition = jelly(DEFAULT_MASCOT_TRANSITION.jelly);
    const dipMs = jellyDipMs(transition.jelly);
    expect(mascotTransitionAt(dipMs - 1, transition).swapped).toBe(false);
    expect(mascotTransitionAt(dipMs, transition).swapped).toBe(true);
  });

  it('swings past one once per settle count after the overshoot', () => {
    const crossings = (settle: number): number => {
      const tuning = { ...DEFAULT_MASCOT_TRANSITION.jelly, settle };
      const scales = heights(jelly(tuning), tuning.durationMs, 4000);
      const peak = scales.indexOf(Math.max(...scales));
      let count = 0;
      for (let i = peak + 1; i < scales.length; i += 1) {
        if ((scales[i - 1] - 1) * (scales[i] - 1) < 0) count += 1;
      }
      return count;
    };
    expect([0, 2, 4].map(crossings)).toEqual([0, 2, 4]);
  });

  it('moves the width against the height', () => {
    const transition = jelly(DEFAULT_MASCOT_TRANSITION.jelly);
    const dip = mascotTransitionAt(jellyDipMs(transition.jelly), transition);
    expect(dip.scaleY).toBeLessThan(1);
    expect(dip.scaleX).toBeGreaterThan(1);
  });

  it('starts a restarted Jelly at the height it had, then eases into the new dip', () => {
    const transition = jelly(DEFAULT_MASCOT_TRANSITION.jelly);
    const from = mascotTransitionAt(200, transition);
    const restarted = (ms: number) => mascotTransitionAt(ms, transition, from.scaleY);
    expect(restarted(0).scaleY).toBeCloseTo(from.scaleY, 6);
    expect(restarted(0).scaleX).toBeCloseTo(from.scaleX, 6);
    expect(restarted(jellyDipMs(transition.jelly)).scaleY).toBeCloseTo(1 - transition.jelly.squash, 6);
    expect(restarted(transition.jelly.durationMs).scaleY).toBe(1);
  });

  it('eases a height left by an interrupted Jelly back to full over a Dissolve', () => {
    const at = (ms: number) => mascotTransitionAt(ms, dissolve(250), 1.1);
    expect(at(0).scaleY).toBeCloseTo(1.1, 6);
    expect(at(0).scaleX).toBeLessThan(1);
    expect(at(125).scaleY).toBeCloseTo(1.05, 6);
    expect(at(250)).toMatchObject({ scaleX: 1, scaleY: 1 });
  });

  it('holds the rest frame past the duration', () => {
    expect(mascotTransitionAt(10_000, jelly(DEFAULT_MASCOT_TRANSITION.jelly))).toEqual({ scaleX: 1, scaleY: 1, opacity: 1, swapped: true, done: true });
    expect(mascotTransitionAt(10_000, dissolve(250)).done).toBe(true);
  });
});

describe('parseMascotTransition', () => {
  it('keeps a good transition', () => {
    const stored = { mode: 'dissolve', jelly: { durationMs: 600, squash: 0.3, overshoot: 0, settle: 4 }, dissolve: { durationMs: 900 } };
    expect(parseMascotTransition(stored)).toEqual(stored);
  });

  it('reads a missing or unreadable value as the default', () => {
    expect(parseMascotTransition(undefined)).toEqual(DEFAULT_MASCOT_TRANSITION);
    expect(parseMascotTransition('jelly')).toEqual(DEFAULT_MASCOT_TRANSITION);
  });

  it('takes the default for each bad field and keeps the good ones', () => {
    expect(parseMascotTransition({ mode: 'wobble', jelly: { durationMs: 'slow', squash: 0.3 }, dissolve: null })).toEqual({
      ...DEFAULT_MASCOT_TRANSITION,
      jelly: { ...DEFAULT_MASCOT_TRANSITION.jelly, squash: 0.3 },
    });
  });

  it('reads a transition with no tuning, such as a bare mode, as the default', () => {
    expect(parseMascotTransition({ mode: 'none' })).toEqual(DEFAULT_MASCOT_TRANSITION);
    expect(parseMascotTransition({ mode: 'dissolve', dissolve: { durationMs: 600 } })).toMatchObject({ mode: 'dissolve', dissolve: { durationMs: 600 } });
  });

  it('puts each tuning on its step', () => {
    expect(parseMascotTransition({ mode: 'jelly', jelly: { durationMs: 455, squash: 0.183, overshoot: 0.1251, settle: 1 }, dissolve: { durationMs: 333 } })).toEqual({
      mode: 'jelly',
      jelly: { durationMs: 460, squash: 0.18, overshoot: 0.13, settle: 1 },
      dissolve: { durationMs: 330 },
    });
  });

  it('holds each tuning within its range and the settle count whole', () => {
    expect(parseMascotTransition({ mode: 'jelly', jelly: { durationMs: 5, squash: 2, overshoot: -1, settle: 2.6 }, dissolve: { durationMs: 99_999 } })).toEqual({
      mode: 'jelly',
      jelly: { durationMs: JELLY_RANGES.durationMs.min, squash: JELLY_RANGES.squash.max, overshoot: JELLY_RANGES.overshoot.min, settle: 3 },
      dissolve: { durationMs: DISSOLVE_RANGES.durationMs.max },
    });
  });
});
