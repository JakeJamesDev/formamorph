/**
 * @vitest-environment node
 * (No DOM needed; node keeps the QuickJS WASM engine loading through its filesystem path.)
 */
import { describe, expect, it } from 'vitest';
import { runStatCodeTurn } from './statCodeTurn';
import type { Entity, PlayerStat, Stat } from '@/types';
import {
  backfillEntityStats, entityCodeTurns, entityStatOwners, seedEntityStats, withEntityRegen, withOwnerCodeResults,
} from './entityStats';
import { boxScripts } from '@/test/scriptFixtures';
import { statCodeTurnOf } from '@/test/statCodeTurnFixture';

const stat = (over: Partial<Stat> = {}): Stat => ({
  id: 'trust', name: 'Trust', type: 'number', description: '', min: 0, max: 100, value: 20, regen: 1, descriptors: [], ...over,
});

const trust = stat();
const stock = stat({ id: 'stock', name: 'Stock', value: 0, min: 3, max: 30, enabled: false });
const bram: Entity = { id: 'bram', name: 'Bram', stats: [trust, stock] };
const odette: Entity = { id: 'odette', name: 'Odette', stats: [stat({ id: 'eels', name: 'Eels', value: 5 })] };
const rook: Entity = { id: 'rook', name: 'Rook' };
const noTraits = () => [];

describe('seedEntityStats', () => {
  it('seeds every stat of each entity that owns any, switched-off ones included, as the player’s are seeded', () => {
    const seeded = seedEntityStats([bram, rook, odette]);
    expect(Object.keys(seeded)).toEqual(['bram', 'odette']);
    expect(seeded.bram).toEqual([
      { ...trust, value: 20, starting: 20, baseMin: 0, baseMax: 100, baseRegen: 1, aiMaxDelta: 0 },
      { ...stock, value: 3, starting: 3, baseMin: 3, baseMax: 30, baseRegen: 1, aiMaxDelta: 0 },
    ]);
  });
});

describe('backfillEntityStats', () => {
  const saved = (value: number): PlayerStat => ({ ...trust, value });

  it('adds a stat the world has since given an entity at its start value (Q8), and keeps one it removed', () => {
    const removed: PlayerStat = { ...stat({ id: 'old', name: 'Old' }), value: 9 };
    const out = backfillEntityStats({ bram: [saved(44), removed] }, [{ ...bram, stats: [trust, { ...stock, value: 7 }] }]);
    expect(out.bram.map((s) => [s.id, s.value])).toEqual([['trust', 44], ['old', 9], ['stock', 7]]);
  });

  it('seeds an entity the save holds no values for', () => {
    expect(backfillEntityStats(undefined, [odette]).odette.map((s) => s.value)).toEqual([5]);
  });

  it('hands back the saved map when nothing is missing', () => {
    const map = { odette: [{ ...odette.stats![0], value: 5 }] };
    expect(backfillEntityStats(map, [odette, rook])).toBe(map);
  });
});

describe('withEntityRegen', () => {
  it('regenerates each owner’s live stats, leaving a switched-off one and an owner not listed alone', () => {
    const values = seedEntityStats([bram, odette]);
    const owners = entityStatOwners(values, [bram], { source: 'none' }, noTraits);
    const out = withEntityRegen(values, owners, 3);
    expect(out.bram.map((s) => s.value)).toEqual([23, 3]);
    expect(out.odette).toBe(values.odette);
  });

  it('hands back the same map when no owner runs', () => {
    const values = seedEntityStats([bram]);
    expect(withEntityRegen(values, [], 3)).toBe(values);
  });
});

describe('entityCodeTurns', () => {
  const values = seedEntityStats([bram]);
  const owners = entityStatOwners(values, [bram], { source: 'none' }, noTraits);

  it('hands each owner its ticked stats, the regen applied, and its pre-tick stats as previous', () => {
    const [turn] = entityCodeTurns(owners, 2, (_, stats) => stats);
    expect(turn.stats.map((s) => s.value)).toEqual([22, 3]);
    expect(turn.regenApplied).toEqual({ trust: 2 });
    expect(turn.previous).toBe(values.bram);
    expect(turn.enabled).toEqual({ trust: true, stock: false });
  });

  it('takes no regen for the before box, and readies the stats through prepare', () => {
    const [turn] = entityCodeTurns(owners, null, (id, stats) => stats.map((s) => ({ ...s, description: id })));
    expect(turn.stats.map((s) => [s.value, s.description])).toEqual([[20, 'bram'], [3, 'bram']]);
    expect(turn.regenApplied).toEqual({});
  });
});

