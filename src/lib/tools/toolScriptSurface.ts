/**
 * What a Tool script can reach, as the code editor reads it: `args` typed from the Tool's parameters, the
 * world, the current scene, the resolved placeholders and `console.log`. It describes the sandbox in
 * `toolScript`; it never widens it.
 */
import type { ToolParam } from '@/types';
import { closeSentence, readOnlyEntries, type CodeSurface, type SurfaceEntry } from '@/lib/codeSurface';
import { TOOL_GUIDE_LINKS } from '@/lib/codeGuideLinks';
import { BUILTIN_MEMBERS, LANGUAGE_NAMES, SANDBOX_BUILTINS } from '@/lib/statCodeSurface';
import { listOptions, namedParams } from './toolDraft';
import { TOOL_SCRIPT_INPUTS } from './toolScript';

/** Whether `path` reads through a global the script gets frozen. */
const isFrozenPath = (path: string) => (TOOL_SCRIPT_INPUTS as readonly string[]).includes(path.split('.')[0]);

const shapeOf = (entries: readonly SurfaceEntry[]) => `{ ${entries.map((entry) => entry.name).join(', ')} }`;

/** The fields of one `world.entities` item. */
export const ENTITY_MEMBERS: readonly SurfaceEntry[] = [
  { name: 'id', detail: 'string', info: 'Unique id of the entity' },
  { name: 'name', detail: 'string', info: 'Name of the entity' },
  { name: 'aliases', detail: 'string[]', info: 'Other names for the entity' },
  { name: 'type', detail: 'string', info: 'The entity’s type' },
  { name: 'pronouns', detail: 'string', info: 'The entity’s pronouns' },
  { name: 'description', detail: 'string', info: 'The full AI description' },
  { name: 'summary', detail: 'string', info: 'The short summary' },
  { name: 'placeholders', detail: 'object', info: 'Each of the entity’s placeholders by name, as resolved text' },
];

/** The fields of one `world.locations` item. */
export const LOCATION_ITEM_MEMBERS: readonly SurfaceEntry[] = [
  { name: 'id', detail: 'string', info: 'Unique id of the location' },
  { name: 'name', detail: 'string', info: 'Name of the location' },
  { name: 'description', detail: 'string', info: 'The full AI description' },
  { name: 'summary', detail: 'string', info: 'The short summary' },
];

/** The fields of one `world.dictionary` item. */
export const DICTIONARY_MEMBERS: readonly SurfaceEntry[] = [
  { name: 'id', detail: 'string', info: 'Unique id of the entry' },
  { name: 'name', detail: 'string', info: 'Name of the entry' },
  { name: 'keys', detail: 'string[]', info: 'The keywords that trigger the entry' },
  { name: 'value', detail: 'string', info: 'The entry’s text' },
  { name: 'placeholders', detail: 'object', info: 'Each of its dictionary’s placeholders by name, as resolved text' },
];

/** The members of `world`. */
export const WORLD_MEMBERS: readonly SurfaceEntry[] = [
  { name: 'entities', detail: `${shapeOf(ENTITY_MEMBERS)}[]`, info: 'Every entity, including the ones the playthrough discovered during the game. Each entity’s placeholders maps its placeholder names to their values.' },
  { name: 'locations', detail: `${shapeOf(LOCATION_ITEM_MEMBERS)}[]`, info: 'Every location' },
  { name: 'dictionary', detail: `${shapeOf(DICTIONARY_MEMBERS)}[]`, info: 'Every enabled dictionary entry. Each entry’s placeholders maps its dictionary’s placeholder names to their values.' },
];

export const LOCATION_MEMBERS: readonly SurfaceEntry[] = [
  { name: 'id', detail: 'string', info: 'Unique id of the location' },
  { name: 'name', detail: 'string', info: 'Name of the location' },
];

export const TIME_MEMBERS: readonly SurfaceEntry[] = [
  { name: 'elapsed', detail: 'number', info: 'Story hours since the opening' },
];

