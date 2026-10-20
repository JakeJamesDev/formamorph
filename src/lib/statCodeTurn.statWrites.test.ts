/**
 * @vitest-environment node
 * (No DOM needed; node keeps the QuickJS WASM engine loading through its filesystem path.)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { runStatCodeTurn, type OwnerCodeTurn } from './statCodeTurn';
import type { StatCodeOwners } from './statCodeTraits';
import { inPlayOwners } from './ownedTraitsInPlay';
import { setTraitEnabled } from './traitRuntime';
import { linkedStat } from './statLinks';
import type { Entity, PlayerStat, Trait } from '@/types';
import { boxScripts } from '@/test/scriptFixtures';
import { statCodeTurnOf, type FlatStatCodeTurn } from '@/test/statCodeTurnFixture';

/** A stat as a playthrough carries it: bases seeded, no AI or code delta booked. */
const stat = (over: Partial<PlayerStat>): PlayerStat => ({
  id: 'x', name: 'Stat', type: 'number', description: '', min: 0, max: 100, value: 50, regen: 0, descriptors: [],
  baseMin: 0, baseMax: 100, baseRegen: 0, aiMaxDelta: 0, ...over,
});

const bram: Entity = { id: 'bram', name: 'Bram' };
const odette: Entity = { id: 'odette', name: 'Odette' };

/** A playthrough with Bram and Odette in the cast, holding `acquired` with `off` switched off. */
const ownerTraits = (acquired: Trait[] = [], off: string[] = []): StatCodeOwners => {
  const entities = [bram, odette];
  return {
    acquired, disabledTraitIds: off, appliedValues: {}, ownedTraits: {}, entities,
    world: {
      traits: acquired, groups: [], entities, persona: { source: 'none' },
      ...inPlayOwners({ traits: acquired, traitGroups: [], entities }, { source: 'none' }, []),
    },
  };
};

const owner = (id: string, stats: PlayerStat[]): OwnerCodeTurn => ({ id, stats, enabled: {}, previous: stats, regenApplied: {} });

const run = (stats: PlayerStat[], over: Partial<FlatStatCodeTurn> = {}) => runStatCodeTurn(statCodeTurnOf({
  stats, enabled: {}, previous: stats, asks: [], regenApplied: {}, clock: {}, ownerTraits: ownerTraits(),
  statNameOf: (s) => s.name, traitNameOf: (t) => t.name, ...over,
}));

const find = (stats: readonly PlayerStat[] | undefined, id: string) => stats?.find((s) => s.id === id);
const valueOf = (stats: readonly PlayerStat[] | undefined, id: string) => find(stats, id)?.value;
const warned = () => vi.mocked(console.warn).mock.calls.map(([line]) => String(line)).join('\n');

const health = (over: Partial<PlayerStat> = {}) => stat({ id: 'h', name: 'Health', value: 60, ...over });
const hub = (code: string, over: Partial<PlayerStat> = {}) => stat({ id: 'hub', name: 'Hub', value: 0, scripts: boxScripts({ after: code }), ...over });

