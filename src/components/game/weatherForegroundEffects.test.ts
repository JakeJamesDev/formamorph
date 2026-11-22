import { describe, it, expect } from 'vitest';
import { ALLOWED_KINDS } from '@/lib/weather';
import { createForegroundEffect, FOREGROUND_DURATION, stormFlash } from './weatherForegroundEffects';

/** A repeatable stand-in for `Math.random`. */
function seeded(seed: number) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
}

/** A context that counts draws and ignores the rest. */
function fakeContext() {
  let draws = 0;
  const gradient = () => ({ addColorStop: () => {} });
  const ctx = new Proxy({}, {
    get: (_t, name) => {
      if (name === 'createLinearGradient' || name === 'createRadialGradient') return gradient;
      if (name === 'fill' || name === 'stroke' || name === 'fillRect') return () => { draws += 1; };
      return () => {};
    },
    set: () => true,
  }) as unknown as CanvasRenderingContext2D;
  return { ctx, draws: () => draws };
}

describe('foreground effects', () => {
  it.each(ALLOWED_KINDS)('%s plays a few seconds and draws while it plays', (kind) => {
    const effect = createForegroundEffect(kind, 1280, 800, () => 0.5);
    expect(effect.duration).toBe(FOREGROUND_DURATION[kind]);
    expect(effect.duration).toBeGreaterThanOrEqual(1);
    expect(effect.duration).toBeLessThanOrEqual(5);
    const { ctx, draws } = fakeContext();
    for (let t = 0; t < effect.duration; t += 0.1) effect.frame(ctx, t);
    expect(draws()).toBeGreaterThan(0);
  });

  it('piles Snow into a drift that deepens as flakes land, then sinks as it melts', () => {
    // The highest point any path reaches, as a `y` from the top: lower numbers mean a deeper drift.
    const crest = (t: number) => {
      let top = Infinity;
      const ctx = new Proxy({}, {
        get: (_t, name) => {
          if (name === 'createLinearGradient' || name === 'createRadialGradient') return () => ({ addColorStop: () => {} });
          if (name === 'lineTo') return (_x: number, y: number) => { top = Math.min(top, y); };
          return () => {};
        },
        set: () => true,
      }) as unknown as CanvasRenderingContext2D;
      createForegroundEffect('snow', 1280, 800, seeded(7)).frame(ctx, t);
      return 800 - top;
    };
    expect(crest(0.5)).toBe(-Infinity);
    expect(crest(2)).toBeGreaterThan(10);
    expect(crest(2.7)).toBeGreaterThan(crest(2));
    expect(crest(3.8)).toBeLessThan(crest(2.7));
  });

  it('builds the Storm bolt on a canvas with no height', () => {
    expect(createForegroundEffect('storm', 0, 0, () => 0.5).duration).toBe(FOREGROUND_DURATION.storm);
  });
});

describe('the Storm flash', () => {
  it('flashes once in its whole length, at 60 frames per second', () => {
    let starts = 0;
    let prev = 0;
    for (let frame = 0; frame / 60 <= FOREGROUND_DURATION.storm; frame++) {
      const now = stormFlash(frame / 60);
      if (now > 0 && prev === 0) starts += 1;
      prev = now;
    }
    expect(starts).toBe(1);
  });

  it('is dark before the flash and after it fades, and lit just after it starts', () => {
    expect(stormFlash(0)).toBe(0);
    expect(stormFlash(0.2)).toBeGreaterThan(0.5);
    expect(stormFlash(FOREGROUND_DURATION.storm - 0.01)).toBe(0);
  });
});
