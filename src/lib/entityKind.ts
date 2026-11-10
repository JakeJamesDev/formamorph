import type { DiscoveredEntity, Entity, EntityKind, EntityStart, ScheduleRow } from "@/types";
import { placesOf, runtimeRoutine, type Routine } from "@/lib/positionEngine";

/**
 * An entity's kind and routine: a Group is at all its `locations` at once; an Individual is one body placed by
 * the position engine from its Starts. An Individual's `locations` is derived here and nowhere else.
 */

export const isGroup = (entity: Pick<Entity, "kind">): boolean => entity.kind === "group";
export const isIndividual = (entity: Pick<Entity, "kind">): boolean => entity.kind === "individual";

/** Every Start place and every row place of `starts`, deduped, in order. */
export const routinePlaces = (starts: readonly EntityStart[]): string[] =>
  [...new Set(starts.flatMap((start) => [start.place, ...start.schedule.flatMap((row) => placesOf(row.action))]))];

/** `entity` with an Individual's `locations` rebuilt from its Starts and rows. Any other entity as it is. */
export function withDerivedLocations(entity: Entity): Entity {
  if (!isIndividual(entity)) return entity;
  const places = routinePlaces(entity.starts ?? []);
  const same = places.length === (entity.locations?.length ?? 0) && places.every((id, i) => entity.locations?.[i] === id);
  if (same) return entity;
  if (places.length) return { ...entity, locations: places };
  const { locations: _none, ...rest } = entity;
  return rest;
}

/** The entity fields a routine is read from. */
export type RoutineEntity = Pick<Entity, "id" | "kind" | "starts" | "traversable">;

/** The engine's view of an Individual. Undefined for anything else. */
export function routineOf(entity: RoutineEntity): Routine | undefined {
  if (!isIndividual(entity)) return undefined;
  return { id: entity.id, starts: entity.starts ?? [], traversable: entity.traversable ?? [] };
}

/** The routines of every Individual in `cast`, then of every runtime character. */
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

/** A copy of `entity` of `kind`. A Group keeps its places and drops the routine; an Individual takes one Start
 *  at its first place, keeping a routine it already has. */
export function withKind(entity: Entity, kind: EntityKind, newId: () => string): Entity {
  if (entity.kind === kind) return entity;
  const { starts, traversable, ...rest } = entity;
  if (kind === "group") return { ...rest, kind };
  const first = entity.locations?.[0];
  const routine = starts?.length ? starts : first ? [blankStart(first, newId)] : [];
  return withDerivedLocations({
    ...rest, kind, ...(routine.length && { starts: routine }), traversable: traversable ?? "anywhere",
  });
}

/** An Individual with its first Start at `placeId`, made when it has none. */
export function withFirstStartPlace(entity: Entity, placeId: string, newId: () => string): Entity {
  const starts = entity.starts ?? [];
  const next = starts.length
    ? [{ ...starts[0], place: placeId }, ...starts.slice(1)]
    : [blankStart(placeId, newId)];
  return withDerivedLocations({ ...entity, starts: next });
}
