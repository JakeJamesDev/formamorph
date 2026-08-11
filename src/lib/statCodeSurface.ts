/**
 * What stat code can actually reach: the names the QuickJS sandbox injects, the fields a marshalled stat
 * carries, and the built-ins the VM already has. One list, so completions, diagnostics and the help text
 * can't drift apart from each other.
 *
 * This module *describes* the sandbox; it never widens it. Adding a name here does not expose it — the
 * exposure lives in `statCodeExecutor`, and a name added here that the executor doesn't inject would be
 * caught by the drift guard beside this file.
 */

import { STAT_CLOCK_VARS } from '@/lib/statCodeExecutor';

/** One reachable name and what an author needs to know about it. */
export interface SurfaceEntry {
  name: string;
  /** The short right-hand hint — a type or a shape. */
  detail: string;
  /** The one-line explanation shown beside the entry. */
  info: string;
}

/** What each clock reading means. Keyed off the executor's own list so a rename there shows up as a
 *  missing description rather than a silently stale one. */
const CLOCK_INFO: Record<(typeof STAT_CLOCK_VARS)[number], SurfaceEntry> = {
  deltaHours: { name: 'deltaHours', detail: 'number', info: 'Story hours this turn consumed.' },
  elapsedHours: { name: 'elapsedHours', detail: 'number', info: 'Total story hours at the end of this turn.' },
  day: { name: 'day', detail: 'number', info: 'Day number at the end of this turn.' },
  daypart: { name: 'daypart', detail: 'string', info: 'Daypart at the end of this turn — night, dawn, morning, midday, afternoon or evening.' },
  startDay: { name: 'startDay', detail: 'number', info: 'Day number at the start of this turn.' },
  startDaypart: { name: 'startDaypart', detail: 'string', info: 'Daypart at the start of this turn.' },
};

/** Every name the sandbox injects into the program, in the order an author meets them. */
export const SANDBOX_GLOBALS: readonly SurfaceEntry[] = [
  { name: 'stats', detail: 'Stat[]', info: 'Every stat in the world, as plain data. Look one up by name or id.' },
  { name: 'currentStatId', detail: 'string', info: 'The id of the stat this code belongs to.' },
  ...STAT_CLOCK_VARS.map((name) => CLOCK_INFO[name]),
  { name: 'console', detail: 'object', info: 'Only console.log — output shows up in the browser console.' },
];

/** The eight fields on a stat object inside `stats`. Anything else is `undefined`. */
export const STAT_FIELDS: readonly SurfaceEntry[] = [
  { name: 'id', detail: 'string', info: 'Unique id. Compare against currentStatId to find this stat.' },
  { name: 'name', detail: 'string', info: 'The stat’s display name, as the author typed it.' },
  { name: 'type', detail: 'string', info: 'number, percentage, or whichever type the stat was given.' },
  { name: 'description', detail: 'string', info: 'The stat’s description text.' },
  { name: 'min', detail: 'number', info: 'Lower bound. Results are clamped to it.' },
  { name: 'max', detail: 'number', info: 'Upper bound. Results are clamped to it.' },
  { name: 'value', detail: 'number', info: 'Current value.' },
  { name: 'regen', detail: 'number', info: 'Per-turn regen amount configured on the stat.' },
];

/** Built-ins the VM already has. Listed so a reference to one isn't flagged, and so completions offer the
 *  handful that stat code actually reaches for rather than everything a JS engine defines. */
export const SANDBOX_BUILTINS: readonly SurfaceEntry[] = [
  { name: 'Math', detail: 'object', info: 'min, max, round, floor, abs, random and the rest.' },
  { name: 'JSON', detail: 'object', info: 'parse and stringify.' },
  { name: 'Number', detail: 'function', info: 'Convert to a number; Number.isFinite and friends.' },
  { name: 'String', detail: 'function', info: 'Convert to a string.' },
  { name: 'Boolean', detail: 'function', info: 'Convert to true or false.' },
  { name: 'Array', detail: 'function', info: 'Array.isArray, Array.from.' },
  { name: 'Object', detail: 'function', info: 'Object.keys, Object.values, Object.entries.' },
  { name: 'Date', detail: 'function', info: 'Real-world clock. The story clock is deltaHours and friends.' },
  { name: 'parseInt', detail: 'function', info: 'Read a whole number out of a string.' },
  { name: 'parseFloat', detail: 'function', info: 'Read a decimal number out of a string.' },
  { name: 'isNaN', detail: 'function', info: 'Whether a value is not a number.' },
  { name: 'isFinite', detail: 'function', info: 'Whether a value is a finite number.' },
  { name: 'NaN', detail: 'number', info: 'The not-a-number value.' },
  { name: 'Infinity', detail: 'number', info: 'Positive infinity.' },
  { name: 'undefined', detail: 'undefined', info: 'The absent value.' },
];

/** Names a reference may use without being a typo, beyond the sandbox's own. Language-level things the
 *  grammar reports as variables, plus the errors QuickJS defines. */
export const LANGUAGE_NAMES: readonly string[] = [
  'this', 'arguments', 'globalThis', 'Error', 'TypeError', 'RangeError', 'SyntaxError',
  'ReferenceError', 'Symbol', 'Map', 'Set', 'Promise', 'RegExp', 'Function',
];

/** Every name a reference is allowed to resolve to without the author having declared it. */
export const SANDBOX_KNOWN_NAMES: ReadonlySet<string> = new Set([
  ...SANDBOX_GLOBALS.map((entry) => entry.name),
  ...SANDBOX_BUILTINS.map((entry) => entry.name),
  ...LANGUAGE_NAMES,
]);

/** How far apart two names may be and still read as the same one mistyped. Scaled to length so short
 *  names don't suggest each other and long ones tolerate a slip. */
const suggestionDistance = (name: string): number => (name.length <= 4 ? 1 : name.length <= 8 ? 2 : 3);

/** Levenshtein distance, capped implicitly by the short strings involved. */
function editDistance(a: string, b: string): number {
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    const row = [i];
    for (let j = 1; j <= b.length; j += 1) {
      row[j] = Math.min(
        previous[j] + 1,
        row[j - 1] + 1,
        previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    previous = row;
  }
  return previous[b.length];
}

/**
 * The surface name an unknown identifier was most likely meant to be, or null when nothing is close
 * enough to be worth suggesting. Case-insensitive, so `Stats` still points at `stats`.
 */
export function nearestSurfaceName(name: string, extra: readonly string[] = []): string | null {
  const candidates = [...SANDBOX_KNOWN_NAMES, ...extra];
  const limit = suggestionDistance(name);
  let best: string | null = null;
  let bestDistance = Infinity;
  for (const candidate of candidates) {
    if (candidate === name) return null;
    const distance = editDistance(name.toLowerCase(), candidate.toLowerCase());
    if (distance <= limit && distance < bestDistance) {
      best = candidate;
      bestDistance = distance;
    }
  }
  return best;
}
