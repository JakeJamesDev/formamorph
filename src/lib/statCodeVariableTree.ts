/**
 * The stat code Variable menu as a tree: the sandbox's globals, the world's names under each, and each name's
 * fields from the surface lists. Every leaf inserts a whole path that runs as inserted. Template mode has no
 * names, so each name list is one `Name` row to type over.
 */

import type { AnalysisOptions, CodeEntityNames, CodeTraitPlace } from '@/lib/statCodeAnalysis';
import { WORLD_BREADCRUMB } from '@/lib/traitGates';
import type { SurfaceEntry } from '@/lib/codeSurface';
import { placeholderKindNoun, type PlaceholderKindNoun } from '@/lib/placeholders';
import {
  isPlaceholderEntryMember, memberStep, placeholderPathMap, type PlaceholderPathMap, type PlaceholderPathNode,
} from '@/lib/statCodePaths';
import {
  CLOCK_MEMBERS, CLOCK_PREVIOUS_FIELDS, DELTA_FIELDS, DELTA_MEMBERS, DICTIONARY_FIELDS, ENTITY_FIELDS, PERSONA_FIELDS,
  PREVIOUS_FIELDS, SANDBOX_GLOBALS, STAT_FIELDS, TRAIT_ENTRY_FIELDS, placeholderEntryFields,
} from '@/lib/statCodeSurface';

/** The names the tree lists, as the editor's session holds them, with each world trait in its groups. */
export type VariableTreeNames = Pick<AnalysisOptions, 'statNames' | 'placeholders' | 'entities'> & {
  traits?: readonly CodeTraitPlace[];
};

/** Offsets into an insert text: the part left selected after the insert. */
export interface VariableSelection {
  from: number;
  to: number;
}

/** A leaf: one field or call, inserted as a whole path. */
export interface VariableField {
  kind: 'field';
  label: string;
  detail: string;
  info: string;
  insert: string;
  selection?: VariableSelection;
}

/** A level that holds fixed children: a global, or a field with members of its own. */
export interface VariableGroup {
  kind: 'group';
  label: string;
  info?: string;
  children: readonly VariableNode[];
}

/** One name in a name list, by its code name. */
export interface VariableNameRow {
  name: string;
  /** Folder, group, holder or owner names, outermost first. */
  trail: readonly string[];
  children: readonly VariableNode[];
}

/** A level that lists the world's names. Never empty: an empty one is a group with an empty marker. */
export interface VariableNameList {
  kind: 'names';
  label: string;
  info?: string;
  rows: readonly VariableNameRow[];
}

/** The one row of a name list with no names. */
export interface VariableEmpty {
  kind: 'empty';
  message: string;
}

export type VariableNode = VariableGroup | VariableNameList | VariableField | VariableEmpty;

/** The type-over name a template inserts. */
export const TEMPLATE_NAME = 'Name';

/** A path being built, with the first type-over name's offsets once one is in it. */
interface Path {
  text: string;
  selection?: VariableSelection;
}

const root = (text: string): Path => ({ text });

/** `path` one key deeper: dot form for a plain identifier, bracket form otherwise. */
const keyed = (path: Path, name: string): Path => ({ text: path.text + memberStep(name), selection: path.selection });

/** `path` one key deeper by the template's type-over name, which is selected unless an earlier one is. */
function typeOver(path: Path): Path {
  const from = path.text.length + 2;
  return {
    text: `${path.text}["${TEMPLATE_NAME}"]`,
    selection: path.selection ?? { from, to: from + TEMPLATE_NAME.length },
  };
}

const field = (path: Path, entry: SurfaceEntry, call = ''): VariableField => ({
  kind: 'field', label: entry.name, detail: entry.detail, info: entry.info, insert: `${path.text}.${entry.name}${call}`,
  ...(path.selection ? { selection: path.selection } : {}),
});

const globalInfo = (name: string) => SANDBOX_GLOBALS.find((entry) => entry.name === name)?.info;

/** A name list, or its empty marker when it has no rows. */
function nameList(label: string, rows: readonly VariableNameRow[], empty: string, info?: string): VariableNode {
  const head = { label, ...(info ? { info } : {}) };
  return rows.length
    ? { kind: 'names', ...head, rows }
    : { kind: 'group', ...head, children: [{ kind: 'empty', message: empty }] };
}

/** What opens a member to its own members, from the member's path. */
type Drill = (entry: SurfaceEntry, at: Path) => VariableNode | undefined;

/** One field per entry, except where `drill` opens the entry. */
const fields = (path: Path, entries: readonly SurfaceEntry[], drill: Drill = () => undefined): VariableNode[] =>
  entries.map((entry) => drill(entry, keyed(path, entry.name)) ?? field(path, entry));

