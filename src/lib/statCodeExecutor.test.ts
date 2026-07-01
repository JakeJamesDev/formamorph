/**
 * @vitest-environment node
 * (No DOM needed; node keeps the QuickJS WASM engine loading through its filesystem path.)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { executeStatCode } from './statCodeExecutor';
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

describe('executeStatCode', () => {
  // The function logs to console.error on its error paths by design; keep test output clean.
  beforeEach(() => vi.spyOn(console, 'error').mockImplementation(() => {}));
  afterEach(() => vi.restoreAllMocks());

  it('returns null value and no error for empty / blank code', async () => {
    expect(await executeStatCode('', [], makeStat({}))).toEqual({ value: null, error: null });
    expect(await executeStatCode('   ', [], makeStat({}))).toEqual({ value: null, error: null });
  });

  it('returns a numeric result', async () => {
    expect(await executeStatCode('return 42;', [], makeStat({}))).toEqual({ value: 42, error: null });
  });

  it('clamps the result to the stat min/max', async () => {
    const stat = makeStat({ min: 0, max: 50 });
    expect((await executeStatCode('return 999;', [], stat)).value).toBe(50);
    expect((await executeStatCode('return -999;', [], stat)).value).toBe(0);
  });

  it('errors when the code does not return a number', async () => {
    const res = await executeStatCode('return "nope";', [], makeStat({}));
    expect(res.value).toBeNull();
    expect(res.error).toMatch(/number/i);
  });

  it('errors when the code throws', async () => {
    const res = await executeStatCode('throw new Error("boom");', [], makeStat({}));
    expect(res.value).toBeNull();
    expect(res.error).toContain('boom');
  });

  it('can read other stats via the stats argument', async () => {
    const stats = [makeStat({ name: 'Strength', value: 7 })];
    const res = await executeStatCode(
      'return stats.find(s => s.name === "Strength").value * 2;',
      stats,
      makeStat({ max: 100 }),
    );
    expect(res.value).toBe(14);
  });

  it('runs in an isolated VM with no host globals (fetch/window/localStorage)', async () => {
    const res = await executeStatCode(
      `return (typeof fetch === 'undefined'
        && typeof window === 'undefined'
        && typeof localStorage === 'undefined'
        && typeof XMLHttpRequest === 'undefined') ? 1 : 0;`,
      [],
      makeStat({}),
    );
    expect(res).toEqual({ value: 1, error: null });
  });

  it('kills a runaway loop via the interrupt handler instead of hanging', async () => {
    const res = await executeStatCode('while (true) {}', [], makeStat({}));
    expect(res.value).toBeNull();
    expect(res.error).toMatch(/timed out/i);
  }, 15_000);

  it('provides a console.log shim inside the VM', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const res = await executeStatCode('console.log("hello", 5); return 1;', [], makeStat({}));
    expect(res).toEqual({ value: 1, error: null });
    expect(log).toHaveBeenCalledWith('hello', 5);
  });
});
