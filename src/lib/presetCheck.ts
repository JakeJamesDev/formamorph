import { applyPreset, emptyEntryDraft, entryDefaults, presetPersonaTargets, withPersonaPick, type EntryTraitWorld, type PresetPlaces } from './entryDraft';
import { playedEntityIdOf, startLocationIdsOpen } from './inPlayWorld';
import { preselectPersona, worldPersonaRules } from './personaPick';
import { scoped } from './scope';
import { resolveOwners, type Owner, type OwnerWorld } from './owners';
import type { WorldSlices } from './editorHistory';
import type { Entity, PresetRow, PresetWorldOption, Trait } from '@/types';

/** One row of a Preset value that cannot apply. */
export interface PresetRowIssue {
  row: PresetRow;
  /** The row's target id is gone from the world. */
  deleted: boolean;
}

/** What the check reads: the authored world as the editor holds it. */
export type PresetCheckWorld = Pick<
  WorldSlices,
  'worldOverview' | 'entities' | 'locations' | 'traits' | 'traitGroups' | 'stats' | 'statGroups' | 'items' | 'placements' | 'slots' | 'bodies' | 'options'
>;

/** The trait trees setup offers (Q42). */
export interface PresetTraitTrees {
  /** Global scope's tree, never a Blueprint trait. */
  global: readonly Trait[];
  /** Each entity owner, its links expanded. */
  owners: readonly Owner[];
}

/** The world's trait trees as setup offers them, the library's owners after the world's. */
export function presetTraitTrees(
  world: Pick<OwnerWorld, 'traits' | 'traitGroups' | 'entities'>, library: readonly Entity[] = [],
): PresetTraitTrees {
  const { global, owners } = resolveOwners(world, undefined, library);
  return { global: global.traits, owners };
}

/** The trait a trait row names, read from the trees, with the owner whose tree holds it. */
export function presetRowTrait(
  row: Pick<Extract<PresetRow, { kind: 'trait' }>, 'traitId' | 'ownerId'>, trees: PresetTraitTrees,
): { trait: Trait; owner?: Owner } | undefined {
  const owner = row.ownerId === undefined ? undefined : trees.owners.find((o) => o.id === row.ownerId);
  if (row.ownerId !== undefined && !owner) return undefined;
  const trait = (owner ? owner.traits : trees.global).find((t) => t.id === row.traitId);
  return trait && { trait, ...(owner ? { owner } : {}) };
}

/** Whether the row's target id is still in the world. */
function targetExists(row: PresetRow, world: PresetCheckWorld, trees: PresetTraitTrees): boolean {
  switch (row.kind) {
    case 'option': return world.options.some((o) => o.id === row.optionId);
    case 'persona': return world.entities.some((e) => e.id === row.entityId);
    case 'location': return world.locations.some((l) => l.id === row.locationId);
    case 'trait': return !!presetRowTrait(row, trees);
  }
}

/**
 * Each Preset value's rows that cannot apply, by value id; a value whose rows all apply is left out. Every value
 * applies to the setup a new game opens on: the defaults, under the persona preselected with nothing remembered and
 * at its start place (Q39). From there a snapshot and an overlay reach the same target, so one apply checks both.
 */
export function checkPreset(preset: PresetWorldOption, world: PresetCheckWorld): Map<string, PresetRowIssue[]> {
  const entryWorld: EntryTraitWorld = { ...world, library: [] };
  const rules = worldPersonaRules(world.worldOverview);
  const places: PresetPlaces = {
    allowed: rules.allowed,
    worldEntities: world.entities,
    locations: world.locations,
    openLocationIds: (draft) => startLocationIdsOpen(
      world, playedEntityIdOf(draft.persona, world.entities), draft.optionValues, scoped(draft.traitIds, draft.ownedTraitIds),
    ),
  };
  const targets = presetPersonaTargets(world.entities);
  const persona = preselectPersona({
    rules, remembered: undefined, globalDefault: undefined,
    available: { world: targets.world.map((e) => e.id), library: [], custom: !!targets.custom },
  });
  const defaults = { ...emptyEntryDraft(), ...entryDefaults(entryWorld, persona) };
  const open = places.openLocationIds(defaults);
  const start = withPersonaPick(defaults, persona, {
    worldEntities: world.entities, locations: world.locations.filter((l) => open.has(l.id)),
  });

  const trees = presetTraitTrees(world);
  const out = new Map<string, PresetRowIssue[]>();
  for (const value of preset.values) {
    const skipped = new Set(applyPreset(start, entryWorld, preset, value.id, places)?.notice.skipped);
    const issues = value.rows.flatMap((row) => (skipped.has(row) ? [{ row, deleted: !targetExists(row, world, trees) }] : []));
    if (issues.length) out.set(value.id, issues);
  }
  return out;
}
