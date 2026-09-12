/**
 * What stat code can actually reach: the names the QuickJS sandbox injects, the fields a marshalled stat
 * carries, and the built-ins the VM already has. One list, so completions, diagnostics and the help text
 * can't drift apart from each other.
 *
 * This module *describes* the sandbox; it never widens it. Adding a name here does not expose it — the
 * exposure lives in `statCodeExecutor`, and a name added here that the executor doesn't inject would be
 * caught by the drift guard beside this file.
 */

import { CODE_BOUND_FIELDS, DELTA_SOURCES, STAT_CLOCK_VARS, type DeltaSource } from '@/lib/statCodeExecutor';

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
  { name: 'self', detail: 'Stat', info: 'The stat this code belongs to. Write self.value to set its value.' },
  { name: 'stats', detail: 'object', info: 'Every stat in the world by name. Use stats["Two Words"] for a name with a space.' },
  ...STAT_CLOCK_VARS.map((name) => CLOCK_INFO[name]),
  { name: 'placeholders', detail: 'object', info: 'Every placeholder in the world by name. Use placeholders["Two Words"] for a name with a space.' },
  { name: 'traits', detail: 'object', info: 'Every trait in the world by name. Use traits["Two Words"] for a name with a space.' },
  { name: 'console', detail: 'object', info: 'Only console.log — output shows up in the browser console.' },
];

/** Names the sandbox injects for older code but never offers or documents. */
export const SANDBOX_UNDOCUMENTED_GLOBALS: readonly string[] = ['currentStatId'];

/** An object's members as its completion detail: `{ a, b }`. */
const shapeOf = (entries: readonly SurfaceEntry[]) => `{ ${entries.map((entry) => entry.name).join(', ')} }`;

/** The fields on every member of `delta`. */
export const DELTA_FIELDS: readonly SurfaceEntry[] = [
  { name: 'value', detail: 'number', info: 'The change to the value.' },
  { name: 'min', detail: 'number', info: 'The change to the lower bound.' },
  { name: 'max', detail: 'number', info: 'The change to the upper bound.' },
  { name: 'regen', detail: 'number', info: 'The change to regen per story hour.' },
];

/** What each change source means. Keyed off the executor's own list, as the clock is. */
const DELTA_SOURCE_INFO: Record<DeltaSource, SurfaceEntry> = {
  ai: { name: 'ai', detail: shapeOf(DELTA_FIELDS), info: 'The change the AI asked for this turn, raw: before flags and the range.' },
  regen: { name: 'regen', detail: shapeOf(DELTA_FIELDS), info: 'What regen did this turn, after clamping. Only value moves.' },
};

/** The members of a stat's `delta`: one per change source, then their sum and what landed. */
export const DELTA_MEMBERS: readonly SurfaceEntry[] = [
  ...DELTA_SOURCES.map((source) => DELTA_SOURCE_INFO[source]),
  { name: 'total', detail: shapeOf(DELTA_FIELDS), info: 'Every source added up: what this turn asked of the stat, before flags and the range.' },
  { name: 'actual', detail: shapeOf(DELTA_FIELDS), info: 'What landed since the start of this turn: the current numbers minus previous.' },
];

/** The fields on a stat object inside `stats`, `self` included. Anything else is `undefined`. */
export const STAT_FIELDS: readonly SurfaceEntry[] = [
  { name: 'id', detail: 'string', info: 'The stat’s unique id.' },
  { name: 'name', detail: 'string', info: 'The stat’s code name: the authored name, with each placeholder chip read as that placeholder’s own name.' },
  { name: 'type', detail: 'string', info: 'number, percentage, or whichever type the stat was given.' },
  { name: 'description', detail: 'string', info: 'The stat’s description text.' },
  { name: 'min', detail: 'number', info: 'Lower bound. Results are clamped to it. Write self.min to set it.' },
  { name: 'max', detail: 'number', info: 'Upper bound. Results are clamped to it. Write self.max to set it.' },
  { name: 'value', detail: 'number', info: 'Current value, with this turn’s AI change and regen applied. Write self.value to set it.' },
  { name: 'regen', detail: 'number', info: 'Regen per story hour, with traits applied. Write self.regen to set it.' },
  { name: 'previous', detail: 'Stat', info: 'The whole stat as it stood at the start of this turn. Read-only.' },
  { name: 'delta', detail: shapeOf(DELTA_MEMBERS), info: 'Every change this turn made to the stat, by source. Read-only.' },
];

/** The fields on `self` that a write reaches. The host reads these back after the run; writes to any other
 *  field, or to another stat's entry, do nothing. A bound write holds until the code next runs. */
export const SELF_WRITABLE_FIELDS: readonly string[] = ['value', ...CODE_BOUND_FIELDS];

/** The fields on a stat's `previous` — the whole stat as it stood at the start of this turn. Frozen, so
 *  a write reaches none of them. */
export const PREVIOUS_FIELDS: readonly SurfaceEntry[] = [
  { name: 'id', detail: 'string', info: 'Unique id, at the start of this turn.' },
  { name: 'name', detail: 'string', info: 'The stat’s code name, at the start of this turn.' },
  { name: 'type', detail: 'string', info: 'number, percentage, or whichever type the stat was given, at the start of this turn.' },
  { name: 'description', detail: 'string', info: 'The stat’s description text, at the start of this turn.' },
  { name: 'min', detail: 'number', info: 'Lower bound at the start of this turn, traits and code bounds included.' },
  { name: 'max', detail: 'number', info: 'Upper bound at the start of this turn, traits and code bounds included.' },
  { name: 'value', detail: 'number', info: 'The value at the start of this turn.' },
  { name: 'regen', detail: 'number', info: 'Regen per story hour at the start of this turn, traits included.' },
];

/** The members of one entry in `placeholders`. */
export const PLACEHOLDER_ENTRY_FIELDS: readonly SurfaceEntry[] = [
  { name: 'value', detail: 'string', info: 'The text the placeholder reads as now, with pins applied.' },
  { name: 'values', detail: 'string[]', info: 'Every value the author wrote, in order, as text. Values with weight 0 are included.' },
  { name: 'roll', detail: '() => string', info: 'Draw one value with the author’s weights. The draw is not kept.' },
  { name: 'pin', detail: '(text) => void', info: 'Pin the placeholder to any text, after this run.' },
  { name: 'unpin', detail: '() => void', info: 'Remove the pin that code set, after this run. The rolled value shows again.' },
];

/** The members of one entry in `traits`. */
export const TRAIT_ENTRY_FIELDS: readonly SurfaceEntry[] = [
  { name: 'enabled', detail: 'boolean', info: 'Whether the player has the trait and it is on. Write it to switch the trait on or off, after this run.' },
  { name: 'acquired', detail: 'boolean', info: 'Whether the player has the trait, on or off. Code can’t change it.' },
];

/** The one field on a `traits` entry that a write reaches. */
export const TRAIT_WRITABLE_FIELD = 'enabled';

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
  ...SANDBOX_UNDOCUMENTED_GLOBALS,
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
  return nearestName(name, [...SANDBOX_KNOWN_NAMES, ...extra]);
}

/** The candidate `name` was most likely meant to be, or null when nothing is close enough. */
export function nearestName(name: string, candidates: readonly string[]): string | null {
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
