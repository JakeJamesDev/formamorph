import { migrateWorld } from '@/lib/version';
import { resolveOwners, type OwnerWorld } from '@/lib/owners';
import { settleDefaults, switchTrait, type GateInput, type GateStatSet, type SettleResult } from '@/lib/traitGates';
import { visibleImages, visibleLocationImages } from '@/lib/imageVisibility';
import { scoped } from '@/lib/scope';
import { inPlayOwners } from '@/lib/ownedTraitsInPlay';
import { applyOwnedStatTraits, seedNewGameStats, type TraitRuntimeState, type TraitWorld } from '@/lib/traitRuntime';
import { ownedTraitStatesFrom } from '@/lib/ownedTraitState';
import { seedEntityStats } from '@/lib/entityStats';
import type { SandboxState, StatCodeTurn, StatCodeTurnResult } from '@/lib/statCodeTurn';
import type { Daypart, Entity, GameLocation, PersonaRef, PlayerStat, Trait, World } from '@/types';

/** Stat name → value. */
export type StatValues = Record<string, number>;

/** `stats` with each named stat set to its value in `values`. */
export const withValues = (stats: readonly PlayerStat[], values: StatValues): PlayerStat[] =>
  stats.map((s) => (s.name in values ? { ...s, value: values[s.name] } : s));

export const valueOf = (stats: readonly PlayerStat[] | undefined, name: string) => stats?.find((s) => s.name === name)?.value;

/** What one After the AI turn starts from, beyond the persona's build. */
export interface TurnInput {
  /** The persona's stats as the AI left them. */
  stats: PlayerStat[];
  /** The persona's stats at the start of the turn. Defaults to `stats`. */
  previous?: PlayerStat[];
  /** The world's own stats as the AI left them, and where they started. */
  globals?: PlayerStat[];
  globalPrevious?: PlayerStat[];
  enabled?: Record<string, boolean>;
  clock?: SandboxState['clock'];
}

/**
 * A bundled world with a Custom Persona, loaded the way the seeder loads it, with the steps its tests share:
 * build the persona from its trait picks, seed the build's stats, and run its scripts for one turn.
 */
export function bundledWorldHarness(raw: string) {
  const world: World = migrateWorld(JSON.parse(raw));
  const none: PersonaRef = { source: 'none' };
  const persona: Entity = world.entities.find((e) => e.customPersona)!;
  const ownerWorld: OwnerWorld = { traits: world.traits, traitGroups: world.traitGroups ?? [], entities: world.entities };
  const { gate } = resolveOwners(ownerWorld, none);
  const traitWorld: TraitWorld = {
    traits: world.traits, groups: world.traitGroups ?? [], entities: world.entities, persona: none, ...inPlayOwners(ownerWorld, none),
  };

  const traitNamed = (name: string): Trait => {
    const found = persona.traits!.find((t) => t.name === name);
    if (!found) throw new Error(`no trait ${name}`);
    return found;
  };
  const idOf = (name: string) => traitNamed(name).id;
  const activeIds = (state: SettleResult) => state.active.owners[persona.id] ?? [];
  const activeTraits = (state: SettleResult) => persona.traits!.filter((t) => activeIds(state).includes(t.id));
  const activeNames = (state: SettleResult) => activeIds(state).map((id) => persona.traits!.find((t) => t.id === id)?.name ?? id).sort();
  const ownedOf = (state: SettleResult) => ownedTraitStatesFrom({ [persona.id]: activeIds(state) });

  /** Switch each named trait on in turn from the default build, as the creator and the in-play toggle do. */
  function build(...picks: string[]): SettleResult {
    let state = settleDefaults(gate);
    for (const pick of picks) {
      // A switch toggles, so a pick already on (a default) stays as it is.
      if (activeIds(state).includes(idOf(pick))) continue;
      const next = switchTrait({ ...gate, active: state.active }, persona.id, idOf(pick), state.cascadeOff);
      if (!next) throw new Error(`${pick} would not switch on`);
      state = next;
    }
    return state;
  }

  /** The persona's stats after its build's stat changes. */
  function personaStats(state: SettleResult): PlayerStat[] {
    const seeded: TraitRuntimeState = {
      stats: seedNewGameStats(world.stats), traits: [], disabledTraitIds: [], appliedValues: {},
      ownedTraits: ownedOf(state), entityStats: seedEntityStats(world.entities),
    };
    return applyOwnedStatTraits(seeded, traitWorld).entityStats![persona.id];
  }

  /** One turn over the persona's build, as the script runner takes it. */
  function turn(state: SettleResult, { stats, previous = stats, globals = [], globalPrevious = globals, enabled = {}, clock = {} }: TurnInput): StatCodeTurn {
    return {
      state: {
        stats: globals, enabled: {}, clock,
        ownerTraits: {
          acquired: [], disabledTraitIds: [], appliedValues: {}, entities: world.entities, world: traitWorld, ownedTraits: ownedOf(state),
        },
        owners: [{ id: persona.id, stats, enabled }],
      },
      previous: globalPrevious, asks: [], regenApplied: {},
      ownerTurns: { [persona.id]: { previous, regenApplied: {} } },
      statNameOf: (s) => s.name, traitNameOf: (t) => t.name,
    };
  }

  /** The persona's stats out of a script run. Throws when the run left them out, so a script that never ran
   *  can't pass as one that returned the same values. */
  function personaStatsOut(out: StatCodeTurnResult): readonly PlayerStat[] {
    const stats = out.owners?.[persona.id]?.stats;
    if (!stats) throw new Error(`no stats came back for ${persona.name}`);
    return stats;
  }

  /** Play's gate input on the default build with one stat at `value`: the owner's own stat, or a world stat
   *  when `ownerId` is absent. */
  function statAt(statName: string, value: number, ownerId?: string): GateInput {
    const stats = ownerId ? world.entities.find((e) => e.id === ownerId)?.stats : world.stats;
    const stat = stats?.find((s) => s.name === statName);
    if (!stat) throw new Error(`no stat ${statName}`);
    const set: GateStatSet = { [stat.id]: { name: stat.name, value, min: stat.min ?? 0, max: stat.max ?? 100 } };
    return { ...gate, active: settleDefaults(gate).active, stats: ownerId ? scoped<GateStatSet>({}, { [ownerId]: set }) : scoped(set) };
  }

  /** Play's gate input at `daypart`, with the build that daypart settles. */
  function atDaypart(daypart: Daypart): GateInput {
    const input = { ...gate, daypart };
    return { ...input, active: settleDefaults(input).active };
  }

  /** The image slots play shows for an entity. */
  const entitySlots = (entity: Entity, input: GateInput) => visibleImages(entity, input).map((image) => image.slot);
  /** The image slots play shows for a location. */
  const locationSlots = (location: GameLocation, input: GateInput) => visibleLocationImages(location, input).map((image) => image.slot);

  return {
    world, persona, gate, ownerWorld, none, traitNamed, idOf, activeIds, activeTraits, activeNames,
    ownedOf, build, personaStats, turn, personaStatsOut, statAt, atDaypart, entitySlots, locationSlots,
  };
}
