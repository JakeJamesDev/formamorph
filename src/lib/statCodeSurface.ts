/**
 * What stat code can actually reach: the names the QuickJS sandbox injects, the fields a marshalled stat
 * carries, and the built-ins the VM already has. `STAT_CODE_SURFACE` gathers them into the one list the
 * editor, completions, diagnostics and help text read, so none of them can drift apart.
 *
 * This module *describes* the sandbox; it never widens it. Adding a name here does not expose it — the
 * exposure lives in `statCodeExecutor`, and a name added here that the executor doesn't inject would be
 * caught by the drift guard beside this file.
 */

import {
  DELTA_SOURCES, PLACEHOLDER_WRITABLE_FIELD, SELF_WRITABLE_FIELDS, TRAIT_WRITABLE_FIELD, type DeltaSource,
} from '@/lib/statCodeExecutor';
import { nearestName, readOnlyEntries, surfaceKnownNames, withAccess, type CodeSurface, type SurfaceEntry } from '@/lib/codeSurface';
import { STAT_CODE_GUIDE_LINKS } from '@/lib/codeGuideLinks';
import type { PlaceholderKindNoun } from '@/lib/placeholders';
import type { ScriptTiming } from '@/types';

/** An object's members as its completion detail: `{ a, b }`. */
const shapeOf = (entries: readonly SurfaceEntry[]) => `{ ${entries.map((entry) => entry.name).join(', ')} }`;

/** The fields on `clock.previous`: the story clock at the start of the turn. Read-only. */
export const CLOCK_PREVIOUS_FIELDS: readonly SurfaceEntry[] = readOnlyEntries([
  { name: 'day', detail: 'number', info: 'Day number at the start of this turn' },
  { name: 'daypart', detail: 'string', info: 'Daypart at the start of this turn' },
]);

/** The members of `clock`: the story clock at the end of the turn, then `previous` for its start. Read-only. */
export const CLOCK_MEMBERS: readonly SurfaceEntry[] = readOnlyEntries([
  { name: 'day', detail: 'number', info: 'Day number at the end of this turn' },
  { name: 'daypart', detail: 'string', info: 'Daypart at the end of this turn: night, dawn, morning, midday, afternoon or evening' },
  { name: 'deltaHours', detail: 'number', info: 'Story hours this turn consumed' },
  { name: 'elapsedHours', detail: 'number', info: 'Total story hours at the end of this turn' },
  { name: 'previous', detail: shapeOf(CLOCK_PREVIOUS_FIELDS), info: 'Clock at the start of this turn, with day and daypart' },
]);

/** The fields of the clock object that `path` names, or null when `path` is no clock object. */
export function clockFieldsAt(path: string): readonly SurfaceEntry[] | null {
  if (path === 'clock') return CLOCK_MEMBERS;
  return path === 'clock.previous' ? CLOCK_PREVIOUS_FIELDS : null;
}

/** Every name the sandbox injects into the program, in the order an author meets them. */
export const SANDBOX_GLOBALS: readonly SurfaceEntry[] = [
  { name: 'self', detail: 'Stat', info: 'The stat this code belongs to. Assign to self.value to set its value.' },
  { name: 'owner', detail: 'object', info: 'The entity that owns this stat, with the fields of an entities entry. A Blueprint stat’s code runs once for each owner. It’s empty in a global stat. Use owner.stats["Two Words"] for a name with a space.' },
  { name: 'stats', detail: 'object', info: 'The global stats by name, in every stat’s code. An entity’s own are on owner.stats. Use stats["Two Words"] for a name with a space.' },
  { name: 'clock', detail: shapeOf(CLOCK_MEMBERS), info: 'The story clock', access: 'readOnly' },
  { name: 'placeholders', detail: 'object', info: 'The world’s own placeholders by name. An entity’s or a dictionary’s are on its entry. Use placeholders["Two Words"] for a name with a space.' },
  { name: 'traits', detail: 'object', info: 'Every trait in the world by name. Use traits["Two Words"] for a name with a space.' },
  { name: 'entities', detail: 'object', info: 'Every entity in the game by name, with its own traits, placeholders and stats. Use entities["Two Words"] for a name with a space.' },
  { name: 'persona', detail: 'object', info: 'The entity the player plays, with its own traits, placeholders and stats. Empty when the player plays no entity.' },
  { name: 'dictionaries', detail: 'object', info: 'Every dictionary in the game by name, with its own placeholders. A dictionary the player turned off isn’t listed. Use dictionaries["Two Words"] for a name with a space.' },
  { name: 'console', detail: 'object', info: 'Only console.log. Output shows in the browser console.' },
];

