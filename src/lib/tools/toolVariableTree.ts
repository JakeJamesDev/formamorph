/**
 * A Tool script's Variable menu as a tree, in the same shape as stat code's: the script's globals, the world's
 * names under each, and each name's fields. Every leaf inserts a whole path that runs as inserted. The world's
 * lists are arrays, so a name's path finds its item by name. With no world open, each name list is one `Name`
 * row to type over.
 */

import type { ToolParam } from '@/types';
import type { SurfaceEntry } from '@/lib/codeSurface';
import { memberStep } from '@/lib/statCodePaths';
import { TEMPLATE_NAME, type VariableField, type VariableNameRow, type VariableNode, type VariableSelection } from '@/lib/statCodeVariableTree';
import type { ToolSnapshot } from './toolSnapshot';
import { namedParams } from './toolDraft';
import {
  DICTIONARY_MEMBERS, ENTITY_MEMBERS, LOCATION_ITEM_MEMBERS, LOCATION_MEMBERS, SCENE_MEMBERS, TIME_MEMBERS, WORLD_MEMBERS,
  argEntry,
} from './toolScriptSurface';

/** The names the tree lists, from the open world. */
export type ToolVariableNames = Pick<ToolSnapshot, 'world' | 'scene' | 'placeholders'>;

/** A path being built, with the first type-over name's offsets once one is in it. */
interface Path {
  text: string;
  selection?: VariableSelection;
}

/** One name of a list: the world's, or the type-over name. */
interface Name {
  name: string;
  typeOver: boolean;
}

const TYPE_OVER: readonly Name[] = [{ name: TEMPLATE_NAME, typeOver: true }];

/** The world's names, one row per distinct name, or the type-over name without a world. */
const namesOf = (names: readonly string[] | null): readonly Name[] =>
  (names ? [...new Set(names.filter((name) => name !== ''))].map((name) => ({ name, typeOver: false })) : TYPE_OVER);

/** `text` appended to `path`, where `quoted` is a quoted name that gets selected if it is the first type-over. */
function append(path: Path, before: string, { name, typeOver }: Name, after = ''): Path {
  const quoted = typeOver ? `"${name}"` : JSON.stringify(name);
  const from = path.text.length + before.length + 1;
  return {
    text: `${path.text}${before}${quoted}${after}`,
    selection: path.selection ?? (typeOver ? { from, to: from + name.length } : undefined),
  };
}

/** `path` one key deeper: dot form for a plain identifier, bracket form for a type-over name or any other. */
const keyed = (path: Path, name: Name): Path =>
  (name.typeOver ? append(path, '[', name, ']') : { text: path.text + memberStep(name.name), selection: path.selection });

const field = (path: Path, entry: SurfaceEntry): VariableField => ({
  kind: 'field', label: entry.name, detail: entry.detail, info: entry.info, access: 'readOnly', insert: path.text,
  ...(path.selection ? { selection: path.selection } : {}),
});

/** A name list, or its empty marker when it has no rows. */
function nameList(label: string, info: string, rows: readonly VariableNameRow[], empty: string): VariableNode {
  return rows.length
    ? { kind: 'names', label, info, rows }
    : { kind: 'group', label, info, children: [{ kind: 'empty', message: empty }] };
}

/** A row per name that inserts its value from the map at `path`. */
const valueRows = (path: Path, names: readonly Name[], entry: (name: string) => SurfaceEntry): VariableNameRow[] =>
  names.map((name) => ({ name: name.name, trail: [], children: [], field: field(keyed(path, name), entry(name.name)) }));

const placeholderEntry = (name: string): SurfaceEntry => ({ name, detail: 'string', info: 'The resolved text' });

/** The fields of one list item, its `placeholders` map as a name list. */
function itemFields(path: Path, entries: readonly SurfaceEntry[], placeholders: readonly Name[], where: string): VariableNode[] {
  return entries.map((entry) => {
    const at = { ...path, text: `${path.text}.${entry.name}` };
    if (entry.name !== 'placeholders') return field(at, entry);
    return nameList('Placeholders', entry.info, valueRows(at, placeholders, placeholderEntry), `No placeholders ${where}`);
  });
}

