/**
 * @vitest-environment node
 * (No DOM needed; node keeps the QuickJS WASM engine loading through its filesystem path.)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { runStatCodeTurn, type OwnerCodeTurn } from './statCodeTurn';
import type { StatCodeOwners } from './statCodeTraits';
import { inPlayOwners } from './ownedTraitsInPlay';
import { withPersonaEntry } from './persona';
import type { Entity, PersonaRef, PlayerStat } from '@/types';
import { boxScripts } from '@/test/scriptFixtures';
import { statCodeTurnOf, type FlatStatCodeTurn } from '@/test/statCodeTurnFixture';

const stat = (over: Partial<PlayerStat>): PlayerStat => ({
  id: 'x', name: 'Stat', type: 'number', description: '', min: 0, max: 100, value: 50, regen: 0, descriptors: [],
  baseMin: 0, baseMax: 100, baseRegen: 0, aiMaxDelta: 0, ...over,
});

const bram: Entity = { id: 'bram', name: 'Bram' };
const odette: Entity = { id: 'odette', name: 'Odette' };
const rook: Entity = { id: 'rook', name: 'Rook' };
const mira: Entity = { id: 'mira', name: 'Mira', persona: true };
const lyra: Entity = { id: 'lyra', name: 'Lyra' };

const asMira: PersonaRef = { source: 'world', entityId: 'mira' };
const asLyra: PersonaRef = { source: 'library', entityId: 'lyra' };

/** A playthrough with Bram, Odette, Rook and Mira in the world under `persona`, with `library` entered. */
function cast(persona: PersonaRef = asMira, library: Entity[] = []): StatCodeOwners {
  const entities = [bram, odette, rook, mira];
  const entered = [...withPersonaEntry(entities, persona, library[0]?.name)];
  return {
    acquired: [], disabledTraitIds: [], appliedValues: {}, ownedTraits: {}, entities, library,
    world: {
      traits: [], groups: [], entities: entered, persona,
      ...inPlayOwners({ traits: [], traitGroups: [], entities: entered }, persona, library),
    },
  };
}

const owner = (id: string, stats: PlayerStat[], over: Partial<OwnerCodeTurn> = {}): OwnerCodeTurn => ({
  id, stats, enabled: {}, previous: stats, regenApplied: {}, ...over,
});

const run = (world: PlayerStat[], owners: OwnerCodeTurn[], over: Partial<FlatStatCodeTurn> = {}) => runStatCodeTurn(statCodeTurnOf({
  stats: world, enabled: {}, previous: world, asks: [], regenApplied: {}, clock: {}, ownerTraits: cast(), owners,
  statNameOf: (s) => s.name, traitNameOf: (t) => t.name, ...over,
}));

const find = (stats: readonly PlayerStat[] | undefined, id: string) => stats?.find((s) => s.id === id);
const valueOf = (stats: readonly PlayerStat[] | undefined, id: string) => find(stats, id)?.value;
const warned = () => vi.mocked(console.warn).mock.calls.map(([line]) => String(line));

