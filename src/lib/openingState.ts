/**
 * The opening fold: the state a new game opens with, built from the authored world, the entry step's picks
 * and the persona. Enter World, the Test Bench's opening instrument and the editors' Script runs all read it.
 */
import { entityStatOwners, seedEntityStats, statOwnerEntities } from './entityStats';
import { inPlayLibrary, inPlayOwners } from './ownedTraitsInPlay';
import { ownedTraitStatesFrom } from './ownedTraitState';
import { allPlaceholders, placeholderOwners } from './placeholderHomes';
import { startingLocations } from './startingLocation';
import { playStatWorld } from './statLinks';
import type { ResolveText, SandboxState } from './statCodeTurn';
import type { UnitHome } from './sandboxSnapshot';
import { atStartValues, statStartValue } from './statDescriptorGeometry';
import { activeStatEnabled, inAuthoredOrder, traitOrderIndex } from './traitEffects';
import {
  acquireTrait, applyGlobalRowTraits, applyOwnedStatTraits, entityStatTraitsInForce, gateStatsOf, heldGlobalTraits,
  seedNewGameStats, statTraitsInForce, type TraitRuntimeState, type TraitWorld,
} from './traitRuntime';
import type { PersonaPick } from './persona';
import type { OwnerId } from './scope';
import { resolveEntityText, type PlaceholderMode } from './placeholders';
import type { Entity, EntityStatValues, OwnedTraitPicks, Placeholder, Trait, World } from '@/types';

/** The authored slice the fold reads. An absent slice reads as empty, as an editor's half-built world can be. */
export type OpeningFoldWorld = Partial<Pick<World,
  'stats' | 'statGroups' | 'traits' | 'traitGroups' | 'entities' | 'entityGroups' | 'placeholders' | 'placeholderGroups' | 'dictionaries' | 'locations'
  | 'connections' | 'worldOverview'
>>;

/** What the player picked at the entry step: the global trait ids and each owner's trait ids. */
export interface OpeningPicks {
  traits: readonly string[];
  owned: OwnedTraitPicks;
}

/** The played persona and the library characters added at the entry step. Absent ⇒ None, no library. */
export type OpeningPersona = PersonaPick & { characters?: readonly Entity[] };

export const NO_OPENING_PICKS: OpeningPicks = { traits: [], owned: {} };

/** The fold, with the parts play keeps beyond the state. */
export interface OpeningFold {
  state: SandboxState;
  /** Every seeded entity's stats, cast or not: play's baseline for their first changes. */
  entityStats: EntityStatValues;
  /** The held picks, then the played owners' global rows, in the order they applied. A row names its owner. */
  startingTraits: { trait: Trait; ownerId: OwnerId }[];
  /** The trait slice as play's trait state holds it. */
  traitState: TraitRuntimeState;
}

/** Authored text resolved as turn one would: an unrolled chip draws once, and every text after it reads that roll. */
function turnOneText(placeholders: Placeholder[]): ResolveText {
  const rolls: { world: Record<string, string>; unique: Record<string, string> } = { world: {}, unique: {} };
  const setRoll = (scope: PlaceholderMode, key: string, value: string) => { rolls[scope][key] = value; };
  return (text, owner) => resolveEntityText(owner, text, { placeholders, rolls, setRoll });
}

/** The state a new game opens with. Pure: the same inputs give the same state, its unrolled chips aside. */
export function openingFold(world: OpeningFoldWorld, picks: OpeningPicks = NO_OPENING_PICKS, persona?: OpeningPersona): OpeningFold {
  const ref = persona?.ref ?? { source: 'none' as const };
  const traits = world.traits ?? [];
  const traitGroups = world.traitGroups ?? [];
  const { stats: authored, entities } = playStatWorld({ stats: world.stats ?? [], statGroups: world.statGroups ?? [], entities: world.entities ?? [] });
  const ownerWorld = { traits, traitGroups, entities };
  const library = inPlayLibrary(ownerWorld, persona?.libraryEntity, persona?.characters ?? []);
  const traitWorld: TraitWorld = {
    traits, groups: traitGroups, entities, persona: ref, ...inPlayOwners(ownerWorld, ref, library),
  };

  // Authored order, not click order: two players with the same picks open with the same stats.
  const chosen = new Set(picks.traits);
  const held = inAuthoredOrder(
    heldGlobalTraits(traits.filter((t) => chosen.has(t.id)), traitWorld), traitOrderIndex(traits, traitGroups),
  );
  let traitState: TraitRuntimeState = { stats: seedNewGameStats(authored), traits: [], disabledTraitIds: [], appliedValues: {} };
  for (const trait of held) traitState = acquireTrait(traitState, trait, { traits, groups: traitGroups }).state;
  // Every entity's global rows apply after the world picks; then each entity's own traits apply to its stats.
  const statEntities = statOwnerEntities({ world: entities, library });
  const rows = applyGlobalRowTraits({
    ...traitState, ownedTraits: ownedTraitStatesFrom(picks.owned), entityStats: seedEntityStats(statEntities),
  }, traitWorld);
  traitState = applyOwnedStatTraits(rows.state, traitWorld);
  const entityStats = traitState.entityStats ?? {};
  const ownedTraits = traitState.ownedTraits ?? {};

  const locations = world.locations ?? [];
  const start = startingLocations(locations)[0] ?? locations[0] ?? null;
  const state: SandboxState = {
    stats: traitState.stats,
    enabled: activeStatEnabled(traitState.stats, statTraitsInForce(traitState, traitWorld)),
    owners: entityStatOwners(entityStats, statEntities, ref, (id) => entityStatTraitsInForce(ownedTraits, traitWorld, id))
      .map(({ id, stats, enabled }) => ({ id, stats, enabled })),
    gateStats: gateStatsOf(traitState, traitWorld),
    ownerTraits: {
      acquired: traitState.traits, disabledTraitIds: [], appliedValues: traitState.appliedValues, ownedTraits,
      world: traitWorld, entities, library,
    },
    placeholders: {
      placeholders: allPlaceholders(world), owners: placeholderOwners(world), dictionaries: world.dictionaries ?? [], rolls: {},
    },
    places: { locations, location: start && { id: start.id, name: start.name }, connections: world.connections ?? [] },
    resolveText: turnOneText(allPlaceholders(world)),
    clock: { deltaHours: 0, elapsedHours: 0 },
  };
  const startingTraits = [...held.map((trait) => ({ trait, ownerId: null })), ...rows.appliedRows];
  return { state, entityStats, startingTraits, traitState };
}

/** The `SandboxState` of turn one. */
export const openingStateOf = (world: OpeningFoldWorld, picks?: OpeningPicks, persona?: OpeningPersona): SandboxState =>
  openingFold(world, picks, persona).state;

/** `home` with its stats at their opening values, as turn one seeds them (Q8). */
export function openingHomeOf(home: UnitHome): UnitHome {
  switch (home.kind) {
    case 'globalStat':
    case 'entityStat': return { ...home, stat: { ...home.stat, value: statStartValue(home.stat) } };
    case 'blueprintStat': return { ...home, stat: { ...home.stat, value: statStartValue(home.stat) }, groupStats: atStartValues(home.groupStats) };
    default: return home;
  }
}
