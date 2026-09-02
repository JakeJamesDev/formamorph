import { randomUUID } from '@/lib/uuid';
import { buildTree, flattenTree } from './groupTree';
import {
  absorbPlaceholders, collectUsedPlaceholders, remapPlaceholderIds, remapValuePins, remintPlaceholderDef,
  SHARED_PATH_SEP,
} from './placeholders';
import { holderOf, ownedDescendants } from './placeholderTree';
import type { Dictionary, DictionaryEntry, Entity, EntityGroup, Placeholder, PlaceholderGroup } from '@/types';

/**
 * Where a placeholder lives. A world keeps three kinds of list: its own shared placeholders, and the ones
 * an entity or a dictionary book carries as its own. Every reader sees one combined view; a write goes to
 * the list that holds the id.
 */
export type PlaceholderHome =
  | { kind: 'world' }
  | { kind: 'entity'; ownerId: string }
  | { kind: 'dictionary'; ownerId: string };

/** The world slices the combined view reads. Each is optional: world JSON is hand-editable. */
export interface PlaceholderHomesWorld {
  placeholders?: Placeholder[];
  entities?: Entity[];
  entityGroups?: EntityGroup[];
  dictionaries?: Dictionary[];
  /** The folders the tab and the chip menus sort the shared placeholders by. */
  placeholderGroups?: PlaceholderGroup[];
}

/** A record that carries a placeholder list of its own. */
type PlaceholderOwner = { id: string; placeholders?: Placeholder[] };

/** The three lists a write can land on, as the slices a caller writes back. A drop that moved a folder
 *  carries the folders too; absent, they are untouched. */
export interface PlaceholderSlices {
  placeholders: Placeholder[];
  entities: Entity[];
  dictionaries: Dictionary[];
  placeholderGroups?: PlaceholderGroup[];
}

/** The entity or book a scoped placeholder belongs to, as a name surface reads it: `Molly.Eyes`. */
export interface PlaceholderOwnerRef {
  kind: 'entity' | 'dictionary';
  id: string;
  name: string;
}

/** Placeholder id → its owner, for every scoped placeholder a world has. A shared one has no entry. */
export type PlaceholderOwners = ReadonlyMap<string, PlaceholderOwnerRef>;

export const NO_OWNERS: PlaceholderOwners = new Map();

const WORLD: PlaceholderHome = { kind: 'world' };
const EMPTY: Placeholder[] = [];

/** True when two homes name the same list. */
export const sameHome = (a: PlaceholderHome, b: PlaceholderHome): boolean =>
  a.kind === b.kind && (a.kind === 'world' || b.kind === 'world' || a.ownerId === b.ownerId);

const cache = new WeakMap<PlaceholderHomesWorld, { deps: unknown[]; result: Placeholder[] }>();
const ownersCache = new WeakMap<PlaceholderHomesWorld, { deps: unknown[]; result: PlaceholderOwners }>();

/** True when both lists hold the same items, by identity, in the same order. */
export function sameElements<T>(a: readonly T[], b: readonly T[]): boolean {
  return a === b || (a.length === b.length && a.every((p, i) => p === b[i]));
}

/** Entities as the Entities tab orders them, walked through the generic tree so this module and the
 *  entity tree never import each other. */
const entitiesInTreeOrder = (groups: EntityGroup[], entities: Entity[]): Entity[] =>
  flattenTree(buildTree(groups, entities)).flatMap((n) => (n.leaf ? [n.leaf] : []));

/**
 * Every placeholder a world can resolve: the world's own list, then each entity's in tree order, then each
 * book's in book order. The same world object answers with the same array while its slices are unchanged,
 * and a world where nothing but the world list carries placeholders answers with that list itself.
 */
