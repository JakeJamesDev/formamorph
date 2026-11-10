import { DAYPART_START_MINUTE, MINUTES_PER_DAY } from '@/lib/gameClock';
import type { Daypart, ScheduleRange, ScheduleRow } from '@/types';

// A routine's times as the editor reads and writes them. Times are minutes from midnight; a range whose end is
// before its start wraps past midnight, and a full day is never a timed range.

/** The dayparts in the order a day runs through them, from dawn. */
export const CLOCK_ORDER: readonly Daypart[] = ['dawn', 'morning', 'midday', 'afternoon', 'evening', 'night'];

export const DAYPART_LABELS: Record<Daypart, string> = {
  night: 'Night', dawn: 'Dawn', morning: 'Morning', midday: 'Midday', afternoon: 'Afternoon', evening: 'Evening',
};

/** An idle that lasts "one daypart" (Q99): a sixth of the day, since real dayparts are uneven. */
export const ONE_DAYPART_MINUTES = 240;

export const daypartStart = (d: Daypart): number => DAYPART_START_MINUTE[d];
export const daypartEnd = (d: Daypart): number => DAYPART_START_MINUTE[CLOCK_ORDER[(CLOCK_ORDER.indexOf(d) + 1) % CLOCK_ORDER.length]];

const dayMinute = (m: number) => ((m % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;

/** The daypart a stored edge sits on, within a minute; null off every edge. */
export function edgeDaypart(minute: number, edge: 'start' | 'end'): Daypart | null {
  for (const d of CLOCK_ORDER) {
    const at = edge === 'start' ? daypartStart(d) : daypartEnd(d);
    if (Math.abs(at - minute) <= 1) return d;
  }
  return null;
}

/** Whether both ends of `range` sit on daypart edges, so the editor shows it as dayparts. */
export const onDaypartEdges = (range: ScheduleRange): boolean =>
  edgeDaypart(range.start, 'start') !== null && edgeDaypart(range.end, 'end') !== null;

/** The daypart that holds `minute`. */
function daypartHolding(minute: number): Daypart {
  const m = dayMinute(minute);
  return CLOCK_ORDER.find((d) => {
    const s = daypartStart(d); const e = daypartEnd(d);
    return s < e ? m >= s && m < e : m >= s || m < e;
  }) ?? 'night';
}

/** `range` widened to the dayparts that cover it (Q9), and whether that moved an end. */
export function snapToDayparts(range: ScheduleRange): { range: ScheduleRange; snapped: boolean } {
  const start = daypartStart(daypartHolding(range.start));
  const end = daypartEnd(daypartHolding(range.end - 1));
  return { range: { start, end }, snapped: start !== range.start || end !== range.end };
}

const pad = (n: number) => String(n).padStart(2, '0');
export const hhmm = (minute: number): string => `${pad(Math.floor(dayMinute(minute) / 60))}:${pad(dayMinute(minute) % 60)}`;
export function parseHhmm(value: string): number {
  const [h = 0, m = 0] = value.split(':').map(Number);
  return dayMinute((h || 0) * 60 + (m || 0));
}

/** A range in words: dayparts when both ends sit on daypart edges and `asHours` is off, else clock times. */
export function rangeText(range: ScheduleRange, asHours = false): string {
  const a = edgeDaypart(range.start, 'start'); const b = edgeDaypart(range.end, 'end');
  if (!asHours && a && b) return a === b ? DAYPART_LABELS[a] : `${DAYPART_LABELS[a]} – ${DAYPART_LABELS[b]}`;
  return `${hhmm(range.start)} – ${hhmm(range.end)}`;
}

/** Each minute of the day, marked when one of `rows`' timed ranges covers it. All-day rows never mark. */
export function timedCover(rows: readonly ScheduleRow[]): boolean[] {
  const covered = new Array<boolean>(MINUTES_PER_DAY).fill(false);
  for (const row of rows) {
    if (row.time === 'allDay') continue;
    for (let m = row.time.start; m !== row.time.end; m = (m + 1) % MINUTES_PER_DAY) covered[m] = true;
  }
  return covered;
}

/** Whether `range` is empty or any of its minutes is in `covered`. */
export function blocked(covered: readonly boolean[], range: ScheduleRange): boolean {
  if (dayMinute(range.start) === dayMinute(range.end)) return true;
  for (let m = dayMinute(range.start); m !== dayMinute(range.end); m = (m + 1) % MINUTES_PER_DAY) if (covered[m]) return true;
  return false;
}

/** A stretch no row covers: `end` is past `start`, up to a whole day. */
export type FreeRange = { start: number; end: number; wholeDay?: true };

/** The stretches of the day no row covers, in clock order. None when an All-day row is there. */
export function freeRanges(rows: readonly ScheduleRow[]): FreeRange[] {
  if (rows.some((r) => r.time === 'allDay')) return [];
  const covered = timedCover(rows);
  const anchor = covered.indexOf(true);
  if (anchor < 0) return [{ start: 0, end: MINUTES_PER_DAY, wholeDay: true }];
  const out: FreeRange[] = [];
  let from: number | null = null;
  for (let i = 1; i <= MINUTES_PER_DAY; i++) {
    const m = (anchor + i) % MINUTES_PER_DAY;
    if (!covered[m] && from === null) from = m;
    if (covered[m] && from !== null) { out.push({ start: from, end: m }); from = null; }
  }
  return out.sort((a, b) => a.start - b.start);
}

/** Whether the timed rows cover every minute, so no timed row fits. */
export const dayFull = (rows: readonly ScheduleRow[]): boolean => timedCover(rows).every(Boolean);

/** Where a new timed row goes: the first free stretch between timed rows, or Morning – Afternoon on an open day.
 *  Null when the timed rows fill the day. */
export function firstFreeRange(rows: readonly ScheduleRow[]): ScheduleRange | null {
  const free = freeRanges(rows.filter((r) => r.time !== 'allDay'));
  if (free.length === 0) return null;
  if (free[0].wholeDay) return { start: daypartStart('morning'), end: daypartEnd('afternoon') };
  return { start: free[0].start, end: free[0].end % MINUTES_PER_DAY };
}

/** Sort key for clock order: the All-day row first, then timed rows by their start. */
export const rowClockKey = (row: ScheduleRow): number => (row.time === 'allDay' ? -1 : row.time.start);

export type IdleUnit = 'minutes' | 'hours' | 'dayparts';

/** An idle in minutes as the number and unit the editor shows. */
export function idleParts(minutes: number): { amount: number; unit: IdleUnit } {
  if (minutes % ONE_DAYPART_MINUTES === 0) return { amount: minutes / ONE_DAYPART_MINUTES, unit: 'dayparts' };
  if (minutes % 60 === 0) return { amount: minutes / 60, unit: 'hours' };
  return { amount: minutes, unit: 'minutes' };
}

export const idleMinutes = (amount: number, unit: IdleUnit): number =>
  Math.max(1, Math.round(amount)) * (unit === 'dayparts' ? ONE_DAYPART_MINUTES : unit === 'hours' ? 60 : 1);

const UNIT_WORDS: Record<IdleUnit, [string, string]> = {
  minutes: ['minute', 'minutes'], hours: ['hour', 'hours'], dayparts: ['daypart', 'dayparts'],
};

/** An idle in words: "1 daypart", "2 hours", "30 minutes". */
export function idleText(minutes: number): string {
  const { amount, unit } = idleParts(minutes);
  return `${amount} ${UNIT_WORDS[unit][amount === 1 ? 0 : 1]}`;
}

/** `weight` as a whole percent of `all`. */
export function chancePercent(weight: number, all: readonly number[]): number {
  const total = all.reduce((a, b) => a + b, 0);
  return total > 0 ? Math.round((weight / total) * 100) : 0;
}

/** A typed weight as a positive integer. */
export const toWeight = (value: string): number => Math.max(1, Math.round(Number(value) || 1));
