import type { CodeBounds, Stat } from '@/types';
import { getQuickJS, shouldInterruptAfterDeadline, type QuickJSWASMModule } from 'quickjs-emscripten';
import { clamp } from './utils';
import { VALUE_JOIN } from './placeholders';
import { hasEntityKey } from './statCodeNames';
import {
  PLACEHOLDER_ENTRY_MEMBERS, placeholderPathExpression, placeholderPathLabel, type PlaceholderPathRoot,
} from './statCodePaths';
import { dayAndHour, daypart, FLAT_HOURS_PER_TURN, type WorldCalendar } from './gameClock';

// Stat `code` ships inside world definitions, and worlds are downloaded from the community server — treat it as
// untrusted. It runs in an isolated QuickJS (WASM) VM: no page globals (window/fetch/localStorage),
// only the marshalled stat data below. A runtime interrupt enforces the timeout (kills `while(true)`),
// and memory/stack caps bound allocation.
const EXECUTION_TIMEOUT_MS = 1000;
const MEMORY_LIMIT_BYTES = 16 * 1024 * 1024;
const MAX_STACK_BYTES = 512 * 1024;

// The WASM engine loads once and is shared; each execution gets a fresh disposable runtime/context.
let quickJSPromise: Promise<QuickJSWASMModule> | null = null;
const loadQuickJS = () => (quickJSPromise ??= getQuickJS());

/** Where the story's clock stands for one stat-code run. `elapsedHours` is the total as of the END of the
 *  turn, so the turn's own duration is already included; the start-of-turn readings derive from it. */
export interface StatClock {
  /** Story hours this turn consumed. Defaults to the flat hour, which is also what a clock-off game charges. */
  deltaHours?: number;
  /** Total story hours at the end of this turn. Defaults to one turn's worth, so a clock-less caller reads
   *  as the opening turn having just closed rather than as no time having passed at all. */
  elapsedHours?: number;
  calendar?: WorldCalendar;
}

/** The `clock` object a run reads, resolved from `clock` and its defaults. */
const clockObject = (clock?: StatClock) => {
  const deltaHours = Math.max(0, clock?.deltaHours ?? FLAT_HOURS_PER_TURN);
  const elapsedHours = Math.max(0, clock?.elapsedHours ?? deltaHours);
  const end = dayAndHour(elapsedHours, clock?.calendar);
  // A turn spans time, so its start can sit in a different day/daypart than its end — a long sleep begins
  // in the afternoon and ends at night. Both readings are exposed; neither is derivable from the other.
  const start = dayAndHour(Math.max(0, elapsedHours - deltaHours), clock?.calendar);
  return {
    day: end.day,
    daypart: daypart(end.hour, clock?.calendar),
    deltaHours,
    elapsedHours,
    previous: { day: start.day, daypart: daypart(start.hour, clock?.calendar) },
  };
};

/** How a run failed, for a caller that sorts failures rather than printing them. `bad-write` is a
 *  placeholder or trait written a value of the wrong type. */
export type StatCodeFailure = 'timeout' | 'non-number' | 'throw' | 'bad-write';

/** The bounds a stat's code may set on itself, in the order the host reads them back. */
export const CODE_BOUND_FIELDS = ['min', 'max', 'regen'] as const satisfies readonly (keyof CodeBounds)[];
export type CodeBoundField = (typeof CODE_BOUND_FIELDS)[number];

/** The fields on `self` that a write reaches. Every other stat field is read-only. */
export const SELF_WRITABLE_FIELDS: readonly string[] = ['value', ...CODE_BOUND_FIELDS];

export interface StatCodeResult {
  /** The value the code set, by return or by `self.value`, clamped to the range after this run's bound
   *  writes; null when it left the value alone. */
  value: number | null;
  error: string | null;
  /** Present exactly when `error` is. */
  kind?: StatCodeFailure;
  /** The bounds the code wrote on `self`. Absent when it wrote none. */
  bounds?: CodeBounds;
  /** The placeholders the code wrote or unpinned, in map order. Absent when it touched none. */
  placeholders?: PlaceholderWrite[];
  /** Paths the code wrote that no placeholder answers, as code spelled them; each write was dropped. */
  unknownPlaceholders?: string[];
  /** Paths the code wrote through an owner no run can know, an unknown entity or dictionary or the empty
   *  persona, as labels; each write was dropped. */
  unknownOwnerPlaceholders?: string[];
  /** The traits the code switched, in map order. Absent when it switched none. */
  traits?: TraitWrite[];
  /** Names the code switched that no trait has; each switch was dropped. */
  unknownTraits?: string[];
  /** Traits whose `acquired` the code wrote; each write was dropped. */
  acquiredWrites?: string[];
  /** What the code did to each entity's traits, through `entities` or `persona`, in map order. Absent when
   *  it wrote into none. */
  entities?: EntityTraitWrites[];
  /** Entity names the code switched a trait through that no entity in play has; each switch was dropped. */
  unknownEntities?: string[];
  /** Read-only fields the code wrote, as code spelled them, such as `traits.Brave.mode`; each write was dropped. */
  readOnlyWrites?: string[];
}

/** What one run did to one entity's traits. */
export interface EntityTraitWrites {
  /** The entity's code name; empty for the empty persona. */
  entity: string;
  /** Absent when the code switched none. */
  traits?: TraitWrite[];
  /** Names the code switched that the entity's set lacks; each switch was dropped. */
  unknownTraits?: string[];
  /** Traits whose `acquired` the code wrote; each write was dropped. */
  acquiredWrites?: string[];
}

/** One placeholder a run pinned, or released with `unpin()`. The pin carries the type the entry's `value`
 *  reads: one text on a Wildcard or a Variable, a list on an Object. `id` is the placeholder the write
 *  lands on, whichever path reached it; `path` is how the code spelled it. */
export type PlaceholderWrite = { id: string; path: readonly string[] }
  & ({ value: string | string[] } | { unpin: true });

/** One trait a run switched on or off. */
export interface TraitWrite {
  name: string;
  enabled: boolean;
}

/** One entry of the sandbox's `traits` map. A caller with no playthrough leaves the identity fields out, and
 *  they read as an optional trait with no group, closed to the player. */
export interface SandboxTrait {
  name: string;
  /** Acquired and not switched off. */
  enabled: boolean;
  /** In the player's list, on or off. */
  acquired: boolean;
  id?: string;
  mode?: 'optional' | 'alwaysOn' | 'hidden';
  /** Whether the trait's requirements hold for its Bearer now. */
  available?: boolean;
  /** The group's code name; empty when ungrouped. */
  group?: string;
  playerToggle?: boolean;
}

/** One entry of the sandbox's `entities`, or `persona`. Identity fields left out read blank. */
export interface SandboxEntity {
  name: string;
  traits: readonly SandboxTrait[];
  id?: string;
  type?: string;
  pronouns?: string;
  inScene?: boolean;
  /** The entity's owner node in the placeholder tree. Absent, its `placeholders` holds no names. */
  placeholders?: SandboxPlaceholderNode;
}