/** The fields on every member of `delta`. */
export const DELTA_FIELDS: readonly SurfaceEntry[] = readOnlyEntries([
  { name: 'value', detail: 'number', info: 'Amount the value changed by' },
  { name: 'min', detail: 'number', info: 'Amount the lower bound changed by' },
  { name: 'max', detail: 'number', info: 'Amount the upper bound changed by' },
  { name: 'regen', detail: 'number', info: 'Amount regen per story hour changed by' },
]);

/** What each change source means. Keyed off the executor's own list, as the clock is. */
const DELTA_SOURCE_INFO: Record<DeltaSource, SurfaceEntry> = {
  ai: { name: 'ai', detail: shapeOf(DELTA_FIELDS), info: 'Amount the AI asked for this turn, before flags and the range' },
  regen: { name: 'regen', detail: shapeOf(DELTA_FIELDS), info: 'What regen did this turn, after clamping. Only value changes.' },
};

/** The members of a stat's `delta`: one per change source, then their sum and what landed. */
export const DELTA_MEMBERS: readonly SurfaceEntry[] = readOnlyEntries([
  ...DELTA_SOURCES.map((source) => DELTA_SOURCE_INFO[source]),
  { name: 'total', detail: shapeOf(DELTA_FIELDS), info: 'Sum of every source: what this turn asked of the stat, before flags and the range' },
  { name: 'actual', detail: shapeOf(DELTA_FIELDS), info: 'Current values minus previous' },
]);

/** The fields on a stat object inside `stats`, `self` included. Anything else is `undefined`. */
export const STAT_FIELDS: readonly SurfaceEntry[] = withAccess([
  { name: 'id', detail: 'string', info: 'Unique id of the stat' },
  { name: 'name', detail: 'string', info: 'Code name: the authored name, with each placeholder chip replaced by that placeholder’s name' },
  { name: 'type', detail: 'string', info: 'number, percentage or another type the stat was given' },
  { name: 'description', detail: 'string', info: 'Description text of the stat' },
  { name: 'enabled', detail: 'boolean', info: 'True when the stat is on. False when a trait switched it off, or for an unknown name.' },
  { name: 'min', detail: 'number', info: 'Lower bound that results are clamped to' },
  { name: 'max', detail: 'number', info: 'Upper bound that results are clamped to' },
  { name: 'value', detail: 'number', info: 'Current value, with this turn’s AI change and regen applied' },
  { name: 'regen', detail: 'number', info: 'Regen per story hour, with traits applied' },
  { name: 'previous', detail: 'Stat', info: 'The whole stat at the start of this turn' },
  { name: 'delta', detail: shapeOf(DELTA_MEMBERS), info: 'Every change this turn made to the stat, by source' },
], SELF_WRITABLE_FIELDS, 'writable');

export { PLACEHOLDER_WRITABLE_FIELD, SELF_WRITABLE_FIELDS, TRAIT_WRITABLE_FIELD } from '@/lib/statCodeExecutor';

