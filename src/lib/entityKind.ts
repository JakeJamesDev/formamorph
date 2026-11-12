import { PLAYER_START, type DiscoveredEntity, type Entity, type EntityKind, type EntityStart, type ScheduleRow, type Traversable } from "@/types";
import { namedPlacesOf, withoutMembership } from "@/lib/entityPlaces";
import { placesOf, runtimeRoutine, type Routine } from "@/lib/positionEngine";

/**
 * An entity's kind and routine: a Unique entity is one body placed from one rolled Start; a Generic entity runs every Start
 * at once, one Generic Entity Instance each. The routine is the only source of its places; neither kind stores a list.
 */

export const isGeneric = (entity: Pick<Entity, "kind">): boolean => entity.kind === "generic";
export const isUnique = (entity: Pick<Entity, "kind">): boolean => entity.kind === "unique";

/** Every Start place and every row place of `starts`, deduped, in order. `PLAYER_START` adds none. */
export const routinePlaces = (starts: readonly EntityStart[]): string[] =>
  [...new Set(starts.flatMap((start) => [
    ...(start.place === PLAYER_START ? [] : [start.place]), ...start.schedule.flatMap((row) => placesOf(row.action)),
  ]))];

/** `start` with Begins Following set or cleared. */
export function withBeginsFollowing(start: EntityStart, on: boolean): EntityStart {
  const { beginsFollowing: _was, ...rest } = start;
  return on ? { ...rest, beginsFollowing: true } : rest;
}

/** `start` moved to `place`. Begins Following holds only at `PLAYER_START`, so a move away clears it. */
export const withStartPlace = (start: EntityStart, place: string): EntityStart =>
  withBeginsFollowing({ ...start, place }, place === PLAYER_START && !!start.beginsFollowing);

/** The entity fields a routine is read from. */
export type RoutineEntity = Pick<Entity, "id" | "kind" | "starts" | "traversable">;

/** The engine's view of an entity with a kind. Undefined for anything else. */
export function routineOf(entity: RoutineEntity): Routine | undefined {
  if (isGeneric(entity)) return { id: entity.id, starts: entity.starts ?? [], traversable: [], generic: true };
  if (!isUnique(entity)) return undefined;
  return { id: entity.id, starts: entity.starts ?? [], traversable: traversableOf(entity) };
}

/** A Unique entity's Traversable. An absent field is an empty list, in play and in the editor. */
export const traversableOf = (entity: Pick<Entity, "traversable">): Traversable => entity.traversable ?? [];

/** The routines of every Unique entity and Generic entity in `cast`, then of every runtime character. */
export function castRoutines(cast: readonly RoutineEntity[], runtime: readonly DiscoveredEntity[] = []): Routine[] {
  return [
    ...cast.flatMap((entity) => routineOf(entity) ?? []),
    ...runtime.flatMap((d) => runtimeRoutine(d) ?? []),
  ];
}

/** A schedule row without `placeId`. Undefined when no place is left. */
function rowWithout(row: ScheduleRow, placeId: string): ScheduleRow | undefined {
  const { action } = row;
  if (action.kind === "stay") return action.place === placeId ? undefined : row;
  if (action.kind === "wander") {
    const places = action.places.filter((p) => p.place !== placeId);
    if (places.length === action.places.length) return row;
    return places.length ? { ...row, action: { ...action, places } } : undefined;
  }
  const stops = action.stops.filter((s) => s.place !== placeId);
  if (stops.length === action.stops.length) return row;
  return stops.length ? { ...row, action: { ...action, stops } } : undefined;
}

/** Whether `entity`'s routine names `placeId` anywhere: a Start, a row or Traversable. */
export const routineNames = (entity: Entity, placeId: string): boolean =>
  (entity.starts ?? []).some((start) => routinePlaces([start]).includes(placeId))
  || (Array.isArray(entity.traversable) && entity.traversable.includes(placeId));

/** `entity` with `placeId` dropped from its Starts, rows and Traversable: a Start at the place goes, and so does
 *  a row left with no places. The same entity when it never named the place. */
export function withoutRoutinePlace(entity: Entity, placeId: string): Entity {
  if (!routineNames(entity, placeId)) return entity;
  const next: Entity = { ...entity };
  if (entity.starts?.some((start) => routinePlaces([start]).includes(placeId))) {
    next.starts = entity.starts
      .filter((start) => start.place !== placeId)
      .map((start) => ({ ...start, schedule: start.schedule.flatMap((row) => rowWithout(row, placeId) ?? []) }));
  }
  if (Array.isArray(entity.traversable)) next.traversable = entity.traversable.filter((id) => id !== placeId);
  return next;
}

/** A new Start at `place` with an empty schedule. */
const blankStart = (place: string, newId: () => string): EntityStart => ({ id: newId(), place, weight: 1, schedule: [] });

/** A copy of `entity` of `kind`, keeping every Start, row, weight, Strict flag and Traversable (Q135). Without
 *  Starts, an entity with no kind becomes a Unique entity with one at its first place or a Generic entity with one
 *  per place; its membership goes. */
