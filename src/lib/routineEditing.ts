import { placesOf } from '@/lib/positionEngine';
import { firstFreeRange, ONE_DAYPART_MINUTES } from '@/lib/routineTime';
import { PLAYER_START, type Entity, type EntityStart, type ScheduleAction, type ScheduleRow } from '@/types';
import { routineOfStart, routinesOf, withRoutineStartAdded, withRoutineStarts, withoutRoutineStart } from '@/lib/routineList';

// The Routine tab's writes to the Starts and rows of an entity's Routines. Each returns the whole entity.

export type ActionKind = ScheduleAction['kind'];

/** Each schedule action's name in the editor. */
export const ACTION_LABELS: Record<ActionKind, string> = { stay: 'Stay', wander: 'Wander', patrol: 'Patrol', away: 'Away' };

/** A schedule action at one or more places: every kind but Away. */
export type PlacedAction = Exclude<ScheduleAction, { kind: 'away' }>;
export type PlacedActionKind = PlacedAction['kind'];

/** Whether `action` puts the entity at a place. */
export const isPlaced = (action: ScheduleAction): action is PlacedAction => action.kind !== 'away';

/** How long a new Patrol stop idles, in minutes. */
export const NEW_STOP_IDLE = 60;

/** The Start, from whichever Routine holds it. */
const startOf = (entity: Entity, startId: string): EntityStart | undefined =>
  routineOfStart(entity, startId)?.starts.find((s) => s.id === startId);

/** `entity` with the Start replaced by `change` of it, in whichever Routine holds it. */
export function withStart(entity: Entity, startId: string, change: (start: EntityStart) => EntityStart): Entity {
  const routine = routineOfStart(entity, startId);
  return routine ? withRoutineStarts(entity, routine.id, routine.starts.map((s) => (s.id === startId ? change(s) : s))) : entity;
}

export const withRow = (entity: Entity, startId: string, rowId: string, change: (row: ScheduleRow) => ScheduleRow): Entity =>
  withStart(entity, startId, (s) => ({ ...s, schedule: s.schedule.map((r) => (r.id === rowId ? change(r) : r)) }));

export const withoutRow = (entity: Entity, startId: string, rowId: string): Entity =>
  withStart(entity, startId, (s) => ({ ...s, schedule: s.schedule.filter((r) => r.id !== rowId) }));

/** A new action of `kind` at `place`. */
export function newAction(kind: ActionKind, place: string): ScheduleAction {
  if (kind === 'away') return { kind };
  if (kind === 'stay') return { kind, place };
  if (kind === 'wander') return { kind, places: [{ place, weight: 1 }], idle: ONE_DAYPART_MINUTES };
  return { kind, stops: [{ place, idle: NEW_STOP_IDLE }] };
}

/** `action` turned into `kind`, keeping its places in order. */
export function switchAction(action: ScheduleAction, kind: ActionKind, startPlace: string): ScheduleAction {
  if (action.kind === kind) return action;
  if (kind === 'away') return { kind };
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

/** Where a new row of `start` begins: its location, or `firstPlace` at `PLAYER_START`, since a row needs a real one. */
export const rowPlaceOf = (start: Pick<EntityStart, 'place'>, firstPlace: string | undefined): string | undefined =>
  (start.place === PLAYER_START ? firstPlace : start.place);

/** `entity` with a new timed row of `kind` in the first free time of the Start. The same entity when the day is full. */
export function withNewRow(entity: Entity, startId: string, kind: ActionKind, newId: () => string, firstPlace?: string): Entity {
  const start = startOf(entity, startId);
  const time = start && firstFreeRange(start.schedule);
  const place = start && rowPlaceOf(start, firstPlace);
  if (!start || !time || (kind !== 'away' && !place)) return entity;
  return withStart(entity, startId, (s) => ({ ...s, schedule: [...s.schedule, { id: newId(), time, action: newAction(kind, place ?? '') }] }));
}

/** `entity` with a new row at the Start's location, and that row's id. The same entity and no id without a place. */
function withPlacedRow(
  entity: Entity, startId: string, newId: () => string, firstPlace: string | undefined, make: (place: string) => Omit<ScheduleRow, 'id'>,
): { entity: Entity; rowId: string | null } {
  const start = startOf(entity, startId);
  const place = start && rowPlaceOf(start, firstPlace);
  if (!place) return { entity, rowId: null };
  const rowId = newId();
  return { entity: withStart(entity, startId, (s) => ({ ...s, schedule: [...s.schedule, { id: rowId, ...make(place) }] })), rowId };
}

/** `entity` with a new Stay at the Start's location over exactly `time`, and that row's id. */
export const withRowAt = (entity: Entity, startId: string, time: ScheduleRow['time'], newId: () => string, firstPlace?: string) =>
  withPlacedRow(entity, startId, newId, firstPlace, (place) => ({ time, action: newAction('stay', place) }));

/** `entity` with its free time made a locked All-day Stay at the Start's location, and that row's id. */
export const withLockedRest = (entity: Entity, startId: string, newId: () => string, firstPlace?: string) =>
  withPlacedRow(entity, startId, newId, firstPlace, (place) => ({ time: 'allDay', strict: true, action: newAction('stay', place) }));

/** `entity` with a new empty Start at `place` in its first Routine. */
export const withNewStart = (entity: Entity, place: string, newId: () => string): Entity =>
  withRoutineStartAdded(entity, routinesOf(entity)[0].id, place, newId);

/** `entity` without the Start. The last Start of its Routine stays. */
export const withoutStart = (entity: Entity, startId: string): Entity => withoutRoutineStart(entity, startId);