export function allPlaceholders(world: PlaceholderHomesWorld): Placeholder[] {
  const deps = [world.placeholders, world.entities, world.entityGroups, world.dictionaries];
  const hit = cache.get(world);
  if (hit && hit.deps.every((d, i) => d === deps[i])) return hit.result;
  const carries = (owners: readonly PlaceholderOwner[] = []) => owners.some((o) => o.placeholders?.length);
  // The tree walk is only worth building once something outside the world list carries a placeholder.
  const scoped = !carries(world.entities) && !carries(world.dictionaries) ? [] : [
    ...entitiesInTreeOrder(world.entityGroups ?? [], world.entities ?? []).flatMap((e) => e.placeholders ?? []),
    ...(world.dictionaries ?? []).flatMap((b) => b.placeholders ?? []),
  ];
  const result = scoped.length ? [...(world.placeholders ?? []), ...scoped] : world.placeholders ?? EMPTY;
  cache.set(world, { deps, result });
  return result;
}

/**
 * Who owns each scoped placeholder. The same world object answers with the same map while its entities and
 * books are unchanged, and a world with nothing scoped answers with the one shared empty map.
 */
export function placeholderOwners(world: PlaceholderHomesWorld): PlaceholderOwners {
  const deps = [world.entities, world.dictionaries];
  const hit = ownersCache.get(world);
  if (hit && hit.deps.every((d, i) => d === deps[i])) return hit.result;
  const map = new Map<string, PlaceholderOwnerRef>();
  for (const e of world.entities ?? []) for (const p of e.placeholders ?? []) map.set(p.id, { kind: 'entity', id: e.id, name: e.name });
  for (const b of world.dictionaries ?? []) for (const p of b.placeholders ?? []) map.set(p.id, { kind: 'dictionary', id: b.id, name: b.name });
  const result = map.size ? map : NO_OWNERS;
  ownersCache.set(world, { deps, result });
  return result;
}

/** True when two owner maps say the same thing — what lets a memo keep its instance across a keystroke. */
export function sameOwners(a: PlaceholderOwners, b: PlaceholderOwners): boolean {
  if (a === b) return true;
  if (a.size !== b.size) return false;
  for (const [id, owner] of a) {
    const other = b.get(id);
    if (!other || other.kind !== owner.kind || other.id !== owner.id || other.name !== owner.name) return false;
  }
  return true;
}

/** The list a home names; empty for an owner the world does not have. */
export function placeholderList(world: PlaceholderHomesWorld, home: PlaceholderHome): Placeholder[] {
  if (home.kind === 'world') return world.placeholders ?? EMPTY;
  const owners: readonly PlaceholderOwner[] | undefined = home.kind === 'entity' ? world.entities : world.dictionaries;
  return owners?.find((o) => o.id === home.ownerId)?.placeholders ?? EMPTY;
}

/** An off-world item's whole pool: the placeholders it owns, then the shared ones it carries for its chips. */
export function carriedPlaceholders(item: { placeholders?: Placeholder[]; sharedPlaceholders?: Placeholder[] }): Placeholder[] {
  const owned = item.placeholders ?? EMPTY;
  return item.sharedPlaceholders?.length ? [...owned, ...item.sharedPlaceholders] : owned;
}

/** Placeholder id → the list holding it, for every placeholder the world has. */
export function placeholderHomeIndex(world: PlaceholderHomesWorld): ReadonlyMap<string, PlaceholderHome> {
  const out = new Map<string, PlaceholderHome>();
  for (const p of world.placeholders ?? []) out.set(p.id, WORLD);
  for (const e of world.entities ?? []) for (const p of e.placeholders ?? []) out.set(p.id, { kind: 'entity', ownerId: e.id });
  for (const b of world.dictionaries ?? []) for (const p of b.placeholders ?? []) out.set(p.id, { kind: 'dictionary', ownerId: b.id });
  return out;
}

/** The entity or book `id` names, as an owner reference; undefined when the world has neither. */
export function placeholderOwnerRef(world: PlaceholderHomesWorld, id: string): PlaceholderOwnerRef | undefined {
  const entity = world.entities?.find((e) => e.id === id);
  if (entity) return { kind: 'entity', id: entity.id, name: entity.name };
  const book = world.dictionaries?.find((b) => b.id === id);
  return book ? { kind: 'dictionary', id: book.id, name: book.name } : undefined;
}