/** One entry of the sandbox's `dictionaries`: a book's code name, and its owner node in the placeholder tree. */
export interface SandboxDictionary {
  name: string;
  id?: string;
  /** Absent, its `placeholders` holds no names. */
  placeholders?: SandboxPlaceholderNode;
}

/** A stat's value and max, as one turn input carries them. */
export interface ValueAndMax {
  value: number;
  max: number;
}

/** The plain 8-field shape of a stat, with none of the turn-relative parts `self` and `stats` entries add.
 *  What `previous` marshals down to. */
export interface StatSnapshot {
  id: string;
  name: string;
  type: string;
  description: string;
  min: number;
  max: number;
  value: number;
  regen: number;
}

/** The numbers a stat carries, and the fields of every `delta` source. */
export type StatNumbers = Pick<StatSnapshot, 'value' | 'min' | 'max' | 'regen'>;

/** Each thing that moves a stat in a turn, one `delta` source apiece. `delta.total` adds them up. */
export const DELTA_SOURCES = ['ai', 'regen'] as const;
export type DeltaSource = (typeof DELTA_SOURCES)[number];

/** What this turn did to one stat before its code runs. Every entry in `stats` carries these; a part left
 *  out reads as untouched: `previous` as a copy of the current entry, a change as zero. */
export interface StatTurnInputs {
  /** The whole stat as it stood at the start of the turn. `min`, `max` and `regen` are the effective
   *  numbers then, traits and code bounds included. */
  previous?: Stat;
  /** Each source's change this turn. `ai` is the raw ask, before flags and the range; `regen` is what regen
   *  did, after the enabled gate and clamping. */
  delta?: Partial<Record<DeltaSource, Partial<StatNumbers>>>;
}

/** Each of the four numbers as `read` gives it. */
const fieldwise = (read: (field: keyof StatNumbers) => number): StatNumbers =>
  ({ value: read('value'), min: read('min'), max: read('max'), regen: read('regen') });

/** One entry of the sandbox's `placeholders` map. `roll` runs on the host; the rest rides in as data.
 *  A list `value` marks an Object, and is what `pin` takes on that entry. */
export interface SandboxPlaceholder {
  /** The placeholder this entry reads, so a write lands on it whichever path reached it. */
  id: string;
  /** What is in force: one text on a Wildcard or a Variable, the values in force on an Object. */
  value: string | string[];
  /** Every authored value as text, in authored order, benched ones included. */
  values: readonly string[];
  /** `value` as one string, exactly what the prompt sees for this placeholder. */
  text: string;
  roll: () => string;
}

/**
 * One node of the sandbox's `placeholders` map. A placeholder node carries an entry; an owner node stands
 * for an entity or a dictionary that owns placeholders and carries none, so it has no fixed members at all.
 * One placeholder reachable by two keys is one node object, so it holds one pin state.
 */
export interface SandboxPlaceholderNode {
  /** The key this node takes in its parent. */
  name: string;
  /** Every segment from the map root to this node, by the path that names it. */
  path: readonly string[];
  /** The kind of owner whose entry the path starts at; absent for the world's own rows. */
  ownedBy?: PlaceholderPathRoot;
  /** Absent on an owner node. */
  entry?: SandboxPlaceholder;
  /** The placeholders this node owns, as members. */
  children?: readonly SandboxPlaceholderNode[];
}

// The host hook every entry's `roll()` calls. The prelude takes it and deletes the global before user code runs.
const ROLL_HOOK = '__formamorphRollPlaceholder';
// The preludes' readers of what the run did to each map; the program's completion value calls them. User
// code runs in a function whose parameters shadow both names, so it cannot reach them.
const PLACEHOLDER_WRITES = '__formamorphPlaceholderWrites';
const TRAIT_WRITES = '__formamorphTraitWrites';
const ENTITY_WRITES = '__formamorphEntityWrites';
const DICTIONARY_WRITES = '__formamorphDictionaryWrites';
// The `placeholders` prelude's view of one owner node, which the owner entries' `placeholders` read.
const OWNER_VIEW = '__formamorphOwnerPlaceholders';
const STAT_WRITES = '__formamorphStatWrites';
// Read-only writes outside every map, as full paths: on a `self` that is no entry of `stats`, and on `clock`.
const LOOSE_WRITES = '__formamorphLooseWrites';
const LOOSE_NOTE = '__formamorphLooseNote';

/** How one sandbox map's entries are tracked. Every `string` field is JS source the prelude inlines. */
interface TrackedMapBase {
  /** `(name, entry, state) => void`: installs the entry's accessors; `state` starts as `{ entry }`. */
  track: string;
  /** The literal an unknown name reads as. */
  blank: string;
}

/** How the host reads back what a run wrote to a map. A map the host reads nothing back from leaves it out. */
interface TrackedMapWrites {
  /** `(name, state) => row | null` for an entry still in place; null when the run left it alone. */
  row: string;
  /** `(name, entry) => row` for an entry the code replaced wholesale. */
  replaced: string;
}

type TrackedMapKind = TrackedMapBase & (TrackedMapWrites | { [K in keyof TrackedMapWrites]?: undefined });

/** One sandbox map: its kind, the variable code reads it by, its data, and the reader of its writes. */
type TrackedMapSpec = TrackedMapKind & {
  root: string;
  data: Record<string, unknown>;
  /** The variable the reader of the map's writes is bound to. Absent when the host reads nothing back. */
  reader?: string;
};

/** JS source of `(data) => [map, rows]`, closing over `keys`. The map has a null prototype; an unknown name
 *  reads as a tracked blank entry. `rows()` lists what the run did. */
const trackedMapFactory = (kind: TrackedMapKind): string => [
  `((data) => {`,
  `  const map = Object.assign(Object.create(null), data);`,
  `  const own = Object.create(null);`,
  `  const track = (name, entry) => { const state = own[name] = { entry }; (${kind.track})(name, entry, state); return entry; };`,
  `  for (const name of keys(map)) track(name, map[name]);`,
  `  const proxy = new Proxy(map, {`,
  `    get: (target, key) => typeof key !== 'string' || key in target ? target[key]`,
  `      : own[key] ? own[key].entry : track(key, ${kind.blank}),`,
  `  });`,
  kind.row === undefined ? `  const rows = () => [];` : [
    `  const rows = () => [...keys(map), ...keys(own).filter((name) => !(name in map))].map((name) => {`,
    `    const entry = map[name], state = own[name];`,
    `    if (!state || (name in map && entry !== state.entry)) return (${kind.replaced})(name, entry);`,
    `    return (${kind.row})(name, state);`,
    `  }).filter((row) => row);`,
  ].join('\n'),
  `  return [proxy, rows];`,
  `})`,
].join('\n');

/** The prelude that builds one sandbox map and, with a `reader`, a reader of what the run did to it. The
 *  data rides in as a JSON string. */
