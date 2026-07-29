/**
 * @vitest-environment node
 * (No DOM needed; node keeps the QuickJS WASM engine loading through its filesystem path.)
 */
import { describe, it, expect } from 'vitest';
import { processStatCode } from './GameplayContextUtils';
import type { Stat } from '@/types';

const makeStat = (over: Partial<Stat>): Stat => ({
  id: '1',
  name: 'Stat',
  type: 'number',
  description: '',
  min: 0,
  max: 100,
  value: 0,
  regen: 0,
  descriptors: [],
  ...over,
});

describe('processStatCode reference identity', () => {
  it('returns the SAME array reference when no stat has code (so the caller skips a redundant setState)', async () => {
    const stats = [makeStat({ id: 'a', value: 10 }), makeStat({ id: 'b', value: 20 })];
    expect(await processStatCode(stats)).toBe(stats);
  });

  it('returns the same reference when code recomputes to the value it already had', async () => {
    const stats = [makeStat({ id: 'a', value: 42, code: 'return 42;' })];
    expect(await processStatCode(stats)).toBe(stats);
  });

  it('returns a NEW array with the updated value when code changes a stat', async () => {
    const stats = [makeStat({ id: 'a', value: 10, code: 'return 55;' })];
    const out = await processStatCode(stats);
    expect(out).not.toBe(stats);
    expect(out[0].value).toBe(55);
    expect(stats[0].value).toBe(10); // input not mutated
  });
});

describe('processStatCode clock passthrough', () => {
  it('hands the turn clock to the sandbox so code can scale by it', async () => {
    const stats = [makeStat({ id: 'a', value: 0, max: 1000, code: 'return elapsedHours * deltaHours;' })];
    const out = await processStatCode(stats, { deltaHours: 8, elapsedHours: 30 });
    expect(out[0].value).toBe(240);
  });

  it('falls back to a flat one-hour turn when no clock is passed', async () => {
    const stats = [makeStat({ id: 'a', value: 0, max: 1000, code: 'return deltaHours;' })];
    expect((await processStatCode(stats))[0].value).toBe(1);
  });
});
