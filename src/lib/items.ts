import { remintScopedPlaceholders } from '@/lib/placeholderHomes';
import { remapPlaceholderIds, remintPlaceholdersDeep } from '@/lib/placeholders';
import { randomUUID } from '@/lib/uuid';
import { isAlwaysOn } from '@/lib/traitEffects';
import type { Item, ItemInstance, ItemInstanceState, ItemRequirement, ItemWhenEmpty, Placement, PlacementWhere, RuntimeItem, Slot, SlotRule, Trait } from '@/types';

/** A new item with every list empty. */
export const blankItem = (id: string, name = 'New Item'): Item =>
  ({ id, name, statEffects: [], traitEffects: [], equipRequires: [] });

/** Uses 2 or more rule stacking out, since each instance counts its own; otherwise stacking is on unless switched off. */
export const itemStackable = (item: Item): boolean => (item.uses === undefined || item.uses <= 1) && item.stackable !== false;

/** Use applies to it: it has Uses, After Use effects or a When Used script (Q20). */
export const itemUsable = (item: Item): boolean => item.uses !== undefined
  || item.statEffects.some((row) => row.timing === 'used') || item.traitEffects.some((row) => row.timing === 'used')
  || !!item.scripts?.some((script) => script.timing === 'used');

/** The uses an Item Instance of `item` has left: full when it records none. Undefined when the item has no Uses. */
export const usesLeft = (instance: Pick<ItemInstance, 'state'>, item: Pick<Item, 'uses'> | undefined): number | undefined =>
  (item?.uses === undefined ? undefined : instance.state?.uses ?? item.uses);

/** Uses left: "N of M uses" for Uses 2+; a Uses 1 instance shows a line only once spent (Q30). */
export const usesLine = (instance: Pick<ItemInstance, 'state'>, item: Pick<Item, 'uses'> | undefined): string | null => {
  const left = usesLeft(instance, item);
  if (left === undefined || item?.uses === undefined) return null;
  if (item.uses > 1) return `${left} of ${item.uses} uses`;
  return left === 0 ? 'No uses left' : null;
};

/** Its instances start unidentified: it has an Unidentified Name or Unidentified Description (Q16). */
export const itemHasUnidentifiedFace = (item: Pick<Item, 'unidentifiedName' | 'unidentifiedDescription'>): boolean => !!item.unidentifiedName?.trim() || !!item.unidentifiedDescription?.trim();

/** The Item Instance shows the unidentified face. */
export const isUnidentified = (instance: Pick<ItemInstance, 'state'>): boolean => instance.state?.unidentified === true;

/** An instance that counts as money: visible and identified. */
export const isSpendable = (instance: Pick<ItemInstance, 'state' | 'visibility'>): boolean => instance.visibility === 'visible' && !isUnidentified(instance);

/** The name the player sees on `instance`: a runtime item's name, else its item's face through `resolve`. */
export function instanceName(
  instance: ItemInstance, items: readonly Item[], runtimeItems: readonly Pick<RuntimeItem, 'id' | 'name'>[], resolve: (text: string) => string,
): string {
  const ref = instance.item;
  if (ref.kind === 'runtime') return runtimeItems.find((r) => r.id === ref.runtimeItemId)?.name || 'Unknown Item';
  const item = items.find((i) => i.id === ref.itemId);
  return (item && resolve(instanceFace(item, instance).name)) || 'Unknown Item';
}

/** The name and player description the player sees on `instance`: the unidentified face while it is unidentified,
 *  a blank unidentified field falling back to the normal value (Q16). */
export function instanceFace(item: Pick<Item, 'name' | 'playerDescription' | 'unidentifiedName' | 'unidentifiedDescription'>, instance: Pick<ItemInstance, 'state'>): {
  name: string; description: string | undefined;
} {
  const unidentified = isUnidentified(instance);
  return {
    name: faceName(item, unidentified),
    description: unidentified && item.unidentifiedDescription?.trim() ? item.unidentifiedDescription : item.playerDescription,
  };
}

/** The name the player sees on `item`: its Unidentified Name while unidentified and filled, else its name. */
export const faceName = (item: Pick<Item, 'name' | 'unidentifiedName'>, unidentified: boolean): string =>
  (unidentified && item.unidentifiedName?.trim() ? item.unidentifiedName : item.name);

