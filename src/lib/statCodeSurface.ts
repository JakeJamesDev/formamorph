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
  { name: 'hour', detail: 'number', info: 'Hour of the day at the start of this turn, from 0' },
  { name: 'minute', detail: 'number', info: 'Minute of the hour at the start of this turn, 0 to 59' },
]);

/** The members of `clock`: the story clock at the end of the turn, then `previous` for its start. Read-only. */
export const CLOCK_MEMBERS: readonly SurfaceEntry[] = readOnlyEntries([
  { name: 'day', detail: 'number', info: 'Day number at the end of this turn' },
  { name: 'daypart', detail: 'string', info: 'Daypart at the end of this turn: night, dawn, morning, midday, afternoon or evening' },
  { name: 'hour', detail: 'number', info: 'Hour of the day at the end of this turn, from 0' },
  { name: 'minute', detail: 'number', info: 'Minute of the hour at the end of this turn, 0 to 59' },
  { name: 'deltaHours', detail: 'number', info: 'Story hours this turn consumed' },
  { name: 'elapsedHours', detail: 'number', info: 'Total story hours at the end of this turn' },
  { name: 'previous', detail: shapeOf(CLOCK_PREVIOUS_FIELDS), info: 'Clock at the start of this turn, with day, daypart, hour and minute' },
  { name: 'advance', detail: '(minutes) => void', info: 'Sets how long this turn takes, in story minutes, in place of the AI’s measure. Calls in one turn add up. The clock reads the same for the rest of the script.' },
]);

/** The members of `turn`: the player's action and the turn number. Read-only. */
export const TURN_MEMBERS: readonly SurfaceEntry[] = readOnlyEntries([
  { name: 'action', detail: 'string', info: 'The player’s action this turn, OOC brackets included. On the opening turn, the opening the AI gets. Empty on an Opening Narration and between turns.' },
  { name: 'number', detail: 'number', info: 'Turn number on the scale of memories[].turn: 1 on the opening turn, 0 before it. Between turns, the last turn that ended.' },
]);

/** The members of one entry in `locations`. None takes a write. */
export const LOCATION_ENTRY_FIELDS: readonly SurfaceEntry[] = readOnlyEntries([
  { name: 'id', detail: 'string', info: 'Unique id of the location' },
  { name: 'name', detail: 'string', info: 'Code name of the location' },
  { name: 'description', detail: 'string', info: 'Full AI description of the location, its placeholders filled in' },
  { name: 'summary', detail: 'string', info: 'Short AI summary of the location, its placeholders filled in' },
  { name: 'starting', detail: 'boolean', info: 'True when the game can start at the location' },
  { name: 'present', detail: 'array', info: 'The entities at the location, each an entry of entities, the persona first when the player is there' },
  { name: 'parent', detail: 'string', info: 'Code name of the location this one is inside, or empty at the top level' },
  { name: 'children', detail: 'string[]', info: 'Code names of the locations inside this one, in the order the editor lists them' },
  { name: 'exits', detail: 'array', info: 'Where the AI can move the player from the location, each exit with a code name and travel hint' },
]);

/** The members of one entry in a location's `exits`. */
export const LOCATION_EXIT_FIELDS: readonly SurfaceEntry[] = readOnlyEntries([
  { name: 'name', detail: 'string', info: 'Code name of the location the exit leads to, a key of locations' },
  { name: 'hint', detail: 'string', info: 'Travel hint of the Connection the exit takes, its placeholders filled in, or empty when it has none' },
]);