/** The fields on a stat's `previous`: the whole stat as it stood at the start of this turn. Read-only. */
export const PREVIOUS_FIELDS: readonly SurfaceEntry[] = readOnlyEntries([
  { name: 'id', detail: 'string', info: 'Unique id at the start of this turn' },
  { name: 'name', detail: 'string', info: 'Code name at the start of this turn' },
  { name: 'type', detail: 'string', info: 'number, percentage or another type the stat was given, at the start of this turn' },
  { name: 'description', detail: 'string', info: 'Description text at the start of this turn' },
  { name: 'min', detail: 'number', info: 'Lower bound at the start of this turn, with traits and code writes applied' },
  { name: 'max', detail: 'number', info: 'Upper bound at the start of this turn, with traits and code writes applied' },
  { name: 'value', detail: 'number', info: 'Value at the start of this turn' },
  { name: 'regen', detail: 'number', info: 'Regen per story hour at the start of this turn, with traits applied' },
]);

/**
 * The members of one entry in `placeholders`. An Object's `value` holds every value in force rather than
 * one text, and its `pin` therefore takes a list. The kind is authored, so completions can state the type
 * per entry.
 */
export function placeholderEntryFields(kind: PlaceholderKindNoun): readonly SurfaceEntry[] {
  const list = kind === 'Object';
  return withAccess([
    { name: 'id', detail: 'string', info: 'Unique id of the placeholder' },
    { name: 'name', detail: 'string', info: 'Code name of the placeholder' },
    list
      ? { name: 'value', detail: 'string[]', info: 'Current values as a list, with pins applied' }
      : { name: 'value', detail: 'string', info: 'Text the placeholder reads as now, with pins applied' },
    { name: 'values', detail: 'string[]', info: 'Every value the author wrote, in order, as text. Values with weight 0 are included.' },
    { name: 'text', detail: 'string', info: 'What the prompt sees for this placeholder. A list joins with ", ".' },
    { name: 'roll', detail: '() => string', info: 'Draws one value with the author’s weights. The draw doesn’t persist.' },
    list
      ? { name: 'pin', detail: '(list) => void', info: 'Pins the placeholder to a list of text, after this run. One text pins a one-item list.' }
      : { name: 'pin', detail: '(text) => void', info: 'Pins the placeholder to any text, after this run' },
    { name: 'unpin', detail: '() => void', info: 'Clears the pin that code set, after this run. The rolled value applies again.' },
  ], [PLACEHOLDER_WRITABLE_FIELD], 'afterRun');
}

/** The members of one entry in `traits` and in an entity's `traits`. */
export const TRAIT_ENTRY_FIELDS: readonly SurfaceEntry[] = withAccess([
  { name: 'enabled', detail: 'boolean', info: 'True when the trait is held and on. Assign a boolean to switch the trait on or off.' },
  { name: 'acquired', detail: 'boolean', info: 'True when the trait is held, on or off' },
  { name: 'id', detail: 'string', info: 'Unique id of the trait' },
  { name: 'name', detail: 'string', info: 'Code name of the trait' },
  { name: 'mode', detail: 'string', info: '"optional", "alwaysOn" or "hidden"' },
  { name: 'available', detail: 'boolean', info: 'True when the trait’s requirements hold for its owner now' },
  { name: 'group', detail: 'string', info: 'Code name of the trait’s group, or empty when it has none' },
  { name: 'playerToggle', detail: 'boolean', info: 'True when the player can switch the trait during the game' },
], [TRAIT_WRITABLE_FIELD], 'afterRun');

/** The members of an owner entry that are maps. Their own entries carry the access. */
const OWNER_MAPS = ['traits', 'placeholders', 'stats'];

/** The members of `persona`. The members are read-only; a trait switches through its own `enabled`, and a
 *  stats entry takes writes to its value, min, max and regen while its identity fields stay read-only. */
