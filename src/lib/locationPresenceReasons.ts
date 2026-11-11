import { isGeneric, isUnique } from '@/lib/entityKind';
import { chancePercent, rangeText } from '@/lib/routineTime';
import type { Entity, ScheduleAction, ScheduleRow } from '@/types';

/** One entity that can be at a location, with each reason, in the order the Presence tab reads them. */
export interface PresenceLine {
  entity: Entity;
  reasons: string[];
}

const ROW_VERB: Record<ScheduleAction['kind'], string> = { stay: 'stays', wander: 'wanders', patrol: 'patrols' };

const rowPlaces = (action: ScheduleAction): string[] =>
  action.kind === 'stay' ? [action.place]
    : action.kind === 'wander' ? action.places.map((p) => p.place)
      : action.stops.map((s) => s.place);

/** The row's time as the Routine tab words it: an All-day row beside timed rows is the rest of the day. */
export function timeText(row: ScheduleRow, schedule: readonly ScheduleRow[]): string {
  if (row.time !== 'allDay') return rangeText(row.time);
  return schedule.some((r) => r.time !== 'allDay') ? 'The rest of the day' : 'All day';
}

const rowReason = (row: ScheduleRow, schedule: readonly ScheduleRow[]): string =>
  `${ROW_VERB[row.action.kind]} here (${timeText(row, schedule)})`;

/** Why an entity can be at `locationId`, from its Starts and rows. A Generic entity has no chance and no led-to line. */
function routineReasons(entity: Entity, locationId: string): string[] {
  const starts = entity.starts ?? [];
  const reasons: string[] = [];
  const here = starts.filter((s) => s.place === locationId);
  if (here.length) {
    const chance = chancePercent(here.reduce((sum, s) => sum + s.weight, 0), starts.map((s) => s.weight));
    reasons.push(starts.length > 1 && isUnique(entity) ? `begins here (${chance}%)` : 'begins here');
  }
  for (const start of starts) {
    for (const row of start.schedule) {
      if (!rowPlaces(row.action).includes(locationId)) continue;
      const reason = rowReason(row, start.schedule);
      if (!reasons.includes(reason)) reasons.push(reason);
    }
  }
  if (!isGeneric(entity) && Array.isArray(entity.traversable) && entity.traversable.includes(locationId)) reasons.push('can be led here');
  return reasons;
}

/**
 * Every entity of `entities` that can be at `locationId`, in the order given, with the reasons.
 * An entity with no kind (the persona, the played entity) never counts.
 */
export function presenceLines(locationId: string, entities: readonly Entity[]): PresenceLine[] {
  return entities.flatMap((entity) => {
    if (!(isGeneric(entity) || isUnique(entity))) return [];
    const reasons = routineReasons(entity, locationId);
    return reasons.length ? [{ entity, reasons }] : [];
  });
}