/** Split a whole pool written back to an off-world item into the lists it was read from: an id the item
 *  carried as shared stays shared, so it stays shared on export; everything else is the item's own. */
export function splitCarriedPlaceholders<T extends { placeholders?: Placeholder[]; sharedPlaceholders?: Placeholder[] }>(
  item: T, next: Placeholder[],
): T {
  const sharedIds = new Set((item.sharedPlaceholders ?? []).map((p) => p.id));
  const owned = next.filter((p) => !sharedIds.has(p.id));
  const shared = next.filter((p) => sharedIds.has(p.id));
  const { placeholders: _owned, sharedPlaceholders: _shared, ...rest } = item;
  // The spread keeps every other field, so the shape is T again; only the two lists moved.
  return {
    ...rest,
    ...(owned.length ? { placeholders: owned } : {}),
    ...(shared.length ? { sharedPlaceholders: shared } : {}),
  } as T;
}

/** The shared placeholders an off-world export has to carry beside `owned`: everything `texts` and the owned
 *  values reach in `available` that is not the item's own — through their chips, and through the
 *  placeholders their pins hold, which no chip need place. */
export function sharedPlaceholdersUsed(texts: string[], owned: readonly Placeholder[], available: Placeholder[]): Placeholder[] {
  const ownedIds = new Set(owned.map((p) => p.id));
  const reached = collectUsedPlaceholders(
    [...texts, ...owned.flatMap((p) => (p.values ?? []).map((v) => v.text))],
    available,
    owned.flatMap((p) => (p.values ?? []).flatMap((v) => (v.pins ?? []).map((pin) => pin.placeholderId))),
  );
  return reached.filter((p) => !ownedIds.has(p.id));
}

/** The list holding `id`, or null when no list does. */
export function placeholderHome(world: PlaceholderHomesWorld, id: string): PlaceholderHome | null {
  if ((world.placeholders ?? []).some((p) => p.id === id)) return WORLD;
  const entity = (world.entities ?? []).find((e) => (e.placeholders ?? []).some((p) => p.id === id));
  if (entity) return { kind: 'entity', ownerId: entity.id };
  const book = (world.dictionaries ?? []).find((b) => (b.placeholders ?? []).some((p) => p.id === id));
  if (book) return { kind: 'dictionary', ownerId: book.id };
  return null;
}

/** The record with `list` as its placeholders; an empty list drops the field rather than leaving `[]`. */
function withList<T extends PlaceholderOwner>(record: T, list: Placeholder[]): T {
  const { placeholders: _drop, ...rest } = record;
  // The spread keeps every other field, so the shape is T again; only the key set moved.
  return (list.length ? { ...rest, placeholders: list } : rest) as T;
}

/** `owners` with each record's list replaced by `next(owner, list)`. A record whose list comes back the
 *  same keeps its identity, and so does the array when no record changed. */
function mapOwnerLists<T extends PlaceholderOwner>(
  owners: T[], next: (owner: T, list: Placeholder[]) => Placeholder[],
): T[] {
  let changed = false;
  const mapped = owners.map((owner) => {
    const before = owner.placeholders ?? EMPTY;
    const after = next(owner, before);
    if (after === before || sameElements(before, after)) return owner;
    changed = true;
    return withList(owner, after);
  });
  return changed ? mapped : owners;
}

/**
 * Where a create lands: the home the caller names; else, for a placeholder born owned (a part typed into a
 * holder's value), the list its holder lives in; else the world list. A named owner the world no longer
 * has falls back to the world list rather than dropping the placeholder.
 */
