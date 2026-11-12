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

export type RangeEdge = 'start' | 'end';

/** The clock minute at the strip's left edge. The strip runs Dawn to Dawn, so Night is one stretch at its right end
 *  and no daypart wraps. */
export const STRIP_START = daypartStart('dawn');

/** A clock minute as a position on the strip, 0 at Dawn. */
export const toStrip = (minute: number): number => dayMinute(minute - STRIP_START);
const fromStrip = (position: number): number => dayMinute(position + STRIP_START);

/** Where each end of `range` sits on the 0–1440 strip. An end at the strip's first minute sits at the right edge. */
export const edgePositions = (range: ScheduleRange): { start: number; end: number } =>
  ({ start: toStrip(range.start), end: toStrip(range.end) || MINUTES_PER_DAY });

/** The pieces of `range` on the strip: two when it wraps past the strip's end. */
export function strip(range: ScheduleRange): [number, number][] {
  const { start, end } = edgePositions(range);
  return start < end ? [[start, end]] : [[start, MINUTES_PER_DAY], [0, end]];
}

/** The strip positions an edge snaps to, both ends of the strip included: daypart edges, or whole hours. */
function snapPoints(asHours: boolean): number[] {
  const minutes = asHours ? Array.from({ length: 24 }, (_, h) => h * 60) : CLOCK_ORDER.map(daypartStart);
  return [...new Set([...minutes.map(toStrip), MINUTES_PER_DAY])].sort((a, b) => a - b);
}

type RowTime = ScheduleRow['time'];

/** An All-day row as a range: the whole strip, both ends at its first minute. */
const WHOLE_STRIP: ScheduleRange = { start: STRIP_START, end: STRIP_START };
const asRange = (time: RowTime): ScheduleRange => (time === 'allDay' ? WHOLE_STRIP : time);

/** Where each end of a row's time sits on the strip. An All-day row holds both ends of the strip. */
export const timePositions = (time: RowTime): { start: number; end: number } =>
  (time === 'allDay' ? { start: 0, end: MINUTES_PER_DAY } : edgePositions(time));

/**
 * One `edge` on a line that runs a day past each end of the strip, so an edge can go round the strip's end: where it
 * sits, the span it may take (never at or past its row's other end, a full day at most), and `target` on that line.
 *
 * Only an edge on the strip's end, or one already round it, goes round. Any other edge stops at the strip's end.
 */
function edgeLine(time: RowTime, edge: RangeEdge, target: number): { from: number; lo: number; hi: number; target: number } {
  const { start, end } = timePositions(time);
  const wraps = start > end;
  if (edge === 'end') {
    const round = wraps || end === MINUTES_PER_DAY;
    return {
      from: wraps ? end + MINUTES_PER_DAY : end, lo: start + 1, hi: round ? start + MINUTES_PER_DAY : MINUTES_PER_DAY,
      target: round && target <= start ? target + MINUTES_PER_DAY : target,
    };
  }
  const round = wraps || start === 0;
  return {
    from: wraps ? start - MINUTES_PER_DAY : start, lo: round ? end - MINUTES_PER_DAY : 0, hi: end - 1,
    target: round && target >= end ? target - MINUTES_PER_DAY : target,
  };
}

/**
 * A row's time with `edge` moved toward strip position `target`, snapped by the row's format. The edge walks one snap
 * point at a time and stops at the last one that leaves the row clear of `covered`.
 *
 * An edge on the strip's end goes round to its start when the pointer is there, so a row can run across Dawn.
 *
 * A row stretched over the whole strip becomes All Day when `canFill` allows it, and an All-day row dragged inward
 * becomes a timed one: a timed range cannot say "every hour", since its two ends would be the same minute.
 */
export function moveEdge(time: RowTime, edge: RangeEdge, target: number, asHours: boolean, covered: readonly boolean[], canFill = false): RowTime {
  const line = edgeLine(time, edge, target);
  const points = linePoints(line, asHours);
  if (points.length === 0) return time;
  const goal = points.reduce((best, p) => (Math.abs(p - line.target) < Math.abs(best - line.target) ? p : best));
  return walkEdge(time, edge, line.from, goal, points, covered, canFill);
}

/** The snap points an edge may take on its line, in order. */
function linePoints(line: { lo: number; hi: number }, asHours: boolean): number[] {
  return [-MINUTES_PER_DAY, 0, MINUTES_PER_DAY]
    .flatMap((turn) => snapPoints(asHours).map((p) => p + turn))
    .filter((p, i, all) => all.indexOf(p) === i && p >= line.lo && p <= line.hi)
    .sort((a, b) => a - b);
}