const group = (entry: SurfaceEntry, children: readonly VariableNode[]): VariableGroup =>
  ({ kind: 'group', label: entry.name, info: entry.info, children });

/** The rows of an owner's `traits` and `placeholders`, from each map's path. */
interface OwnLists {
  traits?: (at: Path) => readonly VariableNameRow[];
  placeholders: (at: Path) => readonly VariableNameRow[];
}

/** An entity's, the persona's or a dictionary's fields, its maps as name lists. `where` ends their empty messages. */
const ownerFields = (path: Path, entries: readonly SurfaceEntry[], lists: OwnLists, where: string): VariableNode[] =>
  fields(path, entries, (entry, at) => {
    if (entry.name === 'traits' && lists.traits) return nameList('Traits', lists.traits(at), `No traits ${where}`, entry.info);
    if (entry.name === 'placeholders') return nameList('Placeholders', lists.placeholders(at), `No placeholders ${where}`, entry.info);
    return undefined;
  });

/** A stat's fields, `previous` and `delta` opening to theirs, and each `delta` source to its own. */
const statFields = (path: Path): VariableNode[] => fields(path, STAT_FIELDS, (entry, at) => {
  if (entry.name === 'previous') return group(entry, fields(at, PREVIOUS_FIELDS));
  if (entry.name === 'delta') return group(entry, fields(at, DELTA_MEMBERS, (source, sourceAt) => group(source, fields(sourceAt, DELTA_FIELDS))));
  return undefined;
});

const clockFields = (path: Path): VariableNode[] => fields(path, CLOCK_MEMBERS, (entry, at) =>
  (entry.name === 'previous' ? group(entry, fields(at, CLOCK_PREVIOUS_FIELDS)) : undefined));

/** A placeholder entry's members by its kind. The calls insert complete; `pin` leaves its text selected. */
function placeholderFields(path: Path, kind: PlaceholderKindNoun): VariableNode[] {
  return placeholderEntryFields(kind).map((entry) => {
    if (entry.name === 'roll' || entry.name === 'unpin') return field(path, entry, '()');
    if (entry.name !== 'pin') return field(path, entry);
    const args = kind === 'Object' ? '([""])' : '("")';
    const pin = field(path, entry, args);
    // A type-over name keeps the selection; otherwise the caret sits between the quotes.
    const caret = pin.insert.length - args.length + args.indexOf('"') + 1;
    return pin.selection ? pin : { ...pin, selection: { from: caret, to: caret } };
  });
}