const trackedMapPrelude = (spec: TrackedMapSpec): string => [
  `const [${spec.root}${spec.reader ? `, ${spec.reader}` : ''}] = ((stringify, keys) => {`,
  `  const [map, rows] = ${trackedMapFactory(spec)}(JSON.parse(${JSON.stringify(JSON.stringify(spec.data))}));`,
  `  return [map, () => stringify(rows())];`,
  `})(JSON.stringify, Object.keys);`,
].join('\n');

/** `entry` with every string emptied and every number zeroed, at every depth. */
const blankOf = (entry: unknown): unknown => {
  if (typeof entry === 'string') return '';
  if (typeof entry === 'number') return 0;
  if (typeof entry !== 'object' || entry === null) return entry;
  return Object.fromEntries(Object.entries(entry).map(([key, value]) => [key, blankOf(value)]));
};

/** JS source of `(list, path) => void`: adds a reported path to `list` unless it is already there. */
const ADD_ONCE = `(list, path) => { if (!list.includes(path)) list.push(path); }`;

/** JS source of `(target, fields, prefix, note) => target`: each field becomes a getter of its value whose
 *  setter calls `note(prefix + field)`. */
const LOCK_FIELDS = `(target, fields, prefix, note) => {
  for (const field of fields) {
    const held = target[field];
    Object.defineProperty(target, field, { enumerable: true, get: () => held, set: () => note(prefix + field) });
  }
  return target;
}`;

/** JS source of `(entry, isSelf, note) => void`: locks every field of a stat entry, at every depth, except
 *  the ones `self` writes. */
const LOCK_STAT = `(entry, isSelf, note) => {
  const lock = ${LOCK_FIELDS};
  const deep = (target, prefix) => Object.freeze(lock(target, Object.keys(target), prefix, note));
  for (const source of Object.keys(entry.delta)) deep(entry.delta[source], 'delta.' + source + '.');
  deep(entry.delta, 'delta.');
  deep(entry.previous, 'previous.');
  const writable = ${JSON.stringify(SELF_WRITABLE_FIELDS)};
  lock(entry, Object.keys(entry).filter((field) => !(isSelf && writable.includes(field))), '', note);
}`;

/** The `stats` prelude. Rows are `[name, writtenPaths]`, or `[name, null]` for an entry replaced whole. */
const statsPrelude = (entries: readonly { name: string }[], blank: unknown, selfName: string | null): string => trackedMapPrelude({
  root: 'stats',
  reader: STAT_WRITES,
  data: Object.fromEntries(entries.map((entry) => [entry.name, entry])),
  track: `(name, entry, state) => {
    state.written = [];
    (${LOCK_STAT})(entry, name === ${JSON.stringify(selfName)}, (path) => (${ADD_ONCE})(state.written, path));
  }`,
  blank: JSON.stringify(blank),
  row: `(name, state) => state.written.length ? [name, state.written] : null`,
  replaced: `(name) => [name, null]`,
});

/** The `placeholders` map as the prelude and the write reader both read it: its top-level keys, and every
 *  node it holds under an index apiece. */
interface FlatPlaceholderMap {
  top: readonly SandboxPlaceholderNode[];
  /** Every node, each once, in the order a walk from the top reaches them. */
  nodes: readonly SandboxPlaceholderNode[];
  indexOf: ReadonlyMap<SandboxPlaceholderNode, number>;
}

/** Flatten the map and the owner nodes the entries carry. A node shared by two routes takes one index, so it
 *  holds one pin state, and a world whose placeholders hold each other terminates. */
function flattenPlaceholderMap(
  top: readonly SandboxPlaceholderNode[], owned: readonly (SandboxPlaceholderNode | undefined)[],
): FlatPlaceholderMap {
  const indexOf = new Map<SandboxPlaceholderNode, number>();
  const nodes: SandboxPlaceholderNode[] = [];
  const visit = (node: SandboxPlaceholderNode) => {
    if (indexOf.has(node)) return;
    indexOf.set(node, nodes.length);
    nodes.push(node);
    for (const child of node.children ?? []) visit(child);
  };
  for (const node of top) visit(node);
  for (const node of owned) if (node) visit(node);
  return { top, nodes, indexOf };
}

/**
 * The `placeholders` prelude. The map is a tree: every node is an object on a null prototype carrying its
 * children as members, then its own fixed members, which win a name a child shares. A Proxy on each node
 * hands an unknown member a tracked blank entry, so a write to `placeholders.Hair.Shdae` is dropped rather
 * than thrown, and reported by the path that named it.
 *
 * `value` is an accessor, so the reader knows whether the entry was written and whether an unpin came after;
 * `text` follows it and takes no write. `pin(x)` is an alias of the `value` setter — same state, same row —
 * so the last of `pin`, `value` and `unpin` a run calls wins. Rows are `[index, 'set', value]` or
 * `[index, 'unpin']`; an entry a run replaced wholesale is a write of itself when it is a string or a list,
 * else of its own value.
 *
 * It also hands back an owner node's view by index, each owner entry's `placeholders`.
 *
 * `stats` and `traits` are flat maps and share `trackedMapPrelude`. This one does not: its objects nest, one
 * node sits at two keys, and a key a run adds has to be told apart from the members its node was built with.
 * A factory serving both shapes would carry every one of those cases for the two maps that never meet them.
 */
