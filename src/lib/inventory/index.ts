/**
 * The Inventory module: every change to Item Copies goes through here. Pure: no React, no AI, no storage. Ids
 * come from an injected maker, as the turn commit's do.
 */
import {
  byEquipOrder, isUnidentified, itemStackable, itemUsable, occupiedSlots, ruleGaps, ruleSlots, sameState, sameWhere, seededState, stateWord, usesLeft, whenEmptyOf,
} from '@/lib/items';
import { slotsInForce, type BodyWorld } from '@/lib/bodies';
import { inCast, playsAs } from '@/lib/owners';
import type {
  Entity, GameLocation, Item, ItemCopy, ItemCopyState, ItemCopyVisibility, ItemCopyWhere, ItemEffectLedger, ItemRef, ItemScriptTiming, PersonaRef, Placement,
  InventoryUseAfter, RuntimeItem, Slot,
} from '@/types';
import { timedTraitRow, type ItemUse } from './effects';

export {
  itemEffectLine, itemEffectLog, settleItemEffects, timedEffectViews, timedKey, type ItemUse, type ItemEffectChange,
  type TimedEffectNames, type TimedEffectView, type ItemEffectResult, type ItemEffectWorld, type OwnerStatTraits,
} from './effects';
export {
  applyInventoryPass, inventoryPassSchema, itemNameKey, parseInventoryLines, parseInventoryReply, INVENTORY_JSON_FORMAT,
  INVENTORY_TEXT_FORMAT, PASS_OP_KINDS, passOwners, type InventoryPassResult, type PassMoney, type PassOwner, type PassScene,
} from './pass';
export {
  equipRequirement, settleInventory, settleTraitsWithItems, traitPicksInPlay, SETTLE_CAP, type InventorySettleResult, type InventorySettleState, type InventorySettleWorld,
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

/** The Item Copies at `where` the player can see worn. */
export const visibleWorn = (copies: readonly ItemCopy[], where: ItemCopyWhere): ItemCopy[] =>
  copiesAt(copies, where).filter((c) => c.equipped && c.visibility === 'visible').sort(byEquipOrder);

/**
 * The items with stat effects that the stat request names (Q53, Q149): visible Item Copies held by you or a
 * present entity, or lying at `scene.locationId`. In authored order.
 */
export function statEffectItems(
  copies: readonly ItemCopy[], items: readonly Item[], scene: { locationId?: string; entityIds: readonly string[] },
): Item[] {
  const here = (where: ItemCopyWhere) => where.kind === 'you'
    || (where.kind === 'entity' ? scene.entityIds.includes(where.id) : where.id === scene.locationId);
  const ids = new Set(copies.flatMap((c) => (c.item.kind === 'item' && c.visibility === 'visible' && here(c.where) ? [c.item.itemId] : [])));
  return items.filter((item) => ids.has(item.id) && item.statEffects.length > 0);
}

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
 * placed twice on one owner forms one stack; hidden placements stack apart from shown ones. Each copy of an item that
 * isn't stackable is its own Item Copy with full uses. Seeded copies start carried, and unidentified when the item
 * has an unidentified face (Q16). Runs for a new game only (Q59).
 */
export const seedItemCopies = (world: SeedWorld, persona: PersonaRef | undefined, newId: NewId): ItemCopy[] =>
  seedPlacements(world, persona, newId).copies;

/** The authored slice the starting copies read. */
export type StartWorld = SeedWorld & InventoryWorld;

/**
 * The Item Copies a new game starts with: the seed, then each Equipped placement equipped as the panel would
 * (Q36, Q51). A refused equip stays carried. `requirement` is the new game's equip check; previews pass none.
 */
export function startingCopies(
  world: StartWorld, persona: PersonaRef | undefined, newId: NewId, requirement?: InventoryCall['requirement'],
): ItemCopy[] {
  const { copies, equips } = seedPlacements(world, persona, newId);
  if (!equips.length) return copies;
  return applyInventoryOps(copies, equips, { world, source: 'panel', newId, persona, ...(requirement && { requirement }) }).copies;
}

/** The seeded Item Copies, and one equip per unit of each Equipped owner placement, in placement order (Q36). */
function seedPlacements(world: SeedWorld, persona: PersonaRef | undefined, newId: NewId): { copies: ItemCopy[]; equips: InventoryOp[] } {
  const items = new Map((world.items ?? []).map((item) => [item.id, item]));
  const copies: ItemCopy[] = [];
  const equips: InventoryOp[] = [];
  // The validator refuses an equip at a location, so a stray flag there is harmless.
  const equip = (placement: Placement, item: Item, copyId: string, unit: number) => {
    if (!placement.equipped) return;
    // Only the first unit takes the named slot (Q78). A slot the rule no longer lists falls back to the first free one.
    const slotId = unit === 0 && placement.slotId && item.slotRule?.slotIds.includes(placement.slotId) ? placement.slotId : undefined;
    equips.push({ kind: 'equip', copyId, ...(slotId && { slotId }) });
  };
  for (const placement of world.placements ?? []) {
    const item = items.get(placement.source.itemId);
    const where = seedWhere(placement, world, persona);
    const quantity = Math.floor(placement.quantity);
    if (!item || !where || !(quantity > 0)) continue;
    const visibility = placement.hidden ? 'hidden' : 'visible';
    const ref = { kind: 'item', itemId: item.id } as const;
    const state = seededState(item);
    if (itemStackable(item)) {
      const stack = copies.find((c) => c.item.kind === 'item' && c.item.itemId === item.id
        && c.visibility === visibility && sameWhere(c.where, where));
      const id = stack ? stack.id : newId();
      if (stack) stack.quantity += quantity;
      else copies.push({ id, item: ref, where, quantity, visibility, ...(state && { state }) });
      // Each equip splits one copy off the stack, which keeps its id.
      for (let i = 0; i < quantity; i += 1) equip(placement, item, id, i);
      continue;
    }
    for (let i = 0; i < quantity; i += 1) {
      const id = newId();
      copies.push({ id, item: ref, where, quantity: 1, visibility, ...(state && { state }) });
      equip(placement, item, id, i);
    }
  }
  return { copies, equips };
}

/** Who sent a list of operations. Bound stops the panel only (Q58). */
export type InventorySource = 'pass' | 'panel' | 'script';

/** One inventory change. A missing `quantity` on lose or transfer means the whole Item Copy. A gain's `itemId`
 *  names an authored item or one of the call's runtime items. */
export type InventoryOp =
  | { kind: 'gain'; itemId: string; quantity: number; to: ItemCopyWhere; /** Absent = visible. */ visibility?: ItemCopyVisibility }
  | { kind: 'lose'; copyId: string; quantity?: number }
  | { kind: 'transfer'; copyId: string; to: ItemCopyWhere; quantity?: number }
  /** `slotId` names one of the item's slots; absent = the first free one (Q37). */
  | { kind: 'equip'; copyId: string; slotId?: string }
  | { kind: 'unequip'; copyId: string }
  /** `after` is read only for a runtime item; absent = used up (Q10, Q56). `targetCopyId` is the copy it is used on. */
  | { kind: 'use'; copyId: string; after?: InventoryUseAfter; targetCopyId?: string }
  | { kind: 'reveal'; copyId: string; quantity?: number }
  | { kind: 'setUses'; copyId: string; uses: number }
  /** Sets one copy's State; a blank `state` clears it. */
  | { kind: 'change'; copyId: string; state: string };

/** One Item Copy event an item's scripts of that timing run on (Q33). `where` is the owner or location it
 *  happened at; `quantity` is how many it moved. */
export interface ItemScriptEvent {
  timing: ItemScriptTiming;
  itemId: string;
  copyId: string;
  where: ItemCopyWhere;
  quantity: number;
  /** The Item Copy as it stood before a When Lost or When Used event, which can leave it gone. */
  was?: ItemCopy;
  /** The Item Copy a use acted on, as it stood before the use. */
  target?: ItemCopy;
}

/** The authored slice the operations read. An absent slice reads as empty. */
export interface InventoryWorld extends BodyWorld {
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
  /** Who `you` is, for the played Persona's Body. */
  persona?: PersonaRef;
  presence?: Presence;
  /** The runtime items a gain may name. */
  runtimeItems?: readonly RuntimeItem[];
  /** Why the owner cannot equip `copy` under `copies` (Q49), or null. Absent ⇒ no requirement is checked. */
  requirement?: (copy: ItemCopy, copies: readonly ItemCopy[]) => string | null;
}

export interface InventoryResult {
  copies: ItemCopy[];
  /** One per use of an authored item, in order: what starts its After Use effects. */
  itemUses: ItemUse[];
  /** One line per skipped operation (Q22). */
  diagnostics: string[];
  /** The events of authored items, in order. Runtime items have no scripts. */
  events: ItemScriptEvent[];
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

/** `copy` without the unidentified flag. */
const identified = (copy: ItemCopy): ItemCopy => {
  const { unidentified: _off, ...state } = copy.state ?? {};
  const { state: _was, ...rest } = copy;
  return Object.keys(state).length ? { ...rest, state } : rest;
};

const whereText = (where: ItemCopyWhere): string => (where.kind === 'you' ? 'you' : `${where.kind} ${where.id}`);

/**
 * Applies `ops` in order: the one validator every writer uses (Q45 hook 4). An invalid operation is skipped
 * with a diagnostic; the valid ones still apply (Q22). Never changes `copies` or its Item Copies.
 */
export function applyInventoryOps(copies: readonly ItemCopy[], ops: readonly InventoryOp[], call: InventoryCall): InventoryResult {
  const items = new Map((call.world.items ?? []).map((item) => [item.id, item]));
  const slots = call.world.slots ?? [];
  let list: ItemCopy[] = [...copies];
  const diagnostics: string[] = [];
  const itemUses: ItemUse[] = [];
  const events: ItemScriptEvent[] = [];
  /** Records an event of `ref`'s item; none for a runtime item. */
  const fire = (timing: ItemScriptTiming, ref: ItemRef, copyId: string, where: ItemCopyWhere, quantity: number, was?: ItemCopy, target?: ItemCopy) => {
    if (ref.kind === 'item') events.push({ timing, itemId: ref.itemId, copyId, where, quantity, ...(was && { was }), ...(target && { target }) });
  };
  const itemOf = (copy: ItemCopy): Item | undefined => (copy.item.kind === 'item' ? items.get(copy.item.itemId) : undefined);
  /** Whether carried `c` is a stack `copy` merges into: same item, visibility, place, uses left (Q27), State and identity (Q18). */
  const sameRow = (c: ItemCopy, copy: ItemCopy): boolean => !c.equipped && sameRef(c.item, copy.item)
    && c.visibility === copy.visibility && sameWhere(c.where, copy.where)
    && usesLeft(c, itemOf(c)) === usesLeft(copy, itemOf(copy))
    && sameState(c, copy) && isUnidentified(c) === isUnidentified(copy);
  /** The row `copy` ended in after a `put`: its own, or the stack it merged into. */
  const rowOf = (copy: ItemCopy): string => (list.some((c) => c.id === copy.id) ? copy.id
    : list.find((c) => sameRow(c, copy))?.id ?? copy.id);
  let order = Math.max(0, ...list.map((c) => c.equipped?.order ?? 0));

  /** `next` with `copy` in its row (a new one goes last), or merged into a matching carried stack when its
   *  item stacks and it is carried (Q94). */
  const put = (next: ItemCopy[], copy: ItemCopy): ItemCopy[] => {
    const stack = !copy.equipped && refStacks(copy.item, items) && next.find((c) => c.id !== copy.id && sameRow(c, copy));
    if (stack) {
      return next.filter((c) => c.id !== copy.id)
        .map((c) => (c === stack ? { ...c, quantity: c.quantity + copy.quantity } : c));
    }
    return next.some((c) => c.id === copy.id) ? next.map((c) => (c.id === copy.id ? copy : c)) : [...next, copy];
  };

  /** `list` with one copy of `copy`'s stack given `state`: in place when it is alone, else split off as its own
   *  row, which merges into any stack it now matches. */
  const withOneCopy = (copy: ItemCopy, state: ItemCopyState): ItemCopy[] => {
    // An undefined field clears it; a copy with nothing left keeps no state.
    const merged = Object.fromEntries(Object.entries({ ...copy.state, ...state }).filter(([, v]) => v !== undefined)) as ItemCopyState;
    const { state: _old, ...bare } = copy;
    const changed: ItemCopy = Object.keys(merged).length ? { ...bare, state: merged } : bare;
    if (copy.quantity <= 1) return put(list, changed);
    const rest = list.map((c) => (c === copy ? { ...c, quantity: c.quantity - 1 } : c));
    return put(rest, { ...changed, id: call.newId(), quantity: 1 });
  };

  const one = (op: InventoryOp): string | null => {
    if (op.kind === 'gain') {
      const item = items.get(op.itemId);
      const runtime = item ? undefined : call.runtimeItems?.find((r) => r.id === op.itemId);
      const quantity = Math.floor(op.quantity);
      if (!item && !runtime) return `gain: no item ${op.itemId}`;
      if (!(quantity > 0)) return `gain: quantity ${op.quantity} is not above 0`;
      if (!isPresent(op.to, call.presence)) return `gain: ${whereText(op.to)} is not present`;
      if (runtime) {
        list = put(list, { id: call.newId(), item: { kind: 'runtime', runtimeItemId: runtime.id }, where: op.to, quantity, visibility: 'visible' });
        return null;
      }
      if (!item) return `gain: no item ${op.itemId}`;
      const ref = { kind: 'item', itemId: item.id } as const;
      const state = seededState(item);
      if (itemStackable(item)) {
        const gained: ItemCopy = { id: call.newId(), item: ref, where: op.to, quantity, visibility: op.visibility ?? 'visible', ...(state && { state }) };
        list = put(list, gained);
        fire('gained', ref, rowOf(gained), op.to, quantity);
        return null;
      }
      const first = list.length;
      for (let i = 0; i < quantity; i += 1) {
        list.push({ id: call.newId(), item: ref, where: op.to, quantity: 1, visibility: op.visibility ?? 'visible', ...(state && { state }) });
      }
      fire('gained', ref, list[first].id, op.to, quantity);
      return null;
    }

    const copy = list.find((c) => c.id === op.copyId);
    if (!copy) return `${op.kind}: no Item Copy ${op.copyId}`;
    if (!isPresent(copy.where, call.presence)) return `${op.kind}: Item Copy ${copy.id} is not present`;
    const item = copy.item.kind === 'item' ? items.get(copy.item.itemId) : undefined;
    // Bound stops the panel letting go of an Item Copy, never picking one up.
    const bound = call.source === 'panel' && !!item?.bound && copy.where.kind !== 'location';

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
        if (copy.equipped) fire('unequipped', copy.item, copy.id, copy.where, copy.quantity);
        fire('lost', copy.item, copy.id, copy.where, quantity, copy);
        if (op.kind === 'transfer') {
          const moved = { ...unequipped(copy), where: op.to, quantity, ...(left > 0 && { id: call.newId() }) };
          list = put(list, moved);
          fire('gained', copy.item, rowOf(moved), op.to, quantity);
        }
        return null;
      }
      case 'reveal': {
        // A hidden copy comes into view and stays unidentified; a visible unidentified one is identified (Q8).
        const hidden = copy.visibility === 'hidden';
        if (!hidden && !isUnidentified(copy)) return `reveal: Item Copy ${copy.id} is neither hidden nor unidentified`;
        const quantity = op.quantity === undefined ? copy.quantity : Math.floor(op.quantity);
        if (!(quantity > 0) || quantity > copy.quantity) return `reveal: quantity ${op.quantity} does not fit ${copy.quantity}`;
        const shown = (c: ItemCopy): ItemCopy => (hidden ? { ...c, visibility: 'visible' } : identified(c));
        // A revealed row merges into a carried stack it now matches, in the same place (Q18, Q65, Q94).
        if (quantity === copy.quantity) {
          list = put(list, shown(copy));
        } else {
          list = list.map((c) => (c === copy ? { ...c, quantity: copy.quantity - quantity } : c));
          list = put(list, shown({ ...unequipped(copy), id: call.newId(), quantity }));
        }
        return null;
      }
      case 'use': {
        if (copy.where.kind === 'location') return `use: Item Copy ${copy.id} has no owner`;
        // Runtime items can always be used; a use removes one unless the pass says it was kept (Q10, Q56).
        if (item && !itemUsable(item)) return `use: Item Copy ${copy.id} can't be used`;
        const left = usesLeft(copy, item);
        if (left !== undefined && !(left > 0)) return `use: Item Copy ${copy.id} has no uses left`;
        const target = op.targetCopyId !== undefined ? list.find((c) => c.id === op.targetCopyId && c !== copy) : undefined;
        if (op.targetCopyId !== undefined && !target) diagnostics.push(`Inventory (${call.source}) used Item Copy ${copy.id} on nothing: no Item Copy ${op.targetCopyId}`);
        if (item) itemUses.push({ itemId: item.id, where: copy.where, hidden: copy.visibility === 'hidden', ...(isUnidentified(copy) && { unidentified: true }) });
        fire('used', copy.item, copy.id, copy.where, 1, copy, target);
        const empty = item ? (left === 1 ? whenEmptyOf(item) : undefined) : op.after === 'kept' ? undefined : { kind: 'gone' as const };
        if (left !== undefined && left > 1) list = withOneCopy(copy, { uses: left - 1 });
        else if (empty?.kind === 'stays') list = withOneCopy(copy, { uses: 0 });
        else if (empty?.kind === 'changesState') list = withOneCopy(copy, { uses: 0, state: stateWord(empty.state) });
        else if (empty) {
          list = copy.quantity > 1 ? list.map((c) => (c === copy ? { ...copy, quantity: copy.quantity - 1 } : c)) : list.filter((c) => c !== copy);
          if (empty.kind === 'becomes') {
            // The result is carried by the same owner, keeps the copy's visibility and seeds like any gain (Q12, Q28).
            const missing = one({ kind: 'gain', itemId: empty.itemId, quantity: 1, to: copy.where, visibility: copy.visibility });
            if (missing) diagnostics.push(`Inventory (${call.source}) removed Item Copy ${copy.id} as Gone: ${missing}`);
          }
        }
        return null;
      }
      case 'setUses': {
        const max = item?.uses;
        if (max === undefined) return `setUses: Item Copy ${copy.id} has no Uses`;
        if (!Number.isFinite(op.uses)) return `setUses: ${op.uses} is not a number`;
        const uses = Math.min(max, Math.max(0, Math.floor(op.uses)));
        // A copy that now matches a stack's uses merges into it.
        list = put(list, { ...copy, state: { ...copy.state, uses } });
        return null;
      }
      case 'change': {
        const state = stateWord(op.state);
        if (sameState(copy, { state: { state } })) return `change: Item Copy ${copy.id} is already ${state ?? 'without a State'}`;
        // One copy of a stack splits off and merges with any row it now matches.
        list = withOneCopy(copy, { state });
        return null;
      }
      case 'unequip': {
        if (!copy.equipped) return `unequip: Item Copy ${copy.id} is not equipped`;
        list = put(list, unequipped(copy));
        fire('unequipped', copy.item, rowOf(copy), copy.where, copy.quantity);
        return null;
      }
      case 'equip': {
        if (copy.equipped) return `equip: Item Copy ${copy.id} is already equipped`;
        if (copy.where.kind === 'location') return `equip: Item Copy ${copy.id} has no owner`;
        const rule = item?.slotRule;
        if (!rule) return `equip: Item Copy ${copy.id} has no slot`;
        const slotName = (slotId: string) => slots.find((s) => s.id === slotId)?.name ?? slotId;
        if (op.slotId !== undefined && !rule.slotIds.includes(op.slotId)) return `equip: Item Copy ${copy.id} can't go in ${slotName(op.slotId)}`;
        // Capacity comes from the owner's Body in force; a slot that Body lacks refuses the equip (Q8, Q39).
        const capacities = new Map(slotsInForce(call.world, copy.where, call.persona).map((s) => [s.slot.id, s.capacity]));
        const held = rule.slotIds.filter((id) => capacities.has(id));
        const lacks = op.slotId !== undefined && !capacities.has(op.slotId) ? op.slotId : ruleGaps(rule, (id) => capacities.has(id))[0];
        if (lacks !== undefined) return `equip: no ${slotName(lacks)} slot on ${whereText(copy.where)}`;
        // The owner's equipped items, longest equipped first (Q14, Q96).
        const worn = list.filter((c) => c.equipped && sameWhere(c.where, copy.where)).sort(byEquipOrder);
        const slotsOf = (c: ItemCopy) => occupiedSlots(c, itemOf(c));
        const unitsLeft = (slotId: string, gone: readonly ItemCopy[]) => (capacities.get(slotId) ?? 0)
          - worn.filter((c) => !gone.includes(c) && slotsOf(c).includes(slotId)).length;
        const taken = ruleSlots(rule, op.slotId ?? held.find((id) => unitsLeft(id, []) > 0) ?? held[0]);
        const leaving: ItemCopy[] = [];
        for (const slotId of taken) {
          while (unitsLeft(slotId, leaving) < 1) {
            const next = worn.find((c) => !leaving.includes(c) && slotsOf(c).includes(slotId));
            if (!next) break;
            leaving.push(next);
          }
        }
        const full = taken.find((id) => unitsLeft(id, leaving) < 1);
        if (full !== undefined) return `equip: no room in ${slotName(full)} on ${whereText(copy.where)}`;
        // A later swap-out can free an earlier one's unit, so one that still fits stays on.
        for (const out of [...leaving]) {
          const without = leaving.filter((c) => c !== out);
          if (slotsOf(out).every((id) => unitsLeft(id, without) >= (taken.includes(id) ? 1 : 0))) leaving.splice(leaving.indexOf(out), 1);
        }
        const swapped = leaving.reduce((next, out) => put(next, unequipped(out)), list);
        // The requirement reads the slot after the swap-out, so an item leaving it never counts.
        const refused = call.requirement?.(swapped.find((c) => c.id === copy.id) ?? copy, swapped);
        if (refused) return `equip: ${refused}`;
        list = swapped;
        for (const out of leaving) fire('unequipped', out.item, rowOf(unequipped(out)), out.where, out.quantity);
        order += 1;
        const equipped = { slotId: taken[0], order };
        // A swapped-out copy can merge into this stack, so read its quantity now. One splits off (Q65).
        if ((list.find((c) => c.id === copy.id)?.quantity ?? 1) > 1) {
          const split = call.newId();
          list = list.map((c) => (c.id === copy.id ? { ...c, quantity: c.quantity - 1 } : c));
          list.push({ ...copy, id: split, quantity: 1, equipped });
          fire('equipped', copy.item, split, copy.where, 1);
        } else {
          list = list.map((c) => (c.id === copy.id ? { ...c, equipped } : c));
          fire('equipped', copy.item, copy.id, copy.where, copy.quantity);
        }
        return null;
      }
    }
  };

  for (const op of ops) {
    const skipped = one(op);
    if (skipped) diagnostics.push(`Inventory (${call.source}) skipped ${skipped}`);
  }
  return { copies: list, itemUses, diagnostics, events };
}

