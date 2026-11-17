import type { DictionarySelectionItem } from './dictionarySelection';
import { locationForPersonaPick, withoutPersona, type PersonaPickContext } from './personaPick';
import { resolveOwners } from './owners';
import { startingGateStats } from './gateStats';
import {
  activeOf, gateTrees, groupPickState, settle, settleDefaults, switchTrait,
  type GateInput, type GateScopeTree, type GateTraitRef, type SettleResult,
} from './traitGates';
import { traitOrderIndex } from './traitEffects';
import { cascadeOffInput, settledCascadeOff } from './traitRuntime';
import { scoped } from './scope';
import { startingInstances } from './inventory';
import { acceptsValue, optionValue, valuedOptions } from './worldOptions';
import type {
  Body, CascadeOffTraitIds, Entity, GameLocation, Item, OwnedTraitPicks, PersonaRef, Placement, PresetRow, PresetValue,
  PresetWorldOption, Slot, Stat, StatGroup, Trait, TraitGroup, WorldOption, WorldOptionValues,
} from '@/types';

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
  /** The player's World Option picks. An Option missing here starts on its default. */
  optionValues: WorldOptionValues;
}

export const emptyEntryDraft = (): EntryDraft => ({
  traitIds: [], ownedTraitIds: {}, cascadeOffTraitIds: {}, locationId: null, locationChosen: false, entityIds: new Set(), dictionaryItems: [],
  persona: { source: 'none' }, traitSection: 0, optionValues: {},
});

/** The draft after a persona pick: one entity fills one role, and a persona with start places preselects its location. */
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
  /** The authored items and their starting placements: item Conditions read the instances the new game seeds. */
  items?: readonly Item[];
  placements?: readonly Placement[];
  /** The slots and Bodies that starting equips fill. */
  slots?: readonly Slot[];
  bodies?: readonly Body[];
  locations?: readonly Pick<GameLocation, 'id'>[];
  /** The world's Options, which Option Conditions read at the draft's picks (Q43). */
  options?: readonly WorldOption[];
}

/** The Item Instances a new game would hold under `persona`, so an item Condition reads the start. The ids only tell instances apart. */
function seededInstances(world: EntryTraitWorld, persona: PersonaRef) {
  let n = 0;
  return startingInstances({ ...world, entities: [...world.entities, ...world.library] }, persona, () => `seed-${n++}`);
}

/** The gate input over every present owner under `persona`, without the active sets. */
const entryGateBase = (world: EntryTraitWorld, persona: PersonaRef): Omit<GateInput, 'active'> => ({
  ...resolveOwners(world, persona, world.library).gate,
  ...(world.options ? { worldOptions: world.options } : {}),
  stats: startingGateStats(world, world.library),
  reader: 'player',
  ...(world.items ? { worldItems: world.items, itemInstances: seededInstances(world, persona) } : {}),
});

/** Global scope's tree and every present entity owner under `persona`: the world's entities, then the library
 *  entities. */
export const entryTrees = (world: EntryTraitWorld, persona: PersonaRef): Pick<GateInput, 'global' | 'owners'> => {
  const { global, owners } = resolveOwners(world, persona, world.library).gate;
  return { global, owners };
};