/** The members of `location`: the fields of a `locations` entry for where the turn stands, and the move. */
export const LOCATION_MEMBERS: readonly SurfaceEntry[] = readOnlyEntries([
  { name: 'id', detail: 'string', info: 'Unique id of the location the turn is at, or empty in a world with no location' },
  { name: 'name', detail: 'string', info: 'Code name of the location the turn is at, or empty in a world with no location' },
  { name: 'description', detail: 'string', info: 'Full AI description of the location the turn is at, its placeholders filled in' },
  { name: 'summary', detail: 'string', info: 'Short AI summary of the location the turn is at, its placeholders filled in' },
  { name: 'starting', detail: 'boolean', info: 'True when the game can start at the location the turn is at' },
  { name: 'present', detail: 'array', info: 'The entities at the turn’s location, the persona first, or none in a world with no location' },
  { name: 'parent', detail: 'string', info: 'Code name of the location the turn’s location is inside, or empty at the top level' },
  { name: 'children', detail: 'string[]', info: 'Code names of the locations inside the turn’s location, in the order the editor lists them' },
  { name: 'exits', detail: 'array', info: 'Where the AI can move the player this turn, each exit with a code name and travel hint' },
  { name: 'move', detail: '(nameOrId) => void', info: 'Moves the turn to a location of the world, in place of the AI’s move. A name the world has no location for stops the script with an error.' },
]);

/** The verbs on `memories`: a line for this turn, and a pinned line. */
export const MEMORY_MEMBERS: readonly SurfaceEntry[] = readOnlyEntries([
  { name: 'add', detail: '(line) => void', info: 'Adds a line to this turn’s memory, after the AI’s summary. Recall finds it on later turns when it fits, and it isn’t sent with every request.' },
  { name: 'pin', detail: '(line) => void', info: 'Adds a memory that’s sent with every request, listed under Custom as in the Memory Manager. It never loses its place to the memory limit.' },
]);

