// The entity picker of the in-game stat panel: who it lists, how it labels each, and which one shows.

import type { Entity, PlayerStat, SceneEntity } from '@/types';
import type { OwnerStats } from './statOwners';
import { resolveEntityByName } from './entityMatch';

export interface StatPanelOption {
  id: string;
  label: string;
  present: boolean;
  /** The played persona: the picker renders the You mark after the label. */
  you?: boolean;
}

const UNKNOWN = 'Unknown';

/** What the story has told the player about each entity's name, across `scenes` in order. */
function nameKnowledge(scenes: readonly (readonly SceneEntity[])[], entities: readonly Entity[]) {
  const known = new Map<string, { revealed: boolean; alias?: string }>();
  for (const scene of scenes) {
    for (const seen of scene) {
      const entity = resolveEntityByName(seen.name, entities);
      if (!entity) continue;
      const before = known.get(entity.id);
      if (seen.revealed) known.set(entity.id, { revealed: true });
      else if (!before?.revealed) known.set(entity.id, { revealed: false, alias: seen.alias ?? before?.alias });
    }
  }
  return known;
}

/** Later labels that repeat an earlier one take a count: "Unknown", "Unknown (2)". */
function numbered(options: StatPanelOption[]): StatPanelOption[] {
  const counts = new Map<string, number>();
  return options.map((option) => {
    const count = (counts.get(option.label) ?? 0) + 1;
    counts.set(option.label, count);
    return count > 1 ? { ...option, label: `${option.label} (${count})` } : option;
  });
}

/**
 * The entities the panel can show: the played persona, the entities present in `scene`, then the absent ones
 * that own a stat the player can see and whose name some scene in `history` revealed. A present entity reads
 * its own scene row: its name once revealed, else its alias. `keep` is an entity that stays listed even when
 * absent, unrevealed or with nothing to show, so the entity view's pick is never missing from the list; an
 * unrevealed one reads the last alias seen.
 */
export function statPanelOptions({ entities, persona, scene, history, values, keep }: {
  /** Everyone the panel can list: the cast plus discovered characters. */
  entities: readonly Entity[];
  persona: Entity | null;
  scene: readonly SceneEntity[];
  /** Every scene up to the viewed turn, oldest first. */
  history: readonly (readonly SceneEntity[])[];
  values: OwnerStats;
  keep?: string | null;
}): StatPanelOption[] {
  const out: StatPanelOption[] = [];
  const listed = new Set<string>();
  const add = (option: StatPanelOption) => {
    if (listed.has(option.id)) return;
    listed.add(option.id);
    out.push(option);
  };
  if (persona) add({ id: persona.id, label: persona.name, present: true, you: true });
  for (const seen of scene) {
    const entity = resolveEntityByName(seen.name, entities);
    if (entity) add({ id: entity.id, label: seen.revealed ? entity.name : seen.alias ?? UNKNOWN, present: true });
  }
  const known = nameKnowledge(history, entities);
  for (const entity of entities) {
    const told = known.get(entity.id);
    if ((!shownEntityStats(values[entity.id]).length || !told?.revealed) && entity.id !== keep) continue;
    add({ id: entity.id, label: told?.revealed ? entity.name : told?.alias ?? UNKNOWN, present: false });
  }
  return numbered(out);
}

/** The entity the panel shows: a listed pick, else `fallbackId` when no pick holds, else null for (None).
 *  `selected` is undefined before any pick and null for (None). */
export function statPanelSelection(
  selected: string | null | undefined, options: readonly StatPanelOption[], fallbackId: string | undefined,
): string | null {
  if (selected === null) return null;
  if (selected !== undefined && options.some((o) => o.id === selected)) return selected;
  return fallbackId && options.some((o) => o.id === fallbackId) ? fallbackId : null;
}

/** The first entity in `scene`, in scene order, that `showable` accepts. What the entity view opens on. */
export function firstShowableEntity(
  scene: readonly SceneEntity[], entities: readonly Entity[], showable: (entity: Entity) => boolean,
): Entity | undefined {
  for (const seen of scene) {
    const entity = resolveEntityByName(seen.name, entities);
    if (entity && showable(entity)) return entity;
  }
  return undefined;
}

/** The stats of one entity the player can see: not hidden, not switched off. */
export function shownEntityStats(stats: readonly PlayerStat[] | undefined): PlayerStat[] {
  return (stats ?? []).filter((stat) => stat.enabled !== false && stat.hidden !== true);
}
