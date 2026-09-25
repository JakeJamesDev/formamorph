/**
 * What a Tool script can reach, as the code editor reads it: `args` typed from the Tool's parameters, the
 * world, the current scene and `console.log`. It describes the sandbox in `toolScript`; it never widens it.
 */
import type { ToolParam } from '@/types';
import type { CodeSurface, SurfaceEntry } from '@/lib/codeSurface';
import type { InsertSnippet } from '@/lib/codeSnippets';
import { BUILTIN_MEMBERS, LANGUAGE_NAMES, SANDBOX_BUILTINS } from '@/lib/statCodeSurface';
import { listOptions, namedParams } from './toolDraft';

const shapeOf = (entries: readonly SurfaceEntry[]) => `{ ${entries.map((entry) => entry.name).join(', ')} }`;

/** The fields of one `world.entities` item. */
const ENTITY_SHAPE = '{ id, name, aliases, type, pronouns, description, summary }';

/** The members of `world`. */
export const WORLD_MEMBERS: readonly SurfaceEntry[] = [
  { name: 'entities', detail: `${ENTITY_SHAPE}[]`, info: 'Every entity. In play, this includes the characters the playthrough discovered.' },
  { name: 'locations', detail: '{ id, name, description, summary }[]', info: 'Every location.' },
  { name: 'dictionary', detail: '{ id, name, keys, value }[]', info: 'Every enabled dictionary entry.' },
];

const LOCATION_MEMBERS: readonly SurfaceEntry[] = [
  { name: 'id', detail: 'string', info: 'The location’s unique id.' },
  { name: 'name', detail: 'string', info: 'The location’s name.' },
];

const TIME_MEMBERS: readonly SurfaceEntry[] = [
  { name: 'elapsed', detail: 'number', info: 'Story hours since the opening.' },
];

/** The members of `scene`. */
export const SCENE_MEMBERS: readonly SurfaceEntry[] = [
  { name: 'location', detail: `${shapeOf(LOCATION_MEMBERS)} | null`, info: 'Where the scene is, or null when it is nowhere.' },
  { name: 'present', detail: 'string[]', info: 'The names of the people at the location.' },
  { name: 'inScene', detail: 'string[]', info: 'The names of the people who took part in the scene.' },
  { name: 'stats', detail: 'object', info: 'Each stat’s current value by name. Use scene.stats["Two Words"] for a name with a space.' },
  { name: 'traits', detail: 'string[]', info: 'The names of the traits in force.' },
  { name: 'persona', detail: 'string | null', info: 'The player character’s name, or null.' },
  { name: 'notes', detail: 'string', info: 'The player’s notes.' },
  { name: 'time', detail: `${shapeOf(TIME_MEMBERS)} | null`, info: 'The story clock, or null while it is off.' },
];

const TYPE_DETAIL: Record<Exclude<ToolParam['type'], 'enum'>, string> = { string: 'string', number: 'number', boolean: 'boolean' };

/** One parameter as a member of `args`. */
function argEntry(param: ToolParam): SurfaceEntry {
  const detail = param.type === 'enum'
    ? listOptions(param).map((o) => JSON.stringify(o)).join(' | ') || 'string'
    : TYPE_DETAIL[param.type];
  const described = param.description.trim() || 'What the AI passed.';
  return { name: param.name, detail, info: param.required ? described : `${described} Absent when the AI leaves it out.` };
}

// The story clock is the scene's, so the real-world clock says so in this surface's own words.
const DATE_INFO = 'Real-world clock. The story clock is scene.time.';
const BUILTINS = SANDBOX_BUILTINS.map((entry) => (entry.name === 'Date' ? { ...entry, info: DATE_INFO } : entry));
const DATE_MEMBERS = (BUILTIN_MEMBERS.get('Date') ?? [])
  .map((entry) => (entry.name === 'now' ? { ...entry, info: 'Real-world milliseconds since 1970. The story clock is scene.time.' } : entry));

const STATIC_SNIPPETS: readonly InsertSnippet[] = [
  { label: 'Find an entity by name', text: 'world.entities.find((entity) => entity.name === "Name")', select: 'Name' },
  { label: 'The current location', text: 'scene.location?.name' },
  { label: 'A stat’s value', text: 'scene.stats["Health"]', select: 'Health' },
];

/** How a script reads one argument. A name that isn't an identifier, such as `place-name`, needs brackets. */
const argAccess = (name: string) => (/^[A-Za-z_$][\w$]*$/.test(name) ? `args.${name}` : `args[${JSON.stringify(name)}]`);

/** The surface of a script for a Tool with `params`. */
export function toolScriptSurface(params: readonly ToolParam[]): CodeSurface {
  const argEntries = namedParams(params).map(argEntry);
  return {
    label: 'a Tool script',
    globals: [
      { name: 'args', detail: shapeOf(argEntries), info: 'The arguments the AI sent, checked against the parameters. Read-only.' },
      { name: 'world', detail: shapeOf(WORLD_MEMBERS), info: 'The world’s entities, locations and dictionary. Read-only.' },
      { name: 'scene', detail: shapeOf(SCENE_MEMBERS), info: 'The current scene. Read-only.' },
      { name: 'console', detail: 'object', info: 'Only console.log. Output shows in the browser console.' },
    ],
    hiddenGlobals: [],
    builtins: BUILTINS,
    members: new Map([
      ...BUILTIN_MEMBERS, ['Date', DATE_MEMBERS],
      ['args', argEntries], ['world', WORLD_MEMBERS], ['scene', SCENE_MEMBERS],
      ['scene.location', LOCATION_MEMBERS], ['scene.time', TIME_MEMBERS],
    ]),
    languageNames: LANGUAGE_NAMES,
    snippets: [...argEntries.map((entry) => ({ label: `Argument: ${entry.name}`, text: argAccess(entry.name) })), ...STATIC_SNIPPETS],
    missingReturn: 'This script never returns, so the Tool sends its empty result.',
  };
}
