/**
 * The scripts' Variable menu as a tree: the sandbox's globals, the world's names under each, and each name's
 * fields from the surface lists. Every leaf inserts a whole path that runs as inserted. Template mode has no
 * names, so each name list is one `Name` row to type over.
 */

import type { AnalysisOptions, CodeDictionaryNames, CodeEntityNames, CodeTraitPlace } from '@/lib/statCodeAnalysis';
import { WORLD_BREADCRUMB } from '@/lib/traitGates';
import { isMethodEntry, surfaceHasGlobal, type CodeAccess, type CodeSurface, type SurfaceEntry } from '@/lib/codeSurface';
import { placeholderKindNoun, type PlaceholderKindNoun } from '@/lib/placeholders';
import {
  isPlaceholderEntryMember, memberStep, placeholderPathMap, type PlaceholderPathMap, type PlaceholderPathNode,
} from '@/lib/statCodePaths';
import {
  CLOCK_MEMBERS, CLOCK_PREVIOUS_FIELDS, TURN_MEMBERS, LOCATION_ENTRY_FIELDS, LOCATION_EXIT_FIELDS, LOCATION_MEMBERS, MEMORY_ENTRY_FIELDS, MEMORY_MEMBERS, DELTA_FIELDS, DELTA_MEMBERS, DICTIONARY_ENTRY_FIELDS, DICTIONARY_FIELDS, ENTITY_FIELDS, NARRATION_FIELDS,
  NARRATION_GLOBAL, PERSONA_FIELDS, PLAYER_CALL_ENTRIES, PLAYER_GLOBAL, PREVIOUS_FIELDS, SANDBOX_GLOBALS, SELF_TRAIT_FIELDS,
  STAT_CODE_SURFACE, STAT_FIELDS, SWITCHED_TRAIT_FIELDS, SWITCHED_TRAIT_GLOBAL, TRAIT_ENTRY_FIELDS, TRAIT_SCRIPT_SURFACE, placeholderEntryFields,
} from '@/lib/statCodeSurface';

/** The names the tree lists, as the editor's session holds them, with each world trait in its groups. */
export type VariableTreeNames = Pick<AnalysisOptions, 'statNames' | 'placeholders' | 'entities' | 'locations'> & {
  traits?: readonly CodeTraitPlace[];
};

/** What an owned or Blueprint stat's `owner` holds, for the menu's Owner group. A null owner or name list is the
 *  template editor's, which has no world: each list there is one type-over row. */
export type VariableTreeOwner =
  | { kind: 'entity'; entity: CodeEntityNames | null }
  | { kind: 'blueprint'; statNames: readonly string[] | null };

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
  /** Absent on a method. The menu draws no badge, so it states this as text. */
  access?: CodeAccess;
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
  /** Folder, group, parent or owner names, outermost first. */
  trail: readonly string[];
  children: readonly VariableNode[];
  /** Set on a name that is itself a value: picking it inserts this instead of opening `children`. */
  field?: VariableField;
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
  /** Set on an array element, so a field read on an empty list gives `undefined`. */
  optional?: true;
}

const root = (text: string): Path => ({ text });

/** `path` one key deeper: dot form for a plain identifier, bracket form otherwise. */
const keyed = (path: Path, name: string): Path => ({ text: path.text + memberStep(name), selection: path.selection });

/** `path`'s first element, its index selected to type over unless an earlier name is. */
function indexed(path: Path): Path {
  const from = path.text.length + 1;
  return { text: `${path.text}[0]`, selection: path.selection ?? { from, to: from + 1 }, optional: true };
}

/** `path` one key deeper by the template's type-over name, which is selected unless an earlier one is. */
function typeOver(path: Path): Path {
  const from = path.text.length + 2;
  return {
    text: `${path.text}["${TEMPLATE_NAME}"]`,
    selection: path.selection ?? { from, to: from + TEMPLATE_NAME.length },
  };
}

