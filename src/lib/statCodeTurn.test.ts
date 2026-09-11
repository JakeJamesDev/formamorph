/**
 * @vitest-environment node
 * (No DOM needed; node keeps the QuickJS WASM engine loading through its filesystem path.)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { runStatCodeTurn, type StatCodeTurn } from './statCodeTurn';
import type { PlayerStat } from '@/types';

const stat = (over: Partial<PlayerStat>): PlayerStat => ({
  id: 'x', name: 'Stat', type: 'number', description: '', min: 0, max: 100, value: 50, regen: 0, descriptors: [],
  ...over,
});

/** A turn where nothing happened unless a case says so: no asks, no regen, previous equal to now. */
const turn = (over: Partial<StatCodeTurn> & Pick<StatCodeTurn, 'stats'>): StatCodeTurn => ({
  enabled: {}, previous: over.stats, asks: [], regenApplied: {}, clock: {}, ...over,
});

const valueOf = (stats: readonly PlayerStat[], id: string) => stats.find(s => s.id === id)?.value;

describe('runStatCodeTurn', () => {
  beforeEach(() => vi.spyOn(console, 'error').mockImplementation(() => {}));
  afterEach(() => vi.restoreAllMocks());

  it('sets the value from a number return, as stat code always has', async () => {
    const out = await runStatCodeTurn(turn({ stats: [stat({ id: 'a', code: 'return 42;' })] }));
    expect(valueOf(out.stats, 'a')).toBe(42);
    expect(out.moved).toEqual(['a']);
  });

  it('sets the value from a self.value write with no return', async () => {
    const out = await runStatCodeTurn(turn({ stats: [stat({ id: 'a', code: 'self.value = 7;' })] }));
    expect(valueOf(out.stats, 'a')).toBe(7);
    expect(out.moved).toEqual(['a']);
  });

  it('keeps the pipeline result for a value the code leaves alone', async () => {
    const stats = [stat({ id: 'a', value: 63, code: 'const seen = self.value;' })];
    const out = await runStatCodeTurn(turn({ stats }));
    expect(valueOf(out.stats, 'a')).toBe(63);
    expect(out.moved).toEqual([]);
    expect(out.stats).toBe(stats);
  });

  it('lets code halve an AI gain it reads from requested and previous', async () => {
    // The AI asked +20 onto 50, so the pipeline already shows 70; the code keeps half of the ask.
    const code = 'self.value = self.previous.value + self.requested.value / 2;';
    const out = await runStatCodeTurn(turn({
      stats: [stat({ id: 'a', value: 70, code })],
      previous: [stat({ id: 'a', value: 50 })],
      asks: [{ id: 'a', value: 20, max: 0 }],
    }));
    expect(valueOf(out.stats, 'a')).toBe(60);
  });

  it('hands code the raw ask, before the flags and the clamp shaped it', async () => {
    // noIncrease blocked the +30 and the pipeline value stayed 50, but the ask itself reaches the code.
    const out = await runStatCodeTurn(turn({
      stats: [stat({ id: 'a', value: 50, noIncrease: true, code: 'return self.requested.value;' })],
      asks: [{ id: 'a', value: 30, max: 5 }],
    }));
    expect(valueOf(out.stats, 'a')).toBe(30);
  });

  it('exposes the regen this turn applied', async () => {
    const out = await runStatCodeTurn(turn({
      stats: [stat({ id: 'a', value: 55, code: 'return self.value - self.regenApplied;' })],
      regenApplied: { a: 5 },
    }));
    expect(valueOf(out.stats, 'a')).toBe(50);
  });

  it('matches previous by id, and reads a stat missing from it as unmoved', async () => {
    const out = await runStatCodeTurn(turn({
      stats: [
        stat({ id: 'a', value: 70, max: 120, code: 'return self.previous.max;' }),
        stat({ id: 'b', value: 30, code: 'return self.previous.value + 1;' }),
      ],
      previous: [stat({ id: 'a', value: 50, max: 90 })],
    }));
    expect(valueOf(out.stats, 'a')).toBe(90);
    expect(valueOf(out.stats, 'b')).toBe(31);
  });

  it('discards a write when the code throws after making it', async () => {
    const out = await runStatCodeTurn(turn({
      stats: [stat({ id: 'a', value: 50, code: 'self.value = 9; throw new Error("late");' })],
    }));
    expect(valueOf(out.stats, 'a')).toBe(50);
    expect(out.moved).toEqual([]);
  });

  it('discards a write when the code times out after making it', async () => {
    const out = await runStatCodeTurn(turn({
      stats: [stat({ id: 'a', value: 50, code: 'self.value = 9; while (true) {}' })],
    }));
    expect(valueOf(out.stats, 'a')).toBe(50);
  }, 15_000);

  it('never writes a stat other than the one the code belongs to', async () => {
    const out = await runStatCodeTurn(turn({
      stats: [
        stat({ id: 'a', value: 50, code: 'stats.find(s => s.id === "b").value = 1; return 10;' }),
        stat({ id: 'b', value: 80 }),
      ],
    }));
    expect(valueOf(out.stats, 'b')).toBe(80);
    expect(out.moved).toEqual(['a']);
  });

  it('keeps a disabled stat inert and hides it from every other stat', async () => {
    const out = await runStatCodeTurn(turn({
      stats: [
        stat({ id: 'a', value: 50, code: 'return stats.length * 10 + (stats.some(s => s.id === "off") ? 1 : 0);' }),
        stat({ id: 'off', value: 5, code: 'return 99;' }),
      ],
      enabled: { off: false },
    }));
    expect(valueOf(out.stats, 'a')).toBe(10);
    expect(valueOf(out.stats, 'off')).toBe(5);
    expect(out.moved).toEqual(['a']);
  });

  it('reads zero asks on a clock-only run, with the clock still ticking', async () => {
    const out = await runStatCodeTurn(turn({
      stats: [stat({ id: 'a', value: 50, max: 1000, code: 'return self.requested.value + self.requested.max + deltaHours * 100;' })],
      asks: [],
      clock: { deltaHours: 3, elapsedHours: 10 },
    }));
    expect(valueOf(out.stats, 'a')).toBe(300);
  });

  it('gives the same result for the same turn, so a re-roll does not stack', async () => {
    const input = turn({
      stats: [stat({ id: 'a', value: 70, code: 'self.value = self.previous.value + self.requested.value / 2;' })],
      previous: [stat({ id: 'a', value: 50 })],
      asks: [{ id: 'a', value: 20, max: 0 }],
    });
    const first = await runStatCodeTurn(input);
    const second = await runStatCodeTurn(input);
    expect(valueOf(second.stats, 'a')).toBe(valueOf(first.stats, 'a'));
    expect(valueOf(second.stats, 'a')).toBe(60);
  });
});
