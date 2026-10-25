/**
 * What a user Tool script can reach, as the code editor reads it: a world script's surface without writes (Q24),
 * with `args` typed from the Tool's parameters. It describes the read-only run in `statCodeExecutor`; it never
 * widens it.
 */
import type { ToolParam } from '@/types';
import { closeSentence, isMethodEntry, type CodeSurface, type SurfaceEntry } from '@/lib/codeSurface';
import { TOOL_GUIDE_LINKS } from '@/lib/codeGuideLinks';
import { CLOCK_MEMBERS, LOCATION_MEMBERS, WORLD_SCRIPT_SURFACE } from '@/lib/statCodeSurface';
import { listOptions, namedParams } from './toolDraft';

const shapeOf = (entries: readonly SurfaceEntry[]) => `{ ${entries.map((entry) => entry.name).join(', ')} }`;

const TYPE_DETAIL: Record<Exclude<ToolParam['type'], 'enum'>, string> = { string: 'string', number: 'number', boolean: 'boolean' };

/** One parameter as a member of `args`. */
export function argEntry(param: ToolParam): SurfaceEntry {
  const detail = param.type === 'enum'
    ? listOptions(param).map((o) => JSON.stringify(o)).join(' | ') || 'string'
    : TYPE_DETAIL[param.type];
  const described = param.description.trim() || 'What the AI passed';
  return { name: param.name, detail, info: param.required ? described : `${closeSentence(described)} Absent when the AI leaves it out.` };
}

/** The script globals a user Tool reads, in the order an author meets them (spec: Surface). */
const USER_TOOL_GLOBALS = [
  'stats', 'clock', 'turn', 'locations', 'location', 'memories', 'notes', 'placeholders', 'traits', 'entities', 'persona', 'dictionaries', 'console',
];

const fieldsOnly = (entries: readonly SurfaceEntry[]) => entries.filter((entry) => !isMethodEntry(entry));

/** A world script's global as a user Tool reads it, where its wording names a write or a place it doesn't have. */
const USER_TOOL_GLOBAL: Readonly<Record<string, Partial<SurfaceEntry>>> = {
  stats: { info: 'The global stats by name. An entity’s own are on its entry. Use stats["Two Words"] for a name with a space.' },
  clock: { detail: shapeOf(fieldsOnly(CLOCK_MEMBERS)), info: 'The story clock. In the World Editor and with no world open, it reads the opening.' },
  turn: { info: 'The player’s action and the turn number. A call the AI makes in a turn reads that turn. Between turns, the action is empty.' },
  location: { detail: shapeOf(fieldsOnly(LOCATION_MEMBERS)), info: 'The location the turn is at, with the fields of a locations entry' },
  memories: {
    info: 'The story’s memories as the Memory panel lists them, oldest first. Each entry has its id, turn, day, daypart, text, Custom flag and pins. It’s empty in the World Editor and with no world open.',
  },
  notes: { info: 'The player’s notes. It’s empty in the World Editor and with no world open.' },
};

const ARGS_INFO = 'The arguments the AI sent, checked against the parameters';

/** The new form of each `world` and `scene` read, for the mark on one that load left as written (Q51). */
const RETIRED_READS: CodeSurface['retired'] = {
  world: {
    entities: 'Use “entities”.',
    locations: 'Use “locations”.',
    dictionary: 'Use “dictionaries”.',
  },
  scene: {
    location: 'Use “location”.',
    time: 'Use “clock”.',
    stats: 'Use “stats”.',
    traits: 'Use “traits”.',
    persona: 'Use “persona.name”.',
    present: 'Use “location.present”.',
    inScene: 'Use “inScene” on each “entities” entry.',
    notes: 'Use “notes”.',
  },
};

/** The surface of a script for a user Tool with `params`. */
export function toolScriptSurface(params: readonly ToolParam[]): CodeSurface {
  const argEntries = namedParams(params).map(argEntry);
  const globals = USER_TOOL_GLOBALS.flatMap((name) => {
    const entry = WORLD_SCRIPT_SURFACE.globals.find((global) => global.name === name);
    return entry ? [{ ...entry, ...USER_TOOL_GLOBAL[name] }] : [];
  });
  return {
    ...WORLD_SCRIPT_SURFACE,
    label: 'a Tool script',
    globals: [{ name: 'args', detail: shapeOf(argEntries), info: ARGS_INFO, access: 'readOnly' }, ...globals],
    members: new Map([...WORLD_SCRIPT_SURFACE.members, ['args', argEntries.map((entry) => ({ ...entry, access: 'readOnly' as const }))]]),
    missingReturn: 'This script never returns, so the Tool sends its empty result.',
    readOnly: true,
    guide: TOOL_GUIDE_LINKS,
    retired: RETIRED_READS,
  };
}
