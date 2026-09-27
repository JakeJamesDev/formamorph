import type { DictionarySelectionItem } from './dictionarySelection';
import { locationForPersonaPick, withoutPersona, type PersonaPickContext } from './personaPick';
import { traitOwners } from './ownedTraits';
import { WORLD_OWNER, settleDefaults, type GateInput, type GateOwner, type SettleResult } from './traitGates';
import type { CascadeOffTraitIds, Entity, OwnedTraitPicks, PersonaRef, Trait, TraitGroup } from '@/types';

/** Choices retained for one visit to Enter World. */
export interface EntryDraft {
  traitIds: string[];
  /** An entity that leaves the cast keeps its picks for a return. */
  ownedTraitIds: OwnedTraitPicks;
  /** Owner id → the picks a cascade turned off in this visit, which return once their gate holds again. */
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
}

/** Every owner in the cast: the world, its entities, then the library entities. */
export const entryOwners = (world: EntryTraitWorld): GateOwner[] => traitOwners(world, world.library);

/** The gates of the draft's picks: every owner in the cast, under the draft's persona. */
export const entryGateInput = (
  world: EntryTraitWorld, draft: Pick<EntryDraft, 'traitIds' | 'ownedTraitIds' | 'persona'>,
): GateInput => ({
  owners: entryOwners(world),
  active: { ...draft.ownedTraitIds, [WORLD_OWNER]: draft.traitIds },
  entities: world.entities,
  persona: draft.persona,
});

/** The draft with settled picks and cascade-off lists. An owner the settle did not cover keeps both. */
export function withSettledTraits(draft: EntryDraft, result: Pick<SettleResult, 'active' | 'cascadeOff'>): EntryDraft {
  const { [WORLD_OWNER]: traitIds = draft.traitIds, ...owned } = result.active;
  return {
    ...draft,
    traitIds,
    ownedTraitIds: { ...draft.ownedTraitIds, ...owned },
    cascadeOffTraitIds: { ...draft.cascadeOffTraitIds, ...result.cascadeOff },
  };
}

/** Every owner's default picks under `persona`. */
export function entryDefaults(world: EntryTraitWorld, persona: PersonaRef): Pick<EntryDraft, 'traitIds' | 'ownedTraitIds'> {
  const { [WORLD_OWNER]: traitIds = [], ...ownedTraitIds } =
    settleDefaults({ owners: entryOwners(world), entities: world.entities, persona }).active;
  return { traitIds, ownedTraitIds };
}

/** The owned picks the game starts with: those of the entities in the cast that picked anything. */
export function castOwnedTraits(draft: Pick<EntryDraft, 'ownedTraitIds'>, world: EntryTraitWorld): OwnedTraitPicks {
  const out: OwnedTraitPicks = {};
  for (const owner of entryOwners(world)) {
    const picks = draft.ownedTraitIds[owner.id];
    if (owner.id !== WORLD_OWNER && picks?.length) out[owner.id] = picks;
  }
  return out;
}
