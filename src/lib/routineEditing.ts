import { withDerivedLocations } from '@/lib/entityKind';
import { placesOf } from '@/lib/positionEngine';
import { firstFreeRange, ONE_DAYPART_MINUTES } from '@/lib/routineTime';
import type { Entity, EntityStart, ScheduleAction, ScheduleRow } from '@/types';

// The Routine tab's writes to an Individual. Each returns the whole entity with its `locations` rebuilt.

export type ActionKind = ScheduleAction['kind'];

/** How long a new Patrol stop idles, in minutes. */
export const NEW_STOP_IDLE = 60;

const write = (entity: Entity, starts: EntityStart[]): Entity => withDerivedLocations({ ...entity, starts });

export const withStart = (entity: Entity, startId: string, change: (start: EntityStart) => EntityStart): Entity =>
  write(entity, (entity.starts ?? []).map((s) => (s.id === startId ? change(s) : s)));

export const withRow = (entity: Entity, startId: string, rowId: string, change: (row: ScheduleRow) => ScheduleRow): Entity =>
  withStart(entity, startId, (s) => ({ ...s, schedule: s.schedule.map((r) => (r.id === rowId ? change(r) : r)) }));

export const withoutRow = (entity: Entity, startId: string, rowId: string): Entity =>
  withStart(entity, startId, (s) => ({ ...s, schedule: s.schedule.filter((r) => r.id !== rowId) }));

/** A new action of `kind` at `place`. */
export function newAction(kind: ActionKind, place: string): ScheduleAction {
  if (kind === 'stay') return { kind, place };
  if (kind === 'wander') return { kind, places: [{ place, weight: 1 }], idle: ONE_DAYPART_MINUTES };
  return { kind, stops: [{ place, idle: NEW_STOP_IDLE }] };
}

/** `action` turned into `kind`, keeping its places in order. */
export function switchAction(action: ScheduleAction, kind: ActionKind, startPlace: string): ScheduleAction {
  if (action.kind === kind) return action;
  const places = placesOf(action);
  const first = places[0] ?? startPlace;
  if (kind === 'stay') return { kind, place: first };
  if (kind === 'wander') {
    const idle = action.kind === 'patrol' ? action.stops[0]?.idle ?? ONE_DAYPART_MINUTES : ONE_DAYPART_MINUTES;
    return { kind, places: [...new Set(places.length ? places : [first])].map((place) => ({ place, weight: 1 })), idle };
  }
  const idle = action.kind === 'wander' ? action.idle : NEW_STOP_IDLE;
  return { kind, stops: (places.length ? places : [first]).map((place) => ({ place, idle })) };
}

/** `entity` with a new timed row of `kind` in the first free time of the Start. The same entity when the day is full. */
export function withNewRow(entity: Entity, startId: string, kind: ActionKind, newId: () => string): Entity {
  const start = entity.starts?.find((s) => s.id === startId);
  const time = start && firstFreeRange(start.schedule);
  if (!start || !time) return entity;
  return withStart(entity, startId, (s) => ({ ...s, schedule: [...s.schedule, { id: newId(), time, action: newAction(kind, s.place) }] }));
}

/** `entity` with a new Stay at the Start's location over exactly `time`, and that row's id. */
export function withRowAt(entity: Entity, startId: string, time: ScheduleRow['time'], newId: () => string): { entity: Entity; rowId: string } {
  const rowId = newId();
  const next = withStart(entity, startId, (s) => ({ ...s, schedule: [...s.schedule, { id: rowId, time, action: newAction('stay', s.place) }] }));
  return { entity: next, rowId };
}

/** `entity` with its free time made a locked All-day Stay at the Start's location, and that row's id. */
export function withLockedRest(entity: Entity, startId: string, newId: () => string): { entity: Entity; rowId: string } {
  const rowId = newId();
  const next = withStart(entity, startId, (s) => ({
    ...s, schedule: [...s.schedule, { id: rowId, time: 'allDay' as const, strict: true, action: newAction('stay', s.place) }],
  }));
  return { entity: next, rowId };
}

/** `entity` with a new empty Start at `place`. */
export const withNewStart = (entity: Entity, place: string, newId: () => string): Entity =>
  write(entity, [...(entity.starts ?? []), { id: newId(), place, weight: 1, schedule: [] }]);

/** `entity` without the Start. The last Start stays. */
export function withoutStart(entity: Entity, startId: string): Entity {
  const starts = entity.starts ?? [];
  return starts.length > 1 ? write(entity, starts.filter((s) => s.id !== startId)) : entity;
}
