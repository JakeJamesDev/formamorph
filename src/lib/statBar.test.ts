import { describe, it, expect } from 'vitest';
import { statPct, statBarFrame, bandOrigin } from './statBar';

describe('statPct', () => {
  it('maps a value to its percentage within [min, max]', () => {
    expect(statPct(50, 0, 100)).toBe(50);
    expect(statPct(5, 0, 10)).toBe(50);
    expect(statPct(25, 0, 50)).toBe(50);
  });

  it('clamps out-of-range values to 0..100', () => {
    expect(statPct(-5, 0, 10)).toBe(0);
    expect(statPct(15, 0, 10)).toBe(100);
  });

  it('returns 0 for a degenerate range', () => {
    expect(statPct(5, 10, 10)).toBe(0);
  });
});

describe('statBarFrame', () => {
  it('gain: band spans prev→cur, green, left-anchored', () => {
    const f = statBarFrame(40, 60, 0, 100);
    expect(f.prevPct).toBe(40);
    expect(f.curPct).toBe(60);
    expect(f.bandLeftPct).toBe(40);
    expect(f.bandWidthPct).toBe(20);
    expect(f.hasBand).toBe(true);
    expect(f.gain).toBe(true);
  });

  it('loss: band spans cur→prev, red, left edge is the current value', () => {
    const f = statBarFrame(60, 40, 0, 100);
    expect(f.bandLeftPct).toBe(40); // min(cur,prev)
    expect(f.bandWidthPct).toBe(20);
    expect(f.hasBand).toBe(true);
    expect(f.gain).toBe(false);
  });

  it('no change: no band', () => {
    const f = statBarFrame(50, 50, 0, 100);
    expect(f.hasBand).toBe(false);
    expect(f.bandWidthPct).toBe(0);
  });

  it('turn-1 baseline: prev is the world starting value', () => {
    // A stat authored starting at 50, now 60 → a +10 (20%) green band from the starting value.
    const f = statBarFrame(50, 60, 0, 50 /* max */);
    expect(f.prevPct).toBe(100); // 50 of 50
    expect(f.curPct).toBe(100);  // clamped
    expect(f.hasBand).toBe(false); // both clamp to 100 → no visible band at the ceiling
    const g = statBarFrame(20, 30, 0, 100);
    expect(g.gain).toBe(true);
    expect(g.bandWidthPct).toBe(10);
  });

  it('clamps both edges so an over-cap value cannot overflow the band', () => {
    const f = statBarFrame(90, 120, 0, 100);
    expect(f.curPct).toBe(100);
    expect(f.prevPct).toBe(90);
    expect(f.bandWidthPct).toBeCloseTo(10);
  });

  it('ignores sub-pixel changes', () => {
    const f = statBarFrame(50, 50.001, 0, 100000);
    expect(f.hasBand).toBe(false);
  });
});

describe('bandOrigin', () => {
  it('grow spreads from the previous edge', () => {
    expect(bandOrigin(true, false)).toBe('left');   // gain grows rightward from prev (left edge)
    expect(bandOrigin(false, false)).toBe('right');  // loss grows leftward from prev (right edge)
  });

  it('drain collapses toward the current edge', () => {
    expect(bandOrigin(true, true)).toBe('right');    // gain band collapses to cur (right edge)
    expect(bandOrigin(false, true)).toBe('left');    // loss band collapses to cur (left edge)
  });
});