const placeholdersPrelude = ({ top, nodes, indexOf }: FlatPlaceholderMap): string => {
  const keyed = (children: readonly SandboxPlaceholderNode[]) =>
    children.map((child) => [child.name, indexOf.get(child)]);
  const spec = {
    nodes: nodes.map((node) => ({
      p: [node.ownedBy ?? '', ...node.path],
      ...(node.entry ? { e: { id: node.entry.id, name: node.name, value: node.entry.value, values: node.entry.values, text: node.entry.text } } : {}),
      ...(node.children?.length ? { c: keyed(node.children) } : {}),
    })),
    top: keyed(top),
  };
  return [
    `const [placeholders, ${PLACEHOLDER_WRITES}, ${OWNER_VIEW}] = ((stringify, keys, isArray, define, roll) => {`,
    `  const spec = JSON.parse(${JSON.stringify(JSON.stringify(spec))});`,
    `  const states = [];`,
    `  const strays = Object.create(null);`,
    `  const track = (target, state, id, name) => {`,
    `    const set = (v) => {`,
    `      state.value = v;`,
    `      state.text = isArray(v) ? v.join(${JSON.stringify(VALUE_JOIN)}) : String(v);`,
    `      state.assigned = true; state.unpinned = false;`,
    `    };`,
    `    define(target, 'value', { enumerable: true, get: () => state.value, set });`,
    `    define(target, 'text', { enumerable: true, get: () => state.text });`,
    `    target.pin = set;`,
    `    target.unpin = () => { state.unpinned = true; };`,
    `    for (const [field, held] of [['id', id], ['name', name]]) {`,
    `      define(target, field, { enumerable: true, get: () => held, set: () => (${ADD_ONCE})(state.readOnly, field) });`,
    `    }`,
    `  };`,
    `  const strayAt = (path, key, absent) => {`,
    `    const at = stringify([...path, key]);`,
    `    if (strays[at]) return strays[at].entry;`,
    `    const state = { value: '', text: '', assigned: false, unpinned: false, readOnly: [], path: [...path, key], absent };`,
    `    const entry = Object.create(null);`,
    `    entry.values = []; entry.roll = () => '';`,
    `    track(entry, state, '', '');`,
    `    strays[at] = { entry, state };`,
    `    return entry;`,
    `  };`,
    `  const view = (target, path, absent = false) => new Proxy(target, {`,
    `    get: (t, key) => (typeof key !== 'string' || key in t ? t[key] : strayAt(path, key, absent)),`,
    `  });`,
    `  const targets = spec.nodes.map(() => Object.create(null));`,
    `  const views = spec.nodes.map((n, i) => view(targets[i], n.p));`,
    `  const members = (holder, pairs) => { for (const [key, at] of pairs) holder[key] = views[at]; };`,
    `  spec.nodes.forEach((n, i) => members(targets[i], n.c || []));`,
    `  spec.nodes.forEach((n, i) => {`,
    `    if (!n.e) return;`,
    `    states[i] = { value: n.e.value, text: n.e.text, assigned: false, unpinned: false, readOnly: [] };`,
    `    targets[i].values = n.e.values;`,
    `    targets[i].roll = () => roll(i);`,
    `    track(targets[i], states[i], n.e.id, n.e.name);`,
    `  });`,
    `  const root = Object.create(null);`,
    `  members(root, spec.top);`,
    // Every key each object is meant to carry. A run can also write a key no node answers, which lands on
    // the object itself rather than on a blank entry, so the reader diffs against these to find it.
    `  const expected = (pairs, entry) => {`,
    `    const set = Object.create(null);`,
    `    for (const pair of pairs) set[pair[0]] = 1;`,
    `    if (entry) for (const member of ${JSON.stringify(PLACEHOLDER_ENTRY_MEMBERS)}) set[member] = 1;`,
    `    return set;`,
    `  };`,
    `  const scanned = [{ object: root, built: expected(spec.top, false), path: [''] }]`,
    `    .concat(spec.nodes.map((n, i) => ({ object: targets[i], built: expected(n.c || [], !!n.e), path: n.p })));`,
    // Every key an entry actually sits at, so a run that replaced one wholesale is read back as a write of
    // it. A child whose name lost to a member of its holder sits at no key, so it has no site here.
    `  const sites = [];`,
    `  const site = (holder, pairs) => {`,
    `    for (const [key, at] of pairs) if (holder[key] === views[at] && spec.nodes[at].e) {`,
    `      sites.push({ holder, key, at });`,
    `    }`,
    `  };`,
    `  site(root, spec.top);`,
    `  spec.nodes.forEach((n, i) => site(targets[i], n.c || []));`,
    `  const readWrites = () => {`,
    `    const replaced = Object.create(null);`,
    `    for (const { holder, key, at } of sites) {`,
    `      const held = holder[key];`,
    `      if (held === views[at]) continue;`,
    `      replaced[at] = typeof held === 'string' || held == null || isArray(held) ? held : held.value;`,
    `    }`,
    `    const rows = [];`,
    `    spec.nodes.forEach((n, i) => {`,
    `      if (!n.e) return;`,
    `      if (i in replaced) rows.push([i, 'set', replaced[i]]);`,
    `      else if (states[i].unpinned) rows.push([i, 'unpin']);`,
    `      else if (states[i].assigned) rows.push([i, 'set', states[i].value]);`,
    `    });`,
    `    const missed = [];`,
    `    const missedOwners = [];`,
    `    const seen = Object.create(null);`,
    `    const miss = (path, absent) => { const at = stringify(path); if (!seen[at]) { seen[at] = 1; (absent ? missedOwners : missed).push(path); } };`,
    `    for (const { object, built, path, absent } of scanned) {`,
    `      for (const key of keys(object)) if (!(key in built)) miss([...path, key], absent);`,
    `    }`,
    `    for (const at of keys(strays)) {`,
    `      const state = strays[at].state;`,
    `      if (state.assigned || state.unpinned) miss(state.path, state.absent);`,
    `    }`,
    `    const readOnly = [];`,
    `    spec.nodes.forEach((n, i) => { if (n.e) for (const field of states[i].readOnly) readOnly.push([...n.p, field]); });`,
    `    for (const at of keys(strays)) for (const field of strays[at].state.readOnly) readOnly.push([...strays[at].state.path, field]);`,
    `    return stringify([rows, missed, readOnly, missedOwners]);`,
    `  };`,
    // An owner entry's `placeholders`: its node's view, or an empty owner of its own whose writes the reader
    // scans like any node's. `absent` marks the owner no run can know: an unknown name or the empty persona.
    `  const ownerView = (at, path, absent) => {`,
    `    if (at >= 0) return views[at];`,
    `    const target = Object.create(null);`,
    `    scanned.push({ object: target, built: Object.create(null), path, absent });`,
    `    return view(target, path, absent);`,
    `  };`,
    `  return [view(root, ['']), readWrites, ownerView];`,
    `})(JSON.stringify, Object.keys, Array.isArray, Object.defineProperty, globalThis.${ROLL_HOOK});`,
    `delete globalThis.${ROLL_HOOK};`,
  ].join('\n');
};

/** The fields on a trait entry that a write never reaches. A write to one is recorded and dropped. */
const TRAIT_READ_ONLY_FIELDS = ['id', 'name', 'mode', 'available', 'group', 'playerToggle'] as const;

/** A trait map, `traits` or an entity's; only `enabled` takes a write. Rows are
 *  `[name, enabled, assigned, acquiredWritten, readOnlyFields]`. */
const TRAIT_MAP: TrackedMapKind = {
  track: `(name, entry, state) => {
    state.enabled = entry.enabled; state.acquired = entry.acquired; state.assigned = false; state.acquiredWritten = false;
    state.readOnly = [];
    Object.defineProperty(entry, 'enabled', { enumerable: true, get: () => state.enabled, set: (v) => { state.enabled = v; state.assigned = true; } });
    Object.defineProperty(entry, 'acquired', { enumerable: true, get: () => state.acquired, set: () => { state.acquiredWritten = true; } });
    for (const field of ${JSON.stringify(TRAIT_READ_ONLY_FIELDS)}) {
      const value = entry[field];
      Object.defineProperty(entry, field, { enumerable: true, get: () => value, set: () => (${ADD_ONCE})(state.readOnly, field) });
    }
  }`,
  blank: `{ enabled: false, acquired: false, id: '', name: '', mode: '', available: false, group: '', playerToggle: false }`,
  row: `(name, state) => state.assigned || state.acquiredWritten || state.readOnly.length ? [name, state.enabled, state.assigned, state.acquiredWritten, state.readOnly] : null`,
  replaced: `(name, entry) => [name, typeof entry === 'object' && entry !== null ? entry.enabled : entry, true, false, []]`,
};

