/**
 * @vitest-environment node
 * (No DOM needed; node keeps the QuickJS WASM engine loading through its filesystem path.)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { executeStatCode, usesStatClock, STAT_CLOCK_VARS, type SandboxPlaceholder, type SandboxTrait, type StatCodeRunOptions } from './statCodeExecutor';
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
      'return stats.Strength.value * 2;',
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

describe('executeStatCode stats map', () => {
  beforeEach(() => vi.spyOn(console, 'error').mockImplementation(() => {}));
  afterEach(() => vi.restoreAllMocks());

  const health = makeStat({ id: 'h', name: 'Health', value: 70 });
  const vision = makeStat({ id: 'v', name: 'Night Vision', value: 30 });
  const me = makeStat({ id: 'me', name: 'Mood', value: 40, max: 1000 });
  const stats = [health, vision, me];
  const run = (code: string, list: Stat[] = stats, self: Stat = me) => executeStatCode(code, list, self);

  it('reads a stat by name, with brackets for a name with a space', async () => {
    await expect(run('return stats.Health.value + stats["Night Vision"].value;')).resolves.toEqual({ value: 100, error: null });
  });

  it('is not an array, so a find lookup fails the run', async () => {
    await expect(run('return typeof stats.find === "function" || Array.isArray(stats) ? 0 : 1;'))
      .resolves.toEqual({ value: 1, error: null });
    await expect(run('return stats.find(s => s.name === "Health").value;')).resolves.toMatchObject({ value: null, kind: 'throw' });
  });

  it('makes self the very entry the map holds under its name', async () => {
    await expect(run('return self === stats[self.name] && self === stats.Mood ? 1 : 0;')).resolves.toEqual({ value: 1, error: null });
  });

  it('reads an unknown name as a blank entry: the entry shape, names empty, every number zero', async () => {
    const code = `const blank = stats.Nope;
      const zeroed = (o) => Object.values(o).every(v => typeof v === 'object' ? zeroed(v) : v === 0 || v === '');
      return Object.keys(blank).join() === Object.keys(stats.Health).join() && zeroed(blank)
        && blank.max === 0 && !('Nope' in stats) && stats.toString.value === 0 ? 1 : 0;`;
    await expect(run(code)).resolves.toEqual({ value: 1, error: null });
  });

  it('keeps the last authored of two stats sharing a name, and a self that loses its name stands alone', async () => {
    const first = makeStat({ id: 'h1', name: 'Health', value: 10 });
    const last = makeStat({ id: 'h2', name: 'Health', value: 20 });
    await expect(run('return stats.Health.id === "h2" ? stats.Health.value : 0;', [first, last], me))
      .resolves.toEqual({ value: 20, error: null });
    await expect(run('return self !== stats.Health && self.id === "h1" ? self.value : 0;', [first, last], first))
      .resolves.toEqual({ value: 10, error: null });
  });

  it('iterates every stat with Object.values', async () => {
    await expect(run('return Object.values(stats).reduce((sum, s) => sum + s.value, 0);')).resolves.toEqual({ value: 140, error: null });
  });

  it('ignores a write to another stat through the map, and still injects currentStatId', async () => {
    await expect(run('stats.Health.value = 1; stats["Night Vision"] = 5;')).resolves.toEqual({ value: null, error: null });
    await expect(run('return currentStatId === self.id ? 1 : 0;')).resolves.toEqual({ value: 1, error: null });
  });
});

describe('executeStatCode self and turn inputs', () => {
  beforeEach(() => vi.spyOn(console, 'error').mockImplementation(() => {}));
  afterEach(() => vi.restoreAllMocks());

  const me = makeStat({ id: 'me', name: 'Mood', value: 40 });
  const other = makeStat({ id: 'other', name: 'Health', value: 70 });
  const stats = [other, me];
  const run = (code: string, turn?: StatCodeRunOptions['turn']) =>
    executeStatCode(code, stats, me, { turn });

  it('injects self as the very entry that sits in stats', async () => {
    expect((await run('return self === stats.Mood ? 1 : 0;')).value).toBe(1);
  });

  /** Every `delta` source of `self` as the sandbox reads it, as JSON. */
  const readDelta = async (turn?: StatCodeRunOptions['turn'], target = 'self') => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const res = await executeStatCode(`console.log(JSON.stringify(${target}.delta));`, stats, me, { turn });
    expect(res.error).toBeNull();
    return JSON.parse(String(log.mock.calls[0]?.[0]));
  };
  const zero = { value: 0, min: 0, max: 0, regen: 0 };

  it('carries the turn inputs on every entry, not only on self', async () => {
    const turn = {
      other: {
        previous: makeStat({ id: 'other', name: 'Health', value: 90, max: 100 }),
        delta: { ai: { value: -25, max: 10 }, regen: { value: 5 } },
      },
    };
    expect(await readDelta(turn, 'stats.Health')).toEqual({
      ai: { ...zero, value: -25, max: 10 },
      regen: { ...zero, value: 5 },
      total: { ...zero, value: -20, max: 10 },
      actual: { ...zero, value: -20 },
    });
  });

  it('reads actual as the current numbers minus previous, field by field', async () => {
    const turn = { me: { previous: makeStat({ id: 'me', value: 30, min: 5, max: 80, regen: 2 }) } };
    expect((await readDelta(turn)).actual).toEqual({ value: 10, min: -5, max: 20, regen: -2 });
  });

  it('reads an untouched turn when the caller passes no inputs', async () => {
    expect(await readDelta()).toEqual({ ai: zero, regen: zero, total: zero, actual: zero });
    expect((await run('return self.previous.value === 40 && self.previous.max === 100 ? 1 : 0;')).value).toBe(1);
  });

  it('injects neither requested nor regenApplied', async () => {
    const res = await run('return "requested" in self || "regenApplied" in self || "requested" in stats.Health ? 1 : 0;');
    expect(res.value).toBe(0);
  });

  it('freezes delta at every depth, so a write to it changes nothing', async () => {
    const turn = { me: { delta: { ai: { value: 7 } } } };
    const code = 'self.delta.ai.value = 99; self.delta.total = null; stats.Health.delta.actual.max = 5;'
      + ' return self.delta.ai.value + self.delta.total.value + stats.Health.delta.actual.max;';
    expect((await run(code, turn)).value).toBe(14);
  });

  it('carries previous as the whole stat, not only value and max', async () => {
    const res = await run(
      'return self.previous.id === "me" && self.previous.name === "Mood" && self.previous.regen === 0 ? 1 : 0;',
    );
    expect(res.value).toBe(1);
  });

  it('freezes previous, so a write to it changes nothing', async () => {
    const res = await run('self.previous.value = 999; return self.previous.value;');
    expect(res.value).toBe(40);
  });

  it('sets the value from a self.value write with no return', async () => {
    expect(await run('self.value = 12;')).toEqual({ value: 12, error: null });
  });

  it('lets a number return win over a self.value write', async () => {
    expect((await run('self.value = 12; return 30;')).value).toBe(30);
  });

  it('reports no write when the code neither returns nor changes self.value', async () => {
    expect(await run('const x = self.value * 2;')).toEqual({ value: null, error: null });
    expect(await run('self.value = self.value; return undefined;')).toEqual({ value: null, error: null });
  });

  it('clamps a self.value write to the stat range', async () => {
    expect((await run('self.value = 500;')).value).toBe(100);
  });

  it('fails on a non-number return even after a valid write', async () => {
    const res = await run('self.value = 12; return null;');
    expect(res).toMatchObject({ value: null, kind: 'non-number' });
  });

  it('fails when self.value is written with something other than a number', async () => {
    expect(await run('self.value = "high";')).toMatchObject({ value: null, kind: 'non-number' });
  });

  it('lets a number return win over a non-number self.value write', async () => {
    expect(await run('self.value = "high"; return 30;')).toEqual({ value: 30, error: null });
  });

  it('discards a write when the code throws after making it', async () => {
    expect(await run('self.value = 12; throw new Error("late");')).toMatchObject({ value: null, kind: 'throw' });
  });

  it('ignores a write to another stat entry', async () => {
    expect(await run('stats.Health.value = 1;')).toEqual({ value: null, error: null });
  });
});