function walkEdge(time: RowTime, edge: RangeEdge, from: number, goal: number, points: readonly number[], covered: readonly boolean[], canFill: boolean): RowTime {
  const path = goal > from ? points.filter((p) => p > from && p <= goal) : points.filter((p) => p < from && p >= goal).reverse();
  const range = asRange(time);
  let out = time;
  for (const p of path) {
    const next = edge === 'start' ? { start: fromStrip(p), end: range.end } : { start: range.start, end: fromStrip(p) };
    if (next.start === next.end) {
      if (canFill && !covered.some(Boolean)) out = 'allDay';
      break;
    }
    if (blocked(covered, next)) break;
    out = next;
  }
  return out;
}

/** A row's time with `edge` moved one snap point left (-1) or right (1), when that point is free. */
export function stepEdge(time: RowTime, edge: RangeEdge, direction: -1 | 1, asHours: boolean, covered: readonly boolean[], canFill = false): RowTime {
  const line = edgeLine(time, edge, 0);
  const points = linePoints(line, asHours);
  const next = direction > 0 ? points.find((p) => p > line.from) : [...points].reverse().find((p) => p < line.from);
  return next === undefined ? time : walkEdge(time, edge, line.from, next, points, covered, canFill);
}

/** `range` moved whole to each place its format allows, with how far each sits from where it is now. A row on daypart
 *  edges keeps its count of dayparts; any other row keeps its length and moves by whole hours. */
function shifts(range: ScheduleRange, asHours: boolean): { offset: number; range: ScheduleRange }[] {
  const a = asHours ? null : edgeDaypart(range.start, 'start');
  const b = asHours ? null : edgeDaypart(range.end, 'end');
  if (!a || !b) {
    return Array.from({ length: 47 }, (_, i) => (i - 23) * 60)
      .map((offset) => ({ offset, range: { start: dayMinute(range.start + offset), end: dayMinute(range.end + offset) } }));
  }
  const count = CLOCK_ORDER.length;
  const part = (index: number) => CLOCK_ORDER[((index % count) + count) % count];
  const length = (d: Daypart) => dayMinute(daypartEnd(d) - daypartStart(d));
  const first = CLOCK_ORDER.indexOf(a); const last = CLOCK_ORDER.indexOf(b);
  const out = [{ offset: 0, range }];
  let forward = 0; let back = 0;
  for (let k = 1; k < count; k++) {
    forward += length(part(first + k - 1));
    back -= length(part(first - k));
    out.push({ offset: forward, range: { start: daypartStart(part(first + k)), end: daypartEnd(part(last + k)) } });
    out.push({ offset: back, range: { start: daypartStart(part(first - k)), end: daypartEnd(part(last - k)) } });
  }
  return out;
}

/** `range` moved whole by about `delta` minutes: the nearest place that stays clear of `covered`. */
export function moveRange(range: ScheduleRange, delta: number, asHours: boolean, covered: readonly boolean[]): ScheduleRange {
  const open = shifts(range, asHours).filter((s) => s.offset === 0 || !blocked(covered, s.range));
  return open.reduce((best, s) => (Math.abs(s.offset - delta) < Math.abs(best.offset - delta) ? s : best)).range;
}

/** `range` moved whole to the nearest clear place earlier (-1) or later (1). */
export function stepRange(range: ScheduleRange, direction: -1 | 1, asHours: boolean, covered: readonly boolean[]): ScheduleRange {
  const open = shifts(range, asHours).filter((s) => s.offset * direction > 0 && !blocked(covered, s.range));
  return open.length ? open.reduce((best, s) => (Math.abs(s.offset) < Math.abs(best.offset) ? s : best)).range : range;
}

/** An edge's position in the row's own format: "From Morning", "Through Evening", "To 14:00". */
export function edgeText(minute: number, edge: RangeEdge, asHours: boolean): string {
  const d = asHours ? null : edgeDaypart(minute, edge);
  if (d) return `${edge === 'start' ? 'From' : 'Through'} ${DAYPART_LABELS[d]}`;
  return `${edge === 'start' ? 'From' : 'To'} ${hhmm(minute)}`;
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
  minutes: ['minute', 'minutes'], hours: ['hour', 'hours'], dayparts: ['part of the day', 'parts of the day'],
};

/** An idle in words: "1 part of the day", "2 hours", "30 minutes". */
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