/** The members of `scene`. */
export const SCENE_MEMBERS: readonly SurfaceEntry[] = [
  { name: 'location', detail: `${shapeOf(LOCATION_MEMBERS)} | null`, info: 'Where the scene is, or null when the scene has no location' },
  { name: 'present', detail: 'string[]', info: 'Names of the entities at the location' },
  { name: 'inScene', detail: 'string[]', info: 'Names of the entities that took part in the scene' },
  { name: 'stats', detail: 'object', info: 'Each stat’s current value by name. Use scene.stats["Two Words"] for a name with a space.' },
  { name: 'traits', detail: 'string[]', info: 'Names of the traits that apply now' },
  { name: 'persona', detail: 'string | null', info: 'Name of the entity the player plays, or null' },
  { name: 'notes', detail: 'string', info: 'The player’s notes' },
  { name: 'time', detail: `${shapeOf(TIME_MEMBERS)} | null`, info: 'The story clock, or null while it’s off' },
];

const TYPE_DETAIL: Record<Exclude<ToolParam['type'], 'enum'>, string> = { string: 'string', number: 'number', boolean: 'boolean' };

/** One parameter as a member of `args`. */
export function argEntry(param: ToolParam): SurfaceEntry {
  const detail = param.type === 'enum'
    ? listOptions(param).map((o) => JSON.stringify(o)).join(' | ') || 'string'
    : TYPE_DETAIL[param.type];
  const described = param.description.trim() || 'What the AI passed';
  return { name: param.name, detail, info: param.required ? described : `${closeSentence(described)} Absent when the AI leaves it out.` };
}

// The story clock is the scene's, so the real-world clock says so in this surface's own words.
const DATE_INFO = 'Real-world clock. The story clock is scene.time.';
const BUILTINS = SANDBOX_BUILTINS.map((entry) => (entry.name === 'Date' ? { ...entry, info: DATE_INFO } : entry));
const DATE_MEMBERS = (BUILTIN_MEMBERS.get('Date') ?? [])
  .map((entry) => (entry.name === 'now' ? { ...entry, info: 'Real-world milliseconds since 1970. The story clock is scene.time.' } : entry));

/** The surface of a script for a Tool with `params`, in a world whose shared placeholders are `placeholderNames`. */
export function toolScriptSurface(params: readonly ToolParam[], placeholderNames: readonly string[] = []): CodeSurface {
  const argEntries = namedParams(params).map(argEntry);
  const placeholderEntries = placeholderNames.map((name) => ({ name, detail: 'string', info: 'The resolved text' }));
  return {
    label: 'a Tool script',
    globals: [
      { name: 'args', detail: shapeOf(argEntries), info: 'The arguments the AI sent, checked against the parameters' },
      { name: 'world', detail: shapeOf(WORLD_MEMBERS), info: 'The world’s entities, locations and dictionary' },
      { name: 'scene', detail: shapeOf(SCENE_MEMBERS), info: 'The current scene' },
      { name: 'placeholders', detail: 'object', info: 'Each shared placeholder’s value by name. Use placeholders["Two Words"] for a name with a space.' },
      { name: 'console', detail: 'object', info: 'Only console.log. Output shows in the browser console.' },
    ].map((entry) => (isFrozenPath(entry.name) ? { ...entry, access: 'readOnly' as const } : entry)),
    builtins: BUILTINS,
    members: new Map(([
      ...BUILTIN_MEMBERS, ['Date', DATE_MEMBERS],
      ['args', argEntries], ['world', WORLD_MEMBERS], ['scene', SCENE_MEMBERS], ['placeholders', placeholderEntries],
      ['scene.location', LOCATION_MEMBERS], ['scene.time', TIME_MEMBERS],
    ] as const).map(([path, entries]) => [path, isFrozenPath(path) ? readOnlyEntries(entries) : entries])),
    languageNames: LANGUAGE_NAMES,
    missingReturn: 'This script never returns, so the Tool sends its empty result.',
    statMaps: false,
    guide: TOOL_GUIDE_LINKS,
  };
}
