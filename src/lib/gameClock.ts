/**
 * In-world clock formatting: turns elapsed story hours into the labels the AI reads.
 *
 * Memory is accurate about what happened and silent about when — digests ride as an undated chronicle,
 * so the model cannot tell an hour ago from three weeks ago and invents. This module renders a memory's
 * position in story time both ways, absolute ("Day 3, evening") and relative ("two days ago"), because
 * models are unreliable at deriving either from the other.
 *
 * Pure and React-free. The clock's *source* is deliberately not here: callers hand in a `hoursAt`
 * resolver, so the flat hour-per-turn the game advances today and a measured per-turn delta later are
 * the same seam. Design: docs-internal/time-system-design.md.
 */

/** The story's time frame. Not authored anywhere yet — every field falls back to its default. */
export interface WorldCalendar {
  /** Hour of day the story opens at, 0..hoursPerDay-1. */
  startHour?: number;
  /** Hours in one day. */
  hoursPerDay?: number;
}

export const DEFAULT_START_HOUR = 8;
export const DEFAULT_HOURS_PER_DAY = 24;

/** Hours the game charges per turn while the clock is flat — also the fallback whenever the measuring
 *  pass is off, fails, or replies with something unparseable. Falling back to the pre-feature constant
 *  means a broken clock plays exactly like the old game rather than freezing or lurching. */
export const FLAT_HOURS_PER_TURN = 1;

/** Ceiling on one turn's measured delta. A hallucinated "500 years pass" must not detonate the whole
 *  chronicle, and no single turn legitimately spans more than a year. Over-range replies fall back. */
export const MAX_TURN_HOURS = 8760;

const UNIT_HOURS: Record<string, number> = { m: 1 / 60, h: 1, d: 24, w: 168 };

/** Counts the models actually write out in words rather than digits ("five minutes" was a third of one
 *  probe case's replies). Small values only — nobody spells out "seventeen". */
const WORD_NUMBERS: Record<string, number> = {
  zero: 0, a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6,
  seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
};
const WORD_PATTERN = Object.keys(WORD_NUMBERS).join('|');

/**
 * Read the clock pass's reply into hours. Accepts `0`, `15m`, `2h`, `3 days`, `2w`, and spelled-out
 * counts like `five minutes` — a count with an optional unit, anywhere in the reply, since small models
 * append stray prose. A bare number means hours (the unit the game already counts in). Returns null when
 * nothing parses or the value is out of range, which callers resolve to FLAT_HOURS_PER_TURN — never to
 * zero, so a garbled reply cannot silently freeze time.
 */
export function parseTimeDelta(reply: string): number | null {
  const m = (reply || '').match(
    new RegExp(`(-?\\d+(?:\\.\\d+)?|${WORD_PATTERN})\\s*(minutes?|mins?|m|hours?|hrs?|h|days?|d|weeks?|wks?|w)?\\b`, 'i'),
  );
  if (!m) return null;
  const raw = m[1].toLowerCase();
  // A spelled-out count needs its unit: a bare "a"/"one" in prose is not a measurement.
  if (raw in WORD_NUMBERS && !m[2]) return null;
  const value = raw in WORD_NUMBERS ? WORD_NUMBERS[raw] : Number(m[1]);
  if (!Number.isFinite(value) || value < 0) return null;
  const hours = value * (m[2] ? UNIT_HOURS[m[2][0].toLowerCase()] : 1);
  return hours <= MAX_TURN_HOURS ? hours : null;
}

/** Elapsed hours at a message-history position under the flat clock. `pos` is the `BandTurn.index` /
 *  `MemoryNote.anchorTurn` domain: assistant messages sit at odd indices, so every two positions is one
 *  turn, and a note anchored mid-pair belongs to the turn that just closed. */
export function flatHoursAt(pos: number): number {
  return Math.ceil(Math.max(0, pos) / 2) * FLAT_HOURS_PER_TURN;
}

function resolve(calendar?: WorldCalendar) {
  const hoursPerDay = Math.max(1, Math.round(calendar?.hoursPerDay ?? DEFAULT_HOURS_PER_DAY));
  const rawStart = calendar?.startHour ?? DEFAULT_START_HOUR;
  // A start hour outside the day wraps rather than throwing — an authored 26 on a 24-hour day is a typo,
  // not a reason to lose the clock.
  const startHour = ((Math.round(rawStart) % hoursPerDay) + hoursPerDay) % hoursPerDay;
  return { hoursPerDay, startHour };
}