const traitData = (entries: readonly SandboxTrait[]) =>
  Object.fromEntries(entries.map(({ name, enabled, acquired, id = '', mode = 'optional', available = true, group = '', playerToggle = false }) =>
    [name, { enabled, acquired, id, name, mode, available, group, playerToggle }]));

/** The fields on an entity entry that a write never reaches. */
const ENTITY_READ_ONLY_FIELDS = ['id', 'name', 'type', 'pronouns', 'inScene', 'traits', 'placeholders'] as const;

/** The entities in play keyed by code name, and the played persona, which may be one of them. */
export interface KeyedEntities<T extends SandboxEntity = SandboxEntity> {
  byName: ReadonlyMap<string, T>;
  persona: T;
}

/** The entities as the sandbox keys them: an unnamed one is left out, the later of two sharing a name wins,
 *  and the played persona holds its own name whatever comes after it. */
export function keyedEntities<T extends SandboxEntity>(entities: readonly T[], persona: T): KeyedEntities<T> {
  const byName = new Map(entities.filter((entity) => hasEntityKey(entity.name)).map((entity) => [entity.name, entity]));
  if (hasEntityKey(persona.name)) byName.set(persona.name, persona);
  return { byName, persona };
}

/** JS source of `(fields, entries, blank, build) => [map, readWrites, entry]`: frozen entries with read-only
 *  `fields`, built by `build(key, data, unknown) => [values, rows]`; an unknown name builds from `blank`. */
const READ_ONLY_ENTRY_MAP = `(fields, entries, blank, build) => {
  const readers = [];
  const entry = (key, data, unknown) => {
    const [values, rows] = build(key, data, unknown);
    const written = [];
    readers.push([key, unknown, rows, written]);
    const out = {};
    for (const field of fields) {
      define(out, field, { enumerable: true, get: () => values[field], set: () => (${ADD_ONCE})(written, field) });
    }
    return freeze(out);
  };
  const map = Object.create(null);
  for (const [name, data] of entries) map[name] = entry(name, data, false);
  const strays = Object.create(null);
  const proxy = new Proxy(freeze(map), {
    get: (target, key) => typeof key !== 'string' || key in target ? target[key]
      : strays[key] || (strays[key] = entry(key, blank, true)),
  });
  const readWrites = () => stringify(readers
    .map(([key, unknown, rows, written]) => [key, unknown, rows(), written])
    .filter((row) => row[2].length || row[3].length));
  return [proxy, readWrites, entry];
}`;

/** The prelude that binds `names` to what `body` returns, with the read-only entry-map factory in scope as
 *  `entryMap` and the spec as `spec`. */
const readOnlyEntryMapPrelude = (names: string, spec: unknown, body: readonly string[]): string => [
  `const [${names}] = ((stringify, freeze, define) => {`,
  `  const entryMap = ${READ_ONLY_ENTRY_MAP};`,
  `  const spec = JSON.parse(${JSON.stringify(JSON.stringify(spec))});`,
  ...body.map((line) => `  ${line}`),
  `})(JSON.stringify, Object.freeze, Object.defineProperty);`,
].join('\n');

/** The `entities` and `persona` prelude: each entry with its own trait map and owner view. */
const entitiesPrelude = ({ byName, persona }: KeyedEntities, { indexOf }: FlatPlaceholderMap): string => {
  const data = ({ id = '', type = '', pronouns = '', inScene = false, traits, placeholders }: SandboxEntity) =>
    ({ id, type, pronouns, inScene, traits: traitData(traits), ph: ownerIndex(indexOf, placeholders) });
  const spec = {
    entities: [...byName].map(([name, entity]) => [name, data(entity)]),
    persona: hasEntityKey(persona.name) ? null : data(persona),
  };
  return readOnlyEntryMapPrelude(`entities, persona, ${ENTITY_WRITES}`, spec, [
    `const traitMap = ((keys) => ${trackedMapFactory(TRAIT_MAP)})(Object.keys);`,
    `const [entities, readWrites, entry] = entryMap(${JSON.stringify(ENTITY_READ_ONLY_FIELDS)}, spec.entities, {}, (key, data, unknown) => {`,
    `  const [traits, rows] = traitMap(data.traits || {});`,
    `  const placeholders = ${OWNER_VIEW}(data.ph ?? -1, key ? ['entity', key] : ['persona', 'persona'], unknown || !key);`,
    `  return [{ id: '', type: '', pronouns: '', inScene: false, ...data, name: unknown ? '' : key, traits, placeholders }, rows];`,
    `});`,
    `const persona = spec.persona ? entry('', spec.persona, false) : entities[${JSON.stringify(persona.name)}];`,
    `return [entities, persona, readWrites];`,
  ]);
};

/** The index of an owner node in the flattened map, or -1 where the owner has none. */
const ownerIndex = (indexOf: FlatPlaceholderMap['indexOf'], node: SandboxPlaceholderNode | undefined): number =>
  (node ? indexOf.get(node) ?? -1 : -1);

/** The fields on a dictionary entry. None takes a write. */
const DICTIONARY_READ_ONLY_FIELDS = ['id', 'name', 'placeholders'] as const;

/** The `dictionaries` prelude, the later of two books sharing a name winning. */
const dictionariesPrelude = (dictionaries: readonly SandboxDictionary[], { indexOf }: FlatPlaceholderMap): string => {
  const spec = [...new Map(dictionaries.map((book) => [book.name, { id: book.id ?? '', ph: ownerIndex(indexOf, book.placeholders) }]))];
  return readOnlyEntryMapPrelude(`dictionaries, ${DICTIONARY_WRITES}`, spec, [
    `const [dictionaries, readWrites] = entryMap(${JSON.stringify(DICTIONARY_READ_ONLY_FIELDS)}, spec, { id: '', ph: -1 }, (key, data, unknown) =>`,
    `  [{ id: data.id, name: unknown ? '' : key, placeholders: ${OWNER_VIEW}(data.ph, ['dictionary', key], unknown) }, () => []]);`,
    `return [dictionaries, readWrites];`,
  ]);
};

/** One row of a read-only entry map's reader: the name code used, whether no entry has it, what the entry's
 *  own map reported, and the read-only fields the run wrote. */
interface EntryWriteRow {
  name: string;
  unknown: boolean;
  mapRows: unknown;
  fields: unknown;
}

/** The rows in a read-only entry map's dump; a malformed row is skipped. */
function readEntryWriteRows(dump: string): EntryWriteRow[] {
  const parsed: unknown = JSON.parse(dump);
  return (Array.isArray(parsed) ? parsed : []).flatMap((row) => (Array.isArray(row) && typeof row[0] === 'string'
    ? [{ name: row[0], unknown: row[1] === true, mapRows: row[2], fields: row[3] }] : []));
}

/** The read-only fields the run wrote on `dictionaries` entries, as code spelled them. */
const readDictionaryWrites = (dump: string): string[] =>
  readEntryWriteRows(dump).flatMap(({ name, fields }) => readOnlyPaths(memberPath('dictionaries', name), fields));

