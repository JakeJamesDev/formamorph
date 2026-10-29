import { remintScopedPlaceholders } from '@/lib/placeholderHomes';
import { remapPlaceholderIds, remintPlaceholdersDeep } from '@/lib/placeholders';
import { randomUUID } from '@/lib/uuid';
import { isAlwaysOn } from '@/lib/traitEffects';
import type { Item, ItemCopy, Placement, PlacementWhere, Slot, Trait } from '@/types';

/** A new item with every list empty. */
export const blankItem = (id: string, name = 'New Item'): Item =>
  ({ id, name, statEffects: [], traitEffects: [], equipRequires: [] });

/** Charges rule stacking out (Q47); otherwise stacking is on unless switched off. */
export const itemStackable = (item: Item): boolean => item.charges === undefined && item.stackable !== false;

export const slotCapacity = (slot: Slot): number => slot.capacity ?? 1;

/** The slot capacity one Item Copy of `item` takes. A runtime item, which has no item, takes 1. */
export const slotSizeOf = (item: Item | undefined): number => item?.slotSize ?? 1;

/** Sorts equipped Item Copies longest equipped first. */
export const byEquipOrder = (a: ItemCopy, b: ItemCopy): number => (a.equipped?.order ?? 0) - (b.equipped?.order ?? 0);

const isRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object';
const hasId = (value: unknown): value is { id: string } => isRecord(value) && typeof value.id === 'string';
const listOf = <T>(value: unknown): T[] => (Array.isArray(value) ? value : []);

/** A world file's items with every list present. Records without an id are dropped. */
export function parseItems(raw: unknown): Item[] {
  return listOf<unknown>(raw).filter(hasId).map((value) => {
    // Hand-edited JSON: the guards above give the id, the spread keeps whatever else the record holds.
    const item = value as Item;
    return {
      ...item,
      name: typeof item.name === 'string' ? item.name : '',
      statEffects: listOf(item.statEffects),
      traitEffects: listOf(item.traitEffects),
      equipRequires: listOf(item.equipRequires),
    };
  });
}

export const parseSlots = (raw: unknown): Slot[] => listOf<unknown>(raw).filter(hasId) as Slot[];

/** A world file's placements. Records without an id or an item source are dropped. */
export const parsePlacements = (raw: unknown): Placement[] => listOf<unknown>(raw).filter(hasId).filter((p) => {
  const source = (p as { source?: unknown }).source;
  return isRecord(source) && source.kind === 'item' && typeof source.itemId === 'string';
}) as Placement[];

/** A whole number typed into an input, or undefined for a blank or non-numeric one. */
export const wholeCount = (raw: string): number | undefined => {
  if (raw.trim() === '') return undefined;
  const n = Math.floor(Number(raw));
  return Number.isFinite(n) ? n : undefined;
};

/** `items` with every slot size in the slot cut to `capacity`. */
export function withSlotCapacity(items: Item[], slotId: string, capacity: number): Item[] {
  if (!items.some((i) => i.slotId === slotId && (i.slotSize ?? 1) > capacity)) return items;
  return items.map((i) => (i.slotId === slotId && (i.slotSize ?? 1) > capacity ? { ...i, slotSize: capacity } : i));
}

/** The item with `map` over each of its chip fields. */
const mapItemChips = (item: Item, map: (text: string) => string): Item => {
  const one = (text: string | undefined) => (text ? map(text) : text);
  return {
    ...item,
    name: map(item.name),
    playerDescription: one(item.playerDescription),
    aiDescription: one(item.aiDescription),
    aiSummary: one(item.aiSummary),
    imageTags: one(item.imageTags),
  };
};

/** `items` with a copy of `id` right after it: fresh ids for the item, its rows and its placeholders, and its
 *  Unique chips drawn anew. The same list when no item has the id. */
export function duplicateItem(items: readonly Item[], id: string): { items: Item[]; newId: string } {
  const index = items.findIndex((i) => i.id === id);
  if (index < 0) return { items: [...items], newId: id };
  const copy = remintPlaceholdersDeep(structuredClone(items[index]));
  const fresh = <T extends { id: string }>(rows: T[]) => rows.map((row) => ({ ...row, id: randomUUID() }));
  let next: Item = {
    ...copy,
    id: randomUUID(),
    name: `${copy.name} (Copy)`,
    statEffects: fresh(copy.statEffects),
    traitEffects: fresh(copy.traitEffects),
  };
  if (next.placeholders?.length) {
    const { placeholders, idMap } = remintScopedPlaceholders(next.placeholders);
    next = mapItemChips({ ...next, placeholders }, (text) => remapPlaceholderIds(text, idMap));
  }
  return { items: [...items.slice(0, index + 1), next, ...items.slice(index + 1)], newId: next.id };
}

/** How many items equip into the slot. */
export const itemsInSlot = (items: readonly Item[], slotId: string): number =>
  items.filter((i) => i.slotId === slotId).length;

/** `items` with every reference to the slot cleared, and its slot size with it. */
export function withoutSlotRefs(items: Item[], slotId: string): Item[] {
  if (!itemsInSlot(items, slotId)) return items;
  return items.map((item) => {
    if (item.slotId !== slotId) return item;
    const { slotId: _slot, slotSize: _size, ...rest } = item;
    return rest;
  });
}

/** `placements` without the ones that place the item. */
export const withoutItemPlacements = (placements: Placement[], itemId: string): Placement[] =>
  (placements.some((p) => p.source.itemId === itemId) ? placements.filter((p) => p.source.itemId !== itemId) : placements);

/** Whether two places are the same: the played Persona, one entity, or one location. */
export const sameWhere = (a: PlacementWhere, b: PlacementWhere): boolean =>
  (a.kind === 'you' || b.kind === 'you' ? a.kind === b.kind : a.kind === b.kind && a.id === b.id);

const placesAt = (p: Placement, where: PlacementWhere): boolean => sameWhere(p.where, where);

/** `placements` without the ones at `where`. */
export const withoutPlacementsAt = (placements: Placement[], where: PlacementWhere): Placement[] =>
  (placements.some((p) => placesAt(p, where)) ? placements.filter((p) => !placesAt(p, where)) : placements);

/** The placements at `where`, in authored order. */
export const placementsAt = (placements: readonly Placement[], where: PlacementWhere): Placement[] =>
  placements.filter((p) => placesAt(p, where));

/** The traits an item's trait effect row can name: each owner's own, under the owner, every id once, Automatic
 *  ones left out (Q117). An owner with none is dropped. */
export function itemTraitOptions(owners: readonly { id: string; name: string; traits: readonly Trait[] }[]) {
  const seen = new Set<string>();
  return owners.flatMap((owner) => {
    const traits = owner.traits.filter((t) => !isAlwaysOn(t) && !seen.has(t.id) && seen.add(t.id));
    return traits.length ? [{ id: owner.id, name: owner.name, traits }] : [];
  });
}
