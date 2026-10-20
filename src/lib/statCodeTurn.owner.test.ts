/**
 * @vitest-environment node
 * (No DOM needed; node keeps the QuickJS WASM engine loading through its filesystem path.)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { runStatCodeTurn, type OwnerCodeTurn } from './statCodeTurn';
import type { StatCodeOwners } from './statCodeTraits';
import { inPlayOwners } from './ownedTraitsInPlay';
import { playStatWorld } from './statLinks';
import type { Entity, PersonaRef, PlayerStat, Stat, StatGroup, Trait } from '@/types';
import { boxScripts } from '@/test/scriptFixtures';
import { statCodeTurnOf, type FlatStatCodeTurn } from '@/test/statCodeTurnFixture';

const stat = (over: Partial<PlayerStat>): PlayerStat => ({
  id: 'x', name: 'Stat', type: 'number', description: '', min: 0, max: 100, value: 50, regen: 0, descriptors: [],
  baseMin: 0, baseMax: 100, baseRegen: 0, aiMaxDelta: 0, ...over,
});

const hardy: Trait = { id: 'hardy', name: 'Hardy', statChanges: [] };

/** A playthrough with `entities` in the cast under `persona`. */
const ownerTraits = (entities: Entity[], persona: PersonaRef = { source: 'none' }): StatCodeOwners => ({
  acquired: [], disabledTraitIds: [], appliedValues: {}, ownedTraits: {}, entities,
  world: {
    traits: [], groups: [], entities, persona,
    ...inPlayOwners({ traits: [], traitGroups: [], entities }, persona, []),
  },
});

const owner = (id: string, stats: PlayerStat[]): OwnerCodeTurn => ({ id, stats, enabled: {}, previous: stats, regenApplied: {} });

const run = (world: PlayerStat[], owners: OwnerCodeTurn[], entities: Entity[], over: Partial<FlatStatCodeTurn> = {}) => runStatCodeTurn(statCodeTurnOf({
  stats: world, enabled: {}, previous: world, asks: [], regenApplied: {}, clock: {}, ownerTraits: ownerTraits(entities), owners,
  statNameOf: (s) => s.name, traitNameOf: (t) => t.name, ...over,
}));

const valueOf = (stats: readonly PlayerStat[] | undefined, id: string) => stats?.find((s) => s.id === id)?.value;

