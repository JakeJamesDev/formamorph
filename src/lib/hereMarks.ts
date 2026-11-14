import { placesOf } from '@/lib/positionEngine';
import type { Entity, EntityStart, ScheduleRow } from '@/types';
import { everyStart } from '@/lib/entityKind';
import { shownRoutine, shownStart, type ShownRoutineAt } from '@/lib/routineList';

/** Whether a routine row names the location. */
export const rowNamesLocation = (row: ScheduleRow, locationId: string): boolean => placesOf(row.action).includes(locationId);

/** Whether a Start names the location: it begins there, or one of its rows names it. */
export const startNamesLocation = (start: EntityStart, locationId: string): boolean =>
  start.place === locationId || start.schedule.some((row) => rowNamesLocation(row, locationId));

/** The Start the editor shows for the location: the one on show when it names the location, else the first of the
 *  shown Routine that does, else the first of any Routine, else the shown Routine's first. */
export function startToShowFor(entity: Entity, locationId: string, at: ShownRoutineAt): string | null {
  const shown = shownStart(entity, at);
  if (shown && startNamesLocation(shown, locationId)) return shown.id;
  const names = (s: EntityStart) => startNamesLocation(s, locationId);
  return (shownRoutine(entity, at).starts.find(names) ?? everyStart(entity).find(names) ?? shownRoutine(entity, at).starts[0])?.id ?? null;
}
