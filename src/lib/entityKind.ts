import { PLAYER_START, type DiscoveredEntity, type Entity, type EntityKind, type EntityStart, type ScheduleRow } from "@/types";
import { placesOf, runtimeRoutine, type Routine } from "@/lib/positionEngine";

/**
 * An entity's kind and routine: an Individual is one body placed from one rolled Start; a Group runs every Start
 * at once, one presence each. The `locations` of both is derived here and nowhere else.
 */

export const isGroup = (entity: Pick<Entity, "kind">): boolean => entity.kind === "group";
export const isIndividual = (entity: Pick<Entity, "kind">): boolean => entity.kind === "individual";

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

/** `entity` with its `locations` rebuilt from its Starts and rows. An entity with no kind as it is. */
export function withDerivedLocations(entity: Entity): Entity {
  if (!entity.kind) return entity;
  const places = routinePlaces(entity.starts ?? []);
  const same = places.length === (entity.locations?.length ?? 0) && places.every((id, i) => entity.locations?.[i] === id);
  if (same) return entity;
  if (places.length) return { ...entity, locations: places };
  const { locations: _none, ...rest } = entity;
  return rest;
}

/** The entity fields a routine is read from. */
export type RoutineEntity = Pick<Entity, "id" | "kind" | "starts" | "traversable">;

/** The engine's view of an entity with a kind. Undefined for anything else. */
export function routineOf(entity: RoutineEntity): Routine | undefined {
  if (isGroup(entity)) return { id: entity.id, starts: entity.starts ?? [], traversable: [], group: true };
  if (!isIndividual(entity)) return undefined;
  return { id: entity.id, starts: entity.starts ?? [], traversable: entity.traversable ?? [] };
}

/** The routines of every Individual and Group in `cast`, then of every runtime character. */
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
  return withDerivedLocations(next);
}

/** A new Start at `place` with an empty schedule. */
const blankStart = (place: string, newId: () => string): EntityStart => ({ id: newId(), place, weight: 1, schedule: [] });

/** A copy of `entity` of `kind`, keeping every Start, row, weight, Strict flag and Traversable (Q135). Without
 *  Starts, an Individual takes one at its first place and a Group one per place. */
export function withKind(entity: Entity, kind: EntityKind, newId: () => string): Entity {
  if (entity.kind === kind) return entity;
  const places = entity.locations ?? [];
  const starts = entity.starts?.length ? entity.starts
    : (kind === "group" ? places : places.slice(0, 1)).map((place) => blankStart(place, newId));
  const { starts: _s, ...rest } = entity;
  return withDerivedLocations({
    ...rest, kind, ...(starts.length && { starts }),
    ...(kind === "individual" && { traversable: entity.traversable ?? "anywhere" }),
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

/** A Group carried into another world, its places renamed through `map` (source id → world id): the Starts whose
 *  place maps are kept with their rows remapped, and with none kept it takes one Start per mapped place. */
export function withGroupPlacesMapped(entity: Entity, map: Readonly<Record<string, string>>, newId: () => string): Entity {
  const placeOf = (start: EntityStart) => (start.place === PLAYER_START ? PLAYER_START : map[start.place]);
  const kept = (entity.starts ?? []).flatMap((start) => (placeOf(start)
    ? [{ ...start, place: placeOf(start), schedule: start.schedule.flatMap((row) => rowMapped(row, map) ?? []) }]
    : []));
  const starts = kept.length ? kept : [...new Set(Object.values(map))].map((place) => blankStart(place, newId));
  const { starts: _s, ...rest } = entity;
  return withDerivedLocations({ ...rest, ...(starts.length && { starts }) });
}

/** A Group with a new Start with no rows at `place`. */
export function withGroupStart(entity: Entity, place: string, newId: () => string): Entity {
  return withDerivedLocations({ ...entity, starts: [...(entity.starts ?? []), blankStart(place, newId)] });
}

/** Whether removing the Starts that begin at `place` leaves `entity` at least one. */
export const canRemoveGroupStartsAt = (entity: Pick<Entity, "starts">, place: string): boolean =>
  (entity.starts ?? []).some((start) => start.place !== place);

/** A Group without the Starts that begin at `place`, rows and all. The same entity when that would remove its
 *  last Start, or none begins there. */
export function withoutGroupStartsAt(entity: Entity, place: string): Entity {
  const starts = entity.starts ?? [];
  if (!starts.some((start) => start.place === place) || !canRemoveGroupStartsAt(entity, place)) return entity;
  return withDerivedLocations({ ...entity, starts: starts.filter((start) => start.place !== place) });
}

/** A Group without the Start `startId`, rows and all. The same entity when that is its last Start. */
export function withoutGroupStart(entity: Entity, startId: string): Entity {
  const starts = entity.starts ?? [];
  if (starts.length < 2 || !starts.some((start) => start.id === startId)) return entity;
  return withDerivedLocations({ ...entity, starts: starts.filter((start) => start.id !== startId) });
}

/** A Group with a Start added at `place`, or the Starts that begin there removed when there are any. */
export const toggleGroupStart = (entity: Entity, place: string, newId: () => string): Entity =>
  ((entity.starts ?? []).some((start) => start.place === place) ? withoutGroupStartsAt(entity, place) : withGroupStart(entity, place, newId));

/** An Individual with its first Start at `placeId`, made when it has none. */
export function withFirstStartPlace(entity: Entity, placeId: string, newId: () => string): Entity {
  const starts = entity.starts ?? [];
  const next = starts.length
    ? [withStartPlace(starts[0], placeId), ...starts.slice(1)]
    : [blankStart(placeId, newId)];
  return withDerivedLocations({ ...entity, starts: next });
}
