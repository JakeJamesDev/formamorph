import { describe, it, expect } from 'vitest';
import { ALLOWED_KINDS } from '@/lib/weather';
import { createWeatherEffect, nextFlashDelay, particleCount } from './weatherEffects';

/** A seeded random source, so a schedule is the same on every run. */
function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

/** A context that records how often each kind of draw happens and ignores the rest. */
function fakeContext() {
  const calls = { fillRect: 0, stroke: 0, fill: 0 };
  const ctx = new Proxy({}, {
    get: (_t, name) => {
      if (name === 'createLinearGradient') return () => ({ addColorStop: () => {} });
      if (name in calls) return () => { calls[name as keyof typeof calls] += 1; };
      return () => {};
    },
    set: () => true,
  }) as unknown as CanvasRenderingContext2D;
  return { ctx, calls };
}

const COLORS = { rain: '255, 255, 255', snow: '255, 255, 255' };

describe('storm flashes', () => {
  it('start under three times in any one second, over an hour of storm', () => {
    for (const seed of [1, 7, 42, 99]) {
      const rand = seeded(seed);
      const starts: number[] = [];
      for (let t = 0; t < 3600;) {
        t += nextFlashDelay(rand);
        starts.push(t);
      }
      for (let i = 0; i + 2 < starts.length; i++) expect(starts[i + 2] - starts[i]).toBeGreaterThan(1);
    }
  });

  it('fire while a full storm runs at 60 frames a second, and stay under three in each second', () => {
    const flashes: number[] = [];
    let now = 0;
    const effect = createWeatherEffect('storm', 'full', 800, 600, seeded(3), () => flashes.push(now));
    const { ctx } = fakeContext();
    for (let frame = 0; frame < 60 * 120; frame++) {
      now = frame / 60;
      effect.frame(ctx, 1 / 60, COLORS);
    }
    expect(flashes.length).toBeGreaterThan(5);
    for (let i = 0; i + 2 < flashes.length; i++) expect(flashes[i + 2] - flashes[i]).toBeGreaterThan(1);
  });

  it('never fire in the calm storm', () => {
    let flashes = 0;
    const effect = createWeatherEffect('storm', 'calm', 800, 600, seeded(3), () => { flashes += 1; });
    const { ctx, calls } = fakeContext();
    for (let frame = 0; frame < 60 * 120; frame++) effect.frame(ctx, 1 / 60, COLORS);
    expect(flashes).toBe(0);
    expect(calls.fillRect).toBe(0);
    expect(calls.stroke).toBe(60 * 120);
  });
});

describe('particle counts', () => {
  it('scale down on a small screen', () => {
    for (const kind of ['rain', 'snow', 'storm'] as const) {
      expect(particleCount(kind, 'full', 375, 812)).toBeLessThan(particleCount(kind, 'full', 1920, 1080));
    }
  });

  it('drop in the calm mode', () => {
    expect(particleCount('rain', 'calm', 1920, 1080)).toBeLessThan(particleCount('rain', 'full', 1920, 1080));
  });

  it('stay capped on a very large screen', () => {
    expect(particleCount('storm', 'full', 7680, 4320)).toBe(particleCount('storm', 'full', 3840, 2160));
  });
});

/** A context that records each moveTo → lineTo segment of the frame, and ignores the rest. */
function segmentContext() {
  let at: [number, number] = [0, 0];
  const segments: { dx: number; dy: number }[] = [];
  const ctx = new Proxy({}, {
    get: (_t, name) => {
      if (name === 'createLinearGradient') return () => ({ addColorStop: () => {} });
      if (name === 'moveTo') return (x: number, y: number) => { at = [x, y]; };
      if (name === 'lineTo') return (x: number, y: number) => { segments.push({ dx: at[0] - x, dy: at[1] - y }); };
      return () => {};
    },
    set: () => true,
  }) as unknown as CanvasRenderingContext2D;
  return { ctx, segments };
}

/** The rain's lean on one frame: sideways over down, read from the first streak drawn. */
function leanAt(effect: ReturnType<typeof createWeatherEffect>) {
  const { ctx, segments } = segmentContext();
  effect.frame(ctx, 1 / 60, COLORS);
  return segments[0].dx / segments[0].dy;
}

describe('every kind', () => {
  it.each(ALLOWED_KINDS)('%s draws on every frame in both modes', (kind) => {
    for (const mode of ['full', 'calm'] as const) {
      const effect = createWeatherEffect(kind, mode, 800, 600, seeded(5));
      const { ctx, calls } = fakeContext();
      for (let frame = 0; frame < 60 * 10; frame++) effect.frame(ctx, 1 / 60, COLORS);
      expect(calls.fill + calls.stroke + calls.fillRect).toBeGreaterThanOrEqual(60 * 10);
    }
  });
});

describe('wind', () => {
  it('leans storm rain harder than rain, and gusts it while rain holds steady', () => {
    const storm = createWeatherEffect('storm', 'full', 800, 600, seeded(2));
    const rain = createWeatherEffect('rain', 'full', 800, 600, seeded(2));
    const stormLeans: number[] = [];
    const rainLeans: number[] = [];
    for (let frame = 0; frame < 60 * 20; frame++) {
      stormLeans.push(leanAt(storm));
      rainLeans.push(leanAt(rain));
    }
    expect(Math.min(...stormLeans)).toBeGreaterThan(Math.max(...rainLeans));
    expect(Math.max(...stormLeans) - Math.min(...stormLeans)).toBeGreaterThan(0.1);
    expect(Math.max(...rainLeans) - Math.min(...rainLeans)).toBeLessThan(1e-9);
  });

  it('drives blizzard snow sideways faster than it falls', () => {
    const effect = createWeatherEffect('blizzard', 'full', 800, 600, seeded(4));
    const { ctx, segments } = segmentContext();
    effect.frame(ctx, 1 / 60, COLORS);
    const sideways = segments.reduce((sum, s) => sum + s.dx, 0);
    const down = segments.reduce((sum, s) => sum + s.dy, 0);
    expect(sideways).toBeGreaterThan(down);
  });
});

describe('hail', () => {
  it('bounces where it lands: some pellets show as dots once the first ones reach the ground', () => {
    const effect = createWeatherEffect('hail', 'full', 800, 600, seeded(6));
    const { ctx } = fakeContext();
    for (let frame = 0; frame < 60; frame++) effect.frame(ctx, 1 / 60, COLORS);
    const { ctx: rec, segments } = segmentContext();
    effect.frame(rec, 1 / 60, COLORS);
    expect(segments.some((s) => Math.abs(s.dy) < 1)).toBe(true);
    expect(segments.some((s) => s.dy > 5)).toBe(true);
  });
});
