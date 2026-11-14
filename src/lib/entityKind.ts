import { PLAYER_START, type DiscoveredEntity, type Entity, type EntityKind, type EntityRoutine, type EntityStart, type ScheduleRow, type Traversable } from "@/types";
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

/** The id a migrated or blank entity's one Routine takes. */
export const FIRST_ROUTINE_ID = "routine-1";
/** The default name of the `n`th Routine, from 1. */
export const routineName = (n: number): string => `Routine ${n}`;

/** "Routine 1" with no gate. `traversable` absent = an empty list. */
export const firstRoutine = (starts: EntityStart[] = [], traversable?: Traversable): EntityRoutine =>
  ({ id: FIRST_ROUTINE_ID, name: routineName(1), starts, ...(traversable !== undefined && { traversable }) });

/** The Routine that applies in play: the first. */
export const applyingRoutine = (entity: Pick<Entity, "routines">): EntityRoutine | undefined => entity.routines?.[0];

/** The applying Routine's Starts. */
export const startsOf = (entity: Pick<Entity, "routines">): EntityStart[] => applyingRoutine(entity)?.starts ?? [];

/** The applying Routine's Traversable. An absent field is an empty list, in play and in the editor. */
export const traversableOf = (entity: Pick<Entity, "routines">): Traversable => applyingRoutine(entity)?.traversable ?? [];

/** Every Start of every Routine, in order. */
export const everyStart = (entity: Pick<Entity, "routines">): EntityStart[] => (entity.routines ?? []).flatMap((r) => r.starts);

/** `entity`'s Routines, or one blank Routine when it has none. */
const routinesOrFirst = (entity: Pick<Entity, "routines">): EntityRoutine[] =>
  (entity.routines?.length ? entity.routines : [firstRoutine()]);

/** `entity` with its first Routine replaced by `edit` of it; one with none starts from a blank Routine. */
export function withFirstRoutine<E extends Pick<Entity, "routines">>(entity: E, edit: (routine: EntityRoutine) => EntityRoutine): E {
  const [first, ...rest] = routinesOrFirst(entity);
  return { ...entity, routines: [edit(first), ...rest] };
}

/** `entity` with its first Routine's Starts set to `starts`. */
export const withFirstStarts = <E extends Pick<Entity, "routines">>(entity: E, starts: EntityStart[]): E =>
  withFirstRoutine(entity, (routine) => ({ ...routine, starts }));

/** `entity` with its first Routine's Traversable set to `traversable`. */
export const withFirstTraversable = <E extends Pick<Entity, "routines">>(entity: E, traversable: Traversable): E =>
  withFirstRoutine(entity, (routine) => ({ ...routine, traversable }));

/** The entity fields a routine is read from. */
export type RoutineEntity = Pick<Entity, "id" | "kind" | "routines">;

/** The engine's view of an entity with a kind: its applying Routine. Undefined for anything else. */
export function routineOf(entity: RoutineEntity): Routine | undefined {
  if (isGeneric(entity)) return { id: entity.id, starts: startsOf(entity), traversable: [], generic: true };
  if (!isUnique(entity)) return undefined;
  return { id: entity.id, starts: startsOf(entity), traversable: traversableOf(entity) };
}

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

/** Whether a Start or row of `routine` names `placeId`. */
const startsName = (routine: EntityRoutine, placeId: string): boolean =>
  routine.starts.some((start) => routinePlaces([start]).includes(placeId));

/** Whether `routine` names `placeId` anywhere: a Start, a row or Traversable. */
const routineNamesPlace = (routine: EntityRoutine, placeId: string): boolean =>
  startsName(routine, placeId) || (Array.isArray(routine.traversable) && routine.traversable.includes(placeId));

/** Whether any of `entity`'s Routines names `placeId`: a Start, a row or Traversable. */
export const routineNames = (entity: Pick<Entity, "routines">, placeId: string): boolean =>
  (entity.routines ?? []).some((routine) => routineNamesPlace(routine, placeId));

/** `routine` with `placeId` dropped from its Starts, rows and Traversable. */
function routineWithoutPlace(routine: EntityRoutine, placeId: string): EntityRoutine {
  if (!routineNamesPlace(routine, placeId)) return routine;
  const starts = !startsName(routine, placeId) ? routine.starts : routine.starts
    .filter((start) => start.place !== placeId)
    .map((start) => ({ ...start, schedule: start.schedule.flatMap((row) => rowWithout(row, placeId) ?? []) }));
  return {
    ...routine, starts,
    ...(Array.isArray(routine.traversable) && { traversable: routine.traversable.filter((id) => id !== placeId) }),
  };
}

/** `entity` with `placeId` dropped from every Routine's Starts, rows and Traversable: a Start at the place goes, and
 *  so does a row left with no places. The same entity when it never named the place. */
export function withoutRoutinePlace(entity: Entity, placeId: string): Entity {
  if (!routineNames(entity, placeId)) return entity;
  return { ...entity, routines: entity.routines?.map((routine) => routineWithoutPlace(routine, placeId)) };
}

/** A new Start at `place` with an empty schedule. */
const blankStart = (place: string, newId: () => string): EntityStart => ({ id: newId(), place, weight: 1, schedule: [] });