/** How code names an entry of `root`: dot syntax for an identifier, brackets otherwise. */
const memberPath = (root: string, name: string) =>
  /^[A-Za-z_$][\w$]*$/.test(name) ? `${root}.${name}` : `${root}[${JSON.stringify(name)}]`;

/** How code names an entity: through `entities`, or through `persona` for the empty persona. */
const entityPath = (entity: string) => (entity ? memberPath('entities', entity) : 'persona');

/** How code names an entity's trait map. */
export const entityTraitsPath = (entity: string) => `${entityPath(entity)}.traits`;

/** The names in a reader's list of written read-only fields, each as the path code spelled it. */
const readOnlyPaths = (path: string, fields: unknown): string[] =>
  (Array.isArray(fields) ? fields : []).filter((field): field is string => typeof field === 'string').map((field) => `${path}.${field}`);

/** A reader's rows, split into those naming an entry and the names no entry has. */
function splitWriteRows(rows: unknown, entries: readonly { name: string }[]): { known: [string, ...unknown[]][]; unknown: string[] } {
  const names = new Set(entries.map((entry) => entry.name));
  const known: [string, ...unknown[]][] = [];
  const unknown: string[] = [];
  for (const row of Array.isArray(rows) ? rows : []) {
    if (!Array.isArray(row) || typeof row[0] !== 'string') continue;
    if (names.has(row[0])) known.push(row as [string, ...unknown[]]);
    else unknown.push(row[0]);
  }
  return { known, unknown };
}

/** The switches in the reader's dump, one per assigned `enabled`. A name no trait has is dropped; a switch
 *  holds true or false, and anything else fails the run. */
function readTraitWrites(
  rows: unknown,
  entries: readonly SandboxTrait[],
  /** How code names the map, for the error. */
  root: string,
): { writes: TraitWrite[]; unknown: string[]; acquired: string[]; readOnly: string[] } | { error: string } {
  const { known, unknown } = splitWriteRows(rows, entries);
  const writes: TraitWrite[] = [];
  const acquired: string[] = [];
  const readOnly: string[] = [];
  for (const [name, enabled, assigned, acquiredWritten, fields] of known) {
    if (acquiredWritten === true) acquired.push(name);
    readOnly.push(...readOnlyPaths(memberPath(root, name), fields));
    if (assigned !== true) continue;
    if (typeof enabled !== 'boolean') return { error: `${memberPath(root, name)}.enabled must be true or false` };
    writes.push({ name, enabled });
  }
  return { writes, unknown, acquired, readOnly };
}

/** What the run did to each entity's traits, from the `entities` reader's dump. A row through an unknown
 *  entity names the entity, not its traits. */
function readEntityWrites(
  dump: string,
  { byName, persona }: KeyedEntities,
): { writes: EntityTraitWrites[]; unknown: string[]; readOnly: string[] } | { error: string } {
  const writes: EntityTraitWrites[] = [];
  const unknown: string[] = [];
  const readOnly: string[] = [];
  for (const { name, unknown: isUnknown, mapRows: rows, fields } of readEntryWriteRows(dump)) {
    readOnly.push(...readOnlyPaths(isUnknown ? memberPath('entities', name) : entityPath(name), fields));
    // A blank entry has no traits, so any trait row through it is a switch on an entity that is not there.
    if (isUnknown) {
      if (Array.isArray(rows) && rows.length) unknown.push(name);
      continue;
    }
    const entity = name ? byName.get(name) : persona;
    if (!entity) continue;
    const read = readTraitWrites(rows, entity.traits, entityTraitsPath(name));
    if ('error' in read) return read;
    readOnly.push(...read.readOnly);
    if (!read.writes.length && !read.unknown.length && !read.acquired.length) continue;
    writes.push({
      entity: name,
      ...(read.writes.length ? { traits: read.writes } : {}),
      ...(read.unknown.length ? { unknownTraits: read.unknown } : {}),
      ...(read.acquired.length ? { acquiredWrites: read.acquired } : {}),
    });
  }
  return { writes, unknown, readOnly };
}

/** The root a prelude path leads with: '' for the world's own map. */
const pathRoot = (root: string): PlaceholderPathRoot | undefined =>
  (root === 'entity' || root === 'dictionary' || root === 'persona' ? root : undefined);

/** The paths in a reader's list: each a list of names; anything else is skipped. */
const pathsIn = (rows: unknown): string[][] =>
  (Array.isArray(rows) ? rows : []).filter((path): path is string[] => Array.isArray(path) && path.every((step) => typeof step === 'string'));

/** One written item as text: a string, or a finite number spelled out. Anything else is not text. */
const writtenText = (value: unknown): string | null => (typeof value === 'string' ? value
  : typeof value === 'number' && Number.isFinite(value) ? String(value) : null);

/**
 * The writes in the reader's dump, keyed by node index. A path no placeholder answers is reported rather
 * than applied. A write carries the type its entry's `value` reads: an entry that reads one text takes text,
 * and an entry that reads a list takes a list, with one text pinning a one-item list. Anything else fails
 * the run.
 */
function readPlaceholderWrites(
  dump: string,
  nodes: readonly SandboxPlaceholderNode[],
): { writes: PlaceholderWrite[]; unknown: string[]; unknownOwned: string[]; readOnly: string[] } | { error: string } {
  const parsed: unknown = JSON.parse(dump);
  const [rows, missed, readOnlyRows, missedOwners] = Array.isArray(parsed) ? parsed : [];
  const writes: PlaceholderWrite[] = [];
  for (const row of Array.isArray(rows) ? rows : []) {
    if (!Array.isArray(row) || typeof row[0] !== 'number') continue;
    const node = nodes[row[0]];
    if (!node?.entry) continue;
    const { id } = node.entry;
    const { path } = node;
    const named = placeholderPathExpression(path, node.ownedBy);
    if (row[1] === 'unpin') { writes.push({ id, path, unpin: true }); continue; }
    if (!Array.isArray(node.entry.value)) {
      const text = writtenText(row[2]);
      if (text === null) return { error: `${named}.value must be text` };
      writes.push({ id, path, value: text });
      continue;
    }
    const items: string[] = [];
    for (const item of Array.isArray(row[2]) ? row[2] : [row[2]]) {
      const text = writtenText(item);
      if (text === null) return { error: `${named}.value must be a list of text` };
      items.push(text);
    }
    writes.push({ id, path, value: items });
  }
  // Each path the prelude reports leads with its root: '' for the world's own map, else the owner kind.
  const label = ([, ...segments]: string[]) => placeholderPathLabel(segments);
  const unknown = pathsIn(missed).map(label);
  const unknownOwned = pathsIn(missedOwners).map(label);
  const readOnly = pathsIn(readOnlyRows).map(([root, ...segments]) => placeholderPathExpression(segments, pathRoot(root)));
  return { writes, unknown, unknownOwned, readOnly };
}

/** The read-only fields the run wrote on `stats` entries, then the loose ones. A `self` that is an entry
 *  reports under its `stats` path. */
