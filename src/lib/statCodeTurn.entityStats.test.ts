/**
 * @vitest-environment node
 * (No DOM needed; node keeps the QuickJS WASM engine loading through its filesystem path.)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { runStatCodeTurn, type OwnerCodeTurn, type StatCodeTurn } from './statCodeTurn';
import type { StatCodeBearers } from './statCodeTraits';
import { inPlayBearers } from './ownedTraitsInPlay';
import { withOwnerCodeResults } from './entityStats';
import type { Entity, Placeholder, PlayerStat, Trait } from '@/types';
import { phValues } from '@/test/placeholderValues';

const stat = (over: Partial<PlayerStat>): PlayerStat => ({
  id: 'x', name: 'Stat', type: 'number', description: '', min: 0, max: 100, value: 50, regen: 0, descriptors: [],
  baseMin: 0, baseMax: 100, baseRegen: 0, aiMaxDelta: 0, ...over,
});

const brave: Trait = { id: 'brave', name: 'Brave', statChanges: [] };
const bram: Entity = { id: 'bram', name: 'Bram' };
const odette: Entity = { id: 'odette', name: 'Odette' };
const probe: Placeholder = { id: 'probe', name: 'Probe', values: phValues(['unset']) };

/** A playthrough with Bram and Odette in the cast and the world trait Brave not yet acquired. */
const bearers = (): StatCodeBearers => {
  const entities = [bram, odette];
  return {
    acquired: [], disabledTraitIds: [], appliedValues: {}, ownedTraits: {}, entities,
    world: {
      traits: [brave], groups: [], entities, persona: { source: 'none' },
      bearers: inPlayBearers({ traits: [brave], traitGroups: [], entities }, { source: 'none' }, []),
    },
  };
};

/** One entity owner over its stats: nothing asked, no regen, previous equal to now unless a case says so. */
const owner = (id: string, stats: PlayerStat[], over: Partial<OwnerCodeTurn> = {}): OwnerCodeTurn => ({
  id, stats, enabled: {}, previous: stats, regenApplied: {}, ...over,
});

const run = (player: PlayerStat[], owners: OwnerCodeTurn[], over: Partial<StatCodeTurn> = {}) => runStatCodeTurn({
  stats: player, enabled: {}, previous: player, asks: [], regenApplied: {}, clock: {}, bearers: bearers(), owners,
  placeholders: { placeholders: [probe], rolls: {} },
  statNameOf: (s) => s.name, traitNameOf: (t) => t.name, ...over,
});

const valueOf = (stats: readonly PlayerStat[] | undefined, id: string) => stats?.find((s) => s.id === id)?.value;

