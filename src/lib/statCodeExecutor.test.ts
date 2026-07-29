/**
 * @vitest-environment node
 * (No DOM needed; node keeps the QuickJS WASM engine loading through its filesystem path.)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { executeStatCode, usesStatClock, STAT_CLOCK_VARS } from './statCodeExecutor';
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

describe('executeStatCode clock variables', () => {
  const big = makeStat({ max: 100000 });
  const run = (code: string, clock?: Parameters<typeof executeStatCode>[3]) =>
    executeStatCode(code, [], big, clock);

  it('exposes the turn duration, and defaults it to the flat hour when no clock is given', async () => {
    expect((await run('return deltaHours;', { deltaHours: 8 })).value).toBe(8);
    expect((await run('return deltaHours;')).value).toBe(1);
  });

  it('exposes total elapsed hours, defaulting to one turn having closed', async () => {
    expect((await run('return elapsedHours;', { elapsedHours: 30 })).value).toBe(30);
    expect((await run('return elapsedHours;')).value).toBe(1);
  });

  it('reports day and daypart at the END of the turn', async () => {
    // Default calendar opens at 08:00, so 30 elapsed hours lands on day 2 at 14:00 — afternoon.
    expect((await run('return day;', { elapsedHours: 30, deltaHours: 1 })).value).toBe(2);
    expect((await run("return daypart === 'afternoon' ? 1 : 0;", { elapsedHours: 30, deltaHours: 1 })).value).toBe(1);
  });

  it('reports the start of the turn separately, so a long turn can cross dayparts', async () => {
    // Sleep beginning at 15:00 on day 1 (elapsed 7) and running 8 hours ends at 23:00 — night.
    const sleep = { elapsedHours: 15, deltaHours: 8 };
    expect((await run("return startDaypart === 'afternoon' ? 1 : 0;", sleep)).value).toBe(1);
    expect((await run("return daypart === 'night' ? 1 : 0;", sleep)).value).toBe(1);
  });

  it('honors the world calendar when resolving the readings', async () => {
    // Opening at 22:00 puts a 4-hour turn past midnight, on day 2.
    const clock = { elapsedHours: 4, deltaHours: 4, calendar: { startHour: 22 } };
    expect((await run('return day;', clock)).value).toBe(2);
    expect((await run('return startDay;', clock)).value).toBe(1);
  });

  it('clamps a start reading at zero rather than going negative before the story began', async () => {
    expect((await run('return startDay;', { elapsedHours: 1, deltaHours: 999 })).value).toBe(1);
  });
});

describe('usesStatClock', () => {
  it('is false for code that reads no clock variable, and for empty code', () => {
    expect(usesStatClock('return stats.length;')).toBe(false);
    expect(usesStatClock('')).toBe(false);
    expect(usesStatClock(undefined)).toBe(false);
  });

  it('detects every exposed variable', () => {
    for (const name of STAT_CLOCK_VARS) {
      expect(usesStatClock(`return ${name};`)).toBe(true);
    }
  });

  it('does not fire on a longer identifier that merely contains a variable name', () => {
    expect(usesStatClock('const daysSurvived = 3; return daysSurvived;')).toBe(false);
    expect(usesStatClock('return deltaHoursExtra;')).toBe(false);
    expect(usesStatClock('return prev_elapsedHours;')).toBe(false);
  });
});