function readStatReadOnlyWrites(dump: string): string[] {
  const parsed: unknown = JSON.parse(dump);
  const [rows, loose] = Array.isArray(parsed) ? parsed : [];
  const paths: string[] = [];
  for (const row of Array.isArray(rows) ? rows : []) {
    if (!Array.isArray(row) || typeof row[0] !== 'string') continue;
    const entry = memberPath('stats', row[0]);
    if (row[1] === null) paths.push(entry);
    else paths.push(...readOnlyPaths(entry, row[1]));
  }
  return [...paths, ...(Array.isArray(loose) ? loose : []).filter((path): path is string => typeof path === 'string')];
}

const failure = (what: string, kind: StatCodeFailure): StatCodeResult => ({
  value: null,
  error: `Error: ${what}\nStack: No stack trace available`,
  kind,
});
const nonNumberFailure = (what: string) => failure(what, 'non-number');

/** What one run reads beyond the stats: the clock, the turn's inputs, and the two maps. Each part left out
 *  reads as its default: a flat hour, an untouched turn, an empty map. */
export interface StatCodeRunOptions {
  clock?: StatClock;
  turn?: Readonly<Record<string, StatTurnInputs>>;
  /** The live stat-enabled map. A stat set false here reads `enabled: false`. */
  enabled?: Readonly<Record<string, boolean>>;
  /** The map's top-level keys, in authored order. Absent, the map is empty. */
  placeholders?: readonly SandboxPlaceholderNode[];
  traits?: readonly SandboxTrait[];
  /** The entities in play, in play order. */
  entities?: readonly SandboxEntity[];
  /** Absent, `persona` is the empty entry. */
  persona?: SandboxEntity;
  /** Every dictionary, in authored order. */
  dictionaries?: readonly SandboxDictionary[];
}

const EMPTY_PERSONA: SandboxEntity = { name: '', traits: [] };

/** Run a stat's untrusted `code` in an isolated QuickJS (WASM) VM over `stats`, `self`, the turn inputs,
 *  the clock, `placeholders`, `traits`, `entities`, `persona` and `dictionaries`. A number return or a `self.value` write sets the
 *  value, clamped; a `self.min`, `self.max` or `self.regen` write sets that bound; a `traits.<name>.enabled`
 *  write switches that trait, and an `entities.<entity>.traits.<name>.enabled` write that entity's own; a
 *  failure discards every write. Of two placeholders, traits or entities sharing a name, the later one is the
 *  entry. */