/** The members of one entry in `memories`: its read-only fields, then the Memory Manager's verbs. */
export const MEMORY_ENTRY_FIELDS: readonly SurfaceEntry[] = readOnlyEntries([
  { name: 'id', detail: 'string', info: 'Unique id of the memory' },
  { name: 'turn', detail: 'number', info: 'Turn number of the memory, from 1, or the turn before it was added for a Custom memory' },
  { name: 'timestamp', detail: 'number', info: 'Total story hours at the end of that turn, on the scale of clock.elapsedHours' },
  { name: 'day', detail: 'number', info: 'Day number at the end of that turn' },
  { name: 'daypart', detail: 'string', info: 'Daypart at the end of that turn: night, dawn, morning, midday, afternoon or evening' },
  { name: 'text', detail: 'string', info: 'Text of the memory as the Memory panel shows it, edits included' },
  { name: 'custom', detail: 'boolean', info: 'True for a memory listed under Custom: one the player wrote or a script pinned' },
  { name: 'kept', detail: 'boolean', info: 'True when the story keeps the memory, though recall can still leave it out of a turn' },
  { name: 'inContext', detail: 'boolean', info: 'True when the memory went to the AI on the last turn' },
  { name: 'pinned', detail: 'boolean', info: 'True when the memory is pinned to stay' },
  { name: 'forgotten', detail: 'boolean', info: 'True when the memory is pinned to go' },
  { name: 'pin', detail: '() => void', info: 'Pins the memory to stay when the turn ends, as Pin This Memory in the Memory Manager does. On a Custom memory it does nothing, and the run lists it as ignored.' },
  { name: 'forget', detail: '() => void', info: 'Pins the memory to go when the turn ends, as Forget This Memory in the Memory Manager does. On a Custom memory it does nothing, and the run lists it as ignored.' },
  { name: 'edit', detail: '(text) => void', info: 'Rewrites the memory when the turn ends, as an edit in the Memory Manager does. A summary keeps its original and is pinned to stay.' },
  { name: 'remove', detail: '() => void', info: 'Erases the memory when the turn ends, as Delete This Memory in the Memory Manager does. You can restore it there.' },
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
  { name: 'turn', detail: shapeOf(TURN_MEMBERS), info: 'The player’s action and the turn number. Test Code and the Test Bench read a sample action at turn 2. At Game Start reads the opening at turn 1.', access: 'readOnly' },
  { name: 'locations', detail: 'object', info: 'Every location in the world by name, with the entities at each. Use locations["Two Words"] for a name with a space.' },
  { name: 'location', detail: shapeOf(LOCATION_MEMBERS), info: 'The location the turn is at, with the fields of a locations entry. Call location.move to move it.', access: 'readOnly' },
  { name: 'discover', detail: '(name, description?) => void', info: 'Adds a new entity to the turn, described by the AI unless you pass a description. A name an entity already has does nothing.' },
  {
    name: 'memories', detail: 'array', access: 'readOnly',
    info: 'The story’s memories as the Memory panel lists them, oldest first. Each entry has its id, turn, day, daypart, text, Custom flag and pins. Call memories.add or memories.pin to add one. It’s empty in Test Code and the Test Bench.',
  },
  { name: 'notes', detail: 'string', info: 'The player’s notes. It’s empty in Test Code and the Test Bench.', access: 'readOnly' },
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
  { name: 'hidden', detail: 'boolean', info: 'True when the stat is hidden from the player. The AI still reads it. Set it to hide or show the stat.' },
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
  { name: 'hidden', detail: 'boolean', info: 'True when the stat is hidden from the player, at the start of this turn' },
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
 *  stats entry takes writes to its value, min, max, regen and hidden while its identity fields stay read-only. */
export const PERSONA_FIELDS: readonly SurfaceEntry[] = readOnlyEntries([
  { name: 'id', detail: 'string', info: 'Unique id of the persona entity, or empty when the player plays no entity' },
  { name: 'name', detail: 'string', info: 'Code name of the persona, or empty when the player plays no entity' },
  { name: 'type', detail: 'string', info: 'Type text of the persona, or empty when it has none' },
  { name: 'pronouns', detail: 'string', info: 'Pronouns text of the persona, or empty when it has none' },
  { name: 'inScene', detail: 'boolean', info: 'True when the persona plays, false when the player plays no entity' },
  { name: 'location', detail: 'string', info: 'Code name of the location the player is at, or empty in a world with no location' },
  { name: 'following', detail: 'boolean', info: 'Always false, since the persona moves with the player' },
  { name: 'description', detail: 'string', info: 'Full AI description of the persona, its placeholders filled in' },
  { name: 'summary', detail: 'string', info: 'Short AI summary of the persona, its placeholders filled in' },
  { name: 'aliases', detail: 'array', info: 'Other names of the persona, its placeholders filled in' },
  { name: 'traits', detail: 'object', info: 'The persona’s own traits by name, owned or linked. Use persona.traits["Two Words"] for a name with a space.' },
  { name: 'placeholders', detail: 'object', info: 'The persona’s own placeholders by name, or empty when the player plays no entity' },
  { name: 'stats', detail: 'object', info: 'The persona’s own stats by name, each a stats entry, or empty when the player plays no entity' },
], OWNER_MAPS);

/** The members of one entry in `entities`, and of `owner`. The members are read-only; a trait switches through
 *  its own `enabled`, and a stats entry takes writes to its value, min, max, regen and hidden while its identity fields
 *  stay read-only. */
export const ENTITY_FIELDS: readonly SurfaceEntry[] = readOnlyEntries([
  { name: 'id', detail: 'string', info: 'Unique id of the entity' },
  { name: 'name', detail: 'string', info: 'Code name of the entity' },
  { name: 'type', detail: 'string', info: 'Type text of the entity, or empty when it has none' },
  { name: 'pronouns', detail: 'string', info: 'Pronouns text of the entity, or empty when it has none' },
  { name: 'inScene', detail: 'boolean', info: 'True when the entity is in this turn’s scene' },
  { name: 'location', detail: 'string', info: 'Code name of the entity’s location, the player’s for a follower, or empty at every location it lists' },
  { name: 'following', detail: 'boolean', info: 'True when the entity follows the player' },
  { name: 'description', detail: 'string', info: 'Full AI description of the entity, its placeholders filled in' },
  { name: 'summary', detail: 'string', info: 'Short AI summary of the entity, its placeholders filled in' },
  { name: 'aliases', detail: 'array', info: 'Other names of the entity, its placeholders filled in' },
  { name: 'traits', detail: 'object', info: 'The entity’s own traits by name, owned or linked. Use entities.Mira.traits["Two Words"] for a name with a space.' },
  { name: 'placeholders', detail: 'object', info: 'The entity’s own placeholders by name. Use entities.Mira.placeholders["Two Words"] for a name with a space.' },
  { name: 'stats', detail: 'object', info: 'The entity’s own stats by name, each with the fields of a stats entry. Entries take writes to value, min, max, regen and hidden. Use entities.Mira.stats["Two Words"] for a name with a space.' },
  { name: 'move', detail: '(nameOrId) => void', info: 'Moves the entity to a location of the world when the turn ends, and stops it following the player. A name the world has no location for stops the script with an error.' },
  { name: 'follow', detail: '() => void', info: 'Makes the entity follow the player when the turn ends, at the player’s location' },
  { name: 'unfollow', detail: '() => void', info: 'Stops the entity following the player when the turn ends, and leaves it at the player’s location. An entity that isn’t following stays where it is.' },
  { name: 'diary', detail: '(line) => void', info: 'Adds a line to the entity’s diary for this turn, after the AI’s entry. An entity the game doesn’t have stops the script with an error.' },
], OWNER_MAPS);

/** The members of one entry in a dictionary's `entries`. None takes a write. */
export const DICTIONARY_ENTRY_FIELDS: readonly SurfaceEntry[] = readOnlyEntries([
  { name: 'id', detail: 'string', info: 'Unique id of the entry' },
  { name: 'name', detail: 'string', info: 'Code name of the entry' },
  { name: 'keys', detail: 'string[]', info: 'Trigger Keywords of the entry, where a match in a message activates it' },
  { name: 'value', detail: 'string', info: 'Value of the entry: the text the AI gets when the entry activates' },
]);

/** The members of one entry in `dictionaries`. None takes a write. */
export const DICTIONARY_FIELDS: readonly SurfaceEntry[] = readOnlyEntries([
  { name: 'id', detail: 'string', info: 'Unique id of the dictionary' },
  { name: 'name', detail: 'string', info: 'Code name of the dictionary' },
  { name: 'entries', detail: 'object', info: 'The dictionary’s entries by name, each with id, name, keys and value. A disabled entry isn’t listed. Use dictionaries.Lore.entries["Two Words"] for a name with a space.' },
  { name: 'placeholders', detail: 'object', info: 'The dictionary’s own placeholders by name. Use dictionaries.Lore.placeholders["Two Words"] for a name with a space.' },
], [...OWNER_MAPS, 'entries']);

/** Built-ins the VM already has. Listed so a reference to one isn't flagged, and so completions offer the
 *  handful that stat code actually reaches for rather than everything a JS engine defines. */
export const SANDBOX_BUILTINS: readonly SurfaceEntry[] = [
  { name: 'Math', detail: 'object', info: 'min, max, round, floor, abs, random and the rest' },
  { name: 'JSON', detail: 'object', info: 'parse and stringify' },
  { name: 'Number', detail: 'function', info: 'Converts a value to a number, with Number.isFinite and related functions on it' },
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
    { name: 'min', detail: '(...n) => number', info: 'Picks the smallest of its arguments' },
    { name: 'max', detail: '(...n) => number', info: 'Picks the largest of its arguments' },
    { name: 'round', detail: '(n) => number', info: 'Rounds to the nearest whole number, with halves rounding up' },
    { name: 'floor', detail: '(n) => number', info: 'Rounds down to a whole number' },
    { name: 'ceil', detail: '(n) => number', info: 'Rounds up to a whole number' },
    { name: 'trunc', detail: '(n) => number', info: 'Drops the fractional part, toward zero' },
    { name: 'abs', detail: '(n) => number', info: 'Finds the distance from zero, never negative' },
    { name: 'sign', detail: '(n) => number', info: 'Reads the sign as -1, 0 or 1' },
    { name: 'pow', detail: '(n, exp) => number', info: 'Raises the first argument to the second' },
    { name: 'sqrt', detail: '(n) => number', info: 'Takes the square root' },
    { name: 'hypot', detail: '(...n) => number', info: 'Takes the square root of the sum of the squares' },
    { name: 'log', detail: '(n) => number', info: 'Takes the natural logarithm' },
    { name: 'exp', detail: '(n) => number', info: 'Raises e to the given power' },
    { name: 'random', detail: '() => number', info: 'Draws a number from 0 up to but not including 1, reseeded each run' },
    { name: 'PI', detail: 'number', info: 'Ratio of a circle’s circumference to its diameter' },
    { name: 'E', detail: 'number', info: 'Base of the natural logarithm' },
  ],
  JSON: [
    { name: 'parse', detail: '(text) => any', info: 'Reads a value back out of JSON text' },
    { name: 'stringify', detail: '(value) => string', info: 'Writes a value as JSON text' },
  ],
  Object: [
    { name: 'keys', detail: '(obj) => string[]', info: 'Lists the object’s own property names' },
    { name: 'values', detail: '(obj) => any[]', info: 'Lists the object’s own property values' },
    { name: 'entries', detail: '(obj) => any[][]', info: 'Lists one [name, value] pair per own property' },
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
    { name: 'raw', detail: '(strings, ...v) => string', info: 'Reads a template literal with its escapes as written' },
  ],
  Boolean: [],
  Date: [
    { name: 'now', detail: '() => number', info: 'Real-world milliseconds since 1970. The story clock is clock.elapsedHours.' },
    { name: 'parse', detail: '(text) => number', info: 'Reads a date string as milliseconds' },
    { name: 'UTC', detail: '(y, m, ...) => number', info: 'Converts a date given in UTC parts to milliseconds' },
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
  label: 'stat script',
  globals: SANDBOX_GLOBALS,
  builtins: SANDBOX_BUILTINS,
  members: new Map([...BUILTIN_MEMBERS, ['location', LOCATION_MEMBERS], ['memories', MEMORY_MEMBERS], ['turn', TURN_MEMBERS]]),
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
      return { name: 'self', detail: 'Trait', info: 'The trait this script belongs to. Switch a trait through traits or owner.traits.', access: 'readOnly' };
    }
    return entry.name === 'owner'
      ? { ...entry, info: 'The entity this trait belongs to, with the fields of an entities entry. It’s empty for a global trait. Use owner.stats["Two Words"] for a name with a space.' }
      : entry;
  }),
  missingReturn: null,
  selfIs: 'trait',
};