export const PERSONA_FIELDS: readonly SurfaceEntry[] = readOnlyEntries([
  { name: 'id', detail: 'string', info: 'Unique id of the persona entity, or empty when the player plays no entity' },
  { name: 'name', detail: 'string', info: 'Code name of the persona, or empty when the player plays no entity' },
  { name: 'type', detail: 'string', info: 'Type text of the persona, or empty when it has none' },
  { name: 'pronouns', detail: 'string', info: 'Pronouns text of the persona, or empty when it has none' },
  { name: 'inScene', detail: 'boolean', info: 'True when the persona plays. False when the player plays no entity.' },
  { name: 'traits', detail: 'object', info: 'The persona’s own traits by name, owned or linked. Use persona.traits["Two Words"] for a name with a space.' },
  { name: 'placeholders', detail: 'object', info: 'The persona’s own placeholders by name. Empty when the player plays no entity.' },
  { name: 'stats', detail: 'object', info: 'The persona’s own stats by name, each with the fields of a stats entry. Empty when the player plays no entity. Entries take writes to value, min, max and regen.' },
], OWNER_MAPS);

/** The members of one entry in `entities`, and of `owner`. The members are read-only; a trait switches through
 *  its own `enabled`, and a stats entry takes writes to its value, min, max and regen while its identity fields
 *  stay read-only. */
export const ENTITY_FIELDS: readonly SurfaceEntry[] = readOnlyEntries([
  { name: 'id', detail: 'string', info: 'Unique id of the entity' },
  { name: 'name', detail: 'string', info: 'Code name of the entity' },
  { name: 'type', detail: 'string', info: 'Type text of the entity, or empty when it has none' },
  { name: 'pronouns', detail: 'string', info: 'Pronouns text of the entity, or empty when it has none' },
  { name: 'inScene', detail: 'boolean', info: 'True when the entity is in this turn’s scene' },
  { name: 'traits', detail: 'object', info: 'The entity’s own traits by name, owned or linked. Use entities.Mira.traits["Two Words"] for a name with a space.' },
  { name: 'placeholders', detail: 'object', info: 'The entity’s own placeholders by name. Use entities.Mira.placeholders["Two Words"] for a name with a space.' },
  { name: 'stats', detail: 'object', info: 'The entity’s own stats by name, each with the fields of a stats entry. Entries take writes to value, min, max and regen. Use entities.Mira.stats["Two Words"] for a name with a space.' },
], OWNER_MAPS);

/** The members of one entry in `dictionaries`. None takes a write. */
export const DICTIONARY_FIELDS: readonly SurfaceEntry[] = readOnlyEntries([
  { name: 'id', detail: 'string', info: 'Unique id of the dictionary' },
  { name: 'name', detail: 'string', info: 'Code name of the dictionary' },
  { name: 'placeholders', detail: 'object', info: 'The dictionary’s own placeholders by name. Use dictionaries.Lore.placeholders["Two Words"] for a name with a space.' },
], OWNER_MAPS);

/** Built-ins the VM already has. Listed so a reference to one isn't flagged, and so completions offer the
 *  handful that stat code actually reaches for rather than everything a JS engine defines. */