export function withKind(entity: Entity, kind: EntityKind, newId: () => string): Entity {
  if (entity.kind === kind) return entity;
  const places = entity.kind ? [] : namedPlacesOf(entity);
  const starts = entity.starts?.length ? entity.starts
    : (kind === "generic" ? places : places.slice(0, 1)).map((place) => blankStart(place, newId));
  const { starts: _s, ...rest } = entity;
  return withoutMembership({
    ...rest, kind, ...(starts.length && { starts }),
    ...(kind === "unique" && { traversable: entity.traversable ?? "anywhere" }),
  });
}

/** A schedule row with each place renamed through `map` and places it lacks dropped. Undefined when none is left. */
function rowMapped(row: ScheduleRow, map: Readonly<Record<string, string>>): ScheduleRow | undefined {
  const { action } = row;
  if (action.kind === "stay") return map[action.place] ? { ...row, action: { ...action, place: map[action.place] } } : undefined;
  if (action.kind === "wander") {
    const places = action.places.flatMap((p) => (map[p.place] ? [{ ...p, place: map[p.place] }] : []));
    return places.length ? { ...row, action: { ...action, places } } : undefined;
  }
  const stops = action.stops.flatMap((s) => (map[s.place] ? [{ ...s, place: map[s.place] }] : []));
  return stops.length ? { ...row, action: { ...action, stops } } : undefined;
}

/** An entity with a kind carried into another world, its places renamed through `map` (source id → world id, in ref
 *  order): the Starts whose place maps are kept with their rows remapped, and Traversable keeps its mapped places
 *  (Q11). With no Start kept, a Generic entity takes one Start per mapped place and a Unique entity one at the first. */
export function withRoutineMapped(entity: Entity, map: Readonly<Record<string, string>>, newId: () => string): Entity {
  const placeOf = (start: EntityStart) => (start.place === PLAYER_START ? PLAYER_START : map[start.place]);
  const kept = (entity.starts ?? []).flatMap((start) => (placeOf(start)
    ? [{ ...start, place: placeOf(start), schedule: start.schedule.flatMap((row) => rowMapped(row, map) ?? []) }]
    : []));
  const mapped = [...new Set(Object.values(map))];
  const starts = kept.length ? kept : (isGeneric(entity) ? mapped : mapped.slice(0, 1)).map((place) => blankStart(place, newId));
  const { starts: _s, ...rest } = entity;
  return {
    ...rest, ...(starts.length && { starts }),
    ...(Array.isArray(entity.traversable) && { traversable: [...new Set(entity.traversable.flatMap((id) => map[id] ?? []))] }),
  };
}

/** `written` with each `library` entry that `isKept` holds put back after the nearest earlier library entry it still
 *  holds, else first: the library's own order for what the copy could not hold (Q34). */
function withUncarriedRestored<T>(written: T[], library: readonly T[], isKept: (entry: T) => boolean, same: (a: T, b: T) => boolean): T[] {
  const out = [...written];
  let after = -1;
  for (const entry of library) {
    if (isKept(entry)) out.splice(++after, 0, entry);
    else {
      const at = out.findIndex((w) => same(w, entry));
      if (at >= 0) after = at;
    }
  }
  return out;
}

const sameId = (a: { id: string }, b: { id: string }) => a.id === b.id;

/** The first source place `map` carries to each world place. */
function firstSources(map: Readonly<Record<string, string>>): Record<string, string> {
  const first: Record<string, string> = {};
  for (const [from, to] of Object.entries(map)) first[to] ??= from;
  return first;
}

/** The inverse of a carry over a plain list of places, such as Can Also Go or a membership (Q34, Q35). The carry folds
 *  library places that share a world place into one, so each world place returns them all. */
export function placesReturned(written: readonly string[], library: readonly string[], map: Readonly<Record<string, string>>): string[] {
  const first = firstSources(map);
  const back = [...new Set(written.flatMap((place) => {
    const from = library.filter((p) => map[p] === place);
    return from.length ? from : [first[place] ?? place];
  }))];
  return withUncarriedRestored(back, library, (p) => !map[p], (a, b) => a === b);
}

/** Whether `start` is the fallback a carry through `map` mints when no library Start carries (Q30): a new id at a
 *  fallback place, no rows, weight 1. */
function isMintedFallback(start: EntityStart, kind: Entity["kind"], map: Readonly<Record<string, string>>, libraryIds: ReadonlySet<string>): boolean {
  const mapped = [...new Set(Object.values(map))];
  const places = isGeneric({ kind }) ? mapped : mapped.slice(0, 1);
  return !libraryIds.has(start.id) && places.includes(start.place) && !start.schedule.length && start.weight === 1 && !start.beginsFollowing;
}

/** The inverse of `withRoutineMapped`: `copy`'s routine in world ids, written back over `library`'s through `map` (Q34, Q35).
 *  A fallback Start the carry minted stays out while the library keeps a Start (Q37). */