/** The fields of `trait` in a When a Trait Switches script: the trait that switched, after the switch. */
export const SWITCHED_TRAIT_FIELDS: readonly SurfaceEntry[] = readOnlyEntries([
  ...TRAIT_ENTRY_FIELDS.map((entry) => (entry.name === TRAIT_WRITABLE_FIELD
    ? { ...entry, info: 'True when the switch turned the trait on. False when it turned it off.' } : entry)),
  { name: 'owner', detail: 'string', info: 'Code name of the entity the trait belongs to, or empty for a global trait' },
]);

/** `trait`, which only a When a Trait Switches script reads. */
export const SWITCHED_TRAIT_GLOBAL: SurfaceEntry = {
  name: 'trait', detail: 'Trait', access: 'readOnly',
  info: 'The trait that switched. Its enabled field tells you which way.',
};

/** The fields of `narration` in a During AI Output script. Only `sentence` takes a write. */
export const NARRATION_FIELDS: readonly SurfaceEntry[] = withAccess([
  { name: 'sentence', detail: 'string', info: 'The sentence that just completed. Assign it, or return a string, to replace it.' },
  { name: 'sent', detail: 'string[]', info: 'The earlier sentences the reveal already released' },
  { name: 'buffered', detail: 'string[]', info: 'The complete sentences the reveal still has queued, already past their scripts' },
  { name: 'full', detail: 'string', info: 'Everything received so far, the sentence and the partial tail included' },
  { name: 'index', detail: 'number', info: 'The position of the sentence in the reply, from 0' },
], ['sentence'], 'writable');

