import { isGeneric, isUnique, startsOf } from '@/lib/entityKind';
import { presenceOf, type PlacesWorld } from '@/lib/entityPlaces';
import { startingLocationIds } from '@/lib/locationGraph';
import { chancePercent, rangeText } from '@/lib/routineTime';
import { PLAYER_START, type Entity, type ScheduleAction, type ScheduleRow } from '@/types';

/** One entity that can be at a location, with each reason, in the order the Presence tab reads them. */
export interface PresenceLine {
  entity: Entity;
  reasons: string[];
}

const ROW_VERB: Record<ScheduleAction['kind'], string> = { stay: 'stays', wander: 'wanders', patrol: 'patrols', away: 'is away' };

/** The row's time as the Routine tab words it: an All-day row beside timed rows is the rest of the day. */
export function timeText(row: ScheduleRow, schedule: readonly ScheduleRow[]): string {
  if (row.time !== 'allDay') return rangeText(row.time);
  return schedule.some((r) => r.time !== 'allDay') ? 'The rest of the day' : 'All day';
}

/** The Presence reasons of `entity` at `locationId` in words. A Generic entity has no chance and no led-to line. */
function reasonTexts(entity: Entity, locationId: string, world: PlacesWorld): string[] {
  const starts = startsOf(entity);
  // A Player's Starting Location Start is certain here only when it stands for one place.
  const playerStartCertain = startingLocationIds(world.locations).length === 1;
  const texts: string[] = [];
  for (const reason of presenceOf(entity, world).places.find((p) => p.place === locationId)?.reasons ?? []) {
    if (reason.kind === 'begins') {
      const certain = starts.filter((s) => reason.startIds.includes(s.id) && (s.place !== PLAYER_START || playerStartCertain));
      const chance = chancePercent(certain.reduce((sum, s) => sum + s.weight, 0), starts.map((s) => s.weight));
      texts.push(starts.length > 1 && isUnique(entity) && certain.length ? `begins here (${chance}%)` : 'begins here');
    } else if (reason.kind === 'row') {
      const schedule = starts.find((s) => s.id === reason.startId)?.schedule ?? [];
      const row = schedule.find((r) => r.id === reason.rowId);
      const text = row && `${ROW_VERB[row.action.kind]} here (${timeText(row, schedule)})`;
      if (text && !texts.includes(text)) texts.push(text);
    } else if (reason.kind === 'traversable') {
      texts.push('can be led here');
    }
  }
  return texts;
}

/**
 * Every entity of `entities` that can be at `locationId` by its Presence in `world`, in the order given, with the
 * reasons. An entity with no kind (the persona, the played entity) never counts.
 */
export function presenceLines(locationId: string, entities: readonly Entity[], world: PlacesWorld): PresenceLine[] {
  return entities.flatMap((entity) => {
    if (!(isGeneric(entity) || isUnique(entity))) return [];
    const reasons = reasonTexts(entity, locationId, world);
    return reasons.length ? [{ entity, reasons }] : [];
  });
}