function firstOfEach<T>(items: readonly T[], keyOf: (item: T) => string): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = keyOf(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** The sandbox's rule for a name-keyed map: the last item of a name is the entry, at the name's first place.
 *  An unnamed item has no key. */
function keyedLastWins<T extends { name: string }>(items: readonly T[]): T[] {
  const byName = new Map<string, T>();
  for (const item of items) if (item.name !== '') byName.set(item.name, item);
  return [...byName.values()];
}

/** Every placeholder under `nodes`, depth first, its holders as its trail. A child named like a member of its
 *  holder is skipped: the member is what that path reads. */
function placeholderRows(nodes: readonly PlaceholderPathNode[], path: Path, trail: readonly string[]): VariableNameRow[] {
  const rows: VariableNameRow[] = [];
  const visit = (list: readonly PlaceholderPathNode[], at: Path, holders: readonly string[], seen: ReadonlySet<PlaceholderPathNode>) => {
    for (const node of keyedLastWins(list)) {
      if (!node.placeholder || seen.has(node)) continue;
      const nodePath = keyed(at, node.name);
      rows.push({ name: node.name, trail: holders, children: placeholderFields(nodePath, placeholderKindNoun(node.placeholder)) });
      const children = node.children.filter((child) => !isPlaceholderEntryMember(child.name));
      visit(children, nodePath, [...holders, node.name], new Set([...seen, node]));
    }
  };
  visit(nodes, path, trail, new Set());
  return rows;
}

/** A name list in template mode: one type-over name. */
const templateRows = (path: Path, children: (at: Path) => VariableNode[]): VariableNameRow[] =>
  [{ name: TEMPLATE_NAME, trail: [], children: children(typeOver(path)) }];

/** A trait's name and trail, before its row is built. */
type TraitPlace = Pick<VariableNameRow, 'name' | 'trail'>;

/** One row per trait name. Every trait of a name reads the same fields, so the first one's trail stands. */
const traitRows = (path: Path, traits: readonly TraitPlace[]): VariableNameRow[] =>
  firstOfEach(traits, (trait) => trait.name).map((trait) => ({
    ...trait, children: fields(keyed(path, trait.name), TRAIT_ENTRY_FIELDS),
  }));

/** Builds the Variable menu's top level. Without `names`, every name list is one type-over row. */
export function buildVariableTree(names?: VariableTreeNames): VariableNode[] {
  const pathMap: PlaceholderPathMap | null = names?.placeholders
    ? placeholderPathMap({ list: names.placeholders.list, owners: names.placeholders.owners })
    : null;
  const ownedRows = (ownerId: string, path: Path, trail: readonly string[]): VariableNameRow[] => {
    const owner = pathMap?.owners.get(ownerId);
    return owner ? placeholderRows(owner.children, path, trail) : [];
  };
  const typeOverPlaceholders = (path: Path) => templateRows(path, (at) => placeholderFields(at, 'Wildcard'));
  const typeOverTraits = (path: Path) => templateRows(path, (at) => fields(at, TRAIT_ENTRY_FIELDS));
  const typeOverLists: OwnLists = { traits: typeOverTraits, placeholders: typeOverPlaceholders };

  const entityFields = (path: Path, entity: CodeEntityNames | null) => ownerFields(path, ENTITY_FIELDS, entity ? {
    traits: (at) => traitRows(at, entity.traits.map((trait) => ({ name: trait.name, trail: trait.path }))),
    placeholders: (at) => ownedRows(entity.id, at, []),
  } : typeOverLists, 'on this entity');

  const dictionaryFields = (path: Path, dictionaryId: string | null) => ownerFields(path, DICTIONARY_FIELDS, {
    placeholders: (at) => (dictionaryId === null ? typeOverPlaceholders(at) : ownedRows(dictionaryId, at, [])),
  }, 'in this dictionary');

  // Any persona entity can be played, so the persona's lists hold each one's names once, its owner as the trail.
  const personas = (names?.entities ?? []).filter((entity) => entity.persona);
  const personaFields = ownerFields(root('persona'), PERSONA_FIELDS, names ? {
    traits: (at) => traitRows(at, personas.flatMap((entity) =>
      entity.traits.map((trait) => ({ name: trait.name, trail: [entity.name, ...trait.path] })))),
    placeholders: (at) => firstOfEach(
      personas.flatMap((entity) => ownedRows(entity.id, at, [entity.name])),
      (row) => JSON.stringify([...row.trail.slice(1), row.name]),
    ),
  } : typeOverLists, 'on a persona entity');

  const stats = root('stats');
  const traits = root('traits');
  const entities = root('entities');
  const placeholders = root('placeholders');
  const dictionaries = root('dictionaries');

  const statRows = names
    ? firstOfEach((names.statNames ?? []).filter((name) => name !== ''), (name) => name)
      .map((name) => ({ name, trail: [], children: statFields(keyed(stats, name)) }))
    : templateRows(stats, statFields);
  const traitList = names
    ? traitRows(traits, (names.traits ?? []).map((trait) => ({
      name: trait.name, trail: trait.path.length > 0 ? trait.path : WORLD_BREADCRUMB,
    })))
    : typeOverTraits(traits);
  const entityRows = names
    ? keyedLastWins(names.entities ?? []).map((entity) => ({
      name: entity.name, trail: entity.folder ?? [], children: entityFields(keyed(entities, entity.name), entity),
    }))
    : templateRows(entities, (at) => entityFields(at, null));
  const placeholderList = names ? placeholderRows(pathMap?.top ?? [], placeholders, []) : typeOverPlaceholders(placeholders);
  const dictionaryRows = names
    ? keyedLastWins(names.placeholders?.dictionaries ?? []).map((dictionary) => ({
      name: dictionary.name, trail: [], children: dictionaryFields(keyed(dictionaries, dictionary.name), dictionary.id),
    }))
    : templateRows(dictionaries, (at) => dictionaryFields(at, null));

  return [
    { kind: 'group', label: 'This Stat', info: globalInfo('self'), children: statFields(root('self')) },
    nameList('Stats', statRows, 'No stats in this world', globalInfo('stats')),
    nameList('Traits', traitList, 'No traits in this world', globalInfo('traits')),
    nameList('Entities', entityRows, 'No entities in this world', globalInfo('entities')),
    { kind: 'group', label: 'Persona', info: globalInfo('persona'), children: personaFields },
    nameList('Placeholders', placeholderList, 'No placeholders in this world', globalInfo('placeholders')),
    nameList('Dictionaries', dictionaryRows, 'No dictionaries in this world', globalInfo('dictionaries')),
    { kind: 'group', label: 'Clock', info: globalInfo('clock'), children: clockFields(root('clock')) },
  ];
}

/** Every leaf under `nodes`, depth first. */
export function variableTreeLeaves(nodes: readonly VariableNode[]): VariableField[] {
  return nodes.flatMap((node): VariableField[] => {
    if (node.kind === 'field') return [node];
    if (node.kind === 'group') return variableTreeLeaves(node.children);
    if (node.kind === 'names') return node.rows.flatMap((row) => variableTreeLeaves(row.children));
    return [];
  });
}
