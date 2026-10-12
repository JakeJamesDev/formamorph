/**
 * @vitest-environment node
 * (No DOM needed; node keeps the QuickJS WASM engine loading through its filesystem path.)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { executeStatCode } from './statCodeExecutor';
import type { Stat } from '@/types';

const makeStat = (over: Partial<Stat>): Stat => ({
  id: '1', name: 'Stat', type: 'number', description: '', min: 0, max: 100, value: 0, regen: 0, descriptors: [], ...over,
});

describe('executeStatCode writes to other stats', () => {
  beforeEach(() => vi.spyOn(console, 'error').mockImplementation(() => {}));
  afterEach(() => vi.restoreAllMocks());

  const health = makeStat({ id: 'h', name: 'Health', min: 0, max: 100, value: 70, regen: 1 });
  const luck = makeStat({ id: 'l', name: 'Luck', value: 5 });
  const vision = makeStat({ id: 'v', name: 'Night Vision', value: 30 });
  const off = makeStat({ id: 'o', name: 'Off', value: 9 });
  const me = makeStat({ id: 'me', name: 'Dice', value: 0, max: 20 });
  const stats = [health, luck, vision, off, me];
  const run = (code: string, list: Stat[] = stats, self: Stat = me) =>
    executeStatCode(code, list, self, { enabled: { o: false } });

  it('returns one write per written entry, keyed by the target, in map order', async () => {
    const res = await run('stats.Luck.value += 1; stats.Health.max = 80; stats["Night Vision"].regen = 2; return 20;');
    expect(res).toEqual({
      value: 20, error: null,
      statWrites: [{ id: 'h', name: 'Health', max: 80 }, { id: 'l', name: 'Luck', value: 6 }, { id: 'v', name: 'Night Vision', regen: 2 }],
    });
  });

  it('counts a changed value as a write and leaves an unchanged one out', async () => {
    expect(await run('stats.Health.value = stats.Health.value;')).toEqual({ value: null, error: null });
    expect((await run('stats.Health.value = 71;')).statWrites).toEqual([{ id: 'h', name: 'Health', value: 71 }]);
  });

  it('counts every assigned bound as a write, changed or not', async () => {
    expect((await run('stats.Health.min = stats.Health.min; stats.Health.regen = 1;')).statWrites)
      .toEqual([{ id: 'h', name: 'Health', min: 0, regen: 1 }]);
  });

  it('hands back a value write as written, for the turn to clamp once every bound has landed', async () => {
    expect((await run('stats.Health.max = 50; stats.Health.value = 90;')).statWrites)
      .toEqual([{ id: 'h', name: 'Health', max: 50, value: 90 }]);
    expect((await run('stats.Health.value = -4;')).statWrites).toEqual([{ id: 'h', name: 'Health', value: -4 }]);
  });

  it('treats self and its map entry as one object, so a write through either is the self write', async () => {
    expect(await run('stats.Dice.value = 7; self.max = 15;')).toEqual({ value: 7, error: null, bounds: { max: 15 } });
    expect(await run('stats.Dice.max = 12; return self.max;')).toEqual({ value: 12, error: null, bounds: { max: 12 } });
  });

  it.each(['value', 'min', 'max', 'regen'])('fails the run on null written to another stat’s %s, discarding every write', async (field) => {
    const res = await run(`self.value = 3; stats.Luck.value = 9; stats.Health.${field} = null;`);
    expect(res).toMatchObject({ value: null, kind: 'non-number', error: expect.stringContaining(`stats.Health.${field}`) });
    expect(res.statWrites).toBeUndefined();
  });

  it('fails the run on a write that is not a finite number', async () => {
    for (const code of ['stats.Health.max = "high";', 'stats.Health.value = NaN;', 'stats.Health.regen = Infinity;']) {
      expect(await run(code), code).toMatchObject({ value: null, kind: 'non-number' });
    }
  });

  it('discards every write when the code throws after making them', async () => {
    const res = await run('stats.Health.value = 1; stats.Luck.max = 3; throw new Error("late");');
    expect(res).toMatchObject({ value: null, kind: 'throw' });
    expect(res.statWrites).toBeUndefined();
  });

  it('drops and reports a write to an unknown name by its path', async () => {
    expect(await run('stats.Helth.value = 1; stats["No Such"].max = 4; return 1;')).toEqual({
      value: 1, error: null, unknownStatWrites: ['stats.Helth.value', 'stats["No Such"].max'],
    });
  });

  it('reports a write of 0 to an unknown name, which the blank entry already reads', async () => {
    expect(await run('stats.Nope.value = 0;')).toEqual({ value: null, error: null, unknownStatWrites: ['stats.Nope.value'] });
  });

  it('drops and reports a write to a switched-off stat', async () => {
    expect(await run('stats.Off.value = 1; stats.Off.regen = 2; stats.Luck.value = 6;')).toEqual({
      value: null, error: null, disabledStatWrites: ['stats.Off.value', 'stats.Off.regen'], statWrites: [{ id: 'l', name: 'Luck', value: 6 }],
    });
  });

  it('keeps every other field of another entry read-only and reports it by path', async () => {
    const res = await run('stats.Health.name = "x"; stats.Health.previous.value = 1; stats.Health.delta.ai.value = 2; stats.Health.enabled = false;');
    expect(res).toEqual({
      value: null, error: null,
      readOnlyWrites: ['stats.Health.name', 'stats.Health.previous.value', 'stats.Health.delta.ai.value', 'stats.Health.enabled'],
    });
  });

  it('writes a stat that took self’s name when self lost it', async () => {
    const first = makeStat({ id: 'h1', name: 'Health', value: 10 });
    const last = makeStat({ id: 'h2', name: 'Health', value: 20 });
    expect(await executeStatCode('stats.Health.value = 4;', [first, last], first))
      .toEqual({ value: null, error: null, statWrites: [{ id: 'h2', name: 'Health', value: 4 }] });
  });
});
