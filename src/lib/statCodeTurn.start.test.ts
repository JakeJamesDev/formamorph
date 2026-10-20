/**
 * @vitest-environment node
 * (No DOM needed; node keeps the QuickJS WASM engine loading through its filesystem path.)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { runStatCodeTurn, type OwnerCodeTurn, type StatCodeTurn } from './statCodeTurn';
import type { StatCodeOwners } from './statCodeTraits';
import type { PlayerStat, Script } from '@/types';
import { statCodeTurnOf, type FlatStatCodeTurn } from '@/test/statCodeTurnFixture';

const stat = (over: Partial<PlayerStat>): PlayerStat => ({
  id: 'x', name: 'Stat', type: 'number', description: '', min: 0, max: 100, value: 50, regen: 0, descriptors: [],
  ...over,
});

const script = (timing: Script['timing'], code: string, over: Partial<Script> = {}): Script => ({
  id: `${timing}-${code}`, timing, code, ...over,
});

const none: StatCodeOwners = { acquired: [], disabledTraitIds: [], appliedValues: {}, world: { traits: [], groups: [] } };

const start = (over: Partial<FlatStatCodeTurn> & Pick<FlatStatCodeTurn, 'stats'>): StatCodeTurn => statCodeTurnOf({
  timing: 'start', enabled: {}, previous: over.stats, asks: [], regenApplied: {}, clock: {}, ownerTraits: none,
  statNameOf: (s) => s.name, traitNameOf: (t) => t.name, ...over,
});

const valueOf = (stats: readonly PlayerStat[], id: string) => stats.find((s) => s.id === id)?.value;

describe('the At Game Start timing', () => {
  beforeEach(() => vi.spyOn(console, 'error').mockImplementation(() => {}));
  afterEach(() => vi.restoreAllMocks());

  it('runs a stat\'s start script and leaves its other timings alone', async () => {
    const out = await runStatCodeTurn(start({
      stats: [stat({ id: 'a', scripts: [script('before', 'return 1;'), script('start', 'return 77;'), script('after', 'return 2;')] })],
    }));
    expect(valueOf(out.stats, 'a')).toBe(77);
    expect(out.moved).toEqual(['a']);
  });

  it('runs a world start script, which writes other stats by name', async () => {
    const out = await runStatCodeTurn(start({
      stats: [stat({ id: 'a', name: 'Health' })],
      worldScripts: [script('start', 'stats.Health.value = 12;'), script('after', 'stats.Health.value = 99;')],
    }));
    expect(valueOf(out.stats, 'a')).toBe(12);
  });

  it('reads the stats as the opening finds them: no ask, no regen, every delta zero', async () => {
    const code = 'return self.delta.ai.value + self.delta.regen.value + self.delta.total.value + self.delta.actual.value;';
    const out = await runStatCodeTurn(start({
      stats: [stat({ id: 'a', value: 70, scripts: [script('start', code)] })],
      previous: [stat({ id: 'a', value: 50 })],
      asks: [{ id: 'a', value: 20, max: 5 }],
      regenApplied: { a: 5 },
    }));
    expect(valueOf(out.stats, 'a')).toBe(0);
  });

  it('skips a switched-off stat\'s start script, as every timing does', async () => {
    const stats = [stat({ id: 'a', value: 50, scripts: [script('start', 'return 9;')] })];
    const out = await runStatCodeTurn(start({ stats, enabled: { a: false } }));
    expect(out.stats).toBe(stats);
    expect(out.moved).toEqual([]);
  });

  it('runs ordered scripts first, then world scripts, then stats in stat order; the later write wins', async () => {
    const stats = [
      stat({ id: 'a', name: 'Alpha', scripts: [script('start', 'stats.Target.value = 2;')] }),
      stat({ id: 'b', name: 'Beta', scripts: [script('start', 'stats.Target.value = 3;')] }),
      stat({ id: 'target', name: 'Target', value: 0 }),
    ];
    const worldScripts = [script('start', 'stats.Target.value = 1;')];
    expect(valueOf((await runStatCodeTurn(start({ stats, worldScripts }))).stats, 'target')).toBe(3);

    // An `order` runs ahead of the unordered ones, whatever owner holds it.
    const ordered = [{ ...stats[0], scripts: [script('start', 'stats.Target.value = 2;', { order: 5 })] }, stats[1], stats[2]];
    expect(valueOf((await runStatCodeTurn(start({ stats: ordered, worldScripts }))).stats, 'target')).toBe(3);
    // Ordered scripts all run before any unordered one, so the unordered Alpha writes last.
    const worldFirst = [script('start', 'stats.Target.value = 1;', { order: 1 })];
    const lastOrdered = [stats[0], { ...stats[1], scripts: [script('start', 'stats.Target.value = 3;', { order: 9 })] }, stats[2]];
    expect(valueOf((await runStatCodeTurn(start({ stats: lastOrdered, worldScripts: worldFirst }))).stats, 'target')).toBe(2);
  });

  it('runs once per owner, each entity\'s own start script over its own stats', async () => {
    const owner: OwnerCodeTurn = {
      id: 'bram', stats: [stat({ id: 'howl', name: 'Howl', value: 1, scripts: [script('start', 'return 8;')] })],
      enabled: {}, previous: [stat({ id: 'howl', value: 1 })], regenApplied: {},
    };
    const out = await runStatCodeTurn(start({ stats: [stat({ id: 'a', scripts: [script('start', 'return 4;')] })], owners: [owner] }));
    expect(valueOf(out.stats, 'a')).toBe(4);
    expect(valueOf(out.owners?.bram.stats ?? [], 'howl')).toBe(8);
  });

  it('writes nothing from a start script that throws, and logs it', async () => {
    const stats = [stat({ id: 'a', scripts: [script('start', 'throw new Error("no");')] })];
    const out = await runStatCodeTurn(start({ stats }));
    expect(out.stats).toBe(stats);
    expect(console.error).toHaveBeenCalled();
  });
});