export function placeholderHomeFor(
  world: PlaceholderHomesWorld, placeholder: Placeholder, home?: PlaceholderHome,
): PlaceholderHome {
  const known = (h: PlaceholderHome) => h.kind === 'world'
    || (h.kind === 'entity' ? world.entities : world.dictionaries)?.some((o) => o.id === h.ownerId);
  if (home && known(home)) return home;
  return (placeholder.ownerId && placeholderHome(world, placeholder.ownerId)) || WORLD;
}

/**
 * Route a whole combined list back to the lists that hold each id, keeping the combined order within each.
 * An id no list holds yet lands beside the record before it (a duplicate is inserted right after its
 * source), or on the world list when nothing precedes it. An owned placeholder follows its holder: where a
 * row sits and what it belongs to live in one list, so a drop that makes one placeholder a part of another
 * moves it beside the holder. Every unchanged slice keeps its identity.
 */
export function scatterPlaceholders(world: PlaceholderHomesWorld, combined: readonly Placeholder[]): PlaceholderSlices {
  const homeOf = new Map<string, PlaceholderHome>();
  for (const p of world.placeholders ?? []) homeOf.set(p.id, WORLD);
  for (const e of world.entities ?? []) for (const p of e.placeholders ?? []) homeOf.set(p.id, { kind: 'entity', ownerId: e.id });
  for (const b of world.dictionaries ?? []) for (const p of b.placeholders ?? []) homeOf.set(p.id, { kind: 'dictionary', ownerId: b.id });
  const byId = new Map(combined.map((p) => [p.id, p]));
  const resolve = (p: Placeholder, seen: Set<string>, fallback: PlaceholderHome): PlaceholderHome => {
    const holderId = holderOf(combined, p);
    const holder = holderId && !seen.has(holderId) ? byId.get(holderId) : undefined;
    return holder ? resolve(holder, seen.add(p.id), fallback) : homeOf.get(p.id) ?? fallback;
  };

  const worldList: Placeholder[] = [];
  const entityLists = new Map<string, Placeholder[]>();
  const bookLists = new Map<string, Placeholder[]>();
  const push = (lists: Map<string, Placeholder[]>, ownerId: string, p: Placeholder) => {
    const list = lists.get(ownerId);
    if (list) list.push(p); else lists.set(ownerId, [p]);
  };
  let previous: PlaceholderHome = WORLD;
  for (const p of combined) {
    const home = resolve(p, new Set(), previous);
    previous = home;
    if (home.kind === 'world') worldList.push(p);
    else if (home.kind === 'entity') push(entityLists, home.ownerId, p);
    else push(bookLists, home.ownerId, p);
  }
  const current = world.placeholders ?? EMPTY;
  return {
    placeholders: sameElements(current, worldList) ? current : worldList,
    entities: mapOwnerLists(world.entities ?? [], (e) => entityLists.get(e.id) ?? EMPTY),
    dictionaries: mapOwnerLists(world.dictionaries ?? [], (b) => bookLists.get(b.id) ?? EMPTY),
  };
}

/**
 * Apply `change` to the list of whichever owner holds `id`. Returns `owners` itself when no owner holds
 * the id or the change returns the list untouched, so a setter can bail out of a render.
 */
export function mapListHolding<T extends PlaceholderOwner>(
  owners: T[], id: string, change: (list: Placeholder[]) => Placeholder[],
): T[] {
  const index = owners.findIndex((o) => (o.placeholders ?? []).some((p) => p.id === id));
  if (index === -1) return owners;
  const before = owners[index].placeholders ?? EMPTY;
  const after = change(before);
  if (after === before) return owners;
  return owners.map((o, i) => (i === index ? withList(o, after) : o));
}

/** Every slice with `change` applied to each placeholder, whichever list holds it. A list where no
 *  placeholder changed keeps its identity, and so does the record and array around it. */
