/**
 * What stat code can actually reach: the names the QuickJS sandbox injects, the fields a marshalled stat
 * carries, and the built-ins the VM already has. `STAT_CODE_SURFACE` gathers them into the one list the
 * editor, completions, diagnostics and help text read, so none of them can drift apart.
 *
 * This module *describes* the sandbox; it never widens it. Adding a name here does not expose it — the
 * exposure lives in `statCodeExecutor`, and a name added here that the executor doesn't inject would be
 * caught by the drift guard beside this file.
 */

import { DELTA_SOURCES, type DeltaSource } from '@/lib/statCodeExecutor';
import { STAT_CODE_SNIPPETS } from '@/lib/codeSnippets';
import { nearestName, surfaceKnownNames, type CodeSurface, type SurfaceEntry } from '@/lib/codeSurface';
import type { PlaceholderKindNoun } from '@/lib/placeholders';

/** An object's members as its completion detail: `{ a, b }`. */
const shapeOf = (entries: readonly SurfaceEntry[]) => `{ ${entries.map((entry) => entry.name).join(', ')} }`;

/** The fields on `clock.previous`: the story clock at the start of the turn. Read-only. */
export const CLOCK_PREVIOUS_FIELDS: readonly SurfaceEntry[] = [
  { name: 'day', detail: 'number', info: 'Day number at the start of this turn.' },
  { name: 'daypart', detail: 'string', info: 'Daypart at the start of this turn.' },
];

/** The members of `clock`: the story clock at the end of the turn, then `previous` for its start. Read-only. */
export const CLOCK_MEMBERS: readonly SurfaceEntry[] = [
  { name: 'day', detail: 'number', info: 'Day number at the end of this turn.' },
  { name: 'daypart', detail: 'string', info: 'Daypart at the end of this turn — night, dawn, morning, midday, afternoon or evening.' },
  { name: 'deltaHours', detail: 'number', info: 'Story hours this turn consumed.' },
  { name: 'elapsedHours', detail: 'number', info: 'Total story hours at the end of this turn.' },
  { name: 'previous', detail: shapeOf(CLOCK_PREVIOUS_FIELDS), info: 'The clock at the start of this turn: day and daypart.' },
];

/** Every name the sandbox injects into the program, in the order an author meets them. */
export const SANDBOX_GLOBALS: readonly SurfaceEntry[] = [
  { name: 'self', detail: 'Stat', info: 'The stat this code belongs to. Write self.value to set its value.' },
  { name: 'stats', detail: 'object', info: 'Every stat in the world by name. Use stats["Two Words"] for a name with a space.' },
  { name: 'clock', detail: shapeOf(CLOCK_MEMBERS), info: 'The story clock. Read-only.' },
  { name: 'placeholders', detail: 'object', info: 'The world’s own placeholders by name. An entity’s or a dictionary’s are on its entry. Use placeholders["Two Words"] for a name with a space.' },
  { name: 'traits', detail: 'object', info: 'Every trait in the world by name. Use traits["Two Words"] for a name with a space.' },
  { name: 'entities', detail: 'object', info: 'Every entity in play by name, with its own traits and placeholders. Use entities["Two Words"] for a name with a space.' },
  { name: 'persona', detail: 'object', info: 'The entity the player plays, with its own traits and placeholders. Empty when the player plays no entity.' },
  { name: 'dictionaries', detail: 'object', info: 'Every dictionary in play by name, with its own placeholders. A dictionary the player turned off isn’t listed. Use dictionaries["Two Words"] for a name with a space.' },
  { name: 'console', detail: 'object', info: 'Only console.log — output shows up in the browser console.' },
];

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
  { name: 'actual', detail: shapeOf(DELTA_FIELDS), info: 'Current values minus previous.' },
];

