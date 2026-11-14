import { isGeneric, toggleGenericStart, traversableOf, startsOf, withFirstTraversable } from '@/lib/entityKind';
import { placesOf, startReach, type PlaceGraph } from '@/lib/positionEngine';
import { NEW_STOP_IDLE, withRow } from '@/lib/routineEditing';
import type { RoutineSelection } from '@/lib/routineSelection';
import { rangeText } from '@/lib/routineTime';
import { randomUUID } from '@/lib/uuid';
import type { Entity, EntityStart, PatrolStop, ScheduleAction, ScheduleRow } from '@/types';

// What a click or a drag on the canvas does to an entity's routine.

/** A map edit: the whole entity after it, and the undo label. */
export interface RoutineMapEdit {
  entity: Entity;
  label: string;
}

interface Target {
  start: EntityStart;
  row: ScheduleRow | null;
}

type Selected = Target & { row: ScheduleRow };

function targetOf(entity: Entity, selection: RoutineSelection): Target | null {
  if (entity.customPersona) return null;
  const starts = startsOf(entity);
  const start = starts.find((s) => s.id === selection.startId) ?? starts[0];
  if (!start) return null;
  return { start, row: start.schedule.find((r) => r.id === selection.rowId) ?? null };
}

const selectedOf = (target: Target | null): Selected | null =>
  target?.row ? { start: target.start, row: target.row } : null;

/** The selected row's action, whether `place` is connected to its Start, and a writer for the row's new action. */
function rowEdit(entity: Entity, { start, row }: Selected, place: string, graph: PlaceGraph) {
  return {
    action: row.action,
    reaches: startReach(start.place, graph).has(place),
    write: (action: ScheduleAction): RoutineMapEdit => ({
      entity: withRow(entity, start.id, row.id, (r) => ({ ...r, action })),
      label: 'Edit Routine',
    }),
  };
}

/** `stops` with a new stop at `place` after index `after`, or null when a stop would follow its own place.
 *  The loop from the last stop back to stop 1 counts as a step. */
function withStopAfter(stops: readonly PatrolStop[], after: number, place: string): PatrolStop[] | null {
  if (stops.length > 0 && (stops[after].place === place || stops[(after + 1) % stops.length].place === place)) return null;
  return [...stops.slice(0, after + 1), { place, idle: NEW_STOP_IDLE }, ...stops.slice(after + 1)];
}

/**
 * A click on `place`. With a row selected: Stay moves there, Wander adds or removes it, Patrol adds the next stop
 * or removes the last one. With none: a Generic entity adds a Start there or removes the ones that begin there, and a
 * Unique entity adds it to or removes it from the Can Also Go list. Null when nothing changes.
 */
export function routineMapClick(entity: Entity, selection: RoutineSelection, place: string, graph: PlaceGraph): RoutineMapEdit | null {
  const target = targetOf(entity, selection);
  const selected = selectedOf(target);
  if (!selected && isGeneric(entity)) {
    const next = toggleGenericStart(entity, place, randomUUID);
    return next === entity ? null : { entity: next, label: 'Change Locations' };
  }
  if (!target) return null;
  if (!selected) {
    const list = traversableOf(entity);
    if (list === 'anywhere') return null;
    const traversable = list.includes(place) ? list.filter((p) => p !== place) : [...list, place];
    return { entity: withFirstTraversable(entity, traversable), label: 'Change Can Also Go' };
  }
  const { action, reaches, write } = rowEdit(entity, selected, place, graph);
  if (!reaches) return null;
  if (action.kind === 'stay') return action.place === place ? null : write({ ...action, place });
  if (action.kind === 'wander') {
    const places = action.places.some((p) => p.place === place)
      ? action.places.filter((p) => p.place !== place)
      : [...action.places, { place, weight: 1 }];
    return write({ ...action, places });
  }
  if (action.stops.at(-1)?.place === place) return write({ ...action, stops: action.stops.slice(0, -1) });
  const stops = withStopAfter(action.stops, action.stops.length - 1, place);
  return stops ? write({ ...action, stops }) : null;
}

/** Where a drag may start: the places of the selected Wander or Patrol row. */
export function routineDragSources(entity: Entity, selection: RoutineSelection): Set<string> {
  const action = targetOf(entity, selection)?.row?.action;
  return new Set(action && action.kind !== 'stay' ? placesOf(action) : []);
}

/** The drag from `from` to `to` as an edit, or null when the drop is refused. */
export function routineMapDrag(entity: Entity, selection: RoutineSelection, from: string, to: string, graph: PlaceGraph): RoutineMapEdit | null {
  const selected = selectedOf(targetOf(entity, selection));
  if (!selected) return null;
  const { action, reaches, write } = rowEdit(entity, selected, to, graph);
  if (!reaches) return null;
  if (action.kind === 'wander') {
    if (!action.places.some((p) => p.place === from) || action.places.some((p) => p.place === to)) return null;
    return write({ ...action, places: [...action.places, { place: to, weight: 1 }] });
  }
  if (action.kind !== 'patrol') return null;
  const fromIndex = action.stops.map((s) => s.place).lastIndexOf(from);
  if (fromIndex < 0) return null;
  const stops = withStopAfter(action.stops, fromIndex, to);
  return stops ? write({ ...action, stops }) : null;
}

const ACTION_NAMES = { stay: 'Stay', wander: 'Wander', patrol: 'Patrol' } as const;

function timeOf(row: ScheduleRow, start: EntityStart): string {
  if (row.time !== 'allDay') return rangeText(row.time);
  return start.schedule.some((r) => r.time !== 'allDay') ? 'the rest of the day' : 'all day';
}

/** The status line over the map: the selected row, and what a click or a drag does right now. */
export interface RoutineMapStatus {
  /** The selected row's action and time. */
  row?: string;
  text: string;
}

/** The status line over a map that only shows the routine: the selected row, or whose routine it is. */
export function routineShownStatus(entity: Entity, selection: RoutineSelection, label: string): RoutineMapStatus {
  const { row } = routineMapStatus(entity, selection);
  return row ? { row, text: 'Locations of this row' } : { text: `Routine of ${label}` };
}

export function routineMapStatus(entity: Entity, selection: RoutineSelection): RoutineMapStatus {
  const target = targetOf(entity, selection);
  const selected = selectedOf(target);
  if (!selected && isGeneric(entity)) return { text: 'Click a location to add or remove it' };
  if (!target) return { text: 'Add a Start to give this entity a routine' };
  if (!selected) {
    return traversableOf(entity) === 'anywhere'
      ? { text: 'Select a row to edit its locations here' }
      : { text: 'Click a location to add or remove it from "Can Also Go"' };
  }
  const { action } = selected.row;
  const row = `${ACTION_NAMES[action.kind]}, ${timeOf(selected.row, selected.start)}`;
  if (action.kind === 'stay') return { row, text: 'Click a location to stay there' };
  if (action.kind === 'wander') {
    return action.places.length === 0
      ? { row, text: 'Click a location to add it' }
      : { row, text: 'Click a location to add or remove it. Drag from one to add another.' };
  }
  return action.stops.length === 0
    ? { row, text: 'Click the first stop' }
    : { row, text: 'Click the next stop, or the last stop to remove it. Drag from a stop to add one after it.' };
}
