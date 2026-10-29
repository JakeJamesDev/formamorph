/**
 * The Inventory module: every change to Item Copies goes through here. Pure: no React, no AI, no storage. Ids
 * come from an injected maker, as the turn commit's do.
 */
import { byEquipOrder, itemStackable, sameWhere, slotCapacity, slotSizeOf } from '@/lib/items';
import { inCast, playsAs } from '@/lib/owners';
import type { Entity, GameLocation, Item, ItemCopy, ItemCopyWhere, ItemRef, PersonaRef, Placement, Slot } from '@/types';

export {
  itemEffectLine, itemEffectLog, settleItemEffects, type ItemEffectChange, type ItemEffectResult, type ItemEffectWorld, type OwnerStatTraits,
} from './effects';
export {
  equipRequirement, settleInventory, SETTLE_CAP, type InventorySettleResult, type InventorySettleState, type InventorySettleWorld,
} from './settle';

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

/** Who sent a list of operations. Bound stops the panel only (Q58). */
export type InventorySource = 'pass' | 'panel' | 'script';

/** One inventory change. A missing `quantity` on lose or transfer means the whole Item Copy. */
export type InventoryOp =
  | { kind: 'gain'; itemId: string; quantity: number; to: ItemCopyWhere }
  | { kind: 'lose'; copyId: string; quantity?: number }
  | { kind: 'transfer'; copyId: string; to: ItemCopyWhere; quantity?: number }
  | { kind: 'equip'; copyId: string }
  | { kind: 'unequip'; copyId: string }
  | { kind: 'reveal'; copyId: string; quantity?: number };

/** The authored slice the operations read. An absent slice reads as empty. */
export interface InventoryWorld {
  items?: readonly Item[];
  slots?: readonly Slot[];
}

/** Who is present after this turn's moves (Q62). Absent = presence is not checked. */
export interface Presence {
  locationId: string | null | undefined;
  entityIds: ReadonlySet<string>;
}

export interface InventoryCall {
  world: InventoryWorld;
  source: InventorySource;
  newId: NewId;
  presence?: Presence;
  /** Why the owner cannot equip `copy` under `copies` (Q49), or null. Absent ⇒ no requirement is checked. */
  requirement?: (copy: ItemCopy, copies: readonly ItemCopy[]) => string | null;
}

export interface InventoryResult {
  copies: ItemCopy[];
  /** One line per skipped operation (Q22). */
  diagnostics: string[];
}

const isPresent = (where: ItemCopyWhere, presence: Presence | undefined): boolean => {
  if (!presence) return true;
  switch (where.kind) {
    case 'you': return true;
    case 'entity': return presence.entityIds.has(where.id);
    case 'location': return !!presence.locationId && where.id === presence.locationId;
  }
};

const sameRef = (a: ItemRef, b: ItemRef): boolean =>
  (a.kind === 'item' ? b.kind === 'item' && a.itemId === b.itemId : b.kind === 'runtime' && a.runtimeItemId === b.runtimeItemId);

/** Runtime items always stack (Q56). */
const refStacks = (ref: ItemRef, items: ReadonlyMap<string, Item>): boolean => {
  if (ref.kind === 'runtime') return true;
  const item = items.get(ref.itemId);
  return !!item && itemStackable(item);
};

const unequipped = (copy: ItemCopy): ItemCopy => {
  const { equipped: _off, ...rest } = copy;
  return rest;
};

const whereText = (where: ItemCopyWhere): string => (where.kind === 'you' ? 'you' : `${where.kind} ${where.id}`);

/**
 * Applies `ops` in order: the one validator every writer uses (Q45 hook 4). An invalid operation is skipped
 * with a diagnostic; the valid ones still apply (Q22). Never changes `copies` or its Item Copies.
 */