/** The fields on a stat object inside `stats`, `self` included. Anything else is `undefined`. */
export const STAT_FIELDS: readonly SurfaceEntry[] = [
  { name: 'id', detail: 'string', info: 'The stat’s unique id.' },
  { name: 'name', detail: 'string', info: 'The stat’s code name: the authored name, with each placeholder chip read as that placeholder’s own name.' },
  { name: 'type', detail: 'string', info: 'number, percentage, or whichever type the stat was given.' },
  { name: 'description', detail: 'string', info: 'The stat’s description text.' },
  { name: 'enabled', detail: 'boolean', info: 'True when the stat is on. False when a trait switched it off, or for an unknown name. Read-only.' },
  { name: 'min', detail: 'number', info: 'Lower bound. Results are clamped to it. Write self.min to set it.' },
  { name: 'max', detail: 'number', info: 'Upper bound. Results are clamped to it. Write self.max to set it.' },
  { name: 'value', detail: 'number', info: 'Current value, with this turn’s AI change and regen applied. Write self.value to set it.' },
  { name: 'regen', detail: 'number', info: 'Regen per story hour, with traits applied. Write self.regen to set it.' },
  { name: 'previous', detail: 'Stat', info: 'The whole stat as it stood at the start of this turn. Read-only.' },
  { name: 'delta', detail: shapeOf(DELTA_MEMBERS), info: 'Every change this turn made to the stat, by source. Read-only.' },
];

export { SELF_WRITABLE_FIELDS } from '@/lib/statCodeExecutor';

/** The fields on a stat's `previous`: the whole stat as it stood at the start of this turn. Read-only. */
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

/**
 * The members of one entry in `placeholders`. An Object's `value` holds every value in force rather than
 * one text, and its `pin` therefore takes a list. The kind is authored, so completions can state the type
 * per entry.
 */
export function placeholderEntryFields(kind: PlaceholderKindNoun): readonly SurfaceEntry[] {
  const list = kind === 'Object';
  return [
    { name: 'id', detail: 'string', info: 'The placeholder’s unique id. Read-only.' },
    { name: 'name', detail: 'string', info: 'The placeholder’s code name. Read-only.' },
    list
      ? { name: 'value', detail: 'string[]', info: 'The current values as a list. Pins are applied.' }
      : { name: 'value', detail: 'string', info: 'The text the placeholder reads as now, with pins applied.' },
    { name: 'values', detail: 'string[]', info: 'Every value the author wrote, in order, as text. Values with weight 0 are included.' },
    { name: 'text', detail: 'string', info: 'What the prompt sees for this placeholder. A list joins with ", ". Read-only.' },
    { name: 'roll', detail: '() => string', info: 'Draw one value with the author’s weights. The draw is not kept.' },
    list
      ? { name: 'pin', detail: '(list) => void', info: 'Pin the placeholder to a list of text, after this run. One text pins a one-item list.' }
      : { name: 'pin', detail: '(text) => void', info: 'Pin the placeholder to any text, after this run.' },
    { name: 'unpin', detail: '() => void', info: 'Remove the pin that code set, after this run. The rolled value shows again.' },
  ];
}

/** The members of one entry in `traits` and in an entity's `traits`. */
export const TRAIT_ENTRY_FIELDS: readonly SurfaceEntry[] = [
  { name: 'enabled', detail: 'boolean', info: 'True when the trait is held and on. Write it to switch the trait on or off, after this run.' },
  { name: 'acquired', detail: 'boolean', info: 'True when the trait is held, on or off. Read-only.' },
  { name: 'id', detail: 'string', info: 'The trait’s unique id. Read-only.' },
  { name: 'name', detail: 'string', info: 'The trait’s code name. Read-only.' },
  { name: 'mode', detail: 'string', info: '"optional", "alwaysOn" or "hidden". Read-only.' },
  { name: 'available', detail: 'boolean', info: 'True when the trait’s requirements hold for its owner now. Read-only.' },
  { name: 'group', detail: 'string', info: 'The code name of the trait’s group. Empty when it has none. Read-only.' },
  { name: 'playerToggle', detail: 'boolean', info: 'True when the player can switch the trait during play. Read-only.' },
];