export const SANDBOX_BUILTINS: readonly SurfaceEntry[] = [
  { name: 'Math', detail: 'object', info: 'min, max, round, floor, abs, random and the rest' },
  { name: 'JSON', detail: 'object', info: 'parse and stringify' },
  { name: 'Number', detail: 'function', info: 'Converts a value to a number. Also includes Number.isFinite and related functions.' },
  { name: 'String', detail: 'function', info: 'Converts a value to a string' },
  { name: 'Boolean', detail: 'function', info: 'Converts a value to true or false' },
  { name: 'Array', detail: 'function', info: 'Array.isArray, Array.from' },
  { name: 'Object', detail: 'function', info: 'Object.keys, Object.values, Object.entries' },
  { name: 'Date', detail: 'function', info: 'Real-world clock. For story time, use clock.' },
  { name: 'parseInt', detail: 'function', info: 'Reads a whole number out of a string' },
  { name: 'parseFloat', detail: 'function', info: 'Reads a decimal number out of a string' },
  { name: 'isNaN', detail: 'function', info: 'True when a value isn’t a number' },
  { name: 'isFinite', detail: 'function', info: 'True when a value is a finite number' },
  { name: 'NaN', detail: 'number', info: 'The not-a-number value' },
  { name: 'Infinity', detail: 'number', info: 'Positive infinity' },
  { name: 'undefined', detail: 'undefined', info: 'The absent value' },
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
    { name: 'min', detail: '(...n) => number', info: 'Returns the smallest of its arguments' },
    { name: 'max', detail: '(...n) => number', info: 'Returns the largest of its arguments' },
    { name: 'round', detail: '(n) => number', info: 'Rounds to the nearest whole number, with halves rounding up' },
    { name: 'floor', detail: '(n) => number', info: 'Rounds down to a whole number' },
    { name: 'ceil', detail: '(n) => number', info: 'Rounds up to a whole number' },
    { name: 'trunc', detail: '(n) => number', info: 'Drops the fractional part, toward zero' },
    { name: 'abs', detail: '(n) => number', info: 'Returns the distance from zero, never negative' },
    { name: 'sign', detail: '(n) => number', info: 'Returns -1, 0 or 1 by the sign' },
    { name: 'pow', detail: '(n, exp) => number', info: 'Raises the first argument to the second' },
    { name: 'sqrt', detail: '(n) => number', info: 'Returns the square root' },
    { name: 'hypot', detail: '(...n) => number', info: 'Returns the square root of the sum of the squares' },
    { name: 'log', detail: '(n) => number', info: 'Returns the natural logarithm' },
    { name: 'exp', detail: '(n) => number', info: 'Returns e raised to the given power' },
    { name: 'random', detail: '() => number', info: 'Returns a number from 0 up to but not including 1. Reseeded each run.' },
    { name: 'PI', detail: 'number', info: 'Ratio of a circle’s circumference to its diameter' },
    { name: 'E', detail: 'number', info: 'Base of the natural logarithm' },
  ],
  JSON: [
    { name: 'parse', detail: '(text) => any', info: 'Reads a value back out of JSON text' },
    { name: 'stringify', detail: '(value) => string', info: 'Writes a value as JSON text' },
  ],
  Object: [
    { name: 'keys', detail: '(obj) => string[]', info: 'Returns the object’s own property names' },
    { name: 'values', detail: '(obj) => any[]', info: 'Returns the object’s own property values' },
    { name: 'entries', detail: '(obj) => any[][]', info: 'Returns one [name, value] pair per own property' },
    { name: 'assign', detail: '(target, ...src) => obj', info: 'Copies properties onto the first object' },
    { name: 'fromEntries', detail: '(pairs) => obj', info: 'Builds an object from [name, value] pairs' },
    { name: 'freeze', detail: '(obj) => obj', info: 'Stops further changes to an object' },
  ],
  Number: [
    { name: 'isFinite', detail: '(n) => boolean', info: 'True when the value is a number and not infinite' },
    { name: 'isInteger', detail: '(n) => boolean', info: 'True when the value is a whole number' },
    { name: 'isNaN', detail: '(n) => boolean', info: 'True when the value is the not-a-number value' },
    { name: 'parseFloat', detail: '(text) => number', info: 'Reads a decimal number out of a string' },
    { name: 'parseInt', detail: '(text) => number', info: 'Reads a whole number out of a string' },
    { name: 'EPSILON', detail: 'number', info: 'Smallest gap between two representable numbers near 1' },
    { name: 'MAX_SAFE_INTEGER', detail: 'number', info: 'Largest whole number that stays exact' },
    { name: 'MIN_SAFE_INTEGER', detail: 'number', info: 'Smallest whole number that stays exact' },
  ],
  Array: [
    { name: 'isArray', detail: '(value) => boolean', info: 'True when the value is an array' },
    { name: 'from', detail: '(value, fn?) => any[]', info: 'Builds an array from anything list-shaped' },
    { name: 'of', detail: '(...items) => any[]', info: 'Builds an array from its arguments' },
  ],
  String: [
    { name: 'fromCharCode', detail: '(...codes) => string', info: 'Builds a string from character codes' },
    { name: 'raw', detail: '(strings, ...v) => string', info: 'Returns a template literal with its escapes left as written' },
  ],
  Boolean: [],
  Date: [
    { name: 'now', detail: '() => number', info: 'Real-world milliseconds since 1970. The story clock is clock.elapsedHours.' },
    { name: 'parse', detail: '(text) => number', info: 'Reads a date string as milliseconds' },
    { name: 'UTC', detail: '(y, m, ...) => number', info: 'Returns milliseconds for a date given in UTC parts' },
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
  // The Variable menu is the drill tree in `statCodeVariableTree`.
  missingReturn: 'This code never returns a number or writes self.value, so the stat keeps its value.',
  statMaps: true,
  guide: STAT_CODE_GUIDE_LINKS,
};

