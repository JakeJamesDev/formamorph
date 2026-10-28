/**
 * The Inventory module: every change to Item Copies goes through here. Pure: no React, no AI, no storage. Ids
 * come from an injected maker, as the turn commit's do.
 */
import { itemStackable, sameWhere } from '@/lib/items';
import { inCast, playsAs } from '@/lib/owners';
import type { Entity, GameLocation, Item, ItemCopy, ItemCopyWhere, PersonaRef, Placement } from '@/types';

/** Makes a fresh Item Copy id. */
export type NewId = () => string;

/** The authored slice the seed reads. An absent slice reads as empty. */
export interface SeedWorld {
  items?: readonly Item[];
  placements?: readonly Placement[];
  entities?: readonly Entity[];
  locations?: readonly Pick<GameLocation, 'id'>[];
}

/** The Item Copies at `where`: one owner's, or the ones lying at one location. */
export const copiesAt = (copies: readonly ItemCopy[], where: ItemCopyWhere): ItemCopy[] =>
  copies.filter((copy) => sameWhere(copy.where, where));

/** Where a placement's Item Copies go under `persona`, or null when its owner is not in play (Q54, Q82). */
function seedWhere(placement: Placement, world: SeedWorld, persona: PersonaRef | undefined): ItemCopyWhere | null {
  const { where } = placement;
  switch (where.kind) {
    case 'you': return where;
    case 'location': return world.locations?.some((l) => l.id === where.id) ? where : null;
    case 'entity': {
      const entity = world.entities?.find((e) => e.id === where.id);
      if (!entity) return null;
      if (playsAs(entity, persona)) return { kind: 'you' };
      return inCast(entity, persona) ? where : null;
    }
  }
}

/**
 * The Item Copies a new game starts with, from the world's placements in authored order. A stackable item
 * placed twice on one owner forms one stack; a hidden placement stays its own row. Each copy of an item that
 * isn't stackable is its own Item Copy with full charges. Seeded copies start carried. Runs for a new game
 * only (Q59).
 */
export function seedItemCopies(world: SeedWorld, persona: PersonaRef | undefined, newId: NewId): ItemCopy[] {
  const items = new Map((world.items ?? []).map((item) => [item.id, item]));
  const copies: ItemCopy[] = [];
  for (const placement of world.placements ?? []) {
    const item = items.get(placement.source.itemId);
    const where = seedWhere(placement, world, persona);
    const quantity = Math.floor(placement.quantity);
    if (!item || !where || !(quantity > 0)) continue;
    const visibility = placement.hidden ? 'hidden' : 'visible';
    const ref = { kind: 'item', itemId: item.id } as const;
    if (itemStackable(item)) {
      const stack = copies.find((c) => c.item.kind === 'item' && c.item.itemId === item.id
        && c.visibility === visibility && sameWhere(c.where, where));
      if (stack) stack.quantity += quantity;
      else copies.push({ id: newId(), item: ref, where, quantity, visibility });
      continue;
    }
    for (let i = 0; i < quantity; i += 1) {
      copies.push({
        id: newId(), item: ref, where, quantity: 1, visibility,
        ...(item.charges !== undefined && { state: { charges: item.charges } }),
      });
    }
  }
  return copies;
}

/** What still exists for Item Copies to point at. */
export interface CopyTargets {
  itemIds: ReadonlySet<string>;
  entityIds: ReadonlySet<string>;
  locationIds: ReadonlySet<string>;
}

const isOrphan = (copy: ItemCopy, targets: CopyTargets): boolean => {
  // A runtime item is kept: the save holds no runtime-item list.
  if (copy.item.kind === 'item' && !targets.itemIds.has(copy.item.itemId)) return true;
  switch (copy.where.kind) {
    case 'you': return false;
    case 'entity': return !targets.entityIds.has(copy.where.id);
    case 'location': return !targets.locationIds.has(copy.where.id);
  }
};

/** `copies` without the ones whose item, owner entity or location no longer exists (Q60), and the dropped ones.
 *  The same array when none is dropped. */
export function withoutOrphanCopies(
  copies: readonly ItemCopy[], targets: CopyTargets,
): { copies: readonly ItemCopy[]; dropped: ItemCopy[] } {
  const dropped = copies.filter((copy) => isOrphan(copy, targets));
  return dropped.length ? { copies: copies.filter((copy) => !dropped.includes(copy)), dropped } : { copies, dropped };
}