export const executeStatCode = async (
  code: string,
  stats: Stat[],
  currentStat: Stat,
  { clock, turn, enabled, placeholders = [], traits = [], entities = [], persona = EMPTY_PERSONA, dictionaries = [] }: StatCodeRunOptions = {},
): Promise<StatCodeResult> => {
  // If code is empty, return null (use the manually set value)
  if (!code || code.trim() === '') {
    return { value: null, error: null };
  }

  try {
    const QuickJS = await loadQuickJS();

    // Only whitelisted plain data crosses into the VM (never `code`/`descriptors`).
    const marshalSnapshot = (stat: Stat): StatSnapshot => ({
      id: String(stat.id),
      name: stat.name || '',
      type: stat.type || 'number',
      description: stat.description || '',
      min: stat.min || 0,
      max: stat.max || 100,
      value: stat.value || 0,
      regen: stat.regen || 0,
    });
    const marshal = (stat: Stat) => {
      const snapshot = marshalSnapshot(stat);
      const inputs = turn?.[stat.id];
      // No pre-turn entry: `previous` reads as this same entry's own current fields.
      const previous = inputs?.previous ? marshalSnapshot(inputs.previous) : snapshot;
      // fromEntries types its keys as string; the map is over DELTA_SOURCES, so every source is present.
      const sources = Object.fromEntries(DELTA_SOURCES.map((source) =>
        [source, fieldwise((field) => inputs?.delta?.[source]?.[field] ?? 0)])) as Record<DeltaSource, StatNumbers>;
      return {
        ...snapshot,
        enabled: enabled?.[stat.id] !== false,
        previous,
        delta: {
          ...sources,
          total: fieldwise((field) => DELTA_SOURCES.reduce((sum, source) => sum + sources[source][field], 0)),
          actual: fieldwise((field) => snapshot[field] - previous[field]),
        },
      };
    };
    const placeholderMap = flattenPlaceholderMap(placeholders, [
      ...entities.map((entity) => entity.placeholders), persona.placeholders, ...dictionaries.map((book) => book.placeholders),
    ]);
    const keyed = keyedEntities(entities, persona);
    const statsData = stats.map(marshal);
    // A live stat wins a shared name over a switched-off one; within each, the later one wins.
    const owner = new Map([...statsData.filter((entry) => !entry.enabled), ...statsData.filter((entry) => entry.enabled)]
      .map((entry) => [entry.name, entry]));
    const keyedStats = statsData.filter((entry) => owner.get(entry.name) === entry);
    // `self` is the current stat's own entry in `stats`. A stat missing from `stats`, or one that loses its
    // name, stands alone.
    const selfIndex = stats.findIndex(stat => stat.id === currentStat.id);
    const selfData = selfIndex >= 0 ? statsData[selfIndex] : marshal(currentStat);
    const selfIsEntry = selfIndex >= 0 && owner.get(selfData.name) === selfData;

    const runtime = QuickJS.newRuntime();
    runtime.setInterruptHandler(shouldInterruptAfterDeadline(Date.now() + EXECUTION_TIMEOUT_MS));
    runtime.setMemoryLimit(MEMORY_LIMIT_BYTES);
    runtime.setMaxStackSize(MAX_STACK_BYTES);
    const vm = runtime.newContext();

    try {
      // console.log shim: QuickJS has no console; collect output and forward it to the host console.
      let consoleOutput = '';
      const logFn = vm.newFunction('log', (...args) => {
        const parts = args.map((a) => vm.dump(a));
        consoleOutput += parts.map(String).join(' ') + '\n';
        console.log(...parts);
      });
      const consoleObj = vm.newObject();
      vm.setProp(consoleObj, 'log', logFn);
      vm.setProp(vm.global, 'console', consoleObj);
      logFn.dispose();
      consoleObj.dispose();

      const rollFn = vm.newFunction('roll', (indexHandle) =>
        vm.newString(placeholderMap.nodes[vm.getNumber(indexHandle)]?.entry?.roll() ?? ''));
      vm.setProp(vm.global, ROLL_HOOK, rollFn);
      rollFn.dispose();

      // The stat data rides in as JSON literals (JSON is valid JS expression syntax); console.log and the
      // roll hook are the only host functions. The user code runs as a function body so `return` works, with
      // the readers' names shadowed as its parameters; the program's completion value pairs what it returned
      // with what `self`'s writable fields hold afterwards, then what it did to `placeholders`, `traits` and
      // the entities' traits.
      const program = [
        statsPrelude(keyedStats, { ...(blankOf(selfData) as object), enabled: false }, selfIsEntry ? selfData.name : null),
        `const ${LOOSE_WRITES} = [];`,
        `const ${LOOSE_NOTE} = (path) => (${ADD_ONCE})(${LOOSE_WRITES}, path);`,
        `const self = ${selfIsEntry ? `stats[${JSON.stringify(selfData.name)}]` : JSON.stringify(selfData)};`,
        ...(selfIsEntry ? [] : [`(${LOCK_STAT})(self, true, (path) => ${LOOSE_NOTE}('self.' + path));`]),
        `const clock = ((lock) => {`,
        `  const clock = ${JSON.stringify(clockObject(clock))};`,
        `  Object.freeze(lock(clock.previous, ['day', 'daypart'], 'clock.previous.', ${LOOSE_NOTE}));`,
        `  return Object.freeze(lock(clock, Object.keys(clock), 'clock.', ${LOOSE_NOTE}));`,
        `})(${LOCK_FIELDS});`,
        placeholdersPrelude(placeholderMap),
        trackedMapPrelude({ ...TRAIT_MAP, root: 'traits', reader: TRAIT_WRITES, data: traitData(traits) }),
        entitiesPrelude(keyed, placeholderMap),
        dictionariesPrelude(dictionaries, placeholderMap),
        `[(function(${PLACEHOLDER_WRITES}, ${TRAIT_WRITES}, ${ENTITY_WRITES}, ${STAT_WRITES}, ${LOOSE_WRITES}, ${LOOSE_NOTE}, ${DICTIONARY_WRITES}, ${OWNER_VIEW}) {`,
        code,
        `})(), self.value, ${CODE_BOUND_FIELDS.map((field) => `self.${field}`).join(', ')}, ${PLACEHOLDER_WRITES}(), ${TRAIT_WRITES}(), ${ENTITY_WRITES}(),`,
        `  JSON.stringify([JSON.parse(${STAT_WRITES}()), ${LOOSE_WRITES}]), ${DICTIONARY_WRITES}()];`,
      ].join('\n');

      const result = vm.evalCode(program);

      if (result.error) {
        const dumped = vm.dump(result.error) as { name?: string; message?: string; stack?: string } | string;
        result.error.dispose();
        const err = typeof dumped === 'object' && dumped !== null ? dumped : { message: String(dumped) };
        // The interrupt handler surfaces as an "interrupted" InternalError — report it as the timeout.
        if (/interrupted/i.test(err.message || '')) {
          return { value: null, error: 'Execution timed out', kind: 'timeout' };
        }
        return {
          value: null,
          error: `Error: ${err.message}\nStack: ${err.stack || 'No stack trace available'}`,
          kind: 'throw'
        };
      }

      // Each half is read by its own handle and typeof, never through a JSON dump: a dump turns
      // `undefined` and `NaN` into `null`, which would erase the difference between them.
      const readSlot = (index: number): { type: string; number: number } => {
        const handle = vm.getProp(result.value, index);
        try {
          const type = vm.typeof(handle);
          return { type, number: type === 'number' ? vm.getNumber(handle) : NaN };
        } finally {
          handle.dispose();
        }
      };
      const returned = readSlot(0);
      const written = readSlot(1);
      const boundSlots = CODE_BOUND_FIELDS.map((field, i) => [field, readSlot(2 + i)] as const);
      const readDump = (index: number): string => {
        const handle = vm.getProp(result.value, index);
        try {
          return vm.typeof(handle) === 'string' ? vm.getString(handle) : '[]';
        } finally {
          handle.dispose();
        }
      };
      const writesDump = readDump(2 + CODE_BOUND_FIELDS.length);
      const traitsDump = readDump(3 + CODE_BOUND_FIELDS.length);
      const entitiesDump = readDump(4 + CODE_BOUND_FIELDS.length);
      const statsDump = readDump(5 + CODE_BOUND_FIELDS.length);
      const dictionariesDump = readDump(6 + CODE_BOUND_FIELDS.length);
      result.value.dispose();

      if (consoleOutput.trim()) {
        console.log('Console output:', consoleOutput);
      }

      if (returned.type !== 'number' && returned.type !== 'undefined') {
        return nonNumberFailure('Code must return a number or nothing');
      }
      if (returned.type === 'undefined' && written.type !== 'number') {
        return nonNumberFailure('self.value must be a number');
      }
      // A field the code left alone keeps the pipeline's result, so only a changed field is a write.
      const bounds: CodeBounds = {};
      for (const [field, slot] of boundSlots) {
        if (slot.type === 'number' && Object.is(slot.number, selfData[field])) continue;
        if (!Number.isFinite(slot.number)) return nonNumberFailure(`self.${field} must be a finite number`);
        bounds[field] = slot.number;
      }
      const placeholderWrites = readPlaceholderWrites(writesDump, placeholderMap.nodes);
      if ('error' in placeholderWrites) return failure(placeholderWrites.error, 'bad-write');
      const traitWrites = readTraitWrites(JSON.parse(traitsDump), traits, 'traits');
      if ('error' in traitWrites) return failure(traitWrites.error, 'bad-write');
      const entityWrites = readEntityWrites(entitiesDump, keyed);
      if ('error' in entityWrites) return failure(entityWrites.error, 'bad-write');
      const readOnlyWrites = [
        ...readStatReadOnlyWrites(statsDump),
        ...placeholderWrites.readOnly,
        ...traitWrites.readOnly,
        ...entityWrites.readOnly,
        ...readDictionaryWrites(dictionariesDump),
      ];

      const min = bounds.min ?? selfData.min;
      const max = Math.max(min, bounds.max ?? selfData.max);
      const settled = (value: number | null): StatCodeResult => ({
        value: value === null ? null : clamp(value, min, max),
        error: null,
        ...(Object.keys(bounds).length ? { bounds } : {}),
        ...(placeholderWrites.writes.length ? { placeholders: placeholderWrites.writes } : {}),
        ...(placeholderWrites.unknown.length ? { unknownPlaceholders: placeholderWrites.unknown } : {}),
        ...(placeholderWrites.unknownOwned.length ? { unknownOwnerPlaceholders: placeholderWrites.unknownOwned } : {}),
        ...(traitWrites.writes.length ? { traits: traitWrites.writes } : {}),
        ...(traitWrites.unknown.length ? { unknownTraits: traitWrites.unknown } : {}),
        ...(traitWrites.acquired.length ? { acquiredWrites: traitWrites.acquired } : {}),
        ...(entityWrites.writes.length ? { entities: entityWrites.writes } : {}),
        ...(entityWrites.unknown.length ? { unknownEntities: entityWrites.unknown } : {}),
        ...(readOnlyWrites.length ? { readOnlyWrites } : {}),
      });
      if (returned.type === 'number') return settled(returned.number);
      return settled(Object.is(written.number, selfData.value) ? null : written.number);
    } finally {
      vm.dispose();
      runtime.dispose();
    }
  } catch (error) {
    console.error('Error in executeStatCode:', error);

    // Provide more detailed error information
    return {
      value: null,
      error: `Error: ${(error as Error).message}\nStack: ${(error as Error).stack || 'No stack trace available'}`,
      kind: 'throw'
    };
  }
};
