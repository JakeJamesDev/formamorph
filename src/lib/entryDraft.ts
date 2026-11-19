import type { DictionarySelectionItem } from './dictionarySelection';
import {
  locationForPersonaPick, offeredPersonas, offeredStartLocations, samePersonaRef, withoutPersona, type PersonaPickContext,
} from './personaPick';
import { customPersonaEntity } from './blueprints';
import { resolveOwners } from './owners';
import { setupStatsOf, type SetupStatsOf } from './setupGateStats';
import {
  NO_ACTIVE, activeOf, gateTreeOf, gateTrees, groupPickState, settle, settleDefaults, switchTrait,
  type GateInput, type GateScopeTree, type GateTraitRef, type SettleResult,
} from './traitGates';
import { isAlwaysOn, traitOrderIndex } from './traitEffects';
import { cascadeOffInput, settledCascadeOff } from './traitRuntime';
import { scoped, type OwnerId } from './scope';
import { startingInstances } from './inventory';
import { acceptsValue, optionValue, valuedOptions } from './worldOptions';
import type {
  AllowedPersonas, Body, CascadeOffTraitIds, Entity, GameLocation, Item, OwnedTraitPicks, PersonaRef, Placement, PresetRow, PresetValue,
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

const setupStats = new WeakMap<EntryTraitWorld, Map<string, SetupStatsOf>>();

/** Persona and Option value pairs a world keeps setup stats for; an older pair rebuilds when asked again. */
const KEPT_SETUPS = 8;

/** The stats a new game under `persona` and `optionValues` starts with per set of picks, kept per world. */
function entryStatsOf(world: EntryTraitWorld, persona: PersonaRef, optionValues?: WorldOptionValues): SetupStatsOf {
  const kept = setupStats.get(world) ?? new Map<string, SetupStatsOf>();
  setupStats.set(world, kept);
  const key = JSON.stringify([persona, optionValues ?? {}]);
  const hit = kept.get(key);
  if (hit) return hit;
  const statsOf = setupStatsOf(world, persona, world.library, optionValues);
  const oldest = kept.size >= KEPT_SETUPS ? kept.keys().next().value : undefined;
  if (oldest !== undefined) kept.delete(oldest);
  kept.set(key, statsOf);
  return statsOf;
}

/** The gate input over every present owner under `persona` and `optionValues`, without the active sets. Stat
 *  Conditions read the stats the picks start the game with (Q26). */
const entryGateBase = (
  world: EntryTraitWorld, persona: PersonaRef, optionValues?: WorldOptionValues,
): Omit<GateInput, 'active'> & { statsOf: SetupStatsOf } => {
  const statsOf = entryStatsOf(world, persona, optionValues);
  return {
    ...resolveOwners(world, persona, world.library).gate,
    ...(world.options ? { worldOptions: world.options } : {}),
    ...(optionValues ? { optionValues } : {}),
    statsOf,
    stats: statsOf(NO_ACTIVE),
    reader: 'player',
    ...(world.items ? { worldItems: world.items, itemInstances: seededInstances(world, persona) } : {}),
  };
};

/** Global scope's tree and every present entity owner under `persona`: the world's entities, then the library
 *  entities. */
export const entryTrees = (world: EntryTraitWorld, persona: PersonaRef): Pick<GateInput, 'global' | 'owners'> => {
  const { global, owners } = resolveOwners(world, persona, world.library).gate;
  return { global, owners };
};

/** The gates of the draft's picks: every present owner, under the draft's persona and Option values. */
export const entryGateInput = (
  world: EntryTraitWorld, draft: Pick<EntryDraft, 'traitIds' | 'ownedTraitIds' | 'persona'> & Partial<Pick<EntryDraft, 'optionValues'>>,
): GateInput => {
  const base = entryGateBase(world, draft.persona, draft.optionValues);
  const active = scoped(draft.traitIds, draft.ownedTraitIds);
  return { ...base, active, stats: base.statsOf(active) };
};

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
 * short, and a group no drop touched is the player's to fill. No fill picks a trait in `keepOff`.
 */
export function withShortGroupsFilled(
  draft: EntryDraft, world: EntryTraitWorld, dropped: readonly GateTraitRef[], keepOff: readonly GateTraitRef[] = [],
): EntryDraft {
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
      .filter((t) => (t.groupId ?? null) === group.id && !on.has(t.id)
        && !keepOff.some((ref) => ref.ownerId === tree.id && ref.traitId === t.id))
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

/** Every scope's default picks under `persona` and the picked `optionValues`. */
export function entryDefaults(
  world: EntryTraitWorld, persona: PersonaRef, optionValues?: WorldOptionValues,
): Pick<EntryDraft, 'traitIds' | 'ownedTraitIds'> {
  const { global, owners } = settleDefaults(entryGateBase(world, persona, optionValues)).active;
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
  const defaults = entryDefaults(world, draft.persona, draft.optionValues).ownedTraitIds;
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

/** What one Preset click did: the value applied, the picks it turned on and off, the persona and Starting Location
 *  it changed to, and the rows it could not apply. */
export interface PresetNotice {
  value: PresetValue;
  on: GateTraitRef[];
  off: GateTraitRef[];
  /** Absent when the persona did not change. */
  persona?: PersonaRef;
  /** Absent when the Starting Location did not change; null is Random. */
  locationId?: string | null;
  skipped: readonly PresetRow[];
}

/** What persona and location rows read. Without it, apply skips those rows. */
export interface PresetPlaces {
  allowed: AllowedPersonas;
  /** The world's entities as authored: persona marks and start places. */
  worldEntities: readonly Entity[];
  locations: readonly GameLocation[];
  /** The ids of the locations the gates leave on and unlocked at the start under `draft`. */
  openLocationIds: (draft: EntryDraft) => ReadonlySet<string>;
}

type PersonaRow = Extract<PresetRow, { kind: 'persona' }>;

/** The entities a persona row can name: the marked personas, then the Custom Persona (Q36). */
export function presetPersonaTargets<E extends Entity>(entities: readonly E[]): { world: E[]; custom?: E } {
  const custom = customPersonaEntity(entities) as E | undefined;
  return { world: entities.filter((e) => e.persona === true && e !== custom), ...(custom ? { custom } : {}) };
}

/** The pick a persona row makes, or null when its entity is gone, unmarked, or not offered (Q36). The Custom
 *  Persona is picked as None, keeping a name the player entered. */
function personaRowRef(row: PersonaRow, places: PresetPlaces, current: PersonaRef): PersonaRef | null {
  const targets = presetPersonaTargets(places.worldEntities);
  const offer = offeredPersonas(places.allowed, { world: targets.world.map((e) => e.id), library: [], custom: targets.custom?.id });
  if (row.entityId === targets.custom?.id) return offer.none && offer.custom ? (current.source === 'none' ? current : { source: 'none' }) : null;
  return offer.world.includes(row.entityId) ? { source: 'world', entityId: row.entityId } : null;
}

/** What a persona pick reads under `draft`: the authored entities and the locations open at its start. */
const pickContext = (draft: EntryDraft, places: PresetPlaces): PersonaPickContext => {
  const open = places.openLocationIds(draft);
  return { worldEntities: places.worldEntities, locations: places.locations.filter((l) => open.has(l.id)) };
};

type TraitRow = Extract<PresetRow, { kind: 'trait' }>;
type Picks = Pick<EntryDraft, 'traitIds' | 'ownedTraitIds'>;
type Trees = Pick<GateInput, 'global' | 'owners'>;

/** The trait a row names, in its owner's scope. */
export const presetRowRef = (row: TraitRow): GateTraitRef => ({ ownerId: row.ownerId ?? null, traitId: row.traitId });
const refKey = (ownerId: OwnerId, traitId: string) => `${ownerId ?? ''}\u0000${traitId}`;
const picksIn = (picks: Picks, ownerId: OwnerId): readonly string[] =>
  (ownerId === null ? picks.traitIds : picks.ownedTraitIds[ownerId] ?? []);
const withPicksIn = <T extends Picks>(picks: T, ownerId: OwnerId, ids: string[]): T =>
  (ownerId === null ? { ...picks, traitIds: ids } : { ...picks, ownedTraitIds: { ...picks.ownedTraitIds, [ownerId]: ids } });
const scopeIds = (trees: Trees): OwnerId[] => [null, ...trees.owners.map((o) => o.id)];

function withCascadeOff(lists: CascadeOffTraitIds, ownerId: OwnerId, edit: (ids: string[]) => string[]): CascadeOffTraitIds {
  if (ownerId === null) return { ...lists, global: edit(lists.global ?? []) };
  return { ...lists, owners: { ...lists.owners, [ownerId]: edit(lists.owners?.[ownerId] ?? []) } };
}

/** Whether a trait row holds in `active`. */
const rowHoldsIn = (active: GateInput['active'], row: TraitRow) => activeOf(active, presetRowRef(row).ownerId).includes(row.traitId) === row.on;

/**
 * The target with one trait row laid on, and the picks it took out; null when the owner is not in the cast, the
 * trait is gone or its mode refuses a toggle, or its group has no room an unlisted pick can give up (Q27, Q28).
 * An on-row makes room in its group by dropping unlisted picks, latest first.
 */
function withTraitRow(
  target: EntryDraft, row: TraitRow, trees: Trees, listed: ReadonlySet<string>,
): { target: EntryDraft; removed: GateTraitRef[] } | null {
  const { ownerId } = presetRowRef(row);
  const tree = gateTreeOf(trees, ownerId);
  const trait = tree?.traits.find((t) => t.id === row.traitId);
  if (!tree || !trait || isAlwaysOn(trait)) return null;
  let next = picksIn(target, ownerId).filter((id) => id !== trait.id);
  const removed: GateTraitRef[] = [];
  if (!row.on) {
    if (next.length < picksIn(target, ownerId).length) removed.push({ ownerId, traitId: trait.id });
  } else {
    const group = tree.groups.find((g) => g.id === (trait.groupId ?? null));
    const max = group?.maxPicks;
    if (group && max !== undefined) {
      const droppable = (id: string) => !listed.has(refKey(ownerId, id))
        && tree.traits.some((t) => t.id === id && (t.groupId ?? null) === group.id && !isAlwaysOn(t));
      while (groupPickState(group, tree.traits, next).count >= max) {
        const drop = [...next].reverse().find(droppable);
        if (drop === undefined) return null;
        next = next.filter((id) => id !== drop);
        removed.push({ ownerId, traitId: drop });
      }
    }
    next = [...next, trait.id];
  }
  const cascadeOffTraitIds = withCascadeOff(target.cascadeOffTraitIds, ownerId, (ids) => ids.filter((id) => id !== trait.id));
  return { target: { ...withPicksIn(target, ownerId, next), cascadeOffTraitIds }, removed };
}

/** The target with each scope's listed picks first, so they win a Not tie in the settle (Q26). */
function listedFirst(target: EntryDraft, trees: Trees, listed: ReadonlySet<string>): EntryDraft {
  return scopeIds(trees).reduce((acc, ownerId) => {
    const ids = picksIn(acc, ownerId);
    const first = ids.filter((id) => listed.has(refKey(ownerId, id)));
    return first.length ? withPicksIn(acc, ownerId, [...first, ...ids.filter((id) => !listed.has(refKey(ownerId, id)))]) : acc;
  }, target);
}

/** The target with `refs` out of the picks and on the cascade-off list. */
const toCascadeOff = (target: EntryDraft, refs: readonly GateTraitRef[]): EntryDraft => refs.reduce((acc, ref) => ({
  ...withPicksIn(acc, ref.ownerId, picksIn(acc, ref.ownerId).filter((id) => id !== ref.traitId)),
  cascadeOffTraitIds: withCascadeOff(acc.cascadeOffTraitIds, ref.ownerId, (ids) => [...ids.filter((id) => id !== ref.traitId), ref.traitId]),
}), target);

/** Every pick `after` holds that `before` lacks, scope by scope over the cast. */
const picksAdded = (before: Picks, after: Picks, trees: Trees): GateTraitRef[] => scopeIds(trees).flatMap((ownerId) => {
  const had = new Set(picksIn(before, ownerId));
  return picksIn(after, ownerId).filter((id) => !had.has(id)).map((traitId) => ({ ownerId, traitId }));
});

/**
 * The unlisted picks to send to cascade-off so the most laid rows hold (Q26): every unlisted active pick sets the
 * bound, then each one that the bound does not need stays, so the latest picks are the ones that go.
 */
function blockersOf(
  target: EntryDraft, result: SettleResult, trees: Trees, listed: ReadonlySet<string>,
  held: (target: EntryDraft) => number,
): GateTraitRef[] {
  const unlisted = scopeIds(trees).flatMap((ownerId) => activeOf(result.active, ownerId)
    .filter((id) => picksIn(target, ownerId).includes(id) && !listed.has(refKey(ownerId, id)))
    .map((traitId) => ({ ownerId, traitId })));
  const best = held(toCascadeOff(target, unlisted));
  if (best <= held(target)) return [];
  let dropped = unlisted;
  for (const ref of unlisted) {
    const trial = dropped.filter((r) => r !== ref);
    if (held(toCascadeOff(target, trial)) >= best) dropped = trial;
  }
  return dropped;
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
 * draft under an overlay, with the rows laid on. The picks then settle once with the Preset's first; an unlisted
 * pick that still blocks an on-row goes to cascade-off and the settle runs again (Q26). A row that does not hold
 * afterward is skipped. A persona row is picked first, as a click, so the trees and the snapshot's defaults read the
 * new persona; a location row is picked last, among the locations the step offers then (Q33–Q38). Null when the
 * Preset has no such value.
 */
export function applyPreset(
  draft: EntryDraft, world: EntryTraitWorld, preset: PresetWorldOption, valueId: string, places?: PresetPlaces,
): { draft: EntryDraft; notice: PresetNotice } | null {
  const value = preset.values.find((v) => v.id === valueId);
  if (!value) return null;
  let optionValues: WorldOptionValues = preset.mode === 'snapshot' ? {} : draft.optionValues;
  const skipped = new Set<PresetRow>();
  for (const row of value.rows) {
    if (row.kind !== 'option') continue;
    const next = withOptionRow(optionValues, row, world);
    if (next) optionValues = next;
    else skipped.add(row);
  }

  let target: EntryDraft = { ...draft, optionValues };
  for (const row of value.rows) {
    if (row.kind !== 'persona') continue;
    const ref = places && personaRowRef(row, places, target.persona);
    if (ref && places) target = withPersonaPick(target, ref, pickContext(target, places));
    else skipped.add(row);
  }
  const trees = entryTrees(world, target.persona);
  if (preset.mode === 'snapshot') {
    const { global, owners } = settleDefaults(entryGateBase(world, target.persona, optionValues)).active;
    target = { ...target, traitIds: global, ownedTraitIds: { ...target.ownedTraitIds, ...owners }, cascadeOffTraitIds: { global: [], owners: {} } };
  }
  const listed = new Set<string>();
  const laid: TraitRow[] = [];
  const removed: GateTraitRef[] = [];
  for (const row of value.rows) {
    if (row.kind !== 'trait') continue;
    const next = withTraitRow(target, row, trees, listed);
    if (!next) { skipped.add(row); continue; }
    target = next.target;
    removed.push(...next.removed);
    laid.push(row);
    if (row.on) listed.add(refKey(presetRowRef(row).ownerId, row.traitId));
  }
  target = listedFirst(target, trees, listed);

  const settleOf = (t: EntryDraft) => settle(entryGateInput(world, t), cascadeOffInput(t.cascadeOffTraitIds));
  const held = (t: EntryDraft) => laid.filter((row) => rowHoldsIn(settleOf(t).active, row)).length;
  let result = settleOf(target);
  const blockers = laid.every((row) => rowHoldsIn(result.active, row)) ? [] : blockersOf(target, result, trees, listed, held);
  if (blockers.length) {
    target = toCascadeOff(target, blockers);
    result = settleOf(target);
  }

  const keptOff = laid.filter((row) => !row.on).map(presetRowRef);
  let settled = withShortGroupsFilled(withSettledTraits(target, result), world, [...result.turnedOff, ...removed, ...blockers], keptOff);
  for (const row of laid) if (picksIn(settled, presetRowRef(row).ownerId).includes(row.traitId) !== row.on) skipped.add(row);
  for (const row of value.rows) {
    if (row.kind !== 'location') continue;
    const offered = places ? offeredStartLocations(settled.persona, pickContext(settled, places)) : [];
    if (offered.some((l) => l.id === row.locationId)) settled = withLocationPick(settled, row.locationId);
    else skipped.add(row);
  }
  return {
    draft: settled,
    notice: {
      value,
      on: picksAdded(draft, settled, trees),
      off: picksAdded(settled, draft, trees),
      ...(samePersonaRef(draft.persona, settled.persona) ? {} : { persona: settled.persona }),
      ...(draft.locationId === settled.locationId ? {} : { locationId: settled.locationId }),
      skipped: value.rows.filter((row) => skipped.has(row)),
    },
  };
}

const samePicks = (a: readonly string[] | undefined, b: readonly string[] | undefined) => {
  const left = new Set(a ?? []);
  const right = new Set(b ?? []);
  return left.size === right.size && [...left].every((id) => right.has(id));
};

/** Whether two drafts agree on one trait row's trait. */
const sameTrait = (a: Picks, b: Picks, row: TraitRow) =>
  picksIn(a, presetRowRef(row).ownerId).includes(row.traitId) === picksIn(b, presetRowRef(row).ownerId).includes(row.traitId);

/** Whether two drafts hold the same trait picks in every scope. */
const sameTraits = (a: EntryDraft, b: EntryDraft) => samePicks(a.traitIds, b.traitIds)
  && [...new Set([...Object.keys(a.ownedTraitIds), ...Object.keys(b.ownedTraitIds)])].every((id) => samePicks(a.ownedTraitIds[id], b.ownedTraitIds[id]));

/**
 * The Preset value the draft matches, or null. A value matches while the draft equals its result: under a snapshot,
 * every Option and trait; under an overlay, the values its applied rows name. Either way the persona and Starting
 * Location count only when a row names them. A value with no row that applies never matches. The first match in
 * authored order wins.
 */
export function matchPreset(draft: EntryDraft, world: EntryTraitWorld, preset: PresetWorldOption, places?: PresetPlaces): string | null {
  const options = valuedOptions(world.options);
  const sameOption = (a: EntryDraft, b: EntryDraft, id: string) => {
    const option = options.find((o) => o.id === id);
    return !option || optionValue(option, a.optionValues) === optionValue(option, b.optionValues);
  };
  for (const value of preset.values) {
    const applied = applyPreset(draft, world, preset, value.id, places);
    if (!applied || applied.notice.skipped.length === value.rows.length) continue;
    const result = applied.draft;
    const samePlace = (row: PresetRow) => (row.kind === 'persona' ? samePersonaRef(result.persona, draft.persona)
      : row.kind !== 'location' || result.locationId === draft.locationId);
    const matches = value.rows.every(samePlace) && (preset.mode === 'snapshot'
      ? options.every((o) => sameOption(result, draft, o.id)) && sameTraits(result, draft)
      : value.rows.every((row) => (row.kind === 'option' ? sameOption(result, draft, row.optionId)
        : row.kind !== 'trait' || sameTrait(result, draft, row))));
    if (matches) return value.id;
  }
  return null;
}