/** The `find` that reads one item of the world list `list` by name. */
const findByName = (list: string, item: string, name: Name): Path =>
  append({ text: '' }, `world.${list}.find((${item}) => ${item}.name === `, name, ')?');

const worldInfo = (name: string) => WORLD_MEMBERS.find((entry) => entry.name === name)?.info ?? '';

/** The scene's fields. `location` and `time` may be null, so their members read through `?.`. */
function sceneFields(statNames: readonly Name[]): VariableNode[] {
  return SCENE_MEMBERS.map((entry): VariableNode => {
    const at = `scene.${entry.name}`;
    if (entry.name === 'location') {
      return { kind: 'group', label: 'location', info: entry.info, children: LOCATION_MEMBERS.map((m) => field({ text: `${at}?.${m.name}` }, m)) };
    }
    if (entry.name === 'time') {
      return { kind: 'group', label: 'time', info: entry.info, children: TIME_MEMBERS.map((m) => field({ text: `${at}?.${m.name}` }, m)) };
    }
    if (entry.name === 'stats') {
      const rows = valueRows({ text: at }, statNames, (name) => ({ name, detail: 'number', info: 'The stat’s current value' }));
      return nameList('stats', entry.info, rows, 'No stats in this world');
    }
    return field({ text: at }, entry);
  });
}

/** Builds the Tool script Variable menu's top level for a Tool with `params`. Without `names`, every name list is
 *  one type-over row. */
export function buildToolVariableTree(params: readonly ToolParam[], names: ToolVariableNames | null): VariableNode[] {
  const args = namedParams(params).map(argEntry).map((entry) => field({ text: `args${memberStep(entry.name)}` }, entry));
  const world = names?.world;
  const placeholdersOf = (name: Name, items: readonly { name: string; placeholders: Readonly<Record<string, string>> }[] | undefined) =>
    namesOf(name.typeOver ? null : Object.keys(items?.find((item) => item.name === name.name)?.placeholders ?? {}));

  const entityRows = namesOf(world ? world.entities.map((entity) => entity.name) : null).map((name): VariableNameRow => ({
    name: name.name, trail: [],
    children: itemFields(findByName('entities', 'entity', name), ENTITY_MEMBERS, placeholdersOf(name, world?.entities), 'on this entity'),
  }));
  const locationRows = namesOf(world ? world.locations.map((location) => location.name) : null).map((name): VariableNameRow => {
    const at = findByName('locations', 'location', name);
    return { name: name.name, trail: [], children: LOCATION_ITEM_MEMBERS.map((entry) => field({ ...at, text: `${at.text}.${entry.name}` }, entry)) };
  });
  const dictionaryRows = namesOf(world ? world.dictionary.map((entry) => entry.name) : null).map((name): VariableNameRow => ({
    name: name.name, trail: [],
    children: itemFields(findByName('dictionary', 'entry', name), DICTIONARY_MEMBERS, placeholdersOf(name, world?.dictionary), 'in this dictionary'),
  }));

  return [
    { kind: 'group', label: 'Arguments', info: 'The arguments the AI sent', children: args.length ? args : [{ kind: 'empty', message: 'No parameters in this Tool' }] },
    { kind: 'group', label: 'Scene', info: 'The current scene', children: sceneFields(namesOf(names ? Object.keys(names.scene.stats) : null)) },
    nameList('Entities', worldInfo('entities'), entityRows, 'No entities in this world'),
    nameList('Locations', worldInfo('locations'), locationRows, 'No locations in this world'),
    nameList('Dictionary', worldInfo('dictionary'), dictionaryRows, 'No dictionary entries in this world'),
    nameList('Placeholders', 'Each shared placeholder’s value', valueRows({ text: 'placeholders' }, namesOf(names ? Object.keys(names.placeholders) : null), placeholderEntry), 'No placeholders in this world'),
  ];
}