describe('withOwnerCodeResults', () => {
  const values = seedEntityStats([bram, odette]);

  it('lays each owner’s moved values and code deltas onto the latest values', () => {
    // The latest values took a regen tick after the run read its snapshot.
    const latest = withEntityRegen(values, entityStatOwners(values, [bram], { source: 'none' }, noTraits), 1);
    const run = values.bram.map((s) => (s.id === 'stock' ? { ...s, value: 9, max: 9, codeDelta: { max: 9 - s.max } } : { ...s, value: 70 }));
    const out = withOwnerCodeResults(latest, { bram: { stats: run, moved: ['trust'], boundsChanged: ['stock'], hiddenChanged: [] } }, noTraits);
    expect(out.bram.map((s) => [s.value, s.max])).toEqual([[70, 100], [3, 9]]);
    expect(out.odette).toBe(latest.odette);
  });

  it('lays a hidden flip alone onto the latest values', () => {
    const run = values.bram.map((s) => (s.id === 'trust' ? { ...s, hidden: true } : s));
    const out = withOwnerCodeResults(values, { bram: { stats: run, moved: [], boundsChanged: [], hiddenChanged: ['trust'] } }, noTraits);
    expect(out.bram.map((s) => [s.id, s.hidden === true])).toEqual([['trust', true], ['stock', false]]);
  });

  it('hands back the same map when no owner moved', () => {
    expect(withOwnerCodeResults(values, { bram: { stats: values.bram, moved: [], boundsChanged: [], hiddenChanged: [] } }, noTraits)).toBe(values);
    expect(withOwnerCodeResults(values, undefined, noTraits)).toBe(values);
  });
});

describe('entityStatOwners', () => {
  const values = seedEntityStats([bram, odette]);

  it('lists every entity in the playthrough that holds stats, in authored order, present or not', () => {
    expect(entityStatOwners(values, [odette, rook, bram], { source: 'none' }, noTraits).map((o) => o.id)).toEqual(['odette', 'bram']);
  });

  it('reads each stat’s own switch for its enabled map', () => {
    const [owner] = entityStatOwners(values, [bram], { source: 'none' }, noTraits);
    expect(owner.enabled).toEqual({ trust: true, stock: false });
    expect(owner.stats).toBe(values.bram);
  });

  it('regens and runs the Custom Persona entity’s stats under a library persona, as its traits are the player’s there', async () => {
    const custom: Entity = { id: 'cp', name: 'Wanderer', customPersona: true, stats: [stat({ id: 'grit', name: 'Grit', scripts: boxScripts({ after: 'return self.value + 10;' }) })] };
    const all = seedEntityStats([bram, custom]);
    const owners = entityStatOwners(all, [bram, custom], { source: 'library', entityId: 'lib' }, noTraits);
    expect(owners.map((o) => o.id)).toEqual(['bram', 'cp']);
    expect(withEntityRegen(all, owners, 2).cp[0].value).toBe(22);
    const turns = entityCodeTurns(owners, 2, (_, stats) => stats);
    const out = await runStatCodeTurn(statCodeTurnOf({
      stats: [], enabled: {}, previous: [], asks: [], regenApplied: {}, clock: {}, owners: turns,
      ownerTraits: { acquired: [], disabledTraitIds: [], appliedValues: {}, world: { traits: [], groups: [] } },
      statNameOf: (s) => s.name, traitNameOf: (t) => t.name,
    }));
    expect(out.owners?.cp.stats[0].value).toBe(32);
  });

  it('runs the played world persona, and leaves out a persona-only entity nobody plays', () => {
    const mira: Entity = { ...odette, id: 'mira', persona: true, personaOnly: true };
    const all = seedEntityStats([bram, mira]);
    expect(entityStatOwners(all, [bram, mira], { source: 'none' }, noTraits).map((o) => o.id)).toEqual(['bram']);
    expect(entityStatOwners(all, [bram, mira], { source: 'world', entityId: 'mira' }, noTraits).map((o) => o.id)).toEqual(['bram', 'mira']);
  });
});
