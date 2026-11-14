import { placesOf } from '@/lib/positionEngine';
import type { Entity, EntityStart, ScheduleRow } from '@/types';
import { startsOf } from '@/lib/entityKind';

/** Whether a routine row names the location. */
export const rowNamesLocation = (row: ScheduleRow, locationId: string): boolean => placesOf(row.action).includes(locationId);

/** Whether a Start names the location: it begins there, or one of its rows names it. */
export const startNamesLocation = (start: EntityStart, locationId: string): boolean =>
  start.place === locationId || start.schedule.some((row) => rowNamesLocation(row, locationId));

/** The Start the editor shows for the location: the one on show when it names the location, else the first that does. */
export function startToShowFor(entity: Entity, locationId: string, shownId: string | null): string | null {
  const starts = startsOf(entity);
  const shown = starts.find((s) => s.id === shownId) ?? starts[0];
  if (shown && startNamesLocation(shown, locationId)) return shown.id;
  return (starts.find((s) => startNamesLocation(s, locationId)) ?? starts[0])?.id ?? null;
}