describe('runStatCodeTurn entity owners', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  it('runs an entity stat’s code over its owner’s stats as `stats`', async () => {
    const trust = stat({ id: 'trust', name: 'Trust', value: 30, code: 'return stats.Stock.value + (stats.Gold.name === "" ? 1 : 0);' });
    const stock = stat({ id: 'stock', name: 'Stock', value: 12 });
    const out = await run([stat({ id: 'gold', name: 'Gold', value: 5 })], [owner('bram', [trust, stock])]);
    expect(valueOf(out.owners?.bram.stats, 'trust')).toBe(13);
    expect(out.owners?.bram.moved).toEqual(['trust']);
    expect(valueOf(out.stats, 'gold')).toBe(5);
  });

  it('keeps the player’s code reading the player’s stats as `stats`', async () => {
    const out = await run(
      [stat({ id: 'gold', name: 'Gold', value: 5, code: 'return stats.Gold.value + (stats.Trust.name === "" ? 1 : 0);' })],
      [owner('bram', [stat({ id: 'trust', name: 'Trust', value: 30 })])],
    );
    expect(valueOf(out.stats, 'gold')).toBe(6);
  });

  it('reads every entity’s stats through entities[x].stats, regen included', async () => {
    const trust = stat({ id: 'trust', name: 'Trust', value: 34 });
    const out = await run(
      [stat({ id: 'gold', name: 'Gold', value: 0, code: 'return entities.Bram.stats.Trust.value + entities.Bram.stats.Trust.delta.regen.value * 10;' })],
      [owner('bram', [trust], { previous: [{ ...trust, value: 30 }], regenApplied: { trust: 4 } })],
    );
    expect(valueOf(out.stats, 'gold')).toBe(74);
  });

  it('runs every owner’s code over one snapshot, before any code wrote', async () => {
    const out = await run(
      [stat({ id: 'gold', name: 'Gold', value: 0, code: 'return entities.Bram.stats.Trust.value;' })],
      [owner('bram', [stat({ id: 'trust', name: 'Trust', value: 30, code: 'return 90;' })])],
    );
    expect(valueOf(out.stats, 'gold')).toBe(30);
    expect(valueOf(out.owners?.bram.stats, 'trust')).toBe(90);
  });

  it('runs no code for a switched-off entity stat, and lists it with enabled false', async () => {
    const out = await run(
      [stat({ id: 'gold', name: 'Gold', value: 0, code: 'return entities.Bram.stats.Trust.enabled ? 1 : 2;' })],
      [owner('bram', [stat({ id: 'trust', name: 'Trust', value: 30, code: 'return 90;' })], { enabled: { trust: false } })],
    );
    expect(valueOf(out.stats, 'gold')).toBe(2);
    expect(valueOf(out.owners?.bram.stats, 'trust')).toBe(30);
    expect(out.owners?.bram.moved).toEqual([]);
  });

  it('applies pin writes player first, then entities in order, the later winning', async () => {
    const out = await run(
      [stat({ id: 'gold', name: 'Gold', code: 'placeholders.Probe.pin("player");' })],
      [
        owner('bram', [stat({ id: 'trust', name: 'Trust', code: 'placeholders.Probe.pin("bram");' })]),
        owner('odette', [stat({ id: 'trust', name: 'Trust', code: 'placeholders.Probe.pin("odette");' })]),
      ],
    );
    expect(out.pinWrites).toEqual({ probe: 'odette' });
  });

  it('applies trait switches in owner order, an entity stat’s `traits` being the player’s world traits', async () => {
    const out = await run(
      [stat({ id: 'gold', name: 'Gold', code: 'traits.Brave.enabled = false;' })],
      [owner('bram', [stat({ id: 'trust', name: 'Trust', code: 'traits.Brave.enabled = true;' })])],
    );
    expect(out.traits?.acquired.map((t) => t.id)).toEqual(['brave']);
    expect(out.traits?.log).toEqual(['Acquired trait: Brave (by Trust)']);
  });

  it('sets an entity stat’s code bounds on that owner alone', async () => {
    const out = await run(
      [stat({ id: 'trust', name: 'Trust', value: 50 })],
      [owner('bram', [stat({ id: 'trust', name: 'Trust', value: 50, code: 'self.max = 40;' })])],
    );
    expect(out.owners?.bram.stats[0]).toMatchObject({ max: 40, value: 40, codeBounds: { max: 40 } });
    expect(out.owners?.bram.boundsChanged).toEqual(['trust']);
    expect(out.stats[0].max).toBe(100);
  });

  it('moves an entity’s own stats when code switches its own trait, and lays the result on the latest values', async () => {
    const hardy: Trait = { id: 'hardy', name: 'Hardy', statChanges: [{ statId: 'vigor', value: 10, type: 'max' }, { statId: 'vigor', value: 5, type: 'starting' }] };
    const strong: Entity = { ...bram, traits: [hardy] };
    const entities = [strong, odette];
    const vigor = stat({ id: 'vigor', name: 'Vigor' });
    const out = await run(
      [stat({ id: 'gold', name: 'Gold', code: 'entities.Bram.traits.Hardy.enabled = true;' })],
      [owner('bram', [vigor])],
      {
        bearers: {
          ...bearers(), entities,
          world: { ...bearers().world, entities, bearers: inPlayBearers({ traits: [brave], traitGroups: [], entities }, { source: 'none' }, []) },
        },
      },
    );
    expect(out.owners?.bram.stats[0]).toMatchObject({ max: 110, value: 55 });
    expect(out.owners?.bram.inForce?.map((t) => t.id)).toEqual(['hardy']);
    expect(out.traits?.appliedValues).toEqual({ 'bram/hardy/stats': { vigor: 5 } });
    // The latest values hold the pre-switch cap, so the overlay re-derives it under Bram's traits.
    const latest = withOwnerCodeResults({ bram: [vigor] }, out.owners, () => []);
    expect(latest.bram[0]).toMatchObject({ max: 110, value: 55 });
  });

  it('hands an owner whose code moved nothing its own stats back', async () => {
    const stats = [stat({ id: 'trust', name: 'Trust' })];
    const out = await run([], [owner('bram', stats)]);
    expect(out.owners?.bram.stats).toBe(stats);
  });
});