describe('runStatCodeTurn owner', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  it('lets The Creature’s stat code read the world’s Destruction through `stats`', async () => {
    const creature: Entity = { id: 'creature', name: 'The Creature' };
    const out = await run(
      [stat({ id: 'destruction', name: 'Destruction', value: 40 })],
      [owner('creature', [stat({ id: 'fury', name: 'Fury', value: 0, scripts: boxScripts({ after: 'return stats.Destruction.value / 2;' }) })])],
      [creature],
    );
    expect(valueOf(out.owners?.creature.stats, 'fury')).toBe(20);
  });

  it('writes the owner’s own stats through `owner.stats`, one write with `self`', async () => {
    const bram: Entity = { id: 'bram', name: 'Bram' };
    const out = await run([], [owner('bram', [
      stat({ id: 'rage', name: 'Rage', value: 10, scripts: boxScripts({ after: 'self.value = 30; owner.stats.Rage.value += 5; owner.stats.Calm.max = 40;' }) }),
      stat({ id: 'calm', name: 'Calm', value: 60 }),
    ])], [bram]);
    expect(valueOf(out.owners?.bram.stats, 'rage')).toBe(35);
    expect(out.owners?.bram.stats[1]).toMatchObject({ max: 40, value: 40 });
    expect(out.owners?.bram.moved).toEqual(['rage', 'calm']);
  });

  it('switches the owner’s own trait through `owner.traits`', async () => {
    const bram: Entity = { id: 'bram', name: 'Bram', traits: [hardy] };
    const out = await run([], [owner('bram', [stat({ id: 'rage', name: 'Rage', scripts: boxScripts({ after: 'owner.traits.Hardy.enabled = true;' }) })])], [bram]);
    expect(out.traits?.ownedTraits).toEqual({ bram: { chosen: ['hardy'] } });
    expect(out.traits?.log).toEqual(['Acquired trait: Bram\'s Hardy (by Rage)']);
  });

  it('keeps `owner` on its entity when a later entity of the same name hides it in `entities`', async () => {
    const first: Entity = { id: 'bram', name: 'Bram', traits: [hardy] };
    const later: Entity = { id: 'bram-2', name: 'Bram', traits: [{ ...hardy, id: 'hardy-2' }] };
    const calm = stat({ id: 'calm', name: 'Calm', value: 10 });
    const out = await run([], [
      owner('bram', [stat({ id: 'rage', name: 'Rage', scripts: boxScripts({ after: 'owner.traits.Hardy.enabled = true; owner.stats.Calm.value = owner.stats.Calm.value + 1;' }) }), calm]),
      owner('bram-2', [{ ...calm, value: 90 }]),
    ], [first, later]);
    expect(valueOf(out.owners?.bram.stats, 'calm')).toBe(11);
    expect(valueOf(out.owners?.['bram-2'].stats, 'calm')).toBe(90);
    expect(out.traits?.ownedTraits).toEqual({ bram: { chosen: ['hardy'] } });
  });

  it('is the played persona for the persona entity’s own stats', async () => {
    const mira: Entity = { id: 'mira', name: 'Mira', persona: true };
    const persona: PersonaRef = { source: 'world', entityId: 'mira' };
    const out = await run([], [owner('mira', [stat({ id: 'grit', name: 'Grit', value: 0, scripts: boxScripts({ after: 'return owner === persona && owner === entities.Mira ? 1 : 2;' }) })])],
      [mira], { ownerTraits: ownerTraits([mira], persona) });
    expect(valueOf(out.owners?.mira.stats, 'grit')).toBe(1);
  });

  it('runs a Blueprint stat’s code for each owner as `owner`, the world `stats` leaving the Blueprint out', async () => {
    const blueprints: StatGroup = { id: 'bp', name: 'Blueprints', parentId: null, system: 'blueprints' };
    const grit: Stat = {
      id: 'grit', name: 'Grit', type: 'number', description: '', min: 0, max: 100, value: 10, regen: 0, descriptors: [], groupId: 'bp',
      scripts: boxScripts({ after: 'return owner.stats.Grit.value + owner.stats.Bonus.value + (stats.Grit.name === "" ? 0 : 1000);' }),
    };
    const gold: Stat = { id: 'gold', name: 'Gold', type: 'number', description: '', min: 0, max: 100, value: 3, regen: 0, descriptors: [] };
    const linked = (id: string, name: string, bonus: number): Entity => ({
      id, name,
      statLinks: [{ id: `link-${id}`, originalId: 'grit', kind: 'stat', originalName: 'Grit', groupId: null }],
      stats: [{ ...gold, id: `bonus-${id}`, name: 'Bonus', value: bonus }],
    });
    const play = playStatWorld({ stats: [grit, gold], statGroups: [blueprints], entities: [linked('bram', 'Bram', 1), linked('odette', 'Odette', 5)] });
    const asPlayer = (stats: readonly Stat[]) => stats.map((s) => stat({ ...s }));
    const out = await run(
      asPlayer(play.stats),
      play.entities.map((entity) => owner(entity.id, asPlayer(entity.stats ?? []))),
      play.entities,
    );
    expect(play.stats.map((s) => s.name)).toEqual(['Gold']);
    expect(valueOf(out.owners?.bram.stats, 'grit')).toBe(11);
    expect(valueOf(out.owners?.odette.stats, 'grit')).toBe(15);
  });

  it('lands a Blueprint stat’s `owner.stats` write on each owner’s own copy', async () => {
    const trust = (value: number) => stat({ id: 'trust', name: 'Trust', value });
    const hub = stat({ id: 'hub', name: 'Hub', value: 0, scripts: boxScripts({ after: 'owner.stats.Trust.value = owner.stats.Trust.value + owner.name.length;' }) });
    const out = await run([], [owner('bram', [hub, trust(10)]), owner('odette', [hub, trust(20)])],
      [{ id: 'bram', name: 'Bram' }, { id: 'odette', name: 'Odette' }]);
    expect(valueOf(out.owners?.bram.stats, 'trust')).toBe(14);
    expect(valueOf(out.owners?.odette.stats, 'trust')).toBe(26);
  });
});