describe('executeStatCode bound writes', () => {
  beforeEach(() => vi.spyOn(console, 'error').mockImplementation(() => {}));
  afterEach(() => vi.restoreAllMocks());

  const me = makeStat({ id: 'me', min: 10, max: 100, value: 40, regen: 2 });
  const run = (code: string) => executeStatCode(code, [me], me);

  it('reads each bound write back out, and only the ones that changed', async () => {
    expect(await run('self.min = 5; self.max = 60; self.regen = -1;'))
      .toEqual({ value: null, error: null, bounds: { min: 5, max: 60, regen: -1 } });
    expect(await run('self.max = 60; self.regen = self.regen;'))
      .toEqual({ value: null, error: null, bounds: { max: 60 } });
  });

  it('clamps a value write to the range the same run wrote', async () => {
    expect(await run('self.max = 30; self.value = 90;')).toEqual({ value: 30, error: null, bounds: { max: 30 } });
    expect(await run('self.min = 50; return 20;')).toEqual({ value: 50, error: null, bounds: { min: 50 } });
  });

  it('floors the written max at the written min when it clamps the value', async () => {
    expect((await run('self.min = 70; self.max = 20; self.value = 0;')).value).toBe(70);
  });

  it('fails the run on a bound that is not a finite number, discarding every write', async () => {
    for (const code of ['self.max = "high"; self.value = 5;', 'self.min = NaN;', 'self.regen = Infinity;']) {
      expect(await run(code), code).toMatchObject({ value: null, kind: 'non-number' });
      expect((await run(code)).bounds, code).toBeUndefined();
    }
  });

  it('discards a bound write when the code throws after making it', async () => {
    const res = await run('self.max = 60; throw new Error("late");');
    expect(res).toMatchObject({ value: null, kind: 'throw' });
    expect(res.bounds).toBeUndefined();
  });
});