/** A trait's own entry as its script's `self` reads it: no field takes a write. */
export const SELF_TRAIT_FIELDS: readonly SurfaceEntry[] = readOnlyEntries(TRAIT_ENTRY_FIELDS.map((entry) =>
  (entry.name === TRAIT_WRITABLE_FIELD ? { ...entry, info: 'True when the trait is held and on' } : entry)));

/** A trait script's surface: stat code's, with `self` as the trait and nothing owed back. */
export const TRAIT_SCRIPT_SURFACE: CodeSurface = {
  ...STAT_CODE_SURFACE,
  label: 'trait script',
  globals: SANDBOX_GLOBALS.map((entry) => {
    if (entry.name === 'self') {
      return { name: 'self', detail: 'Trait', info: 'The trait this script belongs to. Read-only. Switch a trait through traits or owner.traits.', access: 'readOnly' };
    }
    return entry.name === 'owner'
      ? { ...entry, info: 'The entity that holds this trait, with the fields of an entities entry. It’s empty for a global trait. Use owner.stats["Two Words"] for a name with a space.' }
      : entry;
  }),
  missingReturn: null,
  selfIs: 'trait',
};

/** The fields of `trait` in a When a Trait Switches script: the trait that switched, after the switch. */
export const SWITCHED_TRAIT_FIELDS: readonly SurfaceEntry[] = readOnlyEntries([
  ...TRAIT_ENTRY_FIELDS.map((entry) => (entry.name === TRAIT_WRITABLE_FIELD
    ? { ...entry, info: 'True when the switch turned the trait on. False when it turned it off.' } : entry)),
  { name: 'owner', detail: 'string', info: 'Code name of the entity that holds the trait, or empty for a global trait' },
]);

/** `trait`, which only a When a Trait Switches script reads. */
const SWITCHED_TRAIT_GLOBAL: SurfaceEntry = {
  name: 'trait', detail: 'Trait', access: 'readOnly',
  info: 'The trait that switched. Read-only. Its enabled field tells you which way it switched.',
};

/** A script box's surface: its home's, with `trait` in a When a Trait Switches script only. */
export const scriptSurface = (surface: CodeSurface, timing: ScriptTiming): CodeSurface =>
  (timing === 'switch' ? { ...surface, globals: [...surface.globals, SWITCHED_TRAIT_GLOBAL] } : surface);

/** A world script's surface: stat code's, with `self` and `owner` empty and nothing owed back (Q31). */
export const WORLD_SCRIPT_SURFACE: CodeSurface = {
  ...STAT_CODE_SURFACE,
  label: 'world script',
  globals: SANDBOX_GLOBALS.map((entry) => (entry.name === 'self' || entry.name === 'owner'
    ? { name: entry.name, detail: 'object', info: 'Empty in a world script.', access: 'readOnly' }
    : entry)),
  missingReturn: null,
  selfIs: 'empty',
};

/**
 * The stat-code name an unknown identifier was most likely meant to be, or null when nothing is close
 * enough to be worth suggesting. Case-insensitive, so `Stats` still points at `stats`.
 */
export function nearestSurfaceName(name: string, extra: readonly string[] = []): string | null {
  return nearestName(name, [...surfaceKnownNames(STAT_CODE_SURFACE), ...extra]);
}