describe('runStatCodeTurn writes to other stats', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  it('lands a hub’s value write on the target, clamped to its range', async () => {
    const out = await run([hub('stats.Health.value = 140;'), health({ max: 90, baseMax: 90 })]);
    expect(valueOf(out.stats, 'h')).toBe(90);
    expect(valueOf(out.stats, 'hub')).toBe(0);
    expect(out.moved).toEqual(['h']);
  });

  it('books a hub’s bound write in the target’s code delta, which a later trait switch moves from', async () => {
    const boost: Trait = { id: 'b', name: 'Boost', statChanges: [{ statId: 'h', value: 20, type: 'max' }] };
    const out = await run([hub('stats.Health.max = 20;'), health({ value: 10 })], { ownerTraits: ownerTraits([boost], ['b']) });
    expect(find(out.stats, 'h')).toMatchObject({ max: 20, codeDelta: { max: -80 } });
    expect(out.boundsChanged).toEqual(['h']);
    const held = { stats: [...out.stats], traits: [boost], disabledTraitIds: ['b'], appliedValues: {} };
    expect(find(setTraitEnabled(held, 'b', true, { traits: [boost], groups: [] }).state.stats, 'h')?.max).toBe(40);
  });

  it('measures a hub’s bound write after the run’s trait switches', async () => {
    const boost: Trait = { id: 'b', name: 'Boost', statChanges: [{ statId: 'h', value: 20, type: 'max' }] };
    const out = await run([hub('traits.Boost.enabled = true; stats.Health.max = 70;'), health({ value: 10 })], { ownerTraits: ownerTraits([boost], ['b']) });
    expect(find(out.stats, 'h')).toMatchObject({ max: 70, codeDelta: { max: -50 } });
  });

  it('lands two hubs writing one field in stat order, the later winning', async () => {
    const first = hub('stats.Health.value = 10;', { id: 'one', name: 'One' });
    const second = hub('stats.Health.value = 20;', { id: 'two', name: 'Two' });
    expect(valueOf((await run([first, second, health()])).stats, 'h')).toBe(20);
    expect(valueOf((await run([second, first, health()])).stats, 'h')).toBe(10);
  });

  it('clamps a hub’s value against the bound an earlier hub wrote in the same run', async () => {
    const raise = hub('stats.Health.max = 200;', { id: 'one', name: 'One' });
    const fill = hub('stats.Health.value = 150;', { id: 'two', name: 'Two' });
    expect(find((await run([raise, fill, health()])).stats, 'h')).toMatchObject({ value: 150, max: 200 });
  });

  it('lands a stat’s own return inside the max a hub raised in the same run', async () => {
    const raise = hub('stats.Health.max = 200;');
    const out = await run([raise, health({ scripts: boxScripts({ after: 'return 150;' }) })]);
    expect(find(out.stats, 'h')).toMatchObject({ value: 150, max: 200 });
  });

  it('lands a stat’s own value write inside the max its own trait switch raised', async () => {
    const boost: Trait = { id: 'b', name: 'Boost', statChanges: [{ statId: 'h', value: 100, type: 'max' }] };
    const out = await run([health({ scripts: boxScripts({ after: 'traits.Boost.enabled = true; self.value = 150;' }) })], { ownerTraits: ownerTraits([boost], ['b']) });
    expect(find(out.stats, 'h')).toMatchObject({ value: 150, max: 200 });
  });

  it('orders a target’s self write and a hub’s write on one field by stat order', async () => {
    const own = health({ scripts: boxScripts({ after: 'return 5;' }) });
    const writer = hub('stats.Health.value = 30;');
    expect(valueOf((await run([own, writer])).stats, 'h')).toBe(30);
    expect(valueOf((await run([writer, own])).stats, 'h')).toBe(5);
  });

  it('merges writes field by field, so a hub’s bound and the target’s own value both land', async () => {
    const out = await run([hub('stats.Health.max = 80;'), health({ scripts: boxScripts({ after: 'return 75;' }) })]);
    expect(find(out.stats, 'h')).toMatchObject({ value: 75, max: 80 });
  });

  it('hides a hub’s write from the target’s own box on the same run', async () => {
    const own = health({ scripts: boxScripts({ after: 'self.regen = self.value; self.min = self.delta.actual.value;' }) });
    const out = await run([hub('stats.Health.value = 90;'), own]);
    expect(find(out.stats, 'h')).toMatchObject({ value: 90, regen: 60, min: 0 });
  });

  it('drops and reports a write to an unknown stat name by its path', async () => {
    const stats = [hub('stats.Helth.value = 1;'), health()];
    const out = await run(stats);
    expect(out.stats).toBe(stats);
    expect(warned()).toContain('stats.Helth.value');
  });

  it('drops and reports a write to a switched-off stat', async () => {
    const out = await run([hub('stats.Health.value = 1; stats.Health.max = 2;'), health()], { enabled: { h: false } });
    expect(find(out.stats, 'h')).toMatchObject({ value: 60, max: 100 });
    expect(warned()).toContain('stats.Health.value, stats.Health.max');
  });

  it('lands a write through entities[x].stats on that entity’s stat, with no warning', async () => {
    const trust = stat({ id: 'trust', name: 'Trust', value: 30 });
    const out = await run([hub('entities.Bram.stats.Trust.value = 99;')], { owners: [owner('bram', [trust])] });
    expect(valueOf(out.owners?.bram.stats, 'trust')).toBe(99);
    expect(out.owners?.bram.moved).toEqual(['trust']);
    expect(warned()).toBe('');
  });

  it('lands an entity stat’s `owner.stats` write on its owner alone', async () => {
    const calm = stat({ id: 'calm', name: 'Calm', value: 10 });
    const out = await run([stat({ id: 'calm', name: 'Calm', value: 70 })], {
      owners: [owner('bram', [hub('owner.stats.Calm.value += 5;'), calm]), owner('odette', [calm])],
    });
    expect(valueOf(out.owners?.bram.stats, 'calm')).toBe(15);
    expect(out.owners?.bram.moved).toEqual(['calm']);
    expect(valueOf(out.owners?.odette.stats, 'calm')).toBe(10);
    expect(valueOf(out.stats, 'calm')).toBe(70);
  });

  it('runs a Blueprint stat’s code once per owner, each write reaching that owner’s own copy', async () => {
    // A Blueprint copy keeps the original's id, so both owners hold `hub` and `trust` under the same ids.
    const copy = (original: PlayerStat, value: number): PlayerStat => ({
      ...original,
      ...linkedStat(original, { id: `link-${original.id}`, originalId: original.id, kind: 'stat', originalName: original.name, groupId: null }),
      value,
    });
    const blueprintHub = hub('owner.stats.Trust.value = owner.stats.Trust.value * 2;');
    const trust = stat({ id: 'trust', name: 'Trust' });
    const out = await run([], {
      owners: [owner('bram', [copy(blueprintHub, 0), copy(trust, 10)]), owner('odette', [copy(blueprintHub, 0), copy(trust, 25)])],
    });
    expect(valueOf(out.owners?.bram.stats, 'trust')).toBe(20);
    expect(valueOf(out.owners?.odette.stats, 'trust')).toBe(50);
  });

  it('discards every write of a hub that fails', async () => {
    const stats = [hub('stats.Health.value = 1; stats.Health.max = 2; self.value = 3; throw new Error("late");'), health()];
    const out = await run(stats);
    expect(out.stats).toBe(stats);
    expect(out.moved).toEqual([]);
  });

  it.each(['value', 'min', 'max', 'regen'])('fails the run on null written to another stat’s %s', async (field) => {
    const other = field === 'value' ? 'stats.Health.max = 60;' : 'stats.Health.value = 10;';
    const stats = [hub(`${other} stats.Health.${field} = null;`), health()];
    const out = await run(stats);
    expect(out.stats).toBe(stats);
  });

  it('runs hub writes in the before box too', async () => {
    const out = await run([hub('', { scripts: boxScripts({ before: 'stats.Health.value = 12;' }) }), health()], { timing: 'before' });
    expect(valueOf(out.stats, 'h')).toBe(12);
  });
});