/** The gates of the draft's picks: every present owner, under the draft's persona and Option values. */
export const entryGateInput = (
  world: EntryTraitWorld, draft: Pick<EntryDraft, 'traitIds' | 'ownedTraitIds' | 'persona'> & Partial<Pick<EntryDraft, 'optionValues'>>,
): GateInput => ({
  ...entryGateBase(world, draft.persona),
  ...(draft.optionValues ? { optionValues: draft.optionValues } : {}),
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

/**
 * The draft with each group that `dropped` left below its minimum filled again: its default first, then the
 * first trait in authored order that switches on without turning another off. A group nothing can fill stays
 * short, and a group no drop touched is the player's to fill.
 */
export function withShortGroupsFilled(draft: EntryDraft, world: EntryTraitWorld, dropped: readonly GateTraitRef[]): EntryDraft {
  let next = draft;
  const stuck = new Set<string>();
  const emptied = (tree: GateScopeTree, groupId: string) => dropped.some((ref) => ref.ownerId === tree.id
    && tree.traits.some((t) => t.id === ref.traitId && (t.groupId ?? null) === groupId));
  for (;;) {
    const input = entryGateInput(world, next);
    const short = gateTrees(input).flatMap((tree) => tree.groups
      .filter((group) => !stuck.has(`${tree.id}:${group.id}`) && emptied(tree, group.id)
        && groupPickState(group, tree.traits, activeOf(input.active, tree.id)).short)
      .map((group) => ({ tree, group })));
    if (!short.length) return next;
    const { tree, group } = short[0];
    const order = traitOrderIndex(tree.traits, tree.groups);
    const on = new Set(activeOf(input.active, tree.id));
    const candidates = tree.traits
      .filter((t) => (t.groupId ?? null) === group.id && !on.has(t.id))
      .sort((a, b) => Number(!!b.isDefault) - Number(!!a.isDefault) || (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
    const filled = candidates.some((trait) => {
      const result = switchTrait(input, tree.id, trait.id, cascadeOffInput(next.cascadeOffTraitIds));
      if (!result || result.turnedOff.length || !activeOf(result.active, tree.id).includes(trait.id)) return false;
      next = withSettledTraits(next, result);
      return true;
    });
    if (!filled) stuck.add(`${tree.id}:${group.id}`);
  }
}

/** A settle of the draft on the setup screen: {@link withSettledTraits}, then {@link withShortGroupsFilled}. */
export const withSettledEntry = (draft: EntryDraft, result: Pick<SettleResult, 'active' | 'cascadeOff' | 'turnedOff'>, world: EntryTraitWorld): EntryDraft =>
  withShortGroupsFilled(withSettledTraits(draft, result), world, result.turnedOff);

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
  return withSettledEntry(next, settle(entryGateInput(world, next), cascadeOffInput(next.cascadeOffTraitIds)), world);
}

/** Picks keyed by library id moved to the ids of the copies that play. */
export const rekeyOwnedPicks = (picks: OwnedTraitPicks, instanceIds: ReadonlyMap<string, string>): OwnedTraitPicks =>
  Object.fromEntries(Object.entries(picks).map(([id, ids]) => [instanceIds.get(id) ?? id, ids]));

/** The owned picks the game starts with: those of the present owners that picked anything. */
export function castOwnedTraits(draft: Pick<EntryDraft, 'ownedTraitIds' | 'persona'>, world: EntryTraitWorld): OwnedTraitPicks {
  const out: OwnedTraitPicks = {};
  for (const owner of entryTrees(world, draft.persona).owners) {
    const picks = draft.ownedTraitIds[owner.id];
    if (picks?.length) out[owner.id] = picks;
  }
  return out;
}

/** What one Preset click did: the value applied, the picks its settle turned off, and the rows it could not apply. */
export interface PresetNotice {
  value: PresetValue;
  turnedOff: SettleResult['turnedOff'];
  skipped: readonly PresetRow[];
}

/** The draft's Option values with one Option row laid on, or null when the row names no shown valued Option or a
 *  value it does not accept. */
function withOptionRow(values: WorldOptionValues, row: Extract<PresetRow, { kind: 'option' }>, world: EntryTraitWorld): WorldOptionValues | null {
  const option = valuedOptions(world.options).find((o) => o.id === row.optionId);
  if (!option?.shownToPlayer || !acceptsValue(option, row.value)) return null;
  return { ...values, [option.id]: row.value };
}

/**
 * The draft after a click on one Preset value, and its notice. The target is the defaults under a snapshot, or the
 * draft under an overlay, with the rows laid on; the picks then settle once against it. Null when the Preset has no
 * such value.
 */
export function applyPreset(
  draft: EntryDraft, world: EntryTraitWorld, preset: PresetWorldOption, valueId: string,
): { draft: EntryDraft; notice: PresetNotice } | null {
  const value = preset.values.find((v) => v.id === valueId);
  if (!value) return null;
  let optionValues: WorldOptionValues = preset.mode === 'snapshot' ? {} : draft.optionValues;
  const skipped: PresetRow[] = [];
  for (const row of value.rows) {
    const next = row.kind === 'option' ? withOptionRow(optionValues, row, world) : null;
    if (next) optionValues = next;
    else skipped.push(row);
  }
  const target = { ...draft, optionValues };
  const result = settle(entryGateInput(world, target), cascadeOffInput(target.cascadeOffTraitIds));
  return { draft: withSettledEntry(target, result, world), notice: { value, turnedOff: result.turnedOff, skipped } };
}

const samePicks = (a: readonly string[] | undefined, b: readonly string[] | undefined) => {
  const left = new Set(a ?? []);
  const right = new Set(b ?? []);
  return left.size === right.size && [...left].every((id) => right.has(id));
};

/** Whether two drafts hold the same trait picks in every scope. */
const sameTraits = (a: EntryDraft, b: EntryDraft) => samePicks(a.traitIds, b.traitIds)
  && [...new Set([...Object.keys(a.ownedTraitIds), ...Object.keys(b.ownedTraitIds)])].every((id) => samePicks(a.ownedTraitIds[id], b.ownedTraitIds[id]));

/**
 * The Preset value the draft matches, or null. A value matches while the draft equals its result: under a snapshot,
 * every Option and trait; under an overlay, the values its applied rows name. A value with no row that applies never
 * matches. The first match in authored order wins.
 */
export function matchPreset(draft: EntryDraft, world: EntryTraitWorld, preset: PresetWorldOption): string | null {
  const options = valuedOptions(world.options);
  const sameOption = (a: EntryDraft, b: EntryDraft, id: string) => {
    const option = options.find((o) => o.id === id);
    return !option || optionValue(option, a.optionValues) === optionValue(option, b.optionValues);
  };
  for (const value of preset.values) {
    const applied = applyPreset(draft, world, preset, value.id);
    if (!applied || applied.notice.skipped.length === value.rows.length) continue;
    const result = applied.draft;
    const matches = preset.mode === 'snapshot'
      ? options.every((o) => sameOption(result, draft, o.id)) && sameTraits(result, draft)
      : value.rows.every((row) => row.kind !== 'option' || sameOption(result, draft, row.optionId));
    if (matches) return value.id;
  }
  return null;
}