/** The name a log line gives a source of `item`: null when hidden (Q63), the unidentified face when unidentified (Q17). */
export const seenItemName = (item: Pick<Item, 'name' | 'unidentifiedName'>, seen: StoredSighting): string | null =>
  (seen.hidden ? null : faceName(item, !!seen.unidentified));

/** How the log sees a source behind several Item Instances, folded instance by instance. */
export interface SourceSighting { hidden: boolean; unidentified: boolean }

/** A sighting as a stored record keeps it: an absent flag is false. */
export interface StoredSighting { hidden?: boolean; unidentified?: boolean }

/** What one Item Instance shows the player. */
export const instanceSighting = (instance: Pick<ItemInstance, 'visibility' | 'state'>): SourceSighting =>
  ({ hidden: instance.visibility === 'hidden', unidentified: isUnidentified(instance) });

/** A sighting's set flags alone, for a stored record. */
export const storedSighting = (seen: StoredSighting): StoredSighting =>
  ({ ...(seen.hidden && { hidden: true }), ...(seen.unidentified && { unidentified: true }) });

/** Folds one more instance into `seen`: hidden while every instance is, unidentified while every visible instance is (Q39). */
export function foldSighting(seen: SourceSighting, next: SourceSighting): void {
  if (!next.hidden) seen.unidentified = seen.hidden ? next.unidentified : seen.unidentified && next.unidentified;
  seen.hidden &&= next.hidden;
}

/** How the editor and Formaquestion name each When Empty outcome. */
export const WHEN_EMPTY_LABEL: Record<ItemWhenEmpty['kind'], string> = {
  stays: 'Stays', gone: 'Gone', becomes: 'Becomes', changesState: 'Changes State',
};

/** A State word as stored: trimmed, or undefined when blank. */
export const stateWord = (text: string | undefined): string | undefined => text?.trim() || undefined;

/** An Item Instance's State word, or undefined when it has none. */
export const instanceState = (instance: Pick<ItemInstance, 'state'>): string | undefined => stateWord(instance.state?.state);

/** A State word as stacking and conditions compare it: trimmed and case-insensitive (Q31). Empty when blank. */
export const stateTextKey = (text: string | undefined): string => (stateWord(text) ?? '').toLowerCase();

/** An Item Instance's State as stacking compares it. Empty when it has none. */
export const stateKey = (instance: Pick<ItemInstance, 'state'>): string => stateTextKey(instance.state?.state);

/** An item condition's identity check from untrusted input, or undefined when it holds none. */
export const itemIdentity = (value: unknown): ItemRequirement['identity'] =>
  (value === 'identified' || value === 'unidentified' ? value : undefined);

/** Whether two Item Instances have the same State for stacking. */
export const sameState = (a: Pick<ItemInstance, 'state'>, b: Pick<ItemInstance, 'state'>): boolean => stateKey(a) === stateKey(b);

/** The per-instance state a new Item Instance of `item` starts with: the starting State, full uses when it doesn't stack, and
 *  unidentified when the item has an unidentified face (Q16). Undefined when none. */
export function seededState(item: Item): ItemInstanceState | undefined {
  const state = stateWord(item.state);
  const uses = itemStackable(item) ? undefined : item.uses;
  const unidentified = itemHasUnidentifiedFace(item);
  if (uses === undefined && !state && !unidentified) return undefined;
  return { ...(uses !== undefined && { uses }), ...(state && { state }), ...(unidentified && { unidentified: true }) };
}

/** What an instance of `item` leaves on its last use (Q26). */
export const whenEmptyOf = (item: Item): ItemWhenEmpty => item.whenEmpty ?? { kind: 'gone' };

/** The slots an instance takes under its rule: every listed slot for All of, else `chosen`. */
export const ruleSlots = (rule: SlotRule | undefined, chosen: string): readonly string[] =>
  (rule?.mode === 'all' ? rule.slotIds : [chosen]);

/** Whether an instance stored in `slotId` still fits its rule: always for All of, a listed slot for Either of. */
export const ruleKeeps = (rule: SlotRule | undefined, slotId: string): boolean =>
  rule?.mode === 'all' || !!rule?.slotIds.includes(slotId);

/**
 * The slots an equipped Item Instance occupies, one unit in each: every listed slot under All of, else its stored one.
 * Empty for a carried instance. The first is the slot a reader names when it names one.
 */
export const occupiedSlots = (instance: Pick<ItemInstance, 'equipped'>, item: Pick<Item, 'slotRule'> | undefined): readonly string[] => {
  if (!instance.equipped) return [];
  return ruleSlots(item?.slotRule, instance.equipped.slotId);
};