const field = (path: Path, entry: SurfaceEntry, call = ''): VariableField => ({
  kind: 'field', label: entry.name, detail: entry.detail, info: entry.info, insert: `${path.text}${path.optional ? '?.' : '.'}${entry.name}${call}`,
  ...(entry.access ? { access: entry.access } : {}),
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
  stats?: (at: Path) => readonly VariableNameRow[];
  entries?: (at: Path) => readonly VariableNameRow[];
}

/** An entity's, the persona's or a dictionary's fields, its maps as name lists. `where` ends their empty messages. */
const ownerFields = (path: Path, entries: readonly SurfaceEntry[], lists: OwnLists, where: string): VariableNode[] =>
  fields(path, entries, (entry, at) => {
    if (entry.name === 'traits' && lists.traits) return nameList('Traits', lists.traits(at), `No traits ${where}`, entry.info);
    if (entry.name === 'placeholders') return nameList('Placeholders', lists.placeholders(at), `No placeholders ${where}`, entry.info);
    if (entry.name === 'stats' && lists.stats) return nameList('Stats', lists.stats(at), `No stats ${where}`, entry.info);
    if (entry.name === 'diary') return lineCallField(path, entry);
    if (entry.name === 'entries' && lists.entries) return nameList('Entries', lists.entries(at), `No entries ${where}`, entry.info);
    return undefined;
  });

/** A stat's fields, `previous` and `delta` opening to theirs, and each `delta` source to its own. */
const statFields = (path: Path): VariableNode[] => fields(path, STAT_FIELDS, (entry, at) => {
  if (entry.name === 'previous') return group(entry, fields(at, PREVIOUS_FIELDS));
  if (entry.name === 'delta') return group(entry, fields(at, DELTA_MEMBERS, (source, sourceAt) => group(source, fields(sourceAt, DELTA_FIELDS))));
  return undefined;
});

/** One row per stat name, each with a trail. Every stat of a name reads the same fields, so the first one's trail is kept. */
const statNameRows = (path: Path, stats: readonly Pick<VariableNameRow, 'name' | 'trail'>[]): VariableNameRow[] =>
  firstOfEach(stats.filter((stat) => stat.name !== ''), (stat) => stat.name)
    .map((stat) => ({ ...stat, children: statFields(keyed(path, stat.name)) }));

/** A method's leaf, called with `arg`, which stays selected to type over. It has no access. */
const callField = ({ access: _method, ...call }: VariableField, arg: string): VariableField => {
  const insert = `${call.insert}(${arg})`;
  const from = insert.length - arg.length - 1;
  return { ...call, insert, selection: { from, to: from + arg.length } };
};

/** A call that takes a line, `path.entry("Line")`. A type-over name in `path` stays selected; else the line is. */
const lineCallField = (path: Path, entry: SurfaceEntry): VariableField => {
  const call = callField(field(path, entry), '"Line"');
  return path.selection ? { ...call, selection: path.selection } : call;
};

const clockFields = (path: Path): VariableNode[] => fields(path, CLOCK_MEMBERS, (entry, at) => {
  if (entry.name === 'advance') return callField(field(path, entry), '30');
  return entry.name === 'previous' ? group(entry, fields(at, CLOCK_PREVIOUS_FIELDS)) : undefined;
});

// The persona has no verbs and stands first where the player is, so an element lists the fields only.
const PRESENT_ELEMENT_FIELDS = ENTITY_FIELDS.filter((entry) => !isMethodEntry(entry));

/** `present`: the list itself, then an entity entry's fields on its first element. */
const presentGroup = (path: Path, entry: SurfaceEntry, at: Path): VariableGroup =>
  group(entry, [field(path, entry), ...fields(indexed(at), PRESENT_ELEMENT_FIELDS)]);

/** `exits`: the list itself, then an exit's fields on its first element. */
const exitsGroup = (path: Path, entry: SurfaceEntry, at: Path): VariableGroup =>
  group(entry, [field(path, entry), ...fields(indexed(at), LOCATION_EXIT_FIELDS)]);

/** The drill of a location's lists: `present` and `exits` open to their element's fields. */
const locationListGroup = (path: Path, entry: SurfaceEntry, at: Path): VariableGroup | undefined =>
  entry.name === 'present' ? presentGroup(path, entry, at) : entry.name === 'exits' ? exitsGroup(path, entry, at) : undefined;

/** A locations entry's fields, `present` and `exits` opening to their element's. */
const locationEntryFields = (path: Path): VariableNode[] =>
  fields(path, LOCATION_ENTRY_FIELDS, (entry, at) => locationListGroup(path, entry, at));

// A move to where the turn stands runs as inserted in any turn with a location.
const locationFields = (): VariableNode[] => fields(root('location'), LOCATION_MEMBERS, (entry, at) => {
  if (entry.name === 'move') return callField(field(root('location'), entry), 'location.name');
  return locationListGroup(root('location'), entry, at);
});

/** A call at the top level, `name(arg)`. */
const topCallField = (name: string, arg: string): VariableField => {
  const entry = SANDBOX_GLOBALS.find((global) => global.name === name);
  return callField({ kind: 'field', label: name, detail: entry?.detail ?? '', info: entry?.info ?? '', insert: name }, arg);
};

const MEMORY_ELEMENT_INFO = 'One memory in the list, by its place from 0, with the fields of a memories entry';

/** A memory's verb, called complete with the index left selected: `memories[0]?.edit("Text")`. */
const memoryVerb = (path: Path, entry: SurfaceEntry): VariableField =>
  ({ ...callField(field(path, entry), entry.detail.startsWith('()') ? '' : '"Text"'), selection: path.selection });

/** The list's calls, then one memory's fields and verbs. */
const memoryFields = (): VariableNode[] => {
  const element = indexed(root('memories'));
  return [
    ...MEMORY_MEMBERS.map((entry) => callField(field(root('memories'), entry), '"Line"')),
    {
      kind: 'group', label: 'memories[0]', info: MEMORY_ELEMENT_INFO,
      children: fields(element, MEMORY_ENTRY_FIELDS, (entry) => (isMethodEntry(entry) ? memoryVerb(element, entry) : undefined)),
    },
  ];
};

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

/** Every placeholder under `nodes`, depth first, its parents as its trail. A child named like a member of its
 *  parent is skipped: the member is what that path reads. */
function placeholderRows(nodes: readonly PlaceholderPathNode[], path: Path, trail: readonly string[]): VariableNameRow[] {
  const rows: VariableNameRow[] = [];
  const visit = (list: readonly PlaceholderPathNode[], at: Path, parents: readonly string[], seen: ReadonlySet<PlaceholderPathNode>) => {
    for (const node of keyedLastWins(list)) {
      if (!node.placeholder || seen.has(node)) continue;
      const nodePath = keyed(at, node.name);
      rows.push({ name: node.name, trail: parents, children: placeholderFields(nodePath, placeholderKindNoun(node.placeholder)) });
      const children = node.children.filter((child) => !isPlaceholderEntryMember(child.name));
      visit(children, nodePath, [...parents, node.name], new Set([...seen, node]));
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

/** Which of the names a script's timing adds its surface injects: `narration`, `player` and `trait`. */
export interface TimingGlobals {
  narration: boolean;
  player: boolean;
  trait: boolean;
}

/** The timing globals of a surface, read off the one list the editor and the menu share. */
export const timingGlobalsOf = (surface: CodeSurface): TimingGlobals => ({
  narration: surfaceHasGlobal(surface, 'narration'),
  player: surfaceHasGlobal(surface, 'player'),
  trait: surfaceHasGlobal(surface, 'trait'),
});

/** A call on `player` inserts complete, with the caret between the quotes of its question. */
function playerFields(): VariableNode[] {
  return PLAYER_CALL_ENTRIES.map((entry) => {
    const args = entry.name === 'ask' ? '("", [])' : '("")';
    const call = field(root('player'), entry, args);
    const caret = call.insert.length - args.length + args.indexOf('"') + 1;
    return { ...call, selection: { from: caret, to: caret } };
  });
}

/** The groups a script's timing adds, in the order its surface lists them. */
function timingGroups(globals: TimingGlobals): VariableNode[] {
  return [
    ...(globals.narration ? [{ kind: 'group' as const, label: 'Narration', info: NARRATION_GLOBAL.info, children: fields(root('narration'), NARRATION_FIELDS) }] : []),
    ...(globals.player ? [{ kind: 'group' as const, label: 'Player', info: PLAYER_GLOBAL.info, children: playerFields() }] : []),
    ...(globals.trait ? [{ kind: 'group' as const, label: 'Switched Trait', info: SWITCHED_TRAIT_GLOBAL.info, children: fields(root('trait'), SWITCHED_TRAIT_FIELDS) }] : []),
  ];
}

/** The Owner group's line is the `owner` card's line on the surface the menu serves. */
const ownerInfo = (self: 'stat' | 'trait' | 'empty'): string | undefined =>
  (self === 'trait' ? TRAIT_SCRIPT_SURFACE : STAT_CODE_SURFACE).globals.find((entry) => entry.name === 'owner')?.info;

/**
 * Builds the Variable menu's top level. Without `names`, every name list is one type-over row. `stats` lists the
 * global stats in every box; an `owner` adds the Owner group, which lists the owner's own.
 */
export function buildVariableTree(
  names?: VariableTreeNames, owner: VariableTreeOwner | null = null, self: 'stat' | 'trait' | 'empty' = 'stat',
  timing: TimingGlobals = { narration: false, player: false, trait: false },
): VariableNode[] {
  const pathMap: PlaceholderPathMap | null = names?.placeholders
    ? placeholderPathMap({ list: names.placeholders.list, owners: names.placeholders.owners })
    : null;
  const ownedRows = (ownerId: string, path: Path, trail: readonly string[]): VariableNameRow[] => {
    const owner = pathMap?.owners.get(ownerId);
    return owner ? placeholderRows(owner.children, path, trail) : [];
  };
  const typeOverPlaceholders = (path: Path) => templateRows(path, (at) => placeholderFields(at, 'Wildcard'));
  const typeOverTraits = (path: Path) => templateRows(path, (at) => fields(at, TRAIT_ENTRY_FIELDS));
  const typeOverLists: OwnLists = {
    traits: typeOverTraits, placeholders: typeOverPlaceholders, stats: (path) => templateRows(path, statFields),
  };

  const entityFields = (path: Path, entity: CodeEntityNames | null) => ownerFields(path, ENTITY_FIELDS, entity ? {
    traits: (at) => traitRows(at, entity.traits.map((trait) => ({ name: trait.name, trail: trait.path }))),
    placeholders: (at) => ownedRows(entity.id, at, []),
    stats: (at) => statNameRows(at, (entity.stats ?? []).map((name) => ({ name, trail: [] }))),
  } : typeOverLists, 'on this entity');

  const entryFields = (at: Path) => fields(at, DICTIONARY_ENTRY_FIELDS);
  const dictionaryFields = (path: Path, dictionary: CodeDictionaryNames | null) => ownerFields(path, DICTIONARY_FIELDS, {
    placeholders: (at) => (dictionary === null ? typeOverPlaceholders(at) : ownedRows(dictionary.id, at, [])),
    entries: (at) => (dictionary?.entries
      ? keyedLastWins(dictionary.entries).map((entry) => ({ name: entry.name, trail: [], children: entryFields(keyed(at, entry.name)) }))
      : templateRows(at, entryFields)),
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
    stats: (at) => statNameRows(at, personas.flatMap((entity) => (entity.stats ?? []).map((name) => ({ name, trail: [entity.name] })))),
  } : typeOverLists, 'on a persona entity');

  const stats = root('stats');
  const ownerRoot = root('owner');
  const traits = root('traits');
  const entities = root('entities');
  const placeholders = root('placeholders');
  const dictionaries = root('dictionaries');
  const locations = root('locations');

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
      name: dictionary.name, trail: [], children: dictionaryFields(keyed(dictionaries, dictionary.name), dictionary),
    }))
    : templateRows(dictionaries, (at) => dictionaryFields(at, null));
  const locationRows = names
    ? keyedLastWins((names.locations ?? []).map((name) => ({ name })))
      .map(({ name }) => ({ name, trail: [], children: locationEntryFields(keyed(locations, name)) }))
    : templateRows(locations, locationEntryFields);

  // A Blueprint group holds stats only, so its Owner has no traits or placeholders.
  const ownerChildren = (at: VariableTreeOwner): VariableNode[] => {
    if (at.kind === 'entity') return at.entity && names ? entityFields(ownerRoot, at.entity) : ownerFields(ownerRoot, ENTITY_FIELDS, typeOverLists, 'on this entity');
    const groupStats = at.statNames;
    if (!groupStats || !names) return ownerFields(ownerRoot, ENTITY_FIELDS, typeOverLists, 'on this entity');
    return ownerFields(ownerRoot, ENTITY_FIELDS, {
      traits: () => [],
      placeholders: () => [],
      stats: (path) => statNameRows(path, groupStats.map((name) => ({ name, trail: [] }))),
    }, 'in this Blueprint group');
  };

  // A world script's `self` is empty, so it gets no group.
  const selfGroup: VariableNode[] = self === 'empty' ? []
    : self === 'trait'
      ? [{ kind: 'group', label: 'This Trait', info: TRAIT_SCRIPT_SURFACE.globals.find((entry) => entry.name === 'self')?.info, children: fields(root('self'), SELF_TRAIT_FIELDS) }]
      : [{ kind: 'group', label: 'This Stat', info: globalInfo('self'), children: statFields(root('self')) }];
  const top: VariableNode[] = [
    ...selfGroup,
    ...(owner ? [{ kind: 'group' as const, label: 'Owner', info: ownerInfo(self), children: ownerChildren(owner) }] : []),
    nameList('Stats', statRows, 'No stats in this world', globalInfo('stats')),
    nameList('Traits', traitList, 'No traits in this world', globalInfo('traits')),
    nameList('Entities', entityRows, 'No entities in this world', globalInfo('entities')),
    { kind: 'group', label: 'Persona', info: globalInfo('persona'), children: personaFields },
    nameList('Placeholders', placeholderList, 'No placeholders in this world', globalInfo('placeholders')),
    nameList('Dictionaries', dictionaryRows, 'No dictionaries in this world', globalInfo('dictionaries')),
    { kind: 'group', label: 'Clock', info: globalInfo('clock'), children: clockFields(root('clock')) },
    { kind: 'group', label: 'Turn', info: globalInfo('turn'), children: fields(root('turn'), TURN_MEMBERS) },
    nameList('Locations', locationRows, 'No locations in this world', globalInfo('locations')),
    { kind: 'group', label: 'Location', info: globalInfo('location'), children: locationFields() },
    { kind: 'group', label: 'Discover', info: globalInfo('discover'), children: [topCallField('discover', '"Name"')] },
    { kind: 'group', label: 'Memories', info: globalInfo('memories'), children: memoryFields() },
    { kind: 'field', label: 'notes', detail: 'string', info: globalInfo('notes') ?? '', access: 'readOnly', insert: 'notes' },
    ...timingGroups(timing),
  ];
  return top.map(verbsLast).map(leafForOneChild);
}

/** Whether a leaf is a verb: its insert ends in a call, or its detail is a function type. */
export const isVerbLeaf = (node: VariableNode): boolean =>
  node.kind === 'field' && (node.insert.endsWith(')') || isMethodEntry(node));

/** `nodes` with the verbs after everything else, each set keeping its order. */
const fieldsThenVerbs = (nodes: readonly VariableNode[]): VariableNode[] =>
  [...nodes.filter((node) => !isVerbLeaf(node)), ...nodes.filter(isVerbLeaf)];

/** `node` with the verbs last in every group, at any depth (R7). */
function verbsLast(node: VariableNode): VariableNode {
  if (node.kind === 'names') return { ...node, rows: node.rows.map((row) => ({ ...row, children: fieldsThenVerbs(row.children.map(verbsLast)) })) };
  if (node.kind !== 'group') return node;
  return { ...node, children: fieldsThenVerbs(node.children.map(verbsLast)) };
}

/** `node` with every group of one field drawn as that field, at any depth. */
function leafForOneChild(node: VariableNode): VariableNode {
  if (node.kind === 'names') return { ...node, rows: node.rows.map((row) => ({ ...row, children: row.children.map(leafForOneChild) })) };
  if (node.kind !== 'group') return node;
  const children = node.children.map(leafForOneChild);
  return children.length === 1 && children[0].kind === 'field' ? children[0] : { ...node, children };
}

/** `nodes` as a read-only surface lists them (Q24): no method, every field read-only, and no level left empty. */
export function readOnlyTree(nodes: readonly VariableNode[]): VariableNode[] {
  return nodes.flatMap((node): VariableNode[] => {
    if (node.kind === 'field') return isMethodEntry(node) ? [] : [{ ...node, access: 'readOnly' }];
    if (node.kind === 'group') {
      const children = readOnlyTree(node.children);
      return children.length ? [{ ...node, children }] : [];
    }
    if (node.kind === 'names') {
      const rows = node.rows.flatMap((row) => {
        const field = row.field && !isMethodEntry(row.field) ? { ...row.field, access: 'readOnly' as const } : undefined;
        const children = readOnlyTree(row.children);
        return field || children.length ? [{ ...row, children, ...(field ? { field } : {}) }] : [];
      });
      return rows.length ? [{ ...node, rows }] : [];
    }
    return [node];
  });
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