describe('runStatCodeTurn writes across owners', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  it('lands a world-stat write from an entity stat’s code, its bound booked into the code delta', async () => {
    const out = await run(
      [stat({ id: 'alert', name: 'Alert', value: 10 })],
      [owner('bram', [stat({ id: 'fury', name: 'Fury', scripts: boxScripts({ after: 'stats.Alert.value = 70; stats.Alert.max = 80;' }) })])],
    );
    expect(find(out.stats, 'alert')).toMatchObject({ value: 70, max: 80, codeDelta: { max: -20 } });
    expect(out.moved).toEqual(['alert']);
    expect(out.boundsChanged).toEqual(['alert']);
    expect(out.owners?.bram.moved).toEqual([]);
  });

  it('lands world code’s writes on an entity through entities[x].stats and on the persona through persona.stats', async () => {
    const out = await run(
      [stat({ id: 'gold', name: 'Gold', scripts: boxScripts({ after: 'entities.Bram.stats.Stamina.value -= 15; persona.stats.Grit.regen = 3;' }) })],
      [owner('bram', [stat({ id: 'stamina', name: 'Stamina', value: 40 })]), owner('mira', [stat({ id: 'grit', name: 'Grit' })])],
    );
    expect(valueOf(out.owners?.bram.stats, 'stamina')).toBe(25);
    expect(out.owners?.bram.moved).toEqual(['stamina']);
    expect(find(out.owners?.mira.stats, 'grit')).toMatchObject({ regen: 3, codeDelta: { regen: 3 } });
    expect(out.owners?.mira.boundsChanged).toEqual(['grit']);
  });

  it('resolves two owners writing one field in owner order, a library persona landing last', async () => {
    const trust = stat({ id: 'trust', name: 'Trust', value: 30 });
    const writer = (code: string) => stat({ id: 'w', name: 'W', scripts: boxScripts({ after: code }) });
    const out = await run(
      [writer('entities.Bram.stats.Trust.value = 1; stats.Alert.value = 1;'), stat({ id: 'alert', name: 'Alert', value: 0, scripts: boxScripts({ after: 'return 2;' }) })],
      [
        owner('bram', [writer('owner.stats.Trust.value = 2; owner.stats.Trust.regen = 2;'), trust]),
        owner('odette', [writer('entities.Bram.stats.Trust.value = 3; stats.Alert.value = 3;')]),
        owner('lyra', [writer('entities.Bram.stats.Trust.value = 4; stats.Alert.value = 4;')]),
      ],
      { ownerTraits: cast(asLyra, [lyra]) },
    );
    expect(find(out.owners?.bram.stats, 'trust')).toMatchObject({ value: 4, regen: 2 });
    // Alert's own code is a world writer, so it loses to every entity's write.
    expect(valueOf(out.stats, 'alert')).toBe(4);
  });

  it('keeps stat order within the writer’s owner, the later stat winning', async () => {
    const out = await run([], [
      owner('bram', [stat({ id: 'a', name: 'A', scripts: boxScripts({ after: 'entities.Odette.stats.Calm.value = 1;' }) }), stat({ id: 'b', name: 'B', scripts: boxScripts({ after: 'entities.Odette.stats.Calm.value = 2;' }) })]),
      owner('odette', [stat({ id: 'calm', name: 'Calm', value: 0 })]),
    ]);
    expect(valueOf(out.owners?.odette.stats, 'calm')).toBe(2);
  });

  it('moves a world stat once when a Blueprint stat on two owners writes it', async () => {
    const hub = stat({ id: 'hub', name: 'Hub', scripts: boxScripts({ after: 'stats.Gold.value = stats.Gold.value + 1;' }) });
    const out = await run([stat({ id: 'gold', name: 'Gold', value: 5 })], [owner('bram', [hub]), owner('odette', [hub])]);
    // Each owner reads Gold at 5, so both write 6.
    expect(valueOf(out.stats, 'gold')).toBe(6);
  });

  it('lets no run see another run’s write in the same turn', async () => {
    const out = await run(
      [
        stat({ id: 'alert', name: 'Alert', value: 10 }),
        stat({ id: 'echo', name: 'Echo', value: 0, scripts: boxScripts({ after: 'entities.Bram.stats.Trust.value = 99; return stats.Alert.value;' }) }),
      ],
      [
        owner('bram', [stat({ id: 'trust', name: 'Trust', value: 30 }), stat({ id: 'fury', name: 'Fury', scripts: boxScripts({ after: 'stats.Alert.value = 90;' }) })]),
        owner('odette', [stat({ id: 'calm', name: 'Calm', value: 0, scripts: boxScripts({ after: 'return entities.Bram.stats.Trust.value;' }) })]),
      ],
    );
    expect(valueOf(out.stats, 'echo')).toBe(10);
    expect(valueOf(out.owners?.odette.stats, 'calm')).toBe(30);
    expect(valueOf(out.stats, 'alert')).toBe(90);
    expect(valueOf(out.owners?.bram.stats, 'trust')).toBe(99);
  });

  it('spares a world stat an entity writes the starvation penalty, and the gate snapshot sees the write', async () => {
    const out = await run(
      [stat({ id: 'health', name: 'Health', value: 50 }), stat({ id: 'stamina', name: 'Stamina', value: 50 })],
      [owner('bram', [stat({ id: 'fury', name: 'Fury', scripts: boxScripts({ after: 'stats.Health.value = 60;' }) })])],
      { penalties: { health: 10, stamina: 10 } },
    );
    expect(out.gateStats.global.health.value).toBe(60);
    // Control: the stat no code moved takes the penalty.
    expect(out.gateStats.global.stamina.value).toBe(40);
    expect(out.moved).toEqual(['health']);
  });

  it('shows an entity stat’s cross-owner write in that entity’s slot of the gate snapshot', async () => {
    const out = await run(
      [stat({ id: 'gold', name: 'Gold', scripts: boxScripts({ after: 'entities.Odette.stats.Calm.value = 75;' }) })],
      [owner('odette', [stat({ id: 'calm', name: 'Calm', value: 10 })])],
    );
    expect(out.gateStats.owners.odette.calm.value).toBe(75);
  });

  it('drops a write to a switched-off stat, an unknown stat, an entity without the stat and one not in the game, each by its full path', async () => {
    const out = await run(
      [stat({
        id: 'gold', name: 'Gold',
        scripts: boxScripts({ after: 'entities.Bram.stats.Off.value = 1; entities.Bram.stats.Nope.value = 2; entities.Ghost.stats.Trust.value = 3; entities.Rook.stats.Trust.max = 4;' }),
      })],
      [owner('bram', [stat({ id: 'off', name: 'Off', value: 30 })], { enabled: { off: false } })],
    );
    expect(valueOf(out.owners?.bram.stats, 'off')).toBe(30);
    expect(out.owners?.bram.moved).toEqual([]);
    expect(warned()).toEqual([
      // Entities in play in map order, then the names none has.
      'Stat Gold wrote stats that do not exist: entities.Bram.stats.Nope.value, entities.Rook.stats.Trust.max, entities.Ghost.stats.Trust.value',
      'Stat Gold wrote switched-off stats: entities.Bram.stats.Off.value',
    ]);
  });
});