export function mapAllPlaceholders(world: PlaceholderHomesWorld, change: (placeholder: Placeholder) => Placeholder): PlaceholderSlices {
  const mapList = (list: Placeholder[]) => {
    const next = list.map(change);
    return sameElements(list, next) ? list : next;
  };
  return {
    placeholders: mapList(world.placeholders ?? EMPTY),
    entities: mapOwnerLists(world.entities ?? [], (_o, list) => mapList(list)),
    dictionaries: mapOwnerLists(world.dictionaries ?? [], (_o, list) => mapList(list)),
  };
}

/** Every slice with the given ids removed from whichever list holds them. Unchanged slices keep identity. */
export function withoutPlaceholders(world: PlaceholderHomesWorld, ids: ReadonlySet<string>): PlaceholderSlices {
  const keep = (list: Placeholder[]) => (list.some((p) => ids.has(p.id)) ? list.filter((p) => !ids.has(p.id)) : list);
  return {
    placeholders: keep(world.placeholders ?? EMPTY),
    entities: mapOwnerLists(world.entities ?? [], (_o, list) => keep(list)),
    dictionaries: mapOwnerLists(world.dictionaries ?? [], (_o, list) => keep(list)),
  };
}

/**
 * Move one placeholder into the list `home` names, id kept, so no chip re-aims. What it owns goes with it
 * (an owned row lives beside its holder), and the moved one is released from any holder of its own: its
 * holder keeps the value, which now draws it as a shared row. A move to the list it already lives in, of an
 * id no list holds, or to an owner the world lacks changes nothing; unchanged slices keep identity.
 */
export function movePlaceholderHome(world: PlaceholderHomesWorld, id: string, home: PlaceholderHome): PlaceholderSlices {
  const current: PlaceholderSlices = {
    placeholders: world.placeholders ?? EMPTY, entities: world.entities ?? [], dictionaries: world.dictionaries ?? [],
  };
  const from = placeholderHome(world, id);
  if (!from || sameHome(from, home)) return current;
  const known = home.kind === 'world'
    || (home.kind === 'entity' ? current.entities : current.dictionaries).some((o) => o.id === home.ownerId);
  if (!known) return current;
  const all = allPlaceholders(world);
  const record = all.find((p) => p.id === id);
  if (!record) return current;
  // A folder is the world list's own, so a record leaving that list leaves its folder too.
  const { ownerId: _released, groupId: _ungrouped, ...root } = record;
  const moving = [root, ...ownedDescendants(all, id)];
  const stripped = withoutPlaceholders(world, new Set(moving.map((p) => p.id)));
  if (home.kind === 'world') return { ...stripped, placeholders: [...stripped.placeholders, ...moving] };
  const append = <T extends PlaceholderOwner>(owners: T[]) =>
    mapOwnerLists(owners, (o, list) => (o.id === home.ownerId ? [...list, ...moving] : list));
  return home.kind === 'entity'
    ? { ...stripped, entities: append(stripped.entities) }
    : { ...stripped, dictionaries: append(stripped.dictionaries) };
}

/** Every slice with the list `home` names replaced by `list`. Unchanged slices keep identity. */
export function withPlaceholderList(world: PlaceholderHomesWorld, home: PlaceholderHome, list: Placeholder[]): PlaceholderSlices {
  const current: PlaceholderSlices = {
    placeholders: world.placeholders ?? EMPTY, entities: world.entities ?? [], dictionaries: world.dictionaries ?? [],
  };
  if (home.kind === 'world') return sameElements(current.placeholders, list) ? current : { ...current, placeholders: list };
  const swap = <T extends PlaceholderOwner>(owners: T[]) => mapOwnerLists(owners, (o, before) => (o.id === home.ownerId ? list : before));
  return home.kind === 'entity'
    ? { ...current, entities: swap(current.entities) }
    : { ...current, dictionaries: swap(current.dictionaries) };
}

/** The def with every reference in it re-aimed through `idMap`: a chip in a value, its `ownerId`, and the
 *  segments of a shared-weight key below the root (the root is one of the def's own value ids). A chip at
 *  something the map does not name is left as written. Value pins are settled by `remapValuePins`, which
 *  needs the new target's values and so runs once the whole list exists. */