/** `narration`, which only a During AI Output script reads. */
export const NARRATION_GLOBAL: SurfaceEntry = {
  name: 'narration', detail: shapeOf(NARRATION_FIELDS),
  info: 'The narration around the sentence that just completed. Assign narration.sentence to rewrite the sentence.',
};

/** The calls on `player`, in the order the guide lists them. */
export const PLAYER_CALL_ENTRIES: readonly SurfaceEntry[] = [
  { name: 'tell', detail: '(text) => void', info: 'Shows the player a message under the narration. It stays with the turn and never reaches the AI.' },
  { name: 'toast', detail: '(text) => void', info: 'Shows the player a toast. It isn’t saved.' },
  { name: 'confirm', detail: '(question) => boolean', info: 'Asks a yes or no question and waits for the answer' },
  { name: 'ask', detail: '(question, options, { multiple }?) => any', info: 'Asks the player to pick from text or { label, value } options, and waits. The result is the value picked, or a list with multiple.' },
  { name: 'input', detail: '(question, placeholder?) => string', info: 'Asks the player for typed text and waits for the answer' },
];

/** `player`, which every script reads except a During AI Output one. */
export const PLAYER_GLOBAL: SurfaceEntry = {
  name: 'player', detail: shapeOf(PLAYER_CALL_ENTRIES),
  info: 'The human playing, not the entity they play. Tell or ask them through its calls. A call that asks waits for the answer, with no await.',
};

