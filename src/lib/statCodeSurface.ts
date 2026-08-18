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

/** The members offered after `stats.` — what the one array in the sandbox is actually used for, rather
 *  than everything `Array.prototype` defines. */
export const STATS_MEMBERS: readonly SurfaceEntry[] = [
  { name: 'find', detail: '(fn) => Stat', info: 'The first stat the test returns true for, or undefined.' },
  { name: 'filter', detail: '(fn) => Stat[]', info: 'Every stat the test returns true for, as a new array.' },
  { name: 'map', detail: '(fn) => any[]', info: 'One result per stat, in order.' },
  { name: 'some', detail: '(fn) => boolean', info: 'Whether any stat passes the test.' },
  { name: 'every', detail: '(fn) => boolean', info: 'Whether every stat passes the test.' },
  { name: 'reduce', detail: '(fn, start) => any', info: 'Fold the stats down to a single value.' },
  { name: 'at', detail: '(index) => Stat', info: 'The stat at an index. Negative counts from the end.' },
  { name: 'length', detail: 'number', info: 'How many stats the world has.' },
];

/**
 * The static members worth offering after each object-shaped built-in. Everything listed is something
 * QuickJS provides; the lists are trimmed to what stat code plausibly reaches for, so the popup teaches
 * the sandbox rather than reciting a JavaScript reference.
 *
 * A built-in present here with an empty list offers nothing — which is still the point, because it stops
 * the caret falling through to a list of stat fields that were never there.
 *
 * A Map rather than an object so a lookup keyed on whatever the author typed can't reach a prototype
 * member. Its keys are the object-shaped half of `SANDBOX_BUILTINS`, and the guard beside this file holds
 * the two together.
 */
export const BUILTIN_MEMBERS: ReadonlyMap<string, readonly SurfaceEntry[]> = new Map(Object.entries({
  Math: [
    { name: 'min', detail: '(...n) => number', info: 'The smallest of its arguments.' },
    { name: 'max', detail: '(...n) => number', info: 'The largest of its arguments.' },
    { name: 'round', detail: '(n) => number', info: 'Nearest whole number; halves round up.' },
    { name: 'floor', detail: '(n) => number', info: 'Round down to a whole number.' },
    { name: 'ceil', detail: '(n) => number', info: 'Round up to a whole number.' },
    { name: 'trunc', detail: '(n) => number', info: 'Drop the fractional part, toward zero.' },
    { name: 'abs', detail: '(n) => number', info: 'Distance from zero, so never negative.' },
    { name: 'sign', detail: '(n) => number', info: '-1, 0 or 1, depending on the sign.' },
    { name: 'pow', detail: '(n, exp) => number', info: 'The first argument raised to the second.' },
    { name: 'sqrt', detail: '(n) => number', info: 'Square root.' },
    { name: 'hypot', detail: '(...n) => number', info: 'Square root of the sum of the squares.' },
    { name: 'log', detail: '(n) => number', info: 'Natural logarithm.' },
    { name: 'exp', detail: '(n) => number', info: 'E raised to the given power.' },
    { name: 'random', detail: '() => number', info: 'A number from 0 up to but not including 1. Reseeded each run.' },
    { name: 'PI', detail: 'number', info: 'The ratio of a circle’s circumference to its diameter.' },
    { name: 'E', detail: 'number', info: 'The base of the natural logarithm.' },
  ],
  JSON: [
    { name: 'parse', detail: '(text) => any', info: 'Read a value back out of JSON text.' },
    { name: 'stringify', detail: '(value) => string', info: 'Write a value as JSON text.' },
  ],
  Object: [
    { name: 'keys', detail: '(obj) => string[]', info: 'The object’s own property names.' },
    { name: 'values', detail: '(obj) => any[]', info: 'The object’s own property values.' },
    { name: 'entries', detail: '(obj) => any[][]', info: 'One [name, value] pair per own property.' },
    { name: 'assign', detail: '(target, ...src) => obj', info: 'Copy properties onto the first object.' },
    { name: 'fromEntries', detail: '(pairs) => obj', info: 'Build an object from [name, value] pairs.' },
    { name: 'freeze', detail: '(obj) => obj', info: 'Make an object read-only.' },
  ],
  Number: [
    { name: 'isFinite', detail: '(n) => boolean', info: 'Whether the value is a number and not infinite.' },
    { name: 'isInteger', detail: '(n) => boolean', info: 'Whether the value is a whole number.' },
    { name: 'isNaN', detail: '(n) => boolean', info: 'Whether the value is the not-a-number value.' },
    { name: 'parseFloat', detail: '(text) => number', info: 'Read a decimal number out of a string.' },
    { name: 'parseInt', detail: '(text) => number', info: 'Read a whole number out of a string.' },
    { name: 'EPSILON', detail: 'number', info: 'The smallest gap between two representable numbers near 1.' },
    { name: 'MAX_SAFE_INTEGER', detail: 'number', info: 'The largest whole number that stays exact.' },
    { name: 'MIN_SAFE_INTEGER', detail: 'number', info: 'The smallest whole number that stays exact.' },
  ],
  Array: [
    { name: 'isArray', detail: '(value) => boolean', info: 'Whether the value is an array.' },
    { name: 'from', detail: '(value, fn?) => any[]', info: 'Build an array from anything list-shaped.' },
    { name: 'of', detail: '(...items) => any[]', info: 'An array of the arguments given.' },
  ],
  String: [
    { name: 'fromCharCode', detail: '(...codes) => string', info: 'Build a string from character codes.' },
    { name: 'raw', detail: '(strings, ...v) => string', info: 'A template literal with its escapes left alone.' },
  ],
  Boolean: [],
  Date: [
    { name: 'now', detail: '() => number', info: 'Real-world milliseconds since 1970. The story clock is elapsedHours.' },
    { name: 'parse', detail: '(text) => number', info: 'Read a date string as milliseconds.' },
    { name: 'UTC', detail: '(y, m, ...) => number', info: 'Milliseconds for a date given in UTC parts.' },
  ],
}));

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