/** A copy of `entity` of `kind`, keeping every Routine, Start, row, weight, Strict flag and Traversable (Q135). An
 *  entity with no kind becomes one Routine: a Unique entity with a Start at its first place or a Generic entity with
 *  one per place; its membership goes. */
export function withKind(entity: Entity, kind: EntityKind, newId: () => string): Entity {
  if (entity.kind === kind) return entity;
  const places = entity.kind ? [] : namedPlacesOf(entity);
  const routines = entity.routines?.length ? entity.routines
    : [firstRoutine((kind === "generic" ? places : places.slice(0, 1)).map((place) => blankStart(place, newId)))];
  return withoutMembership({
    ...entity, kind,
    routines: kind === "unique" ? routines.map((routine) => ({ ...routine, traversable: routine.traversable ?? "anywhere" })) : routines,
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
  const mapped = [...new Set(Object.values(map))];
  const routines = routinesOrFirst(entity).map((routine): EntityRoutine => {
    const kept = routine.starts.flatMap((start) => (placeOf(start)
      ? [{ ...start, place: placeOf(start), schedule: start.schedule.flatMap((row) => rowMapped(row, map) ?? []) }]
      : []));
    const starts = kept.length ? kept : (isGeneric(entity) ? mapped : mapped.slice(0, 1)).map((place) => blankStart(place, newId));
    return {
      ...routine, starts,
      ...(Array.isArray(routine.traversable) && { traversable: [...new Set(routine.traversable.flatMap((id) => map[id] ?? []))] }),
    };
  });
  return { ...entity, routines };
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

/** The inverse of `withRoutineMapped`: `copy`'s Routines in world ids, each written back over the library Routine with
 *  its id through `map` (Q34, Q35). A fallback Start the carry minted stays out (Q37, Q40). */
export function withRoutineReturned(
  copy: Pick<Entity, "kind" | "routines">, library: Pick<Entity, "routines">, map: Readonly<Record<string, string>>,
): Pick<Entity, "routines"> {
  if (!copy.routines) return {};
  const libraryById = new Map((library.routines ?? []).map((routine) => [routine.id, routine]));
  return { routines: copy.routines.map((routine) => routineReturned(routine, copy.kind, libraryById.get(routine.id), map)) };
}

/** One Routine of {@link withRoutineReturned}: `copy` over `library`, the library Routine of the same id. */
function routineReturned(
  copy: EntityRoutine, kind: Entity["kind"], library: EntityRoutine | undefined, map: Readonly<Record<string, string>>,
): EntityRoutine {
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

  const libraryStarts = library?.starts ?? [];
  const startById = new Map(libraryStarts.map((start) => [start.id, start]));
  // The carry minted a fallback only when no library Start carried (Q40).
  const mintedFallback = libraryStarts.length > 0 && !libraryStarts.some((start) => carries(start.place));
  const libraryIds = new Set(startById.keys());
  const authored = copy.starts.filter((start) => !mintedFallback || !isMintedFallback(start, kind, map, libraryIds));
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
    const libraryPlaces = Array.isArray(library?.traversable) ? library.traversable : [];
    const returned = placesReturned(traversable ?? [], libraryPlaces, map);
    if (traversable || returned.length) traversable = returned;
  }
  const { traversable: _t, ...rest } = copy;
  return { ...rest, starts, ...(traversable !== undefined && { traversable }) };
}

/** A Generic entity with a new Start with no rows at `place`. */
export const withGenericStart = (entity: Entity, place: string, newId: () => string): Entity =>
  withFirstStarts(entity, [...startsOf(entity), blankStart(place, newId)]);

/** Whether removing the Starts that begin at `place` leaves `entity` at least one. */
export const canRemoveGenericStartsAt = (entity: Pick<Entity, "routines">, place: string): boolean =>
  startsOf(entity).some((start) => start.place !== place);

/** A Generic entity without the Starts that begin at `place`, rows and all. The same entity when that would remove its
 *  last Start, or none begins there. */
export function withoutGenericStartsAt(entity: Entity, place: string): Entity {
  const starts = startsOf(entity);
  if (!starts.some((start) => start.place === place) || !canRemoveGenericStartsAt(entity, place)) return entity;
  return withFirstStarts(entity, starts.filter((start) => start.place !== place));
}

/** A Generic entity without the Start `startId`, rows and all. The same entity when that is its last Start. */
export function withoutGenericStart(entity: Entity, startId: string): Entity {
  const starts = startsOf(entity);
  if (starts.length < 2 || !starts.some((start) => start.id === startId)) return entity;
  return withFirstStarts(entity, starts.filter((start) => start.id !== startId));
}

/** A Generic entity with a Start added at `place`, or the Starts that begin there removed when there are any. */
export const toggleGenericStart = (entity: Entity, place: string, newId: () => string): Entity =>
  (startsOf(entity).some((start) => start.place === place) ? withoutGenericStartsAt(entity, place) : withGenericStart(entity, place, newId));

/** A Unique entity with its first Start at `placeId`, made when it has none. */
export function withFirstStartPlace(entity: Entity, placeId: string, newId: () => string): Entity {
  const starts = startsOf(entity);
  const next = starts.length
    ? [withStartPlace(starts[0], placeId), ...starts.slice(1)]
    : [blankStart(placeId, newId)];
  return withFirstStarts(entity, next);
}
