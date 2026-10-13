/**
 * A Tool script's Variable menu as a tree, in the same shape as stat code's: the script's globals, the world's
 * names under each, and each name's fields. Every leaf inserts a whole path that runs as inserted. The world's
 * lists are arrays, so a name's path finds its item by name.
 */

import type { ToolParam } from '@/types';
import type { SurfaceEntry } from '@/lib/codeSurface';
import { memberStep } from '@/lib/statCodePaths';
import type { VariableField, VariableNameRow, VariableNode } from '@/lib/statCodeVariableTree';
import type { PlaceholderValues, ToolSnapshot } from './toolSnapshot';
import { namedParams } from './toolDraft';
import {
  DICTIONARY_MEMBERS, ENTITY_MEMBERS, LOCATION_ITEM_MEMBERS, LOCATION_MEMBERS, SCENE_MEMBERS, TIME_MEMBERS, WORLD_MEMBERS,
  argEntry,
} from './toolScriptSurface';

/** The names the tree lists, from the world Try It runs on. */
export type ToolVariableNames = Pick<ToolSnapshot, 'world' | 'scene' | 'placeholders'>;

const field = (path: string, entry: SurfaceEntry): VariableField => ({
  kind: 'field', label: entry.name, detail: entry.detail, info: entry.info, access: 'readOnly', insert: path,
});

/** A name list, or its empty marker when it has no rows. */
function nameList(label: string, info: string, rows: readonly VariableNameRow[], empty: string): VariableNode {
  return rows.length
    ? { kind: 'names', label, info, rows }
    : { kind: 'group', label, info, children: [{ kind: 'empty', message: empty }] };
}

/** One row per distinct name. */
function distinct(names: readonly string[]): string[] {
  return [...new Set(names.filter((name) => name !== ''))];
}

/** A row per name that inserts its value from the `map` at `path`. */
const valueRows = (path: string, names: readonly string[], entry: (name: string) => SurfaceEntry): VariableNameRow[] =>
  distinct(names).map((name) => ({ name, trail: [], children: [], field: field(path + memberStep(name), entry(name)) }));

const placeholderEntry = (name: string): SurfaceEntry => ({ name, detail: 'string', info: 'The resolved text' });

/** The fields of one list item, its `placeholders` map as a name list. */
function itemFields(path: string, entries: readonly SurfaceEntry[], placeholders: PlaceholderValues, where: string): VariableNode[] {
  return entries.map((entry) => {
    const at = `${path}.${entry.name}`;
    if (entry.name !== 'placeholders') return field(at, entry);
    return nameList('Placeholders', entry.info, valueRows(at, Object.keys(placeholders), placeholderEntry), `No placeholders ${where}`);
  });
}

/** The `find` that reads one item of the world list `list` by name. */
const findByName = (list: string, item: string, name: string) =>
  `world.${list}.find((${item}) => ${item}.name === ${JSON.stringify(name)})?`;

const worldInfo = (name: string) => WORLD_MEMBERS.find((entry) => entry.name === name)?.info ?? '';

/** The scene's fields. `location` and `time` may be null, so their members read through `?.`. */
function sceneFields(scene: ToolVariableNames['scene']): VariableNode[] {
  return SCENE_MEMBERS.map((entry): VariableNode => {
    const at = `scene.${entry.name}`;
    if (entry.name === 'location') {
      return { kind: 'group', label: 'location', info: entry.info, children: LOCATION_MEMBERS.map((m) => field(`${at}?.${m.name}`, m)) };
    }
    if (entry.name === 'time') {
      return { kind: 'group', label: 'time', info: entry.info, children: TIME_MEMBERS.map((m) => field(`${at}?.${m.name}`, m)) };
    }
    if (entry.name === 'stats') {
      const rows = valueRows(at, Object.keys(scene.stats), (name) => ({ name, detail: 'number', info: 'The stat’s current value' }));
      return nameList('stats', entry.info, rows, 'No stats in this world');
    }
    return field(at, entry);
  });
}

/** Builds the Tool script Variable menu's top level for a Tool with `params`. */
export function buildToolVariableTree(params: readonly ToolParam[], names: ToolVariableNames): VariableNode[] {
  const args = namedParams(params).map(argEntry).map((entry) => field(`args${memberStep(entry.name)}`, entry));
  const { world } = names;

  const entityRows = distinct(world.entities.map((entity) => entity.name)).map((name): VariableNameRow => {
    const entity = world.entities.find((item) => item.name === name)!;
    return { name, trail: [], children: itemFields(findByName('entities', 'entity', name), ENTITY_MEMBERS, entity.placeholders, 'on this entity') };
  });
  const locationRows = distinct(world.locations.map((location) => location.name)).map((name): VariableNameRow => ({
    name, trail: [], children: LOCATION_ITEM_MEMBERS.map((entry) => field(`${findByName('locations', 'location', name)}.${entry.name}`, entry)),
  }));
  const dictionaryRows = distinct(world.dictionary.map((entry) => entry.name)).map((name): VariableNameRow => {
    const entry = world.dictionary.find((item) => item.name === name)!;
    return { name, trail: [], children: itemFields(findByName('dictionary', 'entry', name), DICTIONARY_MEMBERS, entry.placeholders, 'in this dictionary') };
  });

  return [
    { kind: 'group', label: 'Arguments', info: 'The arguments the AI sent', children: args.length ? args : [{ kind: 'empty', message: 'No parameters in this Tool' }] },
    { kind: 'group', label: 'Scene', info: 'The current scene', children: sceneFields(names.scene) },
    nameList('Entities', worldInfo('entities'), entityRows, 'No entities in this world'),
    nameList('Locations', worldInfo('locations'), locationRows, 'No locations in this world'),
    nameList('Dictionary', worldInfo('dictionary'), dictionaryRows, 'No dictionary entries in this world'),
    nameList('Placeholders', 'Each shared placeholder’s value', valueRows('placeholders', Object.keys(names.placeholders), placeholderEntry), 'No placeholders in this world'),
  ];
}