/** Calendar position after `elapsed` story hours: 1-based day, plus the hour within that day. */
export function dayAndHour(elapsed: number, calendar?: WorldCalendar): { day: number; hour: number } {
  const { hoursPerDay, startHour } = resolve(calendar);
  const total = Math.max(0, elapsed) + startHour;
  return { day: Math.floor(total / hoursPerDay) + 1, hour: total % hoursPerDay };
}

/** Coarse time of day. Deliberately not a clock reading: an exact numeral in context is a parrotable
 *  value — small models echo it back into the prose — and the narration only ever needs the daypart.
 *  Boundaries are fractions of the day, so a non-24-hour calendar divides the same way. */
export function daypart(hour: number, calendar?: WorldCalendar): string {
  const { hoursPerDay } = resolve(calendar);
  const f = ((hour % hoursPerDay) + hoursPerDay) % hoursPerDay / hoursPerDay;
  if (f < 0.25) return 'night';
  if (f < 0.33) return 'dawn';
  if (f < 0.46) return 'morning';
  if (f < 0.54) return 'midday';
  if (f < 0.71) return 'afternoon';
  if (f < 0.83) return 'evening';
  return 'night';
}

/** Absolute position in story time, e.g. `Day 3, evening`. */
export function formatAbsolute(elapsed: number, calendar?: WorldCalendar): string {
  const { day, hour } = dayAndHour(elapsed, calendar);
  return `Day ${day}, ${daypart(hour, calendar)}`;
}

const NUMBER_WORDS = ['', '', 'two', 'three', 'four', 'five', 'six'];

/** How long ago `then` was, from `now`, in the phrasing a person would use. Measured in calendar days
 *  rather than raw hours so "yesterday" means the previous day, not 24 hours back. */
export function formatRelative(then: number, now: number, calendar?: WorldCalendar): string {
  const gapHours = Math.max(0, now - then);
  const dayGap = dayAndHour(now, calendar).day - dayAndHour(Math.min(then, now), calendar).day;
  if (dayGap <= 0) return gapHours < 1 ? 'moments ago' : 'earlier today';
  if (dayGap === 1) return 'yesterday';
  if (dayGap < 7) return `${NUMBER_WORDS[dayGap]} days ago`;
  if (dayGap < 14) return 'about a week ago';
  if (dayGap < 60) return `about ${Math.round(dayGap / 7)} weeks ago`;
  return `about ${Math.round(dayGap / 30)} months ago`;
}

/** The label a remembered moment carries into context: both readings, in brackets, ready to prefix a
 *  digest. Empty when the moment is the present one — a stamp on the live scene is noise. */
export function formatStamp(then: number, now: number, calendar?: WorldCalendar): string {
  return `[${formatAbsolute(then, calendar)} — ${formatRelative(then, now, calendar)}]`;
}

/**
 * Elapsed hours at each message position, accumulated from the per-turn deltas the clock pass stored.
 * A turn with no recorded delta (pre-feature save, clock off, or a failed measurement) charges the flat
 * hour, so a partly-measured history stays monotonic instead of collapsing. The returned resolver reads
 * the elapsed total as of the last turn at or before `pos`, which places a note anchored between turns
 * on the turn that just closed — the same rule `flatHoursAt` encodes.
 */
export function hoursByPosition(turns: Array<{ index: number; timeDelta?: number }>): (pos: number) => number {
  const marks: Array<{ index: number; hours: number }> = [];
  let acc = 0;
  for (const t of [...turns].sort((a, b) => a.index - b.index)) {
    acc += t.timeDelta ?? FLAT_HOURS_PER_TURN;
    marks.push({ index: t.index, hours: acc });
  }
  return (pos) => {
    let hours = 0;
    for (const m of marks) {
      if (m.index > pos) break;
      hours = m.hours;
    }
    return hours;
  };
}

/** A stamp resolver over message-history positions, for the digest band. `hoursAt` maps a position to
 *  elapsed story hours (flat today, measured later); `nowHours` is the live clock. */
export function buildStamper(args: {
  nowHours: number;
  hoursAt?: (pos: number) => number;
  calendar?: WorldCalendar;
}): (pos: number) => string {
  const { nowHours, hoursAt = flatHoursAt, calendar } = args;
  return (pos) => formatStamp(hoursAt(pos), nowHours, calendar);
}

/** The present moment as a sentence for the recap's now-line closer. */
export function formatNow(nowHours: number, calendar?: WorldCalendar): string {
  return `It is now ${formatAbsolute(nowHours, calendar)}.`;
}
