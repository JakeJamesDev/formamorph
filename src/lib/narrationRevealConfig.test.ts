import { describe, it, expect } from 'vitest';
import {
  pacedStagger, flooredTiming, TARGET_BUFFER_WORDS, DRAIN_TARGET_WORDS, STAGGER_MIN, STAGGER_MAX, FADE_SPREAD,
} from './narrationRevealConfig';

const BASE = 40; // measured ms/word

describe('pacedStagger', () => {
  it('MUST be > 1 sentence: a single-sentence backlog slows down to build the buffer, not speed up', () => {
    // The regression that broke production: with a target under one sentence, a lone queued sentence
    // reads as "over buffer" → reveal faster than arrival → drain → starve every sentence. The target
    // must exceed a sentence so a ~15-word backlog is UNDER target → reveal slower → buffer builds.
    const oneSentence = 15;
    expect(oneSentence).toBeLessThan(TARGET_BUFFER_WORDS);
    expect(pacedStagger(BASE, oneSentence, false)).toBeGreaterThan(BASE);
  });

  it('at the target backlog it reveals right at the measured rate (equilibrium)', () => {
    expect(pacedStagger(BASE, TARGET_BUFFER_WORDS, false)).toBe(BASE);
  });

  it('speeds up when the backlog is well over target (drains toward it)', () => {
    expect(pacedStagger(BASE, TARGET_BUFFER_WORDS * 4, false)).toBeLessThan(BASE);
  });

  it('while draining, targets a small buffer and never reveals slower than the measured rate', () => {
    // A big leftover buffer drains fast…
    expect(pacedStagger(BASE, TARGET_BUFFER_WORDS, true)).toBeLessThan(BASE);
    // …and a nearly-empty tail is capped at the measured rate, never slower (no dawdling).
    expect(pacedStagger(BASE, 1, true)).toBeLessThanOrEqual(BASE);
    expect(DRAIN_TARGET_WORDS).toBeLessThan(TARGET_BUFFER_WORDS);
  });

  it('clamps to the readable stagger bounds', () => {
    expect(pacedStagger(5000, 1, false)).toBe(STAGGER_MAX); // absurdly slow rate → ceiling
    expect(pacedStagger(1, TARGET_BUFFER_WORDS * 100, false)).toBe(STAGGER_MIN); // fast + deep backlog → floor
  });
});

describe('flooredTiming', () => {
  it('raises stagger to the floor and keeps duration a spread multiple of it', () => {
    expect(flooredTiming({ stagger: 5, duration: 20 }, 50, 0)).toEqual({ stagger: 50, duration: 50 * FADE_SPREAD });
  });

  it('respects a duration floor above the derived spread', () => {
    const t = flooredTiming({ stagger: 10, duration: 40 }, 0, 500);
    expect(t.duration).toBe(500);
  });
});