/** A Slot Rule as the prompt writes it: `A or B` for Either of, `A + B` for All of. Empty when no listed slot exists. */
export const slotRuleMark = (rule: SlotRule | undefined, slots: readonly Slot[]): string =>
  (rule?.slotIds ?? []).flatMap((id) => slots.find((s) => s.id === id)?.name ?? []).join(rule?.mode === 'all' ? ' + ' : ' or ');

/** The rule's slots that keep a Body from holding the item: all of them for Either of, each missing one for All of. Empty = it fits. */
export function ruleGaps(rule: SlotRule, held: (slotId: string) => boolean): string[] {
  const missing = rule.slotIds.filter((slotId) => !held(slotId));
  return rule.mode === 'all' || missing.length === rule.slotIds.length ? missing : [];
}

/** Sorts equipped Item Instances longest equipped first. */
export const byEquipOrder = (a: ItemInstance, b: ItemInstance): number => (a.equipped?.order ?? 0) - (b.equipped?.order ?? 0);

const isRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object';
const hasId = (value: unknown): value is { id: string } => isRecord(value) && typeof value.id === 'string';
const listOf = <T>(value: unknown): T[] => (Array.isArray(value) ? value : []);

/** A world file's items with every list present. Records without an id are dropped. */
export function parseItems(raw: unknown): Item[] {
  return listOf<unknown>(raw).filter(hasId).map((value) => {
    // Hand-edited JSON: the guards above give the id, the spread keeps whatever else the record holds.
    const { slotRule, ...item } = value as Item;
    const rule = parseSlotRule(slotRule);
    return {
      ...item,
      name: typeof item.name === 'string' ? item.name : '',
      statEffects: listOf(item.statEffects),
      traitEffects: listOf(item.traitEffects),
      equipRequires: listOf(item.equipRequires),
      ...(rule && { slotRule: rule }),
    };
  });
}

/** A world file's Slot Rule: each slot once, in order. None when it lists no slot. */
function parseSlotRule(raw: unknown): SlotRule | undefined {
  if (!isRecord(raw)) return undefined;
  const slotIds = [...new Set(listOf<unknown>(raw.slotIds).filter((id): id is string => typeof id === 'string'))];
  return slotIds.length ? { mode: raw.mode === 'all' ? 'all' : 'either', slotIds } : undefined;
}

export const parseSlots = (raw: unknown): Slot[] => listOf<unknown>(raw).filter(hasId) as Slot[];

/** A world file's placements. Records without an id or an item source are dropped. */
export const parsePlacements = (raw: unknown): Placement[] => listOf<unknown>(raw).filter(hasId).filter((p) => {
  const source = (p as { source?: unknown }).source;
  return isRecord(source) && source.kind === 'item' && typeof source.itemId === 'string';
}).map((p) => {
  const { equipped, slotId, ...rest } = p as Placement;
  if (equipped !== true || rest.where?.kind === 'location') return rest;
  return { ...rest, equipped, ...(typeof slotId === 'string' && { slotId }) };
});

/** A whole number typed into an input, or undefined for a blank or non-numeric one. */
export const wholeCount = (raw: string): number | undefined => {
  if (raw.trim() === '') return undefined;
  const n = Math.floor(Number(raw));
  return Number.isFinite(n) ? n : undefined;
};

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
  items.filter((i) => i.slotRule?.slotIds.includes(slotId)).length;

/** `items` with every reference to the slot cleared. A rule left with no slot goes too. */
export function withoutSlotRefs(items: Item[], slotId: string): Item[] {
  if (!itemsInSlot(items, slotId)) return items;
  return items.map((item) => {
    if (!item.slotRule?.slotIds.includes(slotId)) return item;
    const { slotRule, ...rest } = item;
    const slotIds = slotRule.slotIds.filter((id) => id !== slotId);
    return slotIds.length ? { ...rest, slotRule: { ...slotRule, slotIds } } : rest;
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

/** What an item popup lists beside the name: State, count, uses left. */
export const instanceFacts = (instance: ItemInstance, item: Pick<Item, 'uses'> | undefined): string[] => {
  const state = instanceState(instance);
  const uses = usesLine(instance, item);
  return [...(state ? [state] : []), ...(instance.quantity > 1 ? [`×${instance.quantity}`] : []), ...(uses ? [uses] : [])];
};