export function remapPlaceholderRefs(p: Placeholder, idMap: Record<string, string>): Placeholder {
  const values = (p.values ?? []).map((v) => ({ ...v, text: remapPlaceholderIds(v.text, idMap) }));
  const sharedWeights = p.sharedWeights && Object.fromEntries(
    Object.entries(p.sharedWeights).map(([key, map]) => {
      const [root, ...under] = key.split(SHARED_PATH_SEP);
      return [[root, ...under.map((id) => idMap[id] ?? id)].join(SHARED_PATH_SEP), map] as const;
    }),
  );
  return {
    ...p,
    values,
    ...(p.ownerId ? { ownerId: idMap[p.ownerId] ?? p.ownerId } : {}),
    ...(sharedWeights ? { sharedWeights } : {}),
  };
}

/**
 * A copy of a scoped list for a duplicated owner: every def gets a fresh id, its values fresh ids and
 * placements (see `remintPlaceholderDef`), and every reference inside the list (a chip in a value, an
 * `ownerId`, a shared-weight key, a value pin) is re-aimed at the new ids. A reference to something outside
 * the list is left as written, so a pin at a shared placeholder still holds it. `idMap` is old id → new id,
 * for the owner's own texts.
 */
export function remintScopedPlaceholders(list: readonly Placeholder[]): { placeholders: Placeholder[]; idMap: Record<string, string> } {
  const idMap: Record<string, string> = {};
  for (const p of list) idMap[p.id] = randomUUID();
  const copied = list.map((p) => ({ ...remapPlaceholderRefs(remintPlaceholderDef(p), idMap), id: idMap[p.id] }));
  return { placeholders: remapValuePins(copied, idMap, copied), idMap };
}

/** What adopting an off-world item into a world produces: the item as the world keeps it, and the shared
 *  placeholders the world has to gain for the item's chips to resolve. */
interface Adopted<T> {
  item: T;
  toAdd: Placeholder[];
  /** Every carried id → the id it resolves to in this world, for the item's own texts. */
  idMap: Record<string, string>;
}

/**
 * Bring a card's or file's placeholders into a world. The owned ones stay owned under fresh ids (the same
 * card added twice must not share ids); the carried shared ones merge with the world's shared list by name
 * and values, as `absorbPlaceholders` decides, or join it as fresh records. A card with no
 * `sharedPlaceholders` carries owned ones only, so nothing of it merges.
 */
function adoptCarried<T extends { placeholders?: Placeholder[]; sharedPlaceholders?: Placeholder[] }>(
  item: T, worldShared: readonly Placeholder[],
): Adopted<T> {
  const owned = item.placeholders ?? EMPTY;
  const shared = item.sharedPlaceholders ?? EMPTY;
  if (!owned.length && !shared.length) return { item, toAdd: [], idMap: {} };
  const minted = remintScopedPlaceholders(owned);
  // A shared def may hold an owned one as a value or a pin; it compares against the world by what its
  // chips mean.
  const carried = remapValuePins(
    shared.map((p) => remapPlaceholderRefs(p, minted.idMap)), minted.idMap, minted.placeholders,
  );
  const { toAdd, idMap: sharedMap } = absorbPlaceholders(carried, [...worldShared]);
  const aimed = minted.placeholders.map((p) => remapPlaceholderRefs(p, sharedMap));
  // Every def a pin may name once the item is in: the item's own, the world's shared list, and the shared
  // ones joining it. A pin at anything else has no target here, so it goes rather than dangle.
  const pool = [...aimed, ...worldShared, ...toAdd];
  const placeholders = remapValuePins(aimed, sharedMap, pool, true);
  const added = remapValuePins(toAdd, sharedMap, pool, true);
  const { placeholders: _owned, sharedPlaceholders: _shared, ...rest } = item;
  // The spread keeps every other field, so the shape is T again; only the two carried lists moved.
  const adopted = (placeholders.length ? { ...rest, placeholders } : rest) as T;
  return { item: adopted, toAdd: added, idMap: { ...minted.idMap, ...sharedMap } };
}

