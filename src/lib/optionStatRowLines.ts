// The stat rows of one Option value as the player reads them, in the trait-list form ("Gold: +100").

import { placementRecipient } from './inventory';
import { faceName, itemHasUnidentifiedFace } from './items';
import { resolvedEntityStatTree, type StatLinkWorld } from './statLinks';
import type { Entity, GameLocation, Item, OptionStatChange, PersonaRef, Placement, Stat } from '@/types';

/** One listed row: the stat's name (with the owner, "Wolf: Health"), the change and the facet. */
export interface OptionRowLine {
  label: string;
  value: number;
  /** Absent for a starting row, which the list shows bare. */
  type?: 'min' | 'max' | 'regen';
}

export interface OptionRowLinesWorld extends StatLinkWorld {
  entities: readonly Entity[];
  /** The items and places an Option's Starting Items name. Absent lists none. */
  items?: readonly Item[];
  locations?: readonly Pick<GameLocation, 'id' | 'name'>[];
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

/** An Option value's Starting Items as the player reads them: "Potion ×3", or "Bram: Rope" for another recipient.
 *  Each goes where a new game under `persona` puts it, so the played entity's read as the player's. A hidden row, or
 *  one whose item is gone or whose recipient is out of play, is left out. An item with an unidentified face shows it. */
export function optionItemLines(
  placements: readonly Placement[] | undefined, world: OptionRowLinesWorld, persona?: PersonaRef,
  resolveText: (text: string) => string = (text) => text,
): string[] {
  const out: string[] = [];
  for (const p of placements ?? []) {
    const item = world.items?.find((i) => i.id === p.source.itemId);
    const where = placementRecipient(p, world, persona);
    const owner = !where || where.kind === 'you' ? ''
      : (where.kind === 'entity' ? world.entities : world.locations ?? []).find((o) => o.id === where.id)?.name ?? '';
    const quantity = Math.floor(p.quantity);
    if (p.hidden || !item || !where || !(quantity > 0)) continue;
    const name = resolveText(faceName(item, itemHasUnidentifiedFace(item)));
    out.push(`${owner ? `${resolveText(owner)}: ` : ''}${name}${quantity > 1 ? ` ×${quantity}` : ''}`);
  }
  return out;
}