describe('executeStatCode on the bundled worlds', () => {
  const worlds = import.meta.glob<{ default: { stats?: Stat[] } }>('../defaultworlds/*.json', { eager: true });
  const coded = Object.entries(worlds).flatMap(([path, world]) =>
    (world.default.stats ?? []).filter(s => s.code?.trim()).map(s => [path, s.name, s, world.default.stats ?? []] as const));

  it('finds stat code to run, so the guard below is not vacuous', () => {
    expect(coded.length).toBeGreaterThan(0);
  });

  it.each(coded)('%s: %s still returns a number', async (_path, _name, stat, stats) => {
    const res = await executeStatCode(stat.code ?? '', stats, stat);
    expect(res.error).toBeNull();
    expect(typeof res.value).toBe('number');
  });
});

describe('executeStatCode clock variables', () => {
  const big = makeStat({ max: 100000 });
  const run = (code: string, clock?: StatCodeRunOptions['clock']) =>
    executeStatCode(code, [], big, { clock });

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

describe('executeStatCode placeholders', () => {
  const stat = makeStat({ id: 'a', max: 1000 });
  const entry = (name: string, value: string, roll = () => value): SandboxPlaceholder => ({ name, value, values: [value], roll });
  const run = (code: string, placeholders: SandboxPlaceholder[]) =>
    executeStatCode(code, [stat], stat, { placeholders });

  it('calls the host roll for the entry it hangs off', async () => {
    const roll = vi.fn(() => 'drawn');
    await expect(run('return placeholders.Mood.roll() === "drawn" ? 1 : 0;', [entry('Mood', 'calm', roll), entry('Hair', 'red')]))
      .resolves.toEqual({ value: 1, error: null });
    expect(roll).toHaveBeenCalledTimes(1);
  });

  it('leaves no trace of the roll hook for the code to reach', async () => {
    await expect(run('return Object.keys(globalThis).some(k => /roll/i.test(k)) ? 0 : 1;', [entry('Mood', 'calm')]))
      .resolves.toEqual({ value: 1, error: null });
  });

  it('keys a name like __proto__ as a plain entry, and an inherited member name reads as a blank entry', async () => {
    const code = 'return placeholders.__proto__.value === "odd" && placeholders.toString.value === "" ? 1 : 0;';
    await expect(run(code, [entry('__proto__', 'odd')])).resolves.toEqual({ value: 1, error: null });
  });
});

describe('executeStatCode placeholder writes', () => {
  const stat = makeStat({ id: 'a', max: 1000 });
  const entry = (name: string, value: string): SandboxPlaceholder => ({ name, value, values: [value], roll: () => value });
  const run = (code: string, placeholders = [entry('Mood', 'calm'), entry('Hair', 'red')]) =>
    executeStatCode(code, [stat], stat, { placeholders });

  it('reads a changed value back as a write, leaving the value alone', async () => {
    await expect(run('placeholders.Mood.value = "Furious";'))
      .resolves.toEqual({ value: null, error: null, placeholders: [{ name: 'Mood', text: 'Furious' }] });
  });

  it('writes the text a value is set to even when it already reads that way, so it pins', async () => {
    await expect(run('placeholders.Mood.value = "calm";'))
      .resolves.toEqual({ value: null, error: null, placeholders: [{ name: 'Mood', text: 'calm' }] });
  });

  it('writes nothing for an entry the code only reads', async () => {
    await expect(run('return placeholders.Mood.value === "calm" ? 1 : 0;')).resolves.toEqual({ value: 1, error: null });
  });

  it('takes a string assigned to the entry itself as a write to its value', async () => {
    await expect(run('placeholders.Mood = "Furious"; return 1;'))
      .resolves.toEqual({ value: 1, error: null, placeholders: [{ name: 'Mood', text: 'Furious' }] });
  });

  it('writes a number as its text', async () => {
    await expect(run('placeholders.Mood.value = 3;'))
      .resolves.toEqual({ value: null, error: null, placeholders: [{ name: 'Mood', text: '3' }] });
  });

  it('writes each placeholder the run changed, in the order the map holds them', async () => {
    await expect(run('placeholders.Hair.value = "grey"; placeholders.Mood.value = "Furious";')).resolves.toEqual({
      value: null, error: null, placeholders: [{ name: 'Mood', text: 'Furious' }, { name: 'Hair', text: 'grey' }],
    });
  });

  it('reads unpin() back as an unpin, with the value unchanged for the rest of the run', async () => {
    await expect(run('placeholders.Mood.unpin(); return placeholders.Mood.value === "calm" ? 1 : 0;'))
      .resolves.toEqual({ value: 1, error: null, placeholders: [{ name: 'Mood', unpin: true }] });
  });

  it('keeps the last of a write and an unpin', async () => {
    await expect(run('placeholders.Mood.unpin(); placeholders.Mood.value = "Furious";'))
      .resolves.toEqual({ value: null, error: null, placeholders: [{ name: 'Mood', text: 'Furious' }] });
    await expect(run('placeholders.Mood.value = "Furious"; placeholders.Mood.unpin();'))
      .resolves.toEqual({ value: null, error: null, placeholders: [{ name: 'Mood', unpin: true }] });
  });

  it('reads pin() back as the same write a value assignment makes', async () => {
    await expect(run('placeholders.Mood.pin("Furious");'))
      .resolves.toEqual({ value: null, error: null, placeholders: [{ name: 'Mood', text: 'Furious' }] });
  });

  it('keeps the last of pin, value and unpin, whichever order code calls them', async () => {
    await expect(run('placeholders.Mood.pin("Furious"); placeholders.Mood.unpin();'))
      .resolves.toEqual({ value: null, error: null, placeholders: [{ name: 'Mood', unpin: true }] });
    await expect(run('placeholders.Mood.unpin(); placeholders.Mood.pin("Furious");'))
      .resolves.toEqual({ value: null, error: null, placeholders: [{ name: 'Mood', text: 'Furious' }] });
    await expect(run('placeholders.Mood.pin("Furious"); placeholders.Mood.value = "calm";'))
      .resolves.toEqual({ value: null, error: null, placeholders: [{ name: 'Mood', text: 'calm' }] });
    await expect(run('placeholders.Mood.value = "calm"; placeholders.Mood.pin("Furious");'))
      .resolves.toEqual({ value: null, error: null, placeholders: [{ name: 'Mood', text: 'Furious' }] });
  });

  it('drops a pin() on a name the world has no placeholder for, and reports it', async () => {
    await expect(run('placeholders.Gone.pin("x"); placeholders.Mood.value = "Furious";')).resolves.toEqual({
      value: null, error: null, placeholders: [{ name: 'Mood', text: 'Furious' }], unknownPlaceholders: ['Gone'],
    });
  });

  it('fails the run on a pin() argument that is not text, the same way a bad value write does', async () => {
    const result = await run('placeholders.Mood.pin({});');
    expect(result).toMatchObject({ value: null, kind: 'bad-write' });
    expect(result.error).toContain('placeholders.Mood.value must be text');
    expect(result.placeholders).toBeUndefined();
  });

  it('drops a write to a name the world has no placeholder for, and reports it, keeping the other writes', async () => {
    const code = 'placeholders.Nope = "x"; placeholders["Also Nope"] = { value: "y" }; placeholders.Gone.value = "z"; placeholders.Mood.value = "Furious";';
    await expect(run(code)).resolves.toEqual({
      value: null, error: null, placeholders: [{ name: 'Mood', text: 'Furious' }], unknownPlaceholders: ['Nope', 'Also Nope', 'Gone'],
    });
  });

  it('reads an unknown name as a placeholder with no text, and a read of it reports nothing', async () => {
    await expect(run('return placeholders.Gone.value === "" && placeholders.Gone.values.length === 0 && !("Gone" in placeholders) ? 1 : 0;'))
      .resolves.toEqual({ value: 1, error: null });
  });

  it('keeps the readers of its writes out of the code’s reach', async () => {
    await expect(run('return typeof __formamorphPlaceholderWrites === "undefined" && typeof __formamorphTraitWrites === "undefined" ? 1 : 0;'))
      .resolves.toEqual({ value: 1, error: null });
  });

  it('fails the run on a value that is not text, discarding every write', async () => {
    const result = await run('self.value = 5; placeholders.Hair.value = "grey"; placeholders.Mood.value = {};');
    expect(result).toMatchObject({ value: null, kind: 'bad-write' });
    expect(result.error).toContain('placeholders.Mood.value must be text');
    expect(result.placeholders).toBeUndefined();
  });

  it('discards the writes of a run that throws after making them', async () => {
    const result = await run('placeholders.Mood.value = "Furious"; throw new Error("late");');
    expect(result).toMatchObject({ value: null, kind: 'throw' });
    expect(result.placeholders).toBeUndefined();
  });
});

describe('executeStatCode traits', () => {
  const stat = makeStat({ id: 'a', max: 1000 });
  const brave: SandboxTrait = { name: 'Brave', enabled: true, acquired: true };
  const timid: SandboxTrait = { name: 'Timid', enabled: false, acquired: true };
  const cursed: SandboxTrait = { name: 'Cursed', enabled: false, acquired: false };
  const run = (code: string, traits: SandboxTrait[] = [brave, timid, cursed]) =>
    executeStatCode(code, [stat], stat, { traits });

  it('reads enabled and acquired for each of the three trait states', async () => {
    const code = 'const t = traits; return [t.Brave, t.Timid, t.Cursed].map(e => (e.enabled ? 2 : 0) + (e.acquired ? 1 : 0)).join("") * 1;';
    await expect(run(code)).resolves.toEqual({ value: 310, error: null });
  });

  it('offers an empty map when the run carries no traits', async () => {
    await expect(run('return Object.keys(traits).length + 1;', [])).resolves.toEqual({ value: 1, error: null });
  });

  it('reads a changed enabled back as a switch', async () => {
    await expect(run('traits.Cursed.enabled = true; traits.Brave.enabled = false;')).resolves.toEqual({
      value: null, error: null, traits: [{ name: 'Brave', enabled: false }, { name: 'Cursed', enabled: true }],
    });
  });

  it('reads every assignment as a switch, even one to the state it read, and a plain read as none', async () => {
    await expect(run('traits.Brave.enabled = true; traits.Timid.enabled = true; traits.Timid.enabled = false; return 1;'))
      .resolves.toEqual({ value: 1, error: null, traits: [{ name: 'Brave', enabled: true }, { name: 'Timid', enabled: false }] });
    await expect(run('return traits.Brave.enabled ? 1 : 0;')).resolves.toEqual({ value: 1, error: null });
  });

  it('takes true or false assigned to the entry itself as a switch', async () => {
    await expect(run('traits.Cursed = true; return 1;'))
      .resolves.toEqual({ value: 1, error: null, traits: [{ name: 'Cursed', enabled: true }] });
  });

  it('keeps acquired as it was, and reports the write', async () => {
    await expect(run('traits.Cursed.acquired = true; return traits.Cursed.acquired ? 0 : 1;'))
      .resolves.toEqual({ value: 1, error: null, acquiredWrites: ['Cursed'] });
  });

  it('drops a switch of a name the world has no trait for, and reports it, keeping the other switches', async () => {
    const code = 'traits.Nope = true; traits["Also Nope"] = { enabled: false }; traits.Gone.enabled = true; traits.Cursed.enabled = true;';
    await expect(run(code)).resolves.toEqual({
      value: null, error: null, traits: [{ name: 'Cursed', enabled: true }], unknownTraits: ['Nope', 'Also Nope', 'Gone'],
    });
  });

  it('reads an unknown name as a trait nobody has, and a read of it reports nothing', async () => {
    await expect(run('return traits.Gone.enabled || traits.Gone.acquired || "Gone" in traits ? 0 : 1;'))
      .resolves.toEqual({ value: 1, error: null });
  });

  it('fails the run on an enabled that is not true or false, discarding every write', async () => {
    const result = await run('traits.Cursed.enabled = true; traits.Brave.enabled = 0;');
    expect(result).toMatchObject({ value: null, kind: 'bad-write' });
    expect(result.error).toContain('traits.Brave.enabled must be true or false');
    expect(result.traits).toBeUndefined();
  });

  it('discards the switches of a run that throws after making them', async () => {
    const result = await run('traits.Cursed.enabled = true; throw new Error("late");');
    expect(result).toMatchObject({ value: null, kind: 'throw' });
    expect(result.traits).toBeUndefined();
  });
});