/** {@link adoptCarried} for a character card, with its chips re-aimed. */
export function adoptEntityPlaceholders(entity: Entity, worldShared: readonly Placeholder[]): { entity: Entity; toAdd: Placeholder[] } {
  const { item, toAdd, idMap } = adoptCarried(entity, worldShared);
  return { entity: item === entity ? entity : remapEntityChips(item, idMap), toAdd };
}

/** {@link adoptCarried} for a dictionary file, with its entries' chips re-aimed. */
export function adoptBookPlaceholders(book: Dictionary, worldShared: readonly Placeholder[]): { book: Dictionary; toAdd: Placeholder[] } {
  const { item, toAdd, idMap } = adoptCarried(book, worldShared);
  return { book: item === book ? book : remapBookChips(item, idMap), toAdd };
}

const remapText = (text: string | undefined, idMap: Record<string, string>) => (text ? remapPlaceholderIds(text, idMap) : text);
const remapTexts = (texts: string[] | undefined, idMap: Record<string, string>) => texts?.map((t) => remapPlaceholderIds(t, idMap));
const sameTexts = (a: string[] | undefined, b: string[] | undefined) => a === b || (!!a && !!b && sameElements(a, b));

/** The entity with every chip in its own fields re-aimed through `idMap`; the same object when nothing maps. */
export function remapEntityChips(entity: Entity, idMap: Record<string, string>): Entity {
  const next: Entity = {
    ...entity,
    name: remapText(entity.name, idMap) ?? entity.name,
    ...(entity.aliases ? { aliases: remapTexts(entity.aliases, idMap) } : {}),
    ...(entity.playerDescription !== undefined ? { playerDescription: remapText(entity.playerDescription, idMap) } : {}),
    ...(entity.aiDescription !== undefined ? { aiDescription: remapText(entity.aiDescription, idMap) } : {}),
    ...(entity.aiSummary !== undefined ? { aiSummary: remapText(entity.aiSummary, idMap) } : {}),
    ...(entity.imageTags !== undefined ? { imageTags: remapText(entity.imageTags, idMap) } : {}),
  };
  const same = next.name === entity.name && sameTexts(next.aliases, entity.aliases)
    && next.playerDescription === entity.playerDescription && next.aiDescription === entity.aiDescription
    && next.aiSummary === entity.aiSummary && next.imageTags === entity.imageTags;
  return same ? entity : next;
}

/** The book with every chip in its entries re-aimed through `idMap`; the same object when nothing maps. */
export function remapBookChips(book: Dictionary, idMap: Record<string, string>): Dictionary {
  let changed = false;
  const entries = book.entries.map((e): DictionaryEntry => {
    const next: DictionaryEntry = {
      ...e,
      ...(e.name !== undefined ? { name: remapText(e.name, idMap) } : {}),
      ...(e.key ? { key: remapTexts(e.key, idMap) } : {}),
      ...(e.secondaryKeys ? { secondaryKeys: remapTexts(e.secondaryKeys, idMap) } : {}),
      ...(e.value !== undefined ? { value: remapText(e.value, idMap) } : {}),
    };
    const same = next.name === e.name && sameTexts(next.key, e.key) && sameTexts(next.secondaryKeys, e.secondaryKeys) && next.value === e.value;
    if (!same) changed = true;
    return same ? e : next;
  });
  return changed ? { ...book, entries } : book;
}

/** A duplicated entity with placeholders of its own: fresh records, and its chips pointed at the copies. */
export function duplicateEntityPlaceholders(entity: Entity): Entity {
  if (!entity.placeholders?.length) return entity;
  const { placeholders, idMap } = remintScopedPlaceholders(entity.placeholders);
  return remapEntityChips({ ...entity, placeholders }, idMap);
}