export function withRoutineReturned(
  copy: Pick<Entity, "kind" | "starts" | "traversable">, library: Pick<Entity, "starts" | "traversable">, map: Readonly<Record<string, string>>,
): Pick<Entity, "starts" | "traversable"> {
  const firstSource = firstSources(map);
  const carries = (place: string) => place === PLAYER_START || !!map[place];
  const toSource = (place: string, prior?: string) =>
    place === PLAYER_START ? place : prior !== undefined && map[prior] === place ? prior : firstSource[place] ?? place;

  // Entries without ids pair with the library entries carried to the same place, in order.
  const entriesBack = <E extends { place: string }>(written: readonly E[], libraryEntries: readonly E[]): E[] => {
    const pool = [...libraryEntries];
    const mapped = written.map((entry) => {
      const at = pool.findIndex((h) => map[h.place] === entry.place);
      return { ...entry, place: toSource(entry.place, at >= 0 ? pool.splice(at, 1)[0].place : undefined) };
    });
    return withUncarriedRestored(mapped, libraryEntries, (h) => !carries(h.place), (a, b) => a.place === b.place);
  };

  const rowBack = (row: ScheduleRow, libraryRow?: ScheduleRow): ScheduleRow => {
    const { action } = row;
    const was = libraryRow?.action;
    if (action.kind === "stay") return { ...row, action: { ...action, place: toSource(action.place, was?.kind === "stay" ? was.place : undefined) } };
    if (action.kind === "wander") return { ...row, action: { ...action, places: entriesBack(action.places, was?.kind === "wander" ? was.places : []) } };
    return { ...row, action: { ...action, stops: entriesBack(action.stops, was?.kind === "patrol" ? was.stops : []) } };
  };

  const libraryStarts = library.starts ?? [];
  const startById = new Map(libraryStarts.map((start) => [start.id, start]));
  const keepsStart = libraryStarts.some((start) => !carries(start.place));
  const libraryIds = new Set(startById.keys());
  const authored = (copy.starts ?? []).filter((start) => !keepsStart || !isMintedFallback(start, copy.kind, map, libraryIds));
  const written = authored.map((start) => {
    const libraryStart = startById.get(start.id);
    const libraryRows = libraryStart?.schedule ?? [];
    const rowById = new Map(libraryRows.map((row) => [row.id, row]));
    const rows = start.schedule.map((row) => rowBack(row, rowById.get(row.id)));
    return { ...start, place: toSource(start.place, libraryStart?.place), schedule: withUncarriedRestored(rows, libraryRows, (row) => !rowMapped(row, map), sameId) };
  });
  const starts = withUncarriedRestored(written, libraryStarts, (start) => !carries(start.place), sameId);

  // Anywhere replaces the list; no list keeps the library's uncarried entries as the list (Q38).
  let traversable = copy.traversable;
  if (traversable !== "anywhere") {
    const libraryPlaces = Array.isArray(library.traversable) ? library.traversable : [];
    const returned = placesReturned(traversable ?? [], libraryPlaces, map);
    if (traversable || returned.length) traversable = returned;
  }
  return { ...(starts.length && { starts }), ...(traversable !== undefined && { traversable }) };
}

/** A Generic entity with a new Start with no rows at `place`. */
export function withGenericStart(entity: Entity, place: string, newId: () => string): Entity {
  return { ...entity, starts: [...(entity.starts ?? []), blankStart(place, newId)] };
}

/** Whether removing the Starts that begin at `place` leaves `entity` at least one. */
export const canRemoveGenericStartsAt = (entity: Pick<Entity, "starts">, place: string): boolean =>
  (entity.starts ?? []).some((start) => start.place !== place);

/** A Generic entity without the Starts that begin at `place`, rows and all. The same entity when that would remove its
 *  last Start, or none begins there. */
export function withoutGenericStartsAt(entity: Entity, place: string): Entity {
  const starts = entity.starts ?? [];
  if (!starts.some((start) => start.place === place) || !canRemoveGenericStartsAt(entity, place)) return entity;
  return { ...entity, starts: starts.filter((start) => start.place !== place) };
}

/** A Generic entity without the Start `startId`, rows and all. The same entity when that is its last Start. */
export function withoutGenericStart(entity: Entity, startId: string): Entity {
  const starts = entity.starts ?? [];
  if (starts.length < 2 || !starts.some((start) => start.id === startId)) return entity;
  return { ...entity, starts: starts.filter((start) => start.id !== startId) };
}

/** A Generic entity with a Start added at `place`, or the Starts that begin there removed when there are any. */
export const toggleGenericStart = (entity: Entity, place: string, newId: () => string): Entity =>
  ((entity.starts ?? []).some((start) => start.place === place) ? withoutGenericStartsAt(entity, place) : withGenericStart(entity, place, newId));

/** A Unique entity with its first Start at `placeId`, made when it has none. */
export function withFirstStartPlace(entity: Entity, placeId: string, newId: () => string): Entity {
  const starts = entity.starts ?? [];
  const next = starts.length
    ? [withStartPlace(starts[0], placeId), ...starts.slice(1)]
    : [blankStart(placeId, newId)];
  return { ...entity, starts: next };
}