/** The object a timing hands its script, with its members: `narration` in During AI Output, `player` elsewhere. */
const timingObject = (timing: ScriptTiming) => (timing === 'output'
  ? { global: NARRATION_GLOBAL, members: NARRATION_FIELDS }
  : { global: PLAYER_GLOBAL, members: PLAYER_CALL_ENTRIES });

/** A script box's surface: its home's, with the names its timing adds. `narration` is During AI Output's, and
 *  `player` is every other timing's. `trait` is When a Trait Switches's. */
export const scriptSurface = (surface: CodeSurface, timing: ScriptTiming): CodeSurface => {
  const { global, members } = timingObject(timing);
  return {
    ...surface,
    globals: [...surface.globals, global, ...(timing === 'switch' ? [SWITCHED_TRAIT_GLOBAL] : [])],
    members: new Map([...surface.members, [global.name, members]]),
  };
};

/** A world script's surface: stat code's, with `self` and `owner` empty and nothing owed back (Q31). */
export const WORLD_SCRIPT_SURFACE: CodeSurface = {
  ...STAT_CODE_SURFACE,
  label: 'world script',
  globals: SANDBOX_GLOBALS.map((entry) => (entry.name === 'self' || entry.name === 'owner'
    ? { name: entry.name, detail: 'object', info: 'Empty in a world script', access: 'readOnly' }
    : entry)),
  missingReturn: null,
  selfIs: 'empty',
};

/** Each home's surface, by the kind of home a script sits on. */
export const SCRIPT_SURFACES = { stat: STAT_CODE_SURFACE, trait: TRAIT_SCRIPT_SURFACE, world: WORLD_SCRIPT_SURFACE } as const;

/**
 * The stat-code name an unknown identifier was most likely meant to be, or null when nothing is close
 * enough to be worth suggesting. Case-insensitive, so `Stats` still points at `stats`.
 */
export function nearestSurfaceName(name: string, extra: readonly string[] = []): string | null {
  return nearestName(name, [...surfaceKnownNames(STAT_CODE_SURFACE), ...extra]);
}
