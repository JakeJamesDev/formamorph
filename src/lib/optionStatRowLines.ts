// The stat rows of one Option value as the player reads them, in the trait-list form ("Gold: +100").

import { resolvedEntityStatTree, type StatLinkWorld } from './statLinks';
import type { Entity, OptionStatChange, Stat } from '@/types';

/** One listed row: the stat's name (with the owner, "Wolf: Health"), the change and the facet. */
export interface OptionRowLine {
  label: string;
  value: number;
  /** Absent for a starting row, which the list shows bare. */
  type?: 'min' | 'max' | 'regen';
}

export interface OptionRowLinesWorld extends StatLinkWorld {
  entities: readonly Entity[];
}

/** The rows a player may read, in row order. A row on a hidden stat, or whose stat or entity is gone, is left out
 *  as a trait row's is. With `play`, starting rows are left out too, since a mid-game switch never applies them. */
export function optionRowLines(
  rows: readonly OptionStatChange[] | undefined, world: OptionRowLinesWorld,
  { play = false, resolveText = (text: string) => text }: { play?: boolean; resolveText?: (text: string) => string } = {},
): OptionRowLine[] {
  const globals = new Map(world.stats.map((stat) => [stat.id, stat]));
  const owned = new Map<string, { name: string; stats: Map<string, Stat> }>();
  const ownerOf = (id: string) => {
    let found = owned.get(id);
    if (!found) {
      const entity = world.entities.find((e) => e.id === id);
      if (!entity) return undefined;
      found = { name: entity.name, stats: new Map(resolvedEntityStatTree(world, entity).stats.map((stat) => [stat.id, stat])) };
      owned.set(id, found);
    }
    return found;
  };
  const out: OptionRowLine[] = [];
  for (const row of rows ?? []) {
    const starting = !row.type || row.type === 'starting';
    if (play && starting) continue;
    let label: string;
    let stat: Stat | undefined;
    if (row.ownerId) {
      const owner = ownerOf(row.ownerId);
      stat = owner?.stats.get(row.statId);
      label = `${resolveText(owner?.name ?? '')}: ${resolveText(stat?.name ?? '')}`;
    } else {
      stat = globals.get(row.statId);
      label = resolveText(stat?.name ?? '');
    }
    if (!stat || stat.hidden === true) continue;
    out.push({ label, value: row.value, ...(row.type === 'min' || row.type === 'max' || row.type === 'regen' ? { type: row.type } : {}) });
  }
  return out;
}