/** The one field on a trait entry that a write reaches. */
export const TRAIT_WRITABLE_FIELD = 'enabled';

/** The members of `persona`. None takes a write; a trait switches through its own `enabled`. */
export const PERSONA_FIELDS: readonly SurfaceEntry[] = [
  { name: 'id', detail: 'string', info: 'The persona entity’s unique id. Empty when the player plays no entity. Read-only.' },
  { name: 'name', detail: 'string', info: 'The persona’s code name. Empty when the player plays no entity. Read-only.' },
  { name: 'type', detail: 'string', info: 'The persona’s type text. Empty when it has none. Read-only.' },
  { name: 'pronouns', detail: 'string', info: 'The persona’s pronouns text. Empty when it has none. Read-only.' },
  { name: 'inScene', detail: 'boolean', info: 'True when the persona plays. False when the player plays no entity. Read-only.' },
  { name: 'traits', detail: 'object', info: 'The persona’s own traits by name, owned or linked. Use persona.traits["Two Words"] for a name with a space.' },
  { name: 'placeholders', detail: 'object', info: 'The persona’s own placeholders by name. Empty when the player plays no entity.' },
];

/** The members of one entry in `entities`. None takes a write; a trait switches through its own `enabled`. */
export const ENTITY_FIELDS: readonly SurfaceEntry[] = [
  { name: 'id', detail: 'string', info: 'The entity’s unique id. Read-only.' },
  { name: 'name', detail: 'string', info: 'The entity’s code name. Read-only.' },
  { name: 'type', detail: 'string', info: 'The entity’s type text. Empty when it has none. Read-only.' },
  { name: 'pronouns', detail: 'string', info: 'The entity’s pronouns text. Empty when it has none. Read-only.' },
  { name: 'inScene', detail: 'boolean', info: 'True when the entity is in this turn’s scene. Read-only.' },
  { name: 'traits', detail: 'object', info: 'The entity’s own traits by name, owned or linked. Use entities.Mira.traits["Two Words"] for a name with a space.' },
  { name: 'placeholders', detail: 'object', info: 'The entity’s own placeholders by name. Use entities.Mira.placeholders["Two Words"] for a name with a space.' },
];

/** The members of one entry in `dictionaries`. None takes a write. */
export const DICTIONARY_FIELDS: readonly SurfaceEntry[] = [
  { name: 'id', detail: 'string', info: 'The dictionary’s unique id. Read-only.' },
  { name: 'name', detail: 'string', info: 'The dictionary’s code name. Read-only.' },
  { name: 'placeholders', detail: 'object', info: 'The dictionary’s own placeholders by name. Use dictionaries.Lore.placeholders["Two Words"] for a name with a space.' },
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
  { name: 'Date', detail: 'function', info: 'Real-world clock. For story time, use clock.' },
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
    { name: 'now', detail: '() => number', info: 'Real-world milliseconds since 1970. The story clock is clock.elapsedHours.' },
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

/** Stat code's whole surface, as the editor and its reader take it. */
export const STAT_CODE_SURFACE: CodeSurface = {
  label: 'stat code',
  globals: SANDBOX_GLOBALS,
  builtins: SANDBOX_BUILTINS,
  members: BUILTIN_MEMBERS,
  languageNames: LANGUAGE_NAMES,
  snippets: STAT_CODE_SNIPPETS,
  missingReturn: 'This code never returns a number or writes self.value, so the stat keeps its value.',
  statMaps: true,
};

/**
 * The stat-code name an unknown identifier was most likely meant to be, or null when nothing is close
 * enough to be worth suggesting. Case-insensitive, so `Stats` still points at `stats`.
 */
export function nearestSurfaceName(name: string, extra: readonly string[] = []): string | null {
  return nearestName(name, [...surfaceKnownNames(STAT_CODE_SURFACE), ...extra]);
}
