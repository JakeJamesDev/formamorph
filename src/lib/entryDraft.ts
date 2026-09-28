import type { DictionarySelectionItem } from './dictionarySelection';
import { locationForPersonaPick, withoutPersona, type PersonaPickContext } from './personaPick';
import { resolveBearers } from './bearers';
import { WORLD_OWNER, settle, settleDefaults, type GateInput, type GateOwner, type SettleResult } from './traitGates';
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

/** Every present bearer under `persona`: the player, the world's entities, then the library entities. */
export const entryOwners = (world: EntryTraitWorld, persona: PersonaRef): readonly GateOwner[] =>
  resolveBearers(world, persona, world.library).gate.owners;

/** The gates of the draft's picks: every present bearer, under the draft's persona. */
export const entryGateInput = (
  world: EntryTraitWorld, draft: Pick<EntryDraft, 'traitIds' | 'ownedTraitIds' | 'persona'>,
): GateInput => ({
  ...resolveBearers(world, draft.persona, world.library).gate,
  active: { ...draft.ownedTraitIds, [WORLD_OWNER]: draft.traitIds },
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
    settleDefaults(resolveBearers(world, persona, world.library).gate).active;
  return { traitIds, ownedTraitIds };
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
  return withSettledTraits(next, settle(entryGateInput(world, next), next.cascadeOffTraitIds));
}

/** Picks keyed by library id moved to the ids of the copies that play. */
export const rekeyOwnedPicks = (picks: OwnedTraitPicks, copyIds: ReadonlyMap<string, string>): OwnedTraitPicks =>
  Object.fromEntries(Object.entries(picks).map(([id, ids]) => [copyIds.get(id) ?? id, ids]));

/** The owned picks the game starts with: those of the present bearers that picked anything. */
export function castOwnedTraits(draft: Pick<EntryDraft, 'ownedTraitIds' | 'persona'>, world: EntryTraitWorld): OwnedTraitPicks {
  const out: OwnedTraitPicks = {};
  for (const owner of entryOwners(world, draft.persona)) {
    const picks = draft.ownedTraitIds[owner.id];
    if (owner.id !== WORLD_OWNER && picks?.length) out[owner.id] = picks;
  }
  return out;
}