/** What still exists for Item Copies to point at. */
export interface CopyTargets {
  itemIds: ReadonlySet<string>;
  /** The save's runtime items. Absent ⇒ runtime Item Copies are kept. */
  runtimeItemIds?: ReadonlySet<string>;
  entityIds: ReadonlySet<string>;
  locationIds: ReadonlySet<string>;
}

const isOrphan = (copy: ItemCopy, targets: CopyTargets): boolean => {
  if (copy.item.kind === 'item' && !targets.itemIds.has(copy.item.itemId)) return true;
  if (copy.item.kind === 'runtime' && targets.runtimeItemIds && !targets.runtimeItemIds.has(copy.item.runtimeItemId)) return true;
  switch (copy.where.kind) {
    case 'you': return false;
    case 'entity': return !targets.entityIds.has(copy.where.id);
    case 'location': return !targets.locationIds.has(copy.where.id);
  }
};

/** `ledger` without the timed trait rows whose item, row or owner entity no longer exists, and their keys. Timed
 *  stat rows drop in the stat settle, which reverses what they moved. */
export function withoutOrphanTimedTraits(
  ledger: ItemEffectLedger, targets: Pick<CopyTargets, 'entityIds'>, items: readonly Item[],
): { ledger: ItemEffectLedger; dropped: string[] } {
  const byId = new Map(items.map((item) => [item.id, item]));
  const dropped = Object.entries(ledger.timed ?? {})
    .filter(([, e]) => e.row === 'trait' && (!timedTraitRow(e, byId) || !targets.entityIds.has(e.ownerId)))
    .map(([key]) => key);
  if (!dropped.length) return { ledger, dropped };
  const timed = Object.fromEntries(Object.entries(ledger.timed ?? {}).filter(([key]) => !dropped.includes(key)));
  const { timed: _old, ...rest } = ledger;
  return { ledger: Object.keys(timed).length ? { ...rest, timed } : rest, dropped };
}

/** `copies` without the ones whose item, owner entity or location no longer exists (Q60), and the dropped ones.
 *  The same array when none is dropped. */
export function withoutOrphanCopies(
  copies: readonly ItemCopy[], targets: CopyTargets,
): { copies: readonly ItemCopy[]; dropped: ItemCopy[] } {
  const dropped = copies.filter((copy) => isOrphan(copy, targets));
  return dropped.length ? { copies: copies.filter((copy) => !dropped.includes(copy)), dropped } : { copies, dropped };
}
