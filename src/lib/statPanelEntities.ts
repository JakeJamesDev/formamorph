// The entity picker of the in-game stat panel: who it lists, how it labels each, and which one shows.

import type { Entity, PlayerStat, SceneEntity } from '@/types';
import { resolveEntityByName } from './entityMatch';
import { numbered } from './presence';

export interface StatPanelOption {
  id: string;
  label: string;
  /** The played persona: the picker renders the You mark after the label. */
  you?: boolean;
}

/**
 * The entities the panel can show: the played persona, then everyone in `scene` under the label the player
 * sees. A stranger never shows its name.
 */
export function statPanelOptions({ persona, scene }: {
  persona: Entity | null;
  /** The In Scene set, in order. */
  scene: readonly { entity: Entity; label: string | null }[];
}): StatPanelOption[] {
  const out: StatPanelOption[] = [];
  const listed = new Set<string>();
  const add = (option: StatPanelOption) => {
    if (listed.has(option.id)) return;
    listed.add(option.id);
    out.push(option);
  };
  if (persona) add({ id: persona.id, label: persona.name, you: true });
  for (const { entity, label } of scene) if (label) add({ id: entity.id, label });
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
