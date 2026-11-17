import { applyPreset, emptyEntryDraft, entryDefaults, presetPersonaTargets, withPersonaPick, type EntryTraitWorld, type PresetPlaces } from './entryDraft';
import { playedEntityIdOf, startLocationIdsOpen } from './inPlayWorld';
import { preselectPersona, worldPersonaRules } from './personaPick';
import { scoped } from './scope';
import type { WorldSlices } from './editorHistory';
import type { PresetRow, PresetWorldOption } from '@/types';

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

/** Whether the row's target id is still in the world. */
function targetExists(row: PresetRow, world: PresetCheckWorld): boolean {
  switch (row.kind) {
    case 'option': return world.options.some((o) => o.id === row.optionId);
    case 'persona': return world.entities.some((e) => e.id === row.entityId);
    case 'location': return world.locations.some((l) => l.id === row.locationId);
    case 'trait': {
      const traits = row.ownerId === undefined ? world.traits : world.entities.find((e) => e.id === row.ownerId)?.traits;
      return !!traits?.some((t) => t.id === row.traitId);
    }
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

  const out = new Map<string, PresetRowIssue[]>();
  for (const value of preset.values) {
    const skipped = new Set(applyPreset(start, entryWorld, preset, value.id, places)?.notice.skipped);
    const issues = value.rows.flatMap((row) => (skipped.has(row) ? [{ row, deleted: !targetExists(row, world) }] : []));
    if (issues.length) out.set(value.id, issues);
  }
  return out;
}
