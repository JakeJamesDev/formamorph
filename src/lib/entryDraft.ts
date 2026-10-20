import type { DictionarySelectionItem } from './dictionarySelection';
import { locationForPersonaPick, withoutPersona, type PersonaPickContext } from './personaPick';
import { resolveOwners } from './owners';
import { startingGateStats } from './gateStats';
import { settle, settleDefaults, type GateInput, type SettleResult } from './traitGates';
import { cascadeOffInput, settledCascadeOff } from './traitRuntime';
import { scoped } from './scope';
import type { CascadeOffTraitIds, Entity, OwnedTraitPicks, PersonaRef, Stat, StatGroup, Trait, TraitGroup } from '@/types';

/** Choices retained for one visit to Enter World. */
export interface EntryDraft {
  traitIds: string[];
  /** An entity that leaves the cast keeps its picks for a return. */
  ownedTraitIds: OwnedTraitPicks;
  /** The picks a cascade turned off in this visit, which return once their gate holds again. */
  cascadeOffTraitIds: CascadeOffTraitIds;
  locationId: string | null;
  /** The player picked the location in this step, so no persona pick moves it. */
  locationChosen: boolean;
  entityIds: Set<string>;
  dictionaryItems: DictionarySelectionItem[];
  persona: PersonaRef;
  traitSection: number;
}

export const emptyEntryDraft = (): EntryDraft => ({
  traitIds: [], ownedTraitIds: {}, cascadeOffTraitIds: {}, locationId: null, locationChosen: false, entityIds: new Set(), dictionaryItems: [],
  persona: { source: 'none' }, traitSection: 0,
});

/** The draft after a persona pick: one entity fills one role, and a world persona preselects its location. */
export function withPersonaPick(draft: EntryDraft, ref: PersonaRef, context: PersonaPickContext): EntryDraft {
  return {
    ...draft,
    persona: ref,
    entityIds: withoutPersona(draft.entityIds, ref),
    ...locationForPersonaPick({ ref, current: draft.locationId, locationChosen: draft.locationChosen, ...context }),
  };
}

export const withLocationPick = (draft: EntryDraft, locationId: string | null): EntryDraft =>
  ({ ...draft, locationId, locationChosen: true });

/** The traits Enter World shows: the world's, its entities', and those of the library entities in the cast. */
export interface EntryTraitWorld {
  traits: readonly Trait[];
  traitGroups: readonly TraitGroup[];
  entities: readonly Entity[];
  /** The library persona and the added library entities, in the order added. */
  library: readonly Entity[];
  /** The world's stats, which stat Conditions read at their authored start. Absent, those stay unresolved. */
  stats?: readonly Stat[];
  statGroups?: readonly StatGroup[];
}

/** The gate input over every present owner under `persona`, without the active sets. */
const entryGateBase = (world: EntryTraitWorld, persona: PersonaRef): Omit<GateInput, 'active'> => ({
  ...resolveOwners(world, persona, world.library).gate,
  stats: startingGateStats(world, world.library),
  reader: 'player',
});

/** Global scope's tree and every present entity owner under `persona`: the world's entities, then the library
 *  entities. */
export const entryTrees = (world: EntryTraitWorld, persona: PersonaRef): Pick<GateInput, 'global' | 'owners'> => {
  const { global, owners } = resolveOwners(world, persona, world.library).gate;
  return { global, owners };
};

/** The gates of the draft's picks: every present owner, under the draft's persona. */
export const entryGateInput = (
  world: EntryTraitWorld, draft: Pick<EntryDraft, 'traitIds' | 'ownedTraitIds' | 'persona'>,
): GateInput => ({
  ...entryGateBase(world, draft.persona),
  active: scoped(draft.traitIds, draft.ownedTraitIds),
});

/** The draft with settled picks and cascade-off lists. An owner the settle did not cover keeps both. */
export function withSettledTraits(draft: EntryDraft, result: Pick<SettleResult, 'active' | 'cascadeOff'>): EntryDraft {
  return {
    ...draft,
    traitIds: result.active.global,
    ownedTraitIds: { ...draft.ownedTraitIds, ...result.active.owners },
    cascadeOffTraitIds: settledCascadeOff(draft.cascadeOffTraitIds, result.cascadeOff),
  };
}

/** Every scope's default picks under `persona`. */
export function entryDefaults(world: EntryTraitWorld, persona: PersonaRef): Pick<EntryDraft, 'traitIds' | 'ownedTraitIds'> {
  const { global, owners } = settleDefaults(entryGateBase(world, persona)).active;
  return { traitIds: global, ownedTraitIds: { ...owners } };
}

/** The library entities in the cast, by library id: the library persona, then the added characters as picked. */
export function libraryCastIds(draft: Pick<EntryDraft, 'persona' | 'entityIds'>): string[] {
  const persona = draft.persona.source === 'library' ? [draft.persona.entityId] : [];
  return [...persona, ...withoutPersona(draft.entityIds, draft.persona)];
}

/** The draft with each library entity that joined the cast holding its default picks, settled against the
 *  rest. An entity with picks keeps them, so a return to the cast finds them as the player left them. */
export function withLibraryDefaults(draft: EntryDraft, world: EntryTraitWorld): EntryDraft {
  const joined = world.library.filter((e) => !(e.id in draft.ownedTraitIds));
  if (!joined.length) return draft;
  const defaults = entryDefaults(world, draft.persona).ownedTraitIds;
  const next = {
    ...draft,
    ownedTraitIds: { ...draft.ownedTraitIds, ...Object.fromEntries(joined.map((e) => [e.id, defaults[e.id] ?? []])) },
  };
  return withSettledTraits(next, settle(entryGateInput(world, next), cascadeOffInput(next.cascadeOffTraitIds)));
}

/** Picks keyed by library id moved to the ids of the copies that play. */
export const rekeyOwnedPicks = (picks: OwnedTraitPicks, copyIds: ReadonlyMap<string, string>): OwnedTraitPicks =>
  Object.fromEntries(Object.entries(picks).map(([id, ids]) => [copyIds.get(id) ?? id, ids]));

/** The owned picks the game starts with: those of the present owners that picked anything. */
export function castOwnedTraits(draft: Pick<EntryDraft, 'ownedTraitIds' | 'persona'>, world: EntryTraitWorld): OwnedTraitPicks {
  const out: OwnedTraitPicks = {};
  for (const owner of entryTrees(world, draft.persona).owners) {
    const picks = draft.ownedTraitIds[owner.id];
    if (picks?.length) out[owner.id] = picks;
  }
  return out;
}