export function applyInventoryOps(copies: readonly ItemCopy[], ops: readonly InventoryOp[], call: InventoryCall): InventoryResult {
  const items = new Map((call.world.items ?? []).map((item) => [item.id, item]));
  const slots = new Map((call.world.slots ?? []).map((slot) => [slot.id, slot]));
  let list: ItemCopy[] = [...copies];
  const diagnostics: string[] = [];
  let order = Math.max(0, ...list.map((c) => c.equipped?.order ?? 0));

  /** `next` with `copy` in its row (a new one goes last), or merged into a matching carried stack when its
   *  item stacks and it is carried (Q94). */
  const put = (next: ItemCopy[], copy: ItemCopy): ItemCopy[] => {
    const stack = !copy.equipped && refStacks(copy.item, items) && next.find((c) => c.id !== copy.id && !c.equipped
      && sameRef(c.item, copy.item) && c.visibility === copy.visibility && sameWhere(c.where, copy.where));
    if (stack) {
      return next.filter((c) => c.id !== copy.id)
        .map((c) => (c === stack ? { ...c, quantity: c.quantity + copy.quantity } : c));
    }
    return next.some((c) => c.id === copy.id) ? next.map((c) => (c.id === copy.id ? copy : c)) : [...next, copy];
  };

  const one = (op: InventoryOp): string | null => {
    if (op.kind === 'gain') {
      const item = items.get(op.itemId);
      const quantity = Math.floor(op.quantity);
      if (!item) return `gain: no item ${op.itemId}`;
      if (!(quantity > 0)) return `gain: quantity ${op.quantity} is not above 0`;
      if (!isPresent(op.to, call.presence)) return `gain: ${whereText(op.to)} is not present`;
      const ref = { kind: 'item', itemId: item.id } as const;
      if (itemStackable(item)) {
        list = put(list, { id: call.newId(), item: ref, where: op.to, quantity, visibility: 'visible' });
        return null;
      }
      for (let i = 0; i < quantity; i += 1) {
        list.push({
          id: call.newId(), item: ref, where: op.to, quantity: 1, visibility: 'visible',
          ...(item.charges !== undefined && { state: { charges: item.charges } }),
        });
      }
      return null;
    }

    const copy = list.find((c) => c.id === op.copyId);
    if (!copy) return `${op.kind}: no Item Copy ${op.copyId}`;
    if (!isPresent(copy.where, call.presence)) return `${op.kind}: Item Copy ${copy.id} is not present`;
    const item = copy.item.kind === 'item' ? items.get(copy.item.itemId) : undefined;
    const bound = call.source === 'panel' && !!item?.bound;

    switch (op.kind) {
      case 'lose':
      case 'transfer': {
        if (bound) return `${op.kind}: Item Copy ${copy.id} is Bound`;
        const quantity = op.quantity === undefined ? copy.quantity : Math.floor(op.quantity);
        if (!(quantity > 0) || quantity > copy.quantity) return `${op.kind}: quantity ${op.quantity} does not fit ${copy.quantity}`;
        if (op.kind === 'transfer') {
          if (!isPresent(op.to, call.presence)) return `transfer: ${whereText(op.to)} is not present`;
          if (sameWhere(op.to, copy.where)) return `transfer: Item Copy ${copy.id} is already at ${whereText(op.to)}`;
        }
        const left = copy.quantity - quantity;
        list = left > 0
          ? list.map((c) => (c === copy ? { ...c, quantity: left } : c))
          : list.filter((c) => c !== copy);
        if (op.kind === 'transfer') {
          const moved = { ...unequipped(copy), where: op.to, quantity, ...(left > 0 && { id: call.newId() }) };
          list = put(list, moved);
        }
        return null;
      }
      case 'reveal': {
        if (copy.visibility !== 'hidden') return `reveal: Item Copy ${copy.id} is not hidden`;
        const quantity = op.quantity === undefined ? copy.quantity : Math.floor(op.quantity);
        if (!(quantity > 0) || quantity > copy.quantity) return `reveal: quantity ${op.quantity} does not fit ${copy.quantity}`;
        // A revealed row merges into a carried visible stack of the same item and place (Q65, Q94).
        if (quantity === copy.quantity) {
          list = put(list, { ...copy, visibility: 'visible' });
        } else {
          list = list.map((c) => (c === copy ? { ...c, quantity: copy.quantity - quantity } : c));
          list = put(list, { ...unequipped(copy), id: call.newId(), quantity, visibility: 'visible' });
        }
        return null;
      }
      case 'unequip': {
        if (!copy.equipped) return `unequip: Item Copy ${copy.id} is not equipped`;
        list = put(list, unequipped(copy));
        return null;
      }
      case 'equip': {
        if (copy.equipped) return `equip: Item Copy ${copy.id} is already equipped`;
        if (copy.where.kind === 'location') return `equip: Item Copy ${copy.id} has no owner`;
        const slot = item?.slotId ? slots.get(item.slotId) : undefined;
        if (!slot) return `equip: Item Copy ${copy.id} has no slot`;
        const size = slotSizeOf(item);
        const capacity = slotCapacity(slot);
        if (size > capacity) return `equip: Item Copy ${copy.id} takes ${size} of slot ${slot.name}'s ${capacity}`;
        // The owner's items in this slot, longest equipped first (Q14, Q96).
        const worn = list
          .filter((c) => c.equipped?.slotId === slot.id && sameWhere(c.where, copy.where))
          .sort(byEquipOrder);
        const sizeOf = (c: ItemCopy) => slotSizeOf(c.item.kind === 'item' ? items.get(c.item.itemId) : undefined);
        let used = worn.reduce((sum, c) => sum + sizeOf(c), 0);
        let swapped = list;
        for (const out of worn) {
          if (used + size <= capacity) break;
          swapped = put(swapped, unequipped(out));
          used -= sizeOf(out);
        }
        // The requirement reads the slot after the swap-out, so an item leaving it never counts.
        const refused = call.requirement?.(swapped.find((c) => c.id === copy.id) ?? copy, swapped);
        if (refused) return `equip: ${refused}`;
        list = swapped;
        order += 1;
        const equipped = { slotId: slot.id, order };
        // A swapped-out copy can merge into this stack, so read its quantity now. One splits off (Q65).
        if ((list.find((c) => c.id === copy.id)?.quantity ?? 1) > 1) {
          list = list.map((c) => (c.id === copy.id ? { ...c, quantity: c.quantity - 1 } : c));
          list.push({ ...copy, id: call.newId(), quantity: 1, equipped });
        } else {
          list = list.map((c) => (c.id === copy.id ? { ...c, equipped } : c));
        }
        return null;
      }
    }
  };

  for (const op of ops) {
    const skipped = one(op);
    if (skipped) diagnostics.push(`Inventory (${call.source}) skipped ${skipped}`);
  }
  return { copies: list, diagnostics };
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
