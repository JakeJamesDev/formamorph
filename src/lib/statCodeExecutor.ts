import type { CodeBounds, Stat } from '@/types';
import { clamp } from './utils';
import { activeDescriptor } from './statContext';
import { runInSandbox, type SandboxEngine, type SandboxHostFunction } from './scriptSandbox';
import { isPromptCanceled, namesPlayer, scriptPrompts, type ScriptPromptHost, type ScriptPromptRequest } from './scriptPrompts';
import { sameChoices } from './scriptedChoices';
import { VALUE_JOIN } from './placeholders';
import { hasEntityKey, statsByCodeName } from './statCodeNames';
import {
  PLACEHOLDER_ENTRY_MEMBERS, placeholderPathExpression, placeholderPathLabel, type PlaceholderPathRoot,
} from './statCodePaths';
import { clockReading, FLAT_HOURS_PER_TURN, type WorldCalendar } from './gameClock';
import { SCRIPT_TIMING_LABEL } from './scripts';
import { namedEntries, type LoreWrite } from './loreToggles';

/** A lore write with the path code wrote it through. */
export type PathedLoreWrite = LoreWrite & { path: string };

// Stat code sees only the marshalled stat data below.

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
  const end = clockReading(elapsedHours, clock?.calendar);
  // A turn spans time, so its start can sit in a different day/daypart than its end — a long sleep begins
  // in the afternoon and ends at night. Both readings are exposed; neither is derivable from the other.
  const start = clockReading(Math.max(0, elapsedHours - deltaHours), clock?.calendar);
  return {
    day: end.day,
    daypart: end.daypart,
    hour: end.hour,
    minute: end.minute,
    deltaHours,
    elapsedHours,
    previous: { day: start.day, daypart: start.daypart, hour: start.hour, minute: start.minute },
  };
};

/** How a run failed, for a caller that sorts failures rather than printing them. `bad-write` is a
 *  placeholder or trait written a value of the wrong type; `canceled` is a prompt the player closed. */
export type StatCodeFailure = 'timeout' | 'non-number' | 'throw' | 'bad-write' | 'canceled';

/** The bounds a stat's code may set on itself, in the order the host reads them back. */
export const CODE_BOUND_FIELDS = ['min', 'max', 'regen'] as const satisfies readonly (keyof CodeBounds)[];
export type CodeBoundField = (typeof CODE_BOUND_FIELDS)[number];

/** The fields a write reaches on every stat, whatever route reaches it. Every other stat field is read-only. */
export const SELF_WRITABLE_FIELDS: readonly string[] = ['value', ...CODE_BOUND_FIELDS, 'hidden'];

/** The one field on a trait entry a write reaches. The switch lands after the run. */
export const TRAIT_WRITABLE_FIELD = 'enabled';

/** The one field on a placeholder entry a write reaches, with `pin` as its alias. The pin lands after the run. */
export const PLACEHOLDER_WRITABLE_FIELD = 'value';

/** What one run wrote to one stat other than `self`. The value is as written: the turn clamps it once every
 *  writer's bounds have landed. */
export type StatWrite = { id: string; name: string } & Partial<Pick<StatNumbers, 'value' | CodeBoundField>> & { hidden?: boolean };

export interface StatCodeResult {
  /** The value the code set, by return or by `self.value`, as written: the turn clamps it once every bound
   *  and trait switch has landed. Null when it left the value alone. */
  value: number | null;
  error: string | null;
  /** Present exactly when `error` is. */
  kind?: StatCodeFailure;
  /** The bounds the code assigned on `self`, changed or not. Absent when it assigned none. */
  bounds?: CodeBounds;
  /** The `hidden` the code assigned on `self`, changed or not. Absent when it assigned none. */
  hidden?: boolean;
  /** The global stats other than `self` the code wrote through `stats`, in map order. Absent when it wrote none. */
  statWrites?: StatWrite[];
  /** The entity stats other than `self` the code wrote, by owner: the run's own owner first, then each other
   *  entity in map order. Absent when it wrote none. */
  ownerStatWrites?: OwnerStatWrites[];
  /** Stat fields the code wrote through a name no stat has, as code spelled them; each write was dropped. */
  unknownStatWrites?: string[];
  /** Fields of switched-off stats the code wrote, as code spelled them; each write was dropped. */
  disabledStatWrites?: string[];
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
  /** The dictionary entry fields the code wrote, each entry's in assignment order, with the path code wrote through.
   *  Absent when it wrote none. */
  lore?: PathedLoreWrite[];
  /** Entry fields the code wrote through a name no entry has, as code spelled them; each write was ignored. */
  unknownLore?: string[];
  /** Read-only fields the code wrote, as code spelled them, such as `traits.Brave.mode`; each write was dropped. */
  readOnlyWrites?: string[];
  /** The `turn.choices` the run left, when it takes the write and the list differs from the one it read (Q12). */
  choices?: string[];
  /** The sentence the code left, by return or by `narration.sentence`. Present on a During AI Output run that
   *  succeeded, the sentence as it came when the code did not touch it. */
  sentence?: string;
  /** What the code did to the location, the clock and the discovered cast. Absent when it did none of it. */
  worldWrites?: WorldWrites;
  /** The `diary` names an `openCast` run found outside its cast, once each. */
  maybeDiary?: string[];
  /** A World Tool run's return value as text: a string as is, any other value as JSON, null for nothing. */
  reply?: string | null;
}

/** A location as `location.move` finds it: by id, else by code name. */
export interface SandboxPlace {
  id: string;
  name: string;
}

/** One place the router offers from a location, under its code name. */
export interface SandboxExit {
  name: string;
  /** The Connection leg's travel hint, its placeholders filled in; empty for implicit travel or a hintless leg. */
  hint: string;
}

/** Where a location sits in the tree and where travel from it goes, all by code name. */
export interface SandboxLocationLinks {
  /** Empty at the top level. */
  parent: string;
  children: readonly string[];
  exits: readonly SandboxExit[];
}

/** One `locations` entry's input. Text left out reads empty; `starting` left out reads false. */
export interface SandboxLocation extends SandboxPlace {
  description?: string;
  summary?: string;
  starting?: boolean;
  /** Called on the run's first read of `parent`, `children` or `exits`. Left out, they read empty. */
  links?: () => SandboxLocationLinks;
}

/** The world's locations a run can name, and where the turn stands. */
export interface SandboxPlaces {
  locations: readonly SandboxLocation[];
  location: SandboxPlace | null;
}

/** One entry of `memories`: a Memory panel row as a script reads it. */
export interface SandboxMemory {
  id: string;
  /** The play turn, 1-based; a Custom line's is the turn that closed before it was added. */
  turn: number;
  /** Story hours at the end of that turn. */
  timestamp: number;
  day: number;
  daypart: string;
  text: string;
  custom: boolean;
  kept: boolean;
  inContext: boolean;
  pinned: boolean;
  forgotten: boolean;
}

/** `row` with only the fields an entry reads, so nothing else a caller holds crosses into the VM; its text as a host slot. */
const memoryData = (row: SandboxMemory, reads: HostReads) => ({
  id: row.id, turn: row.turn, timestamp: row.timestamp, day: row.day, daypart: row.daypart, text: reads.text(row.text),
  custom: row.custom, kept: row.kept, inContext: row.inContext, pinned: row.pinned, forgotten: row.forgotten,
});

/** One `discover` call. With a description the entity is created at once; without, the discover pass
 *  describes it. */
export interface DiscoverWrite {
  name: string;
  description?: string;
}

/** A run's writes to the turn's world fields. Each field is absent when no call wrote it. */
export interface WorldWrites {
  /** The id of the location the last `location.move` named. */
  location?: string;
  /** Every `clock.advance` of the run, added up. */
  minutes?: number;
  /** Once per name, in first-call order; a call with a description fills in one without. */
  discover?: DiscoverWrite[];
  /** Every `memories.add` line, in call order. */
  memory?: string[];
  /** Every `memories.pin` line, in call order. */
  pins?: string[];
  /** Every `diary` line, in call order. */
  diary?: DiaryWrite[];
  /** Every `move`, `follow` and `unfollow` on an entity entry, in call order. */
  entities?: EntityCodeWrite[];
  /** Every `pin`, `forget`, `edit` and `remove` on a `memories` entry, in call order. */
  memoryWrites?: MemoryWrite[];
}

/** One verb on a `memories` entry, by the row's id. An edit marks whether the row is a Custom line. */
export type MemoryWrite = { id: string } & ({ kind: 'pin' | 'forget' | 'remove' } | { kind: 'edit'; text: string; custom: boolean });

/** One `move`, `follow` or `unfollow` on an entity entry: the entity's id, or its name when it has none. */
export type EntityCodeWrite = { entity: string } & ({ kind: 'move'; location: string } | { kind: 'follow' | 'unfollow' });

/** One `diary` call: the entity's id, or its name when it has none, and the line. */
export interface DiaryWrite {
  entity: string;
  line: string;
}

/** The `narration` a During AI Output run reads. Its presence marks the run's timing. */
export interface NarrationInput {
  /** The sentence that just completed; the one field code writes. */
  sentence: string;
  /** The narration as it stands, the sentence and the partial tail included. */
  full: string;
  /** The sentence's position in the reply, from 0. */
  index: number;
  /** Earlier sentences the reveal has released to the screen, as rewritten. */
  sent: readonly string[];
  /** Earlier sentences past their scripts that the reveal still holds. */
  buffered: readonly string[];
}

/** What one run wrote to one entity's stats. */
export interface OwnerStatWrites {
  /** Matched by id, so an entity a same-name one hides in `entities` still gets its own writes. */
  ownerId: string;
  writes: StatWrite[];
}

/** What one run did to one entity's traits. */
export interface EntityTraitWrites {
  /** The entity's code name; empty for the empty persona and for `owner`. */
  entity: string;
  /** Set when the code reached the entry through `owner` alone: the owner is no entry of `entities`. */
  owner?: true;
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
  /** Whether the trait's requirements hold for its owner now. */
  available?: boolean;
  /** The group's code name; empty when ungrouped. */
  group?: string;
  playerToggle?: boolean;
}

/** The `trait` a When a Trait Switches run reads: the switched trait's entry, `enabled` its new state, and
 *  `owner` the code name of the entity that holds it, empty for a global trait. */
export type SwitchedTrait = SandboxTrait & { owner: string };

/** One entry of the sandbox's `entities`, or `persona`. Identity fields left out read blank. */
export interface SandboxEntity {
  name: string;
  traits: readonly SandboxTrait[];
  id?: string;
  type?: string;
  pronouns?: string;
  inScene?: boolean;
  description?: string;
  summary?: string;
  aliases?: readonly string[];
  /** The id of the location the entity stands at in play. Absent, it stands at every one of `locationIds`. */
  locationId?: string;
  /** The ids of the locations the entity is authored to list. */
  locationIds?: readonly string[];
  /** Whether the entity follows the player, which places it where the player stands. */
  following?: boolean;
  /** The entity's owner node in the placeholder tree. Absent, its `placeholders` holds no names. */
  placeholders?: SandboxPlaceholderNode;
  /** What its `stats` reads and takes writes on. Absent, it holds no stats. */
  stats?: SandboxStats;
}

/** One owner's stats as its `stats` map reads them: each entry's turn inputs and enabled flag by stat id. */
export interface SandboxStats {
  stats: readonly Stat[];
  readings?: Readonly<Record<string, StatTurnInputs>>;
  enabled?: Readonly<Record<string, boolean>>;
}

/** What `turn` reads: the player's action, the turn number on the `memories[].turn` scale, and the finished
 *  page and choices, empty until the turn's reply lands. */
export interface SandboxTurn {
  action: string;
  number: number;
  narration: string;
  choices: readonly string[];
  /** The player has choices off: `choices` reads empty and takes no write (Q11). */
  choicesOff?: boolean;
}

/** One entry of a book's `entries`, by its code name. */
export interface SandboxDictionaryEntry {
  id: string;
  name: string;
  keys: readonly string[];
  value: string;
  /** As the lore overlay leaves it. */
  enabled: boolean;
  constant: boolean;
}

/** One entry of the sandbox's `dictionaries`: a book's code name, its owner node in the placeholder tree, and its
 *  entries in authored order, disabled ones included. */
export interface SandboxDictionary {
  name: string;
  id?: string;
  /** As the lore overlay leaves it; absent, on. */
  enabled?: boolean;
  /** Absent, its `placeholders` holds no names. */
  placeholders?: SandboxPlaceholderNode;
  entries?: readonly SandboxDictionaryEntry[];
}

/** A stat's value and max, as one turn input carries them. */
export interface ValueAndMax {
  value: number;
  max: number;
}

/** The plain shape of a stat, with none of the turn-relative parts `self` and `stats` entries add.
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
  hidden: boolean;
  /** The active band's text, chips as the caller resolved them; empty when no band applies. */
  descriptor: string;
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
   *  numbers then, traits and code writes included. */
  previous?: Stat;
  /** Each source's change this turn. `ai` is the raw ask, before flags and the range; `regen` is what regen
   *  did, after the enabled gate and clamping. */
  delta?: Partial<Record<DeltaSource, Partial<StatNumbers>>>;
}

/** Each of the four numbers as `read` gives it. */
const fieldwise = (read: (field: keyof StatNumbers) => number): StatNumbers =>
  ({ value: read('value'), min: read('min'), max: read('max'), regen: read('regen') });

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
  hidden: stat.hidden === true,
  descriptor: activeDescriptor(stat, stat.value || 0)?.description ?? '',
});

/** `value` clamped to the range an authored `stat` holds after a run's own bound writes, the min floored at
 *  the authored min and the max at the min: where the value lands when no other writer and no trait moves
 *  the bounds. */
export function clampToOwnRange(value: number, stat: Stat, bounds: CodeBounds = {}): number {
  const snapshot = marshalSnapshot(stat);
  const min = Math.max(snapshot.min, bounds.min ?? snapshot.min);
  return clamp(value, min, Math.max(min, bounds.max ?? snapshot.max));
}

/** A stat's entry in a `stats` map: its snapshot, whether it is on, and what the turn did to it. */
function marshalStat(stat: Stat, inputs: StatTurnInputs | undefined, enabled: boolean) {
  const snapshot = marshalSnapshot(stat);
  // No pre-turn entry: `previous` reads as this same entry's own current fields.
  const previous = inputs?.previous ? marshalSnapshot(inputs.previous) : snapshot;
  // fromEntries types its keys as string; the map is over DELTA_SOURCES, so every source is present.
  const sources = Object.fromEntries(DELTA_SOURCES.map((source) =>
    [source, fieldwise((field) => inputs?.delta?.[source]?.[field] ?? 0)])) as Record<DeltaSource, StatNumbers>;
  return {
    ...snapshot,
    enabled,
    previous,
    delta: {
      ...sources,
      total: fieldwise((field) => DELTA_SOURCES.reduce((sum, source) => sum + sources[source][field], 0)),
      actual: fieldwise((field) => snapshot[field] - previous[field]),
    },
  };
}

type StatEntry = ReturnType<typeof marshalStat>;

/** Each owner's entries in stat order. */
const marshalStats = ({ stats, readings, enabled }: SandboxStats): StatEntry[] =>
  stats.map((stat) => marshalStat(stat, readings?.[stat.id], enabled?.[stat.id] !== false));

/** The entries a `stats` map keys, in stat order. */
function keyedStatEntries(entries: readonly StatEntry[]): StatEntry[] {
  const owner = statsByCodeName(entries, (entry) => entry.name, (entry) => entry.enabled);
  return entries.filter((entry) => owner.get(entry.name) === entry);
}

/** A `stats` entry for a name no stat has: every field blank, so off and shown. */
const blankStatEntry = (template: StatEntry): unknown => blankOf(template);

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
// The host hook a heavy read calls with its slot, taken and deleted like the roll hook.
const HOST_READ_HOOK = '__formamorphHostRead';
// The prelude's reader of a host slot, each answer cached for the run. User code's parameters shadow it.
const HOST_READ = '__formamorphRead';

/** The run's host-backed reads (Q37, Q48): heavy text and a book's entries stay on the host until code reads them.
 *  The prelude carries slot numbers; -1 is the empty value. */
interface HostReads {
  /** The slot of `value`; one slot per distinct text, so two paths to one text ask the host once. With `resolve`,
   *  the slot holds the text resolved on its read; a run passes one resolver. */
  text(value: string | undefined, resolve?: (text: string) => string): number;
  /** A slot whose value `build` makes on its first read, not before. */
  deferred(build: () => unknown): number;
  /** A slot's value as JSON, so every string crosses into the VM intact. */
  answer(at: number): string;
}

function hostReads(): HostReads {
  const slots: (() => unknown)[] = [];
  const byText = new Map<string, number>();
  const byResolved = new Map<string, number>();
  const deferred = (build: () => unknown) => slots.push(build) - 1;
  return {
    text: (value, resolve) => {
      if (!value) return -1;
      const known = resolve ? byResolved : byText;
      let at = known.get(value);
      if (at === undefined) known.set(value, at = deferred(resolve ? () => resolve(value) : () => value));
      return at;
    },
    deferred,
    answer: (at) => JSON.stringify(slots[at]?.() ?? null),
  };
}

/** The prelude that binds `HOST_READ`: a slot's value from the host on first read, from its cache after. */
const HOST_READ_PRELUDE = [
  `const ${HOST_READ} = ((hook, parse) => {`,
  `  const answers = [];`,
  `  return (at) => (at < 0 ? '' : at in answers ? answers[at] : (answers[at] = parse(hook(at))));`,
  `})(globalThis.${HOST_READ_HOOK}, JSON.parse);`,
  `delete globalThis.${HOST_READ_HOOK};`,
].join('\n');

/** JS source of `(target, fields, prefix, note) => target`: each field, holding a slot, becomes a getter of the slot's
 *  text whose setter calls `note(prefix + field)`, as `LOCK_FIELDS` does for a held value. */
const LAZY_TEXT = `(target, fields, prefix, note) => {
  for (const field of fields) {
    const at = target[field];
    Object.defineProperty(target, field, { enumerable: true, get: () => ${HOST_READ}(at), set: () => note(prefix + field) });
  }
  return target;
}`;

/** A setter for a `LAZY_TEXT` source object that code never reaches: its entry's own accessors record writes. */
const NO_NOTE = '() => {}';
// The preludes' readers of what the run did to each map; the program's completion value calls them. User
// code runs in a function whose parameters shadow both names, so it cannot reach them.
const PLACEHOLDER_WRITES = '__formamorphPlaceholderWrites';
const TRAIT_WRITES = '__formamorphTraitWrites';
const ENTITY_WRITES = '__formamorphEntityWrites';
const DICTIONARY_WRITES = '__formamorphDictionaryWrites';
// The `placeholders` prelude's view of one owner node, which the owner entries' `placeholders` read.
const OWNER_VIEW = '__formamorphOwnerPlaceholders';
const STAT_WRITES = '__formamorphStatWrites';
// `owner.stats`, which the entities prelude hangs on the owner's entry, and the reader of its writes.
const OWNER_STATS = '__formamorphOwnerStats';
const OWNER_STAT_WRITES = '__formamorphOwnerStatWrites';
// The reader of every other entity entry's stat writes.
const ENTITY_STAT_WRITES = '__formamorphEntityStatWrites';
// The writable fields of `self` the code assigned, in assignment order.
const SELF_ASSIGNED = '__formamorphSelfAssigned';
// `JSON.stringify` as it stood before user code, which may replace the global one, for the program's completion value.
const STRINGIFY = '__formamorphStringify';
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

/** `entry` with every string emptied, every number zeroed and every boolean false, at every depth. */
const blankOf = (entry: unknown): unknown => {
  if (typeof entry === 'string') return '';
  if (typeof entry === 'number') return 0;
  if (typeof entry === 'boolean') return false;
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

/** JS source of `(target, text, prefix, note) => target`: the `text` fields lazy, every other field locked. */
const LOCK_ENTRY = `(target, text, prefix, note) => (${LAZY_TEXT})(
  (${LOCK_FIELDS})(target, Object.keys(target).filter((field) => !text.includes(field)), prefix, note), text, prefix, note)`;

/** JS source of `(entry, assigned, note) => void`: locks every field of a stat entry, at every depth. With an
 *  `assigned` list, the writable fields stay open and each assignment to one is listed there, changed or not. */
const LOCK_STAT = `(entry, assigned, note) => {
  const lock = ${LOCK_FIELDS};
  const deep = (target, prefix) => Object.freeze(lock(target, Object.keys(target), prefix, note));
  for (const source of Object.keys(entry.delta)) deep(entry.delta[source], 'delta.' + source + '.');
  deep(entry.delta, 'delta.');
  deep(entry.previous, 'previous.');
  const writable = assigned ? ${JSON.stringify(SELF_WRITABLE_FIELDS)} : [];
  for (const field of writable) {
    let held = entry[field];
    Object.defineProperty(entry, field, {
      enumerable: true, get: () => held, set: (next) => { held = next; (${ADD_ONCE})(assigned, field); },
    });
  }
  lock(entry, Object.keys(entry).filter((field) => !writable.includes(field)), '', note);
}`;

/** A stat map's kind. Rows are `[name, readOnlyPaths, [[field, number], ...]]` with each writable field
 *  assigned on an entry other than `self`, or `[name, null]` for an entry replaced whole. `self`'s own
 *  assignments, on the entry named `selfName`, go to `SELF_ASSIGNED`. */
const statMapKind = (blank: unknown, selfName: string | null): TrackedMapKind => ({
  track: `(name, entry, state) => {
    state.written = [];
    state.assigned = [];
    const assigned = name === ${JSON.stringify(selfName)} ? ${SELF_ASSIGNED} : state.assigned;
    (${LOCK_STAT})(entry, assigned, (path) => (${ADD_ONCE})(state.written, path));
  }`,
  blank: JSON.stringify(blank),
  row: `(name, state) => state.written.length || state.assigned.length
    ? [name, state.written, state.assigned.map((field) => [field, state.entry[field]])] : null`,
  replaced: `(name) => [name, null]`,
});

/** A stat map's data: its entries keyed by name. */
const statMapData = (entries: readonly { name: string }[]) => Object.fromEntries(entries.map((entry) => [entry.name, entry]));

/** One top-level stat map the code writes through: `stats`, or `owner.stats`. */
interface StatMapSpec {
  root: string;
  reader: string;
  entries: readonly { name: string }[];
  blank: unknown;
  /** `self`'s name when `self` is an entry of this map. */
  selfName: string | null;
}

const statsPrelude = ({ root, reader, entries, blank, selfName }: StatMapSpec): string =>
  trackedMapPrelude({ ...statMapKind(blank, selfName), root, reader, data: statMapData(entries) });

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
    `    define(target, ${JSON.stringify(PLACEHOLDER_WRITABLE_FIELD)}, { enumerable: true, get: () => state.value, set });`,
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
    `  const members = (parent, pairs) => { for (const [key, at] of pairs) parent[key] = views[at]; };`,
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
    // it. A child whose name lost to a member of its parent sits at no key, so it has no site here.
    `  const sites = [];`,
    `  const site = (parent, pairs) => {`,
    `    for (const [key, at] of pairs) if (parent[key] === views[at] && spec.nodes[at].e) {`,
    `      sites.push({ parent, key, at });`,
    `    }`,
    `  };`,
    `  site(root, spec.top);`,
    `  spec.nodes.forEach((n, i) => site(targets[i], n.c || []));`,
    `  const readWrites = () => {`,
    `    const replaced = Object.create(null);`,
    `    for (const { parent, key, at } of sites) {`,
    `      const held = parent[key];`,
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
    Object.defineProperty(entry, ${JSON.stringify(TRAIT_WRITABLE_FIELD)}, { enumerable: true, get: () => state.enabled, set: (v) => { state.enabled = v; state.assigned = true; } });
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
const ENTITY_READ_ONLY_FIELDS = [
  'id', 'name', 'type', 'pronouns', 'inScene', 'location', 'following', 'description', 'summary', 'aliases', 'traits', 'placeholders', 'stats',
  'move', 'follow', 'unfollow', 'diary',
] as const;

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

/** Whether `entity` is the played persona: the entry itself, or one with its id. */
const isPlayed = (entity: SandboxEntity, persona: SandboxEntity): boolean =>
  entity === persona || (!!persona.id && entity.id === persona.id);

/** JS source of `(fields, entries, blank, build) => [map, readWrites, entry]`: frozen entries with read-only
 *  `fields`, built by `build(key, data, unknown) => [values, rows, hidden?, setters?]`, where `hidden` fields are
 *  left out of the entry's keys and a field in `setters` takes its write there; an unknown name builds from `blank`.
 *  `entry(key, data, unknown, tag)` builds one more, whose reader row carries `tag`. */
const READ_ONLY_ENTRY_MAP = `(fields, entries, blank, build) => {
  const readers = [];
  const entry = (key, data, unknown, tag = null) => {
    const [values, rows, hidden = [], setters = {}] = build(key, data, unknown);
    const written = [];
    readers.push([key, unknown, rows, written, tag]);
    const out = {};
    for (const field of fields) {
      const set = setters[field] || (() => (${ADD_ONCE})(written, field));
      define(out, field, { enumerable: !hidden.includes(field), get: () => values[field], set });
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
  const readRows = () => readers
    .map(([key, unknown, rows, written, tag]) => [key, unknown, rows(), written, tag])
    .filter((row) => row[2].length || row[3].length);
  return [proxy, () => stringify(readRows()), entry, readRows];
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

/** Where `owner` sits: the `entities` entry of that name, the unnamed persona, or an entry of its own, which
 *  holds the owner's fields or, for the empty owner, none. */
type OwnerPlace = { kind: 'entity'; name: string } | { kind: 'persona' } | { kind: 'own'; entity: SandboxEntity | null };

/** Where `owner` sits among the keyed entities. The owner is matched by id, so an entity a later one of the
 *  same name hides gets an entry of its own. */
function ownerPlace({ byName, persona }: KeyedEntities, owner: SandboxEntity | undefined): OwnerPlace {
  if (!owner) return { kind: 'own', entity: null };
  if (owner.id) {
    if (hasEntityKey(owner.name) && byName.get(owner.name)?.id === owner.id) return { kind: 'entity', name: owner.name };
    if (!hasEntityKey(persona.name) && persona.id === owner.id) return { kind: 'persona' };
  }
  return { kind: 'own', entity: owner };
}

/** The reader tag on the row of an `owner` entry of its own. */
const OWN_OWNER_TAG = 'owner';

/** The `entities`, `persona` and `owner` prelude: each entry with its own trait map, owner view and stat map;
 *  the owner's entry holds `owner.stats`. The stat-write reader's rows are `[key, unknown, statMapRows]`. */
const entitiesPrelude = (
  { byName, persona }: KeyedEntities, { indexOf }: FlatPlaceholderMap, blankStat: unknown, place: OwnerPlace,
  statEntriesOf: (entity: SandboxEntity) => StatEntry[], standing: Standing, reads: HostReads,
): string => {
  const data = (entity: SandboxEntity, owner: boolean) => {
    const { id = '', type = '', pronouns = '', inScene = false, description, summary, aliases = [], traits, placeholders } = entity;
    const played = isPlayed(entity, persona);
    return {
      id, type, pronouns, inScene, location: standing.nameOf(entity, played), following: !played && !!entity.following,
      description: reads.text(description), summary: reads.text(summary), aliases, traits: traitData(traits), ph: ownerIndex(indexOf, placeholders),
      stats: owner ? {} : statMapData(statEntriesOf(entity)), owner, played,
    };
  };
  const own = place.kind === 'own' ? place.entity : undefined;
  const spec = {
    entities: [...byName].map(([name, entity]) => [name, data(entity, place.kind === 'entity' && place.name === name)]),
    persona: hasEntityKey(persona.name) ? null : data(persona, place.kind === 'persona'),
    ownerName: place.kind === 'entity' ? place.name : null,
    // An owner entry of its own carries its name; the empty owner's placeholders belong to no one.
    ownEntry: own === undefined ? null : { ...(own ? { ...data(own, true), name: own.name } : { owner: true, absent: true }), own: true },
  };
  return readOnlyEntryMapPrelude(`entities, persona, owner, ${ENTITY_WRITES}, ${ENTITY_STAT_WRITES}`, spec, [
    `const lazy = ${LAZY_TEXT};`,
    `const traitMap = ((keys) => ${trackedMapFactory(TRAIT_MAP)})(Object.keys);`,
    `const statMapOf = ((keys) => ${trackedMapFactory(statMapKind(blankStat, null))})(Object.keys);`,
    `const statReaders = [];`,
    `const statMap = (key, unknown, data) => {`,
    `  const [map, rows] = statMapOf(data);`,
    `  statReaders.push([key, unknown, rows]);`,
    `  return map;`,
    `};`,
    `const [entities, readWrites, entry] = entryMap(${JSON.stringify(ENTITY_READ_ONLY_FIELDS)}, spec.entities, {}, (key, data, unknown) => {`,
    `  const [traits, rows] = traitMap(data.traits || {});`,
    `  const placeholders = data.own ? ${OWNER_VIEW}(data.ph ?? -1, ['owner', 'owner'], !!data.absent)`,
    `    : ${OWNER_VIEW}(data.ph ?? -1, key ? ['entity', key] : ['persona', 'persona'], unknown || !key);`,
    `  const stats = data.owner ? ${OWNER_STATS} : statMap(key, unknown, data.stats || {});`,
    `  const who = { id: data.id || '', name: data.own ? data.name || '' : key, played: !!data.played, unknown: unknown || !!data.absent };`,
    `  const write = (kind) => (target) => ${ENTITY_WRITE}(who, kind, target);`,
    `  const moves = { move: write('move'), follow: write('follow'), unfollow: write('unfollow'), diary: write('diary') };`,
    `  const blank = { id: '', type: '', pronouns: '', inScene: false, location: '', following: false, description: -1, summary: -1 };`,
    `  const aliases = Object.freeze([...(data.aliases || [])]);`,
    `  const values = { ...blank, ...data, name: data.own ? data.name || '' : unknown ? '' : key, aliases, traits, placeholders, stats, ...moves };`,
    `  return [lazy(values, ['description', 'summary'], '', ${NO_NOTE}), rows, who.played ? Object.keys(moves) : []];`,
    `});`,
    `const persona = spec.persona ? entry('', spec.persona, false) : entities[${JSON.stringify(persona.name)}];`,
    `const owner = spec.ownEntry ? entry('', spec.ownEntry, false, ${JSON.stringify(OWN_OWNER_TAG)})`,
    `  : spec.ownerName !== null ? entities[spec.ownerName] : persona;`,
    `const readStatWrites = () => stringify(statReaders.map(([key, unknown, rows]) => [key, unknown, rows()]).filter((row) => row[2].length));`,
    `return [entities, persona, owner, readWrites, readStatWrites];`,
  ]);
};

/** The index of an owner node in the flattened map, or -1 where the owner has none. */
const ownerIndex = (indexOf: FlatPlaceholderMap['indexOf'], node: SandboxPlaceholderNode | undefined): number =>
  (node ? indexOf.get(node) ?? -1 : -1);

/** The fields on a dictionary entry. Only `DICTIONARY_WRITABLE_FIELD` takes a write. */
const DICTIONARY_KEYS = ['id', 'name', 'enabled', 'entries', 'placeholders'] as const;

/** The book field a write sets, through the lore overlay. */
export const DICTIONARY_WRITABLE_FIELD = 'enabled' satisfies keyof SandboxDictionary;

/** The fields on an entry of a book's `entries`. Only `DICTIONARY_ENTRY_WRITABLE_FIELDS` take a write. */
const DICTIONARY_ENTRY_KEYS = ['id', 'name', 'keys', 'value', 'enabled', 'constant'] as const;

/** The entry fields a write sets, through the lore overlay. */
export const DICTIONARY_ENTRY_WRITABLE_FIELDS = ['enabled', 'constant'] as const satisfies readonly (keyof SandboxDictionaryEntry)[];

/** Each book under its code name, the later of two sharing one winning. */
const namedBooks = (dictionaries: readonly SandboxDictionary[]) => new Map(dictionaries.map((book) => [book.name, book]));

/** The `dictionaries` prelude, the later of two books sharing a name winning. A book's `entries` map comes from the
 *  host on its first read (Q48), and each `value` resolves on its own (Q54). A book's `enabled` and an entry's
 *  `enabled` and `constant` take writes, which read back in the run; an entry's reader rows are the `[field, value]`
 *  pairs assigned, in order. A book's reader rows are `[entriesRows, assignedPairs]`, or none when both are empty. */
const dictionariesPrelude = (
  dictionaries: readonly SandboxDictionary[], { indexOf }: FlatPlaceholderMap, reads: HostReads, resolve?: (value: string) => string,
): string => {
  const entriesOf = (book: SandboxDictionary) => [...namedEntries(book.entries ?? [])]
    .map(([name, { id, keys, value, enabled, constant }]) => [name, { id, keys, value: reads.text(value, resolve), enabled, constant }]);
  const spec = [...namedBooks(dictionaries)].map(([name, book]) =>
    [name, { id: book.id ?? '', on: book.enabled !== false, ph: ownerIndex(indexOf, book.placeholders), entries: reads.deferred(() => entriesOf(book)) }]);
  return readOnlyEntryMapPrelude(`dictionaries, ${DICTIONARY_WRITES}`, spec, [
    `const lazy = ${LAZY_TEXT};`,
    `const blankEntry = { id: '', keys: [], value: -1, enabled: false, constant: false };`,
    `const [dictionaries, readWrites] = entryMap(${JSON.stringify(DICTIONARY_KEYS)}, spec, { id: '', on: false, ph: -1, entries: -1 }, (key, data, unknown) => {`,
    `  let built = null;`,
    `  const entries = () => built || (built = entryMap(${JSON.stringify(DICTIONARY_ENTRY_KEYS)},`,
    `    data.entries < 0 ? [] : ${HOST_READ}(data.entries), blankEntry, (name, entry, stray) => {`,
    `      const values = lazy({ id: entry.id, name: stray ? '' : name, keys: freeze([...entry.keys]), value: entry.value,`,
    `        enabled: entry.enabled, constant: entry.constant }, ['value'], '', ${NO_NOTE});`,
    `      const assigned = [];`,
    `      const setters = {};`,
    `      for (const field of ${JSON.stringify(DICTIONARY_ENTRY_WRITABLE_FIELDS)}) setters[field] = (next) => { values[field] = next; assigned.push([field, next]); };`,
    `      return [values, () => assigned, [], setters];`,
    `    }));`,
    `  const values = { id: data.id, name: unknown ? '' : key, enabled: data.on, placeholders: ${OWNER_VIEW}(data.ph, ['dictionary', key], unknown) };`,
    `  define(values, 'entries', { get: () => entries()[0] });`,
    `  const assigned = [];`,
    `  const setters = { ${DICTIONARY_WRITABLE_FIELD}: (next) => { values.${DICTIONARY_WRITABLE_FIELD} = next; assigned.push(next); } };`,
    `  const rows = () => { const entryRows = built ? built[3]() : []; return entryRows.length || assigned.length ? [entryRows, assigned] : []; };`,
    `  return [values, rows, [], setters];`,
    `});`,
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
  /** The tag the entry was built with; null when none. */
  tag: unknown;
}

/** The rows of a read-only entry map's reader; a malformed row is skipped. */
const entryWriteRows = (rows: unknown): EntryWriteRow[] =>
  (Array.isArray(rows) ? rows : []).flatMap((row) => (Array.isArray(row) && typeof row[0] === 'string'
    ? [{ name: row[0], unknown: row[1] === true, mapRows: row[2], fields: row[3], tag: row[4] ?? null }] : []));

/** The rows in a read-only entry map's dump. */
const readEntryWriteRows = (dump: string): EntryWriteRow[] => entryWriteRows(JSON.parse(dump));

/** What the run wrote through `dictionaries`: the entry fields it set, the ones through a name no entry has and
 *  the read-only fields, as code spelled them; or why the run fails. */
function readDictionaryWrites(
  dump: string, dictionaries: readonly SandboxDictionary[],
): { writes: PathedLoreWrite[]; unknown: string[]; readOnly: string[] } | { error: string } {
  const books = namedBooks(dictionaries);
  const writes: PathedLoreWrite[] = [];
  const unknown: string[] = [];
  const readOnly: string[] = [];
  for (const { name, unknown: stray, fields, mapRows } of readEntryWriteRows(dump)) {
    const path = memberPath('dictionaries', name);
    readOnly.push(...readOnlyPaths(path, fields));
    const book = stray ? undefined : books.get(name);
    const [entryRows, assigned] = Array.isArray(mapRows) ? mapRows : [];
    const bookPath = `${path}.${DICTIONARY_WRITABLE_FIELD}`;
    for (const value of Array.isArray(assigned) ? assigned : []) {
      if (typeof value !== 'boolean') return { error: `${bookPath} must be true or false` };
      if (book?.id) writes.push({ book: book.id, field: DICTIONARY_WRITABLE_FIELD, value, path: bookPath });
      else if (!unknown.includes(bookPath)) unknown.push(bookPath);
    }
    const entries = namedEntries(book?.entries ?? []);
    for (const row of entryWriteRows(entryRows)) {
      const entryPath = memberPath(`${path}.entries`, row.name);
      readOnly.push(...readOnlyPaths(entryPath, row.fields));
      const entry = row.unknown ? undefined : entries.get(row.name);
      for (const pair of Array.isArray(row.mapRows) ? row.mapRows : []) {
        const [field, value] = Array.isArray(pair) ? pair : [];
        if (!isLoreField(field)) continue;
        if (typeof value !== 'boolean') return { error: `${entryPath}.${field} must be true or false` };
        if (book?.id && entry) writes.push({ book: book.id, entry: entry.id, field, value, path: `${entryPath}.${field}` });
        else if (!unknown.includes(`${entryPath}.${field}`)) unknown.push(`${entryPath}.${field}`);
      }
    }
  }
  return { writes, unknown, readOnly };
}

const isLoreField = (field: unknown): field is LoreWrite['field'] =>
  (DICTIONARY_ENTRY_WRITABLE_FIELDS as readonly unknown[]).includes(field);

/** How code names an entry of `root`: dot syntax for an identifier, brackets otherwise. */
export const memberPath = (root: string, name: string) =>
  /^[A-Za-z_$][\w$]*$/.test(name) ? `${root}.${name}` : `${root}[${JSON.stringify(name)}]`;

/** How code names an entity: through `entities`, or through `persona` for the empty persona. */
const entityPath = (entity: string) => (entity ? memberPath('entities', entity) : 'persona');

/** How code names an entity's trait map. */
export const entityTraitsPath = (entity: string) => `${entityPath(entity)}.traits`;

/** How code named the trait map a row of entity writes came through. */
export const traitWritesPath = (row: Pick<EntityTraitWrites, 'entity' | 'owner'>) =>
  (row.owner ? 'owner.traits' : entityTraitsPath(row.entity));

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
  place: OwnerPlace,
): { writes: EntityTraitWrites[]; unknown: string[]; readOnly: string[] } | { error: string } {
  const writes: EntityTraitWrites[] = [];
  const unknown: string[] = [];
  const readOnly: string[] = [];
  for (const { name, unknown: isUnknown, mapRows: rows, fields, tag } of readEntryWriteRows(dump)) {
    const own = tag === OWN_OWNER_TAG;
    readOnly.push(...readOnlyPaths(own ? 'owner' : isUnknown ? memberPath('entities', name) : entityPath(name), fields));
    // A blank entry has no traits, so any trait row through it is a switch on an entity that is not there.
    if (isUnknown) {
      if (Array.isArray(rows) && rows.length) unknown.push(name);
      continue;
    }
    const entity = own ? (place.kind === 'own' ? place.entity ?? EMPTY_PERSONA : undefined) : name ? byName.get(name) : persona;
    if (!entity) continue;
    const row = own ? { entity: '', owner: true as const } : { entity: name };
    const read = readTraitWrites(rows, entity.traits, traitWritesPath(row));
    if ('error' in read) return read;
    readOnly.push(...read.readOnly);
    if (!read.writes.length && !read.unknown.length && !read.acquired.length) continue;
    writes.push({
      ...row,
      ...(read.writes.length ? { traits: read.writes } : {}),
      ...(read.unknown.length ? { unknownTraits: read.unknown } : {}),
      ...(read.acquired.length ? { acquiredWrites: read.acquired } : {}),
    });
  }
  return { writes, unknown, readOnly };
}

/** The root a prelude path leads with: '' for the world's own map. */
const pathRoot = (root: string): PlaceholderPathRoot | undefined =>
  (root === 'entity' || root === 'dictionary' || root === 'persona' || root === 'owner' ? root : undefined);

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

const isWritableField = (field: unknown): field is 'value' | CodeBoundField | 'hidden' =>
  typeof field === 'string' && SELF_WRITABLE_FIELDS.includes(field);

/** Why a stat write fails its run. */
type StatWriteError = { error: string; kind: StatCodeFailure };

/** What a run wrote through one stat map. */
interface StatMapWrites {
  writes: StatWrite[];
  unknown: string[];
  disabled: string[];
  readOnly: string[];
}

/** What the run wrote through one stat map, from its reader's rows. A value is a write when it changed; a
 *  bound or `hidden` is a write whenever it was assigned. A write is kept on a live stat, and ignored and
 *  reported on an unknown name or a switched-off stat. A number field written anything but a finite number,
 *  or `hidden` anything but a boolean, fails the run. `readOnly` lists the read-only fields on the map's
 *  entries; a `self` that is an entry reports under its path in the map. */
function readStatWrites(
  rows: unknown,
  entries: readonly StatEntry[],
  /** How code names the map. */
  root: string,
): StatMapWrites | StatWriteError {
  const byName = new Map(entries.map((entry) => [entry.name, entry]));
  const writes: StatWrite[] = [];
  const unknown: string[] = [];
  const disabled: string[] = [];
  const readOnly: string[] = [];
  for (const row of Array.isArray(rows) ? rows : []) {
    if (!Array.isArray(row) || typeof row[0] !== 'string') continue;
    const [name, readOnlyFields, assigned] = row as [string, unknown, unknown];
    const path = memberPath(root, name);
    if (readOnlyFields === null) { readOnly.push(path); continue; }
    readOnly.push(...readOnlyPaths(path, readOnlyFields));
    const entry = byName.get(name);
    const fields: Partial<StatNumbers> & { hidden?: boolean } = {};
    for (const pair of Array.isArray(assigned) ? assigned : []) {
      if (!Array.isArray(pair) || !isWritableField(pair[0])) continue;
      const [field, written] = pair as [keyof StatNumbers | 'hidden', unknown];
      if (field === 'hidden') {
        if (typeof written !== 'boolean') return { error: `${path}.hidden must be true or false`, kind: 'bad-write' };
        fields.hidden = written;
        continue;
      }
      // An unknown name has no value to keep, so any assignment through it is a write.
      if (field === 'value' && entry && Object.is(written, entry.value)) continue;
      if (typeof written !== 'number' || !Number.isFinite(written)) {
        return { error: `${path}.${field} must be a finite number`, kind: 'non-number' };
      }
      fields[field] = written;
    }
    const written = Object.keys(fields);
    if (!written.length) continue;
    if (!entry || !entry.enabled) {
      (entry ? disabled : unknown).push(...written.map((field) => `${path}.${field}`));
      continue;
    }
    writes.push({ id: entry.id, name, ...fields });
  }
  return { writes, unknown, disabled, readOnly };
}

/** What the run wrote through each entity entry's stat map but `owner.stats`, keyed by entity id. A write
 *  through an entry no entity stands behind, an unknown name or the empty persona, is an unknown stat. */
function readEntityStatWrites(
  dump: string,
  { byName, persona }: KeyedEntities,
  statEntriesOf: (entity: SandboxEntity) => StatEntry[],
): (Omit<StatMapWrites, 'writes'> & { owners: OwnerStatWrites[] }) | StatWriteError {
  const parsed: unknown = JSON.parse(dump);
  const out = { owners: [] as OwnerStatWrites[], unknown: [] as string[], disabled: [] as string[], readOnly: [] as string[] };
  for (const row of Array.isArray(parsed) ? parsed : []) {
    if (!Array.isArray(row) || typeof row[0] !== 'string') continue;
    const [key, isUnknown, rows] = row as [string, unknown, unknown];
    const entity = isUnknown === true ? undefined : key ? byName.get(key) : persona;
    const root = `${entity ? entityPath(key) : memberPath('entities', key)}.stats`;
    const read = readStatWrites(rows, entity ? statEntriesOf(entity) : [], root);
    if ('error' in read) return read;
    out.unknown.push(...read.unknown);
    out.disabled.push(...read.disabled);
    out.readOnly.push(...read.readOnly);
    if (!read.writes.length) continue;
    if (entity?.id) out.owners.push({ ownerId: entity.id, writes: read.writes });
    else {
      out.unknown.push(...read.writes.flatMap(({ id: _id, name, ...fields }) =>
        Object.keys(fields).map((field) => `${memberPath(root, name)}.${field}`)));
    }
  }
  return out;
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
  /** Each stat's turn inputs by stat id. */
  readings?: Readonly<Record<string, StatTurnInputs>>;
  /** Absent, `turn` reads an empty action at turn 0. */
  turn?: SandboxTurn;
  /** `turn.choices` takes the write: an After the AI script's, with choices on (Q21). A change elsewhere is dropped. */
  choicesWritable?: boolean;
  /** The live stat-enabled map. A stat set false here reads `enabled: false`. */
  enabled?: Readonly<Record<string, boolean>>;
  /** The map's top-level keys, in authored order. Absent, the map is empty. */
  placeholders?: readonly SandboxPlaceholderNode[];
  traits?: readonly SandboxTrait[];
  /** The entities in play, in play order. */
  entities?: readonly SandboxEntity[];
  /** Absent, `persona` is the empty entry. */
  persona?: SandboxEntity;
  /** The entity that owns the running stat, its stats with their own turn inputs. Absent, `owner` is the empty
   *  entry and the stat is a global stat. */
  owner?: SandboxEntity;
  /** Every dictionary, in authored order. */
  dictionaries?: readonly SandboxDictionary[];
  /** Resolves an entry's `value` when code reads it (Q54). Absent, a value reads as authored. */
  resolveEntryValue?: (value: string) => string;
  /** Absent outside During AI Output, where `narration` and `player` do not exist. */
  narration?: NarrationInput;
  /** A trait script's own trait: `self` reads its entry, read-only. Only with no `currentStat`. */
  selfTrait?: SandboxTrait;
  /** The trait a When a Trait Switches run fires on, as it stands after the switch. Absent in every other
   *  timing, where `trait` does not exist. */
  switchedTrait?: SwitchedTrait;
  /** Who answers `player.*`. Absent, the game's prompt store does. */
  prompts?: ScriptPromptHost;
  /** What `location` reads and what `location.move` can name. Absent, the run knows none. */
  places?: SandboxPlaces;
  /** The entities play discovered, which an unknown entry's `diary` can name beside `entities`. */
  discovered?: readonly SandboxPlace[];
  /** A World Tool run's call arguments, frozen. Absent on a Script, where `args` does not exist. */
  args?: Readonly<Record<string, unknown>>;
  /** The editor's run, which has no discovered cast: a `diary` on an entity the cast lacks is listed in `maybeDiary`, not
   *  thrown (Q46). Play leaves it off, so an unknown name fails. */
  openCast?: boolean;
  /** The Memory panel's live rows, oldest first. Absent, `memories` is empty. */
  memories?: readonly SandboxMemory[];
  /** The player's notes. Absent, `notes` is empty. */
  notes?: string;
  /** A user Tool's run: the surface without writes (Q24, Q44). Every field is read-only, a write is listed in
   *  `readOnlyWrites`, and no verb, `self`, `owner`, `discover` or `player` exists. */
  readOnly?: boolean;
}

const WORLD_WRITES = '__formamorphWorldWrites';
const ENTITY_WRITE = '__formamorphEntityWrite';
const ADVANCE_CLOCK = '__formamorphAdvanceClock';

const MOVE_TURN = '__formamorphMoveTurn';

/** The globals a read-only run reads through its view, the surface of a user Tool (Q24). */
const READ_ONLY_GLOBALS = ['entities', 'persona', 'locations', 'location', 'memories', 'clock', 'turn', 'stats', 'traits', 'placeholders', 'dictionaries'] as const;

const READ_ONLY_VIEW_OF = '__formamorphReadOnlyView';

/**
 * JS source of `(note) => view`: `view(value, path)` reads `value` with its own function members left out, and a
 * write through it calls `note(path)` and changes nothing. An object keeps one view, so `present` holds the very
 * entries `entities` holds; an array reads as a frozen copy of its items' views.
 */
const READ_ONLY_VIEW = `(note) => {
  const { create, freeze, getPrototypeOf } = Object;
  const { apply, ownKeys, getOwnPropertyDescriptor } = Reflect;
  const { isArray } = Array;
  const { stringify } = JSON;
  const { map, filter } = Array.prototype;
  const { hasOwnProperty } = Object.prototype;
  const views = new WeakMap();
  const hidden = (source, key) => apply(hasOwnProperty, source, [key]) && typeof source[key] === 'function';
  const step = (path, key) => /^[A-Za-z_$][\\w$]*$/.test(key) ? path + '.' + key : path + '[' + stringify(key) + ']';
  const view = (source, path) => {
    if (source === null || typeof source !== 'object') return source;
    const known = views.get(source);
    if (known) return known;
    if (isArray(source)) {
      const items = freeze(apply(map, source, [(item, at) => view(item, path + '[' + at + ']')]));
      views.set(source, items);
      return items;
    }
    const read = (key) => (typeof key !== 'string' ? source[key] : hidden(source, key) ? undefined : view(source[key], step(path, key)));
    const drop = (key) => { if (typeof key === 'string') note(step(path, key)); return true; };
    const out = new Proxy(create(null), {
      get: (target, key) => read(key),
      has: (target, key) => key in source && !hidden(source, key),
      ownKeys: () => apply(filter, ownKeys(source), [(key) => !hidden(source, key)]),
      getOwnPropertyDescriptor: (target, key) => {
        const found = getOwnPropertyDescriptor(source, key);
        return found && !hidden(source, key) ? { value: read(key), writable: false, enumerable: found.enumerable, configurable: true } : undefined;
      },
      getPrototypeOf: () => getPrototypeOf(source),
      set: (target, key) => drop(key),
      defineProperty: (target, key) => drop(key),
      deleteProperty: (target, key) => drop(key),
    });
    views.set(source, out);
    return out;
  };
  return view;
}`;

/** The program's names a read-only run hides from its code: the globals its surface lacks, and the prelude's hooks. */
const HIDDEN_GLOBALS = [
  'self', 'owner', 'discover', MOVE_TURN, ADVANCE_CLOCK, ENTITY_WRITE, WORLD_WRITES, SELF_ASSIGNED, STRINGIFY, READ_ONLY_VIEW_OF,
] as const;

/** `code` as a read-only run runs it: the hidden names shadowed, each surface global, `args` with them when the run
 *  has it, read through its view. The inner function lets code declare a name the outer one shadows. */
const readOnlyCode = (code: string, withArgs: boolean): string => {
  const viewed = [...READ_ONLY_GLOBALS, ...(withArgs ? ['args'] : [])];
  return [
    `return (function (${[...HIDDEN_GLOBALS, ...viewed].join(', ')}) {`,
    `  return (function () {`,
    code,
    `  })();`,
    `})(${[...HIDDEN_GLOBALS.map(() => 'undefined'), ...viewed.map((name) => `${READ_ONLY_VIEW_OF}(${name}, '${name}')`)].join(', ')});`,
  ].join('\n');
};

/** JS source that reseeds `Math.random` with sfc32 from `seed`: QuickJS seeds from the clock, so runs in one
 *  millisecond would repeat it. */
const reseedRandom = (seed: readonly number[]): string => [
  `((m, a, b, c, d) => { m.random = () => { const t = (a + b + d) | 0; d = (d + 1) | 0; a = b ^ (b >>> 9);`,
  '  b = (c + (c << 3)) | 0; c = (c << 21) | (c >>> 11); c = (c + t) | 0; return (t >>> 0) / 2 ** 32; };',
  `  for (let i = 0; i < 15; i++) m.random(); })(Math, ${seed.join(', ')});`,
].join('\n');

/** The prelude of `discover`, `memories`, the hooks `location.move` and `clock.advance` call and the hook an entity
 *  entry's writes call. An unknown location or entity is listed as well as thrown, so a script that catches the
 *  throw still fails. An unknown entry's diary finds its key in `cast` by id, else by name; in an `openCast` run a
 *  miss is listed as a maybe instead. `memories` is frozen: its own writes land at commit and never read back. */
const worldPrelude = (
  { locations, location }: SandboxPlaces, cast: readonly SandboxPlace[], openCast: boolean, memories: readonly SandboxMemory[], reads: HostReads,
): string => [
  `const [${MOVE_TURN}, discover, memories, ${ADVANCE_CLOCK}, ${ENTITY_WRITE}, ${WORLD_WRITES}] = ((places, cast, open, rows, lockEntry, note) => {`,
  `  const writes = { location: null, minutes: 0, advanced: false, discover: [], memory: [], pins: [], diary: [], entities: [], memoryWrites: [], unknown: [], maybe: [] };`,
  `  const fail = (message) => {`,
  `    writes.unknown.push(message);`,
  `    throw new Error(message);`,
  `  };`,
  `  const find = (kind, list, target) => {`,
  `    const hit = typeof target === 'string' ? list.find((place) => place.id === target) || list.find((place) => place.name === target) : undefined;`,
  `    return hit ? hit.id : fail('The world has no ' + kind + ' named "' + String(target) + '"');`,
  `  };`,
  `  const entityWrite = (who, kind, target) => {`,
  `    const diary = kind === 'diary';`,
  `    const listed = diary && who.unknown ? cast.find((place) => place.id === who.name) || cast.find((place) => place.name === who.name) : undefined;`,
  `    if (listed) return void writes.diary.push({ entity: listed.id, line: line('diary', target) });`,
  `    if (diary && open && who.unknown) {`,
  `      line('diary', target);`,
  `      if (!writes.maybe.includes(who.name)) writes.maybe.push(who.name);`,
  `      return;`,
  `    }`,
  `    if (who.unknown) fail('The game has no entity named "' + who.name + '"');`,
  `    if (who.played) fail(!diary ? 'The persona moves with the player' : who.name ? 'The game has no entity named "' + who.name + '"' : 'The persona has no diary');`,
  `    const entity = who.id || who.name;`,
  `    if (diary) writes.diary.push({ entity, line: line('diary', target) });`,
  `    else writes.entities.push(kind === 'move' ? { entity, kind, location: find('location', places.locations, target) } : { entity, kind });`,
  `  };`,
  `  const move = (target) => { writes.location = find('location', places.locations, target); };`,
  `  const text = (value) => (typeof value === 'string' ? value.trim() : '');`,
  `  const discover = (name, description) => {`,
  `    if (!text(name)) throw new TypeError('discover needs a name as text');`,
  `    if (description !== undefined && !text(description)) throw new TypeError('discover needs a description as text');`,
  `    const entry = description === undefined ? { name: text(name) } : { name: text(name), description: text(description) };`,
  `    const at = writes.discover.findIndex((known) => known.name === entry.name);`,
  `    if (at < 0) writes.discover.push(entry);`,
  `    else if (entry.description !== undefined) writes.discover[at] = entry;`,
  `  };`,
  `  const advance = (minutes) => {`,
  `    if (typeof minutes !== 'number' || !Number.isFinite(minutes) || minutes < 0) {`,
  `      throw new TypeError('clock.advance needs a finite number of minutes, 0 or more');`,
  `    }`,
  `    writes.minutes += minutes;`,
  `    writes.advanced = true;`,
  `  };`,
  `  const line = (call, value) => {`,
  `    if (!text(value)) throw new TypeError(call + ' needs a line as text');`,
  `    return text(value);`,
  `  };`,
  `  const verb = (target, path, name, call) => Object.defineProperty(target, name, { get: () => call, set: () => note(path + name) });`,
  `  const memories = rows.map((row, at) => {`,
  `    const { id, custom } = row;`,
  `    const path = 'memories[' + at + '].';`,
  `    const entry = lockEntry(row, ['text'], path, note);`,
  // A verdict on a Custom line changes nothing, so it is listed as a dropped write (Q15).
  `    const verdict = (kind) => () => (custom ? note(path + kind + '()') : void writes.memoryWrites.push({ id, kind }));`,
  `    verb(entry, path, 'pin', verdict('pin'));`,
  `    verb(entry, path, 'forget', verdict('forget'));`,
  `    verb(entry, path, 'edit', (value) => { writes.memoryWrites.push({ id, kind: 'edit', text: line(path + 'edit', value), custom }); });`,
  `    verb(entry, path, 'remove', () => { writes.memoryWrites.push({ id, kind: 'remove' }); });`,
  `    return Object.freeze(entry);`,
  `  });`,
  `  const listVerb = (name, call) => verb(memories, 'memories.', name, call);`,
  `  listVerb('add', (value) => { writes.memory.push(line('memories.add', value)); });`,
  `  listVerb('pin', (value) => { writes.pins.push(line('memories.pin', value)); });`,
  `  return [move, Object.freeze(discover), Object.freeze(memories), advance, entityWrite, writes];`,
  `})(${JSON.stringify({ locations: locations.map(({ id, name }) => ({ id, name })), location })}, ${JSON.stringify(cast)}, ${openCast},`,
  `  JSON.parse(${JSON.stringify(JSON.stringify(memories.map((row) => memoryData(row, reads))))}), ${LOCK_ENTRY}, ${LOOSE_NOTE});`,
].join('\n');

const NO_PLACES: SandboxPlaces = { locations: [], location: null };

/** A turn reply with nothing in it: the narration and choices of a turn not yet told. Spread it; never push to it. */
export const EMPTY_REPLY: { narration: string; choices: string[] } = { narration: '', choices: [] };

const NO_TURN: SandboxTurn = { action: '', number: 0, ...EMPTY_REPLY };

/** The prelude's reader of `turn.choices` at run end: JSON with null for each item that isn't text, or null for no list. */
const CHOICES_AT_END = '__formamorphChoicesAtEnd';

/** `turn.choices` at run end: the list the run read, or what the scripts left, which is any value until checked. */
type ChoicesAtEnd = { changed: false } | { changed: true; end: unknown };

function choicesAtEnd(start: readonly string[], dump: string | null): ChoicesAtEnd {
  const end: unknown = dump === null ? null : JSON.parse(dump);
  return Array.isArray(end) && sameChoices(end, start) ? { changed: false } : { changed: true, end };
}

/** Whether `list` is text items with no blank one (Q13). */
const isTextList = (list: unknown): list is string[] =>
  Array.isArray(list) && list.every((item) => typeof item === 'string' && item.trim() !== '');

/** Who an unknown entry's diary can name: every entity but the persona, by id, else by name, then the discovered. */
const diaryCast = (entities: readonly SandboxEntity[], persona: SandboxEntity, discovered: readonly SandboxPlace[]): SandboxPlace[] => [
  ...entities
    .filter((entity) => entity !== persona && !(persona.id && entity.id === persona.id) && hasEntityKey(entity.name))
    .map((entity) => ({ id: entity.id || entity.name, name: entity.name })),
  ...discovered,
];

/** Where the entities stand: the name each one's `location` reads, and who each location's `present` lists. */
interface Standing {
  nameOf(entity: SandboxEntity, played: boolean): string;
  /** Whether `present` starts with the persona, and the `entities` keys that follow it. */
  presentAt(locationId: string): { persona: boolean; keys: string[] };
}

/** Where `keyed` stand among `places`. A follower and the persona stand where the player does; an entity with no
 *  position stands at every location it lists. */
function standingOf({ locations, location: here }: SandboxPlaces, { byName, persona }: KeyedEntities): Standing {
  const nameById = new Map(locations.map((place) => [place.id, place.name]));
  const standsAt = (entity: SandboxEntity, locationId: string) => {
    if (entity.following) return here?.id === locationId;
    return entity.locationId ? entity.locationId === locationId : !!entity.locationIds?.includes(locationId);
  };
  return {
    nameOf: (entity, isPersona) => {
      // The empty persona is no entity, so it stands nowhere.
      if (isPersona) return entity.id ? here?.name ?? '' : '';
      if (entity.following) return here?.name ?? '';
      return entity.locationId ? nameById.get(entity.locationId) ?? '' : '';
    },
    presentAt: (locationId) => ({
      persona: !!persona.id && here?.id === locationId,
      keys: [...byName].filter(([, entity]) => !isPlayed(entity, persona) && standsAt(entity, locationId)).map(([name]) => name),
    }),
  };
}

/** The link fields of a location entry, in the order its slots hold them. */
const LINK_FIELDS = ['parent', 'children', 'exits'] as const satisfies readonly (keyof SandboxLocationLinks)[];

const NO_LINKS: SandboxLocationLinks = { parent: '', children: [], exits: [] };

/** The `locations` and `location` prelude, after the entities prelude: `present` holds its entries. The later of
 *  two locations sharing a name wins the key. */
const locationsPrelude = ({ locations, location: here }: SandboxPlaces, standing: Standing, reads: HostReads): string => {
  // One build per location, shared by its entry and `location`, on the first read of any link field.
  const linkSlots = new Map<SandboxLocation, number[]>();
  const slotsOf = (place: SandboxLocation): number[] => {
    let slots = linkSlots.get(place);
    if (!slots) {
      let built: SandboxLocationLinks | undefined;
      const { links = () => NO_LINKS } = place;
      linkSlots.set(place, slots = LINK_FIELDS.map((field) => reads.deferred(() => (built ??= links())[field])));
    }
    return slots;
  };
  const data = (place: SandboxLocation, prefix: string) => ({
    id: place.id, name: place.name, description: reads.text(place.description), summary: reads.text(place.summary), starting: !!place.starting,
    ...standing.presentAt(place.id), links: slotsOf(place), prefix,
  });
  const current = here ? locations.find((place) => place.id === here.id) ?? here : null;
  const blank = { ...data({ id: '', name: '' }, ''), persona: false, keys: [] };
  const spec = {
    locations: [...new Map(locations.filter((place) => hasEntityKey(place.name)).map((place) => [place.name, place]))]
      .map(([name, place]) => [name, data(place, `${memberPath('locations', name)}.`)]),
    here: current ? data(current, 'location.') : { ...blank, prefix: 'location.' },
    blank,
  };
  return [
    `const [locations, location] = ((spec, move, lockEntry, note, entities, persona) => {`,
    `  const freeze = (value) => {`,
    `    if (value && typeof value === 'object' && !Object.isFrozen(value)) for (const item of Object.values(Object.freeze(value))) freeze(item);`,
    `    return value;`,
    `  };`,
    `  const linked = (target, slots, prefix) => {`,
    `    ${JSON.stringify(LINK_FIELDS)}.forEach((field, at) => Object.defineProperty(target, field, {`,
    `      enumerable: true, get: () => freeze(${HOST_READ}(slots[at])), set: () => note(prefix + field),`,
    `    }));`,
    `    return target;`,
    `  };`,
    `  const entry = (data, extra) => {`,
    `    const present = Object.freeze([...(data.persona ? [persona] : []), ...data.keys.map((key) => entities[key])]);`,
    `    const out = { id: data.id, name: data.name, description: data.description, summary: data.summary, starting: data.starting, present };`,
    `    const read = linked(lockEntry(out, ['description', 'summary'], data.prefix, note), data.links, data.prefix);`,
    `    for (const [field, held] of Object.entries(extra)) {`,
    `      Object.defineProperty(read, field, { enumerable: true, get: () => held, set: () => note(data.prefix + field) });`,
    `    }`,
    `    return Object.freeze(read);`,
    `  };`,
    `  const map = Object.create(null);`,
    `  for (const [key, data] of spec.locations) map[key] = entry(data, {});`,
    `  const strays = Object.create(null);`,
    `  const stray = (key) => entry({ ...spec.blank, prefix: (/^[A-Za-z_$][\\w$]*$/.test(key) ? 'locations.' + key : 'locations[' + JSON.stringify(key) + ']') + '.' }, {});`,
    `  const locations = new Proxy(Object.freeze(map), {`,
    `    get: (target, key) => typeof key !== 'string' || key in target ? target[key] : strays[key] || (strays[key] = stray(key)),`,
    `  });`,
    `  return [locations, entry(spec.here, { move })];`,
    `})(JSON.parse(${JSON.stringify(JSON.stringify(spec))}), ${MOVE_TURN}, ${LOCK_ENTRY}, ${LOOSE_NOTE}, entities, persona);`,
  ].join('\n');
};

/** The world writes a run's dump holds, or the error of the first unknown name it named. */
function readWorldWrites(dump: string): { writes?: WorldWrites; maybeDiary?: string[] } | { error: string } {
  const parsed: unknown = JSON.parse(dump);
  if (!parsed || typeof parsed !== 'object') return {};
  const { location, minutes, advanced, discover, memory, pins, diary, entities, memoryWrites, unknown, maybe } = parsed as {
    location: string | null; minutes: number; advanced: boolean; discover: DiscoverWrite[]; memory: string[]; pins: string[];
    diary: DiaryWrite[]; entities: EntityCodeWrite[]; memoryWrites: MemoryWrite[]; unknown: string[]; maybe: string[];
  };
  if (unknown.length) return { error: unknown[0] };
  const writes: WorldWrites = {
    ...(location === null ? {} : { location }),
    ...(advanced ? { minutes } : {}),
    ...(discover.length ? { discover } : {}),
    ...(memory.length ? { memory } : {}),
    ...(pins.length ? { pins } : {}),
    ...(diary.length ? { diary } : {}),
    ...(entities.length ? { entities } : {}),
    ...(memoryWrites.length ? { memoryWrites } : {}),
  };
  return {
    ...(Object.keys(writes).length ? { writes } : {}),
    ...(maybe.length ? { maybeDiary: maybe } : {}),
  };
}

/** The `player` object of a During AI Output run: every call throws, since a sentence cannot wait on a dialog. */
const PLAYER_CALLS = ['tell', 'toast', 'confirm', 'ask', 'input'] as const;
const OUTPUT_PLAYER = [
  `const player = Object.freeze(Object.fromEntries(${JSON.stringify(PLAYER_CALLS)}.map((call) => [call, () => {`,
  `  throw new Error('player.' + call + " can't run in ${SCRIPT_TIMING_LABEL.output}");`,
  `}])));`,
].join('\n');

// The host function `player.*` calls with a request as JSON; it answers with the answer as JSON, or throws.
// The prelude takes it and deletes the global before user code runs.
const PROMPT_HOOK = '__formamorphPrompt';

/** The `player` prelude of a run on the async engine. Each call checks its arguments in the VM, so a bad one
 *  throws a TypeError there, and sends the host labels only: `ask` answers with option indexes, which map
 *  back to the values the code passed, so a value never leaves the VM. */
const PLAYER_PRELUDE = [
  `const player = ((prompt, stringify, parse, isArray) => {`,
  `  const call = (request) => parse(prompt(stringify(request)));`,
  `  const text = (name, what, value) => {`,
  `    if (typeof value !== 'string') throw new TypeError('player.' + name + ' needs ' + what + ' as text');`,
  `    return value;`,
  `  };`,
  `  const option = (item) => {`,
  `    if (typeof item === 'string') return { label: item, value: item };`,
  `    if (item !== null && typeof item === 'object' && typeof item.label === 'string' && 'value' in item) return { label: item.label, value: item.value };`,
  `    throw new TypeError('player.ask options must be text or { label, value }');`,
  `  };`,
  `  return Object.freeze({`,
  `    tell: (message) => { call({ kind: 'tell', text: text('tell', 'a message', message) }); },`,
  `    toast: (message) => { call({ kind: 'toast', text: text('toast', 'a message', message) }); },`,
  `    confirm: (question) => call({ kind: 'confirm', question: text('confirm', 'a question', question) }),`,
  `    ask: (question, options, settings) => {`,
  `      const list = isArray(options) ? options.map(option) : [];`,
  `      if (!list.length) throw new TypeError('player.ask needs at least one option');`,
  `      const multiple = !!(settings && settings.multiple);`,
  `      const picked = call({ kind: 'ask', question: text('ask', 'a question', question), options: list.map((o) => o.label), multiple });`,
  `      return multiple ? picked.map((at) => list[at].value) : picked === null ? null : list[picked].value;`,
  `    },`,
  `    input: (question, placeholder) => call({`,
  `      kind: 'input', question: text('input', 'a question', question),`,
  `      ...(placeholder === undefined ? {} : { placeholder: text('input', 'a placeholder', placeholder) }),`,
  `    }),`,
  `  });`,
  `})(globalThis.${PROMPT_HOOK}, JSON.stringify, JSON.parse, Array.isArray);`,
  `delete globalThis.${PROMPT_HOOK};`,
].join('\n');

const EMPTY_PERSONA: SandboxEntity = { name: '', traits: [] };

/** The shape a world script's run marshals in place of a stat, for the blank entries a write may add. */
const NO_SELF_STAT: Stat = { id: '', name: '', type: 'number', description: '', min: 0, max: 0, value: 0, regen: 0, descriptors: [] };

/** Run a script's untrusted `code` in an isolated QuickJS (WASM) VM over the world `stats`, `self`, the turn
 *  inputs, the clock, `placeholders`, `traits`, `entities`, `persona`, `owner` and `dictionaries`. A number
 *  return or a `self.value` write sets the value; a `self.min`, `self.max` or `self.regen` write sets that
 *  bound; a write to any other stat, through `stats`, `owner.stats`, `entities[x].stats` or `persona.stats`,
 *  sets that stat's field the same way; a `traits.<name>.enabled` write switches that trait, and an
 *  `entities.<entity>.traits.<name>.enabled` write that entity's own; a failure discards every write. Of two
 *  placeholders, traits or entities sharing a name, the later one is the entry. */
export const executeStatCode = async (
  code: string,
  stats: Stat[],
  /** Null for a world or trait script: `self` is empty or the trait's entry, and a return value or a `self`
   *  write is ignored. */
  currentStat: Stat | null,
  {
    clock, readings, turn = NO_TURN, choicesWritable = false, enabled, placeholders = [], traits = [], entities = [], persona = EMPTY_PERSONA, owner,
    dictionaries = [], resolveEntryValue, narration, selfTrait, switchedTrait, prompts = scriptPrompts, places = NO_PLACES, discovered = [], args,
    openCast = false, memories = [], notes = '', readOnly = false,
  }: StatCodeRunOptions = {},
): Promise<StatCodeResult> => {
  // If code is empty, return null (use the manually set value)
  if (!code || code.trim() === '') {
    return { value: null, error: null };
  }

  try {
    const placeholderMap = flattenPlaceholderMap(placeholders, [
      ...entities.map((entity) => entity.placeholders), persona.placeholders, owner?.placeholders,
      ...dictionaries.map((book) => book.placeholders),
    ]);
    const keyed = keyedEntities(entities, persona);
    const place = ownerPlace(keyed, owner);
    const standing = standingOf(places, keyed);
    const statsData = marshalStats({ stats, readings, enabled });
    const keyedStats = keyedStatEntries(statsData);
    const ownerStatsData = owner?.stats ? marshalStats(owner.stats) : [];
    const keyedOwnerStats = keyedStatEntries(ownerStatsData);
    // Each entity's keyed stat entries, marshaled once for the prelude and the reader.
    const entityStatEntries = new Map<SandboxEntity, StatEntry[]>();
    const statEntriesOf = (entity: SandboxEntity): StatEntry[] => {
      const known = entityStatEntries.get(entity);
      if (known) return known;
      const entries = keyedStatEntries(entity.stats ? marshalStats(entity.stats) : []);
      entityStatEntries.set(entity, entries);
      return entries;
    };
    // `self` is the current stat's own entry: in `owner.stats` for an entity's stat, else in `stats`. A stat
    // in neither, or one that loses its name, stands alone.
    const self = currentStat ?? NO_SELF_STAT;
    const ownIndex = currentStat ? owner?.stats?.stats.findIndex((stat) => stat.id === self.id) ?? -1 : -1;
    const worldIndex = !currentStat || ownIndex >= 0 ? -1 : stats.findIndex((stat) => stat.id === self.id);
    const selfData = ownIndex >= 0 ? ownerStatsData[ownIndex]
      : worldIndex >= 0 ? statsData[worldIndex]
        : marshalStat(self, readings?.[self.id], enabled?.[self.id] !== false);
    // The sandbox variable of the map `self` is an entry of.
    const selfMap = ownIndex >= 0 ? (keyedOwnerStats.includes(selfData) ? OWNER_STATS : null)
      : worldIndex >= 0 && keyedStats.includes(selfData) ? 'stats' : null;
    // A world script's `self` is an empty object; its slots read as undefined so nothing writes back.
    const selfRead = (field: string) => (currentStat ? `self.${field}` : 'undefined');
    const selfNameIn = (map: typeof OWNER_STATS | 'stats') => (selfMap === map ? selfData.name : null);
    // A trait script's `self` is its trait's entry; a world script's is an empty object.
    const selfTraitSource = selfTrait ? JSON.stringify(Object.values(traitData([selfTrait]))[0]) : '{}';
    const blankStat = blankStatEntry(selfData);
    const reads = hostReads();

    // A script that names `player.` waits on the host for its answers, which only the async engine can do
    // (Q45). During AI Output keeps the sync engine: there `player` is the stub that throws (Q14).
    // A read-only run has no `player`, so it never waits.
    const engine: SandboxEngine = !narration && !readOnly && namesPlayer(code) ? 'async' : 'sync';
    // Set when the player closed a prompt. The call throws in the VM, but a script may catch it, so the run
    // reads this and fails as canceled whatever the program then did (Q15).
    let canceled = false;
    const hostFunctions: Record<string, SandboxHostFunction> = {
      [ROLL_HOOK]: (vm, indexHandle) => vm.newString(placeholderMap.nodes[vm.getNumber(indexHandle)]?.entry?.roll() ?? ''),
      [HOST_READ_HOOK]: (vm, slotHandle) => vm.newString(reads.answer(vm.getNumber(slotHandle))),
      ...(engine === 'sync' ? {} : {
        [PROMPT_HOOK]: async (vm, requestHandle) => {
          // The prelude built the request from checked arguments, so it is one of the kinds.
          const request = JSON.parse(vm.getString(requestHandle)) as ScriptPromptRequest;
          try {
            const answer: unknown = await prompts.prompt(request);
            return vm.newString(JSON.stringify(answer ?? null));
          } catch (error) {
            if (isPromptCanceled(error)) canceled = true;
            return { error: vm.newError(error instanceof Error ? error.message : String(error)) };
          }
        },
      }),
    };

    // The stat data rides in as JSON literals (JSON is valid JS expression syntax); console.log, the roll
    // hook, the read hook and the prompt hook are the only host functions. The user code runs as a function body so `return` works, with
    // the readers' names shadowed as its parameters; the program's completion value pairs what it returned
    // with what `self`'s writable fields hold afterwards, then what it did to `placeholders`, `traits` and
    // the entities' traits.
    const program = [
      ...(readOnly ? [reseedRandom([...crypto.getRandomValues(new Uint32Array(4))])] : []),
      `const ${STRINGIFY} = JSON.stringify;`,
      HOST_READ_PRELUDE,
      `const ${SELF_ASSIGNED} = [];`,
      statsPrelude({ root: 'stats', reader: STAT_WRITES, entries: keyedStats, blank: blankStat, selfName: selfNameIn('stats') }),
      statsPrelude({
        root: OWNER_STATS, reader: OWNER_STAT_WRITES, entries: keyedOwnerStats, blank: blankStat, selfName: selfNameIn(OWNER_STATS),
      }),
      `const ${LOOSE_WRITES} = [];`,
      `const ${LOOSE_NOTE} = (path) => (${ADD_ONCE})(${LOOSE_WRITES}, path);`,
      `const self = ${!currentStat ? selfTraitSource : selfMap ? `${selfMap}[${JSON.stringify(selfData.name)}]` : JSON.stringify(selfData)};`,
      ...(selfMap || !currentStat ? [] : [`(${LOCK_STAT})(self, ${SELF_ASSIGNED}, (path) => ${LOOSE_NOTE}('self.' + path));`]),
      ...(!currentStat && selfTrait ? [`Object.freeze((${LOCK_FIELDS})(self, Object.keys(self), 'self.', ${LOOSE_NOTE}));`] : []),
      worldPrelude(places, diaryCast(entities, persona, discovered), openCast, memories, reads),
      `const clock = ((lock, advance) => {`,
      `  const clock = ${JSON.stringify(clockObject(clock))};`,
      `  Object.freeze(lock(clock.previous, ['day', 'daypart', 'hour', 'minute'], 'clock.previous.', ${LOOSE_NOTE}));`,
      `  lock(clock, Object.keys(clock), 'clock.', ${LOOSE_NOTE});`,
      `  Object.defineProperty(clock, 'advance', { value: advance, enumerable: true });`,
      `  return Object.freeze(clock);`,
      `})(${LOCK_FIELDS}, ${ADVANCE_CLOCK});`,
      // `choices` is a plain array at every timing: the run end reads it back, and a change is the write (Q12).
      `const turn = ((entry, choices) => Object.freeze(Object.defineProperty(entry, 'choices', {`,
      `  enumerable: true, get: () => choices, set: (next) => { choices = next; },`,
      `})))((${LOCK_FIELDS})(${JSON.stringify({ action: turn.action, number: turn.number, narration: turn.narration })}, ['action', 'number', 'narration'], 'turn.', ${LOOSE_NOTE}),`,
      `  ${JSON.stringify(turn.choices)});`,
      `const ${CHOICES_AT_END} = ((isArray, stringify) => (list) => {`,
      `  if (!isArray(list)) return null;`,
      `  const out = [];`,
      `  for (let i = 0; i < list.length; i += 1) out[i] = typeof list[i] === 'string' ? list[i] : null;`,
      `  return stringify(out);`,
      `})(Array.isArray, JSON.stringify);`,
      ...(narration ? [
        // `sent` and `buffered` freeze, so code can neither swap nor grow them.
        `const narration = Object.seal((${LOCK_FIELDS})(((entry) => (Object.freeze(entry.sent), Object.freeze(entry.buffered), entry))(`,
        `  ${JSON.stringify({ sentence: narration.sentence, full: narration.full, index: narration.index, sent: narration.sent, buffered: narration.buffered })}),`,
        `  ['full', 'index', 'sent', 'buffered'], 'narration.', ${LOOSE_NOTE}));`,
        OUTPUT_PLAYER,
      ] : []),
      ...(switchedTrait ? [
        `const trait = ((entry) => Object.freeze((${LOCK_FIELDS})(entry, Object.keys(entry), 'trait.', ${LOOSE_NOTE})))(`,
        `  ${JSON.stringify({ ...Object.values(traitData([switchedTrait]))[0], owner: switchedTrait.owner })});`,
      ] : []),
      ...(engine === 'async' ? [PLAYER_PRELUDE] : []),
      // A JSON string parsed in the VM, so a `__proto__` argument stays a plain key.
      ...(args ? [`const args = Object.freeze(JSON.parse(${JSON.stringify(JSON.stringify(args))}));`] : []),
      placeholdersPrelude(placeholderMap),
      trackedMapPrelude({ ...TRAIT_MAP, root: 'traits', reader: TRAIT_WRITES, data: traitData(traits) }),
      entitiesPrelude(keyed, placeholderMap, blankStat, place, statEntriesOf, standing, reads),
      locationsPrelude(places, standing, reads),
      dictionariesPrelude(dictionaries, placeholderMap, reads, resolveEntryValue),
      // An accessor, so `notes = x` drops and lists the write as a locked field does.
      `Object.defineProperty(globalThis, 'notes', { enumerable: true, get: () => ${JSON.stringify(notes)}, set: () => ${LOOSE_NOTE}('notes') });`,
      ...(readOnly ? [`const ${READ_ONLY_VIEW_OF} = (${READ_ONLY_VIEW})(${LOOSE_NOTE});`] : []),
      `[(function(${PLACEHOLDER_WRITES}, ${TRAIT_WRITES}, ${ENTITY_WRITES}, ${STAT_WRITES}, ${LOOSE_WRITES}, ${LOOSE_NOTE}, ${DICTIONARY_WRITES}, ${OWNER_VIEW}, ${OWNER_STATS}, ${OWNER_STAT_WRITES}, ${ENTITY_STAT_WRITES}, ${HOST_READ}) {`,
      readOnly ? readOnlyCode(code, !!args) : code,
      `})(), ${selfRead('value')}, ${CODE_BOUND_FIELDS.map(selfRead).join(', ')}, ${PLACEHOLDER_WRITES}(), ${TRAIT_WRITES}(), ${ENTITY_WRITES}(),`,
      `  ${STAT_WRITES}(), ${DICTIONARY_WRITES}(), ${STRINGIFY}(${SELF_ASSIGNED}), ${OWNER_STAT_WRITES}(), ${STRINGIFY}(${LOOSE_WRITES}),`,
      `  ${ENTITY_STAT_WRITES}(), ${narration ? 'narration.sentence' : 'undefined'}, ${STRINGIFY}(${WORLD_WRITES}), ${selfRead('hidden')},`,
      `  ${CHOICES_AT_END}(turn.choices)];`,
    ].join('\n');

    return await runInSandbox(program, ({ vm, result, consoleOutput, timedOut }): StatCodeResult => {
      if (canceled) return { value: null, error: 'The player closed the prompt', kind: 'canceled' };
      if (result.error) {
        const dumped = vm.dump(result.error) as { name?: string; message?: string; stack?: string } | string;
        const err = typeof dumped === 'object' && dumped !== null ? dumped : { message: String(dumped) };
        // The interrupt handler surfaces as an "interrupted" InternalError — report it as the timeout.
        if (timedOut || (err.name === 'InternalError' && /interrupted/i.test(err.message || ''))) {
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
      const readSlot = (index: number): { type: string; number: number; text: string; flag: boolean } => {
        const handle = vm.getProp(result.value, index);
        try {
          const type = vm.typeof(handle);
          return {
            type, number: type === 'number' ? vm.getNumber(handle) : NaN, text: type === 'string' ? vm.getString(handle) : '',
            flag: type === 'boolean' && vm.dump(handle) === true,
          };
        } finally {
          handle.dispose();
        }
      };
      const returned = readSlot(0);
      const written = readSlot(1);
      const replyOf = (): string | null => {
        if (returned.type === 'string') return returned.text;
        const handle = vm.getProp(result.value, 0);
        try {
          const value: unknown = vm.dump(handle);
          return value === undefined || value === null ? null : JSON.stringify(value) ?? null;
        } finally {
          handle.dispose();
        }
      };
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
      const selfAssigned: unknown = JSON.parse(readDump(7 + CODE_BOUND_FIELDS.length));
      const ownerStatsDump = readDump(8 + CODE_BOUND_FIELDS.length);
      const loose: unknown = JSON.parse(readDump(9 + CODE_BOUND_FIELDS.length));
      const entityStatsDump = readDump(10 + CODE_BOUND_FIELDS.length);
      const assignedSentence = readSlot(11 + CODE_BOUND_FIELDS.length);
      const worldWrites = readWorldWrites(readDump(12 + CODE_BOUND_FIELDS.length));
      const selfHidden = readSlot(13 + CODE_BOUND_FIELDS.length);
      const choicesDump = readSlot(14 + CODE_BOUND_FIELDS.length);

      if (consoleOutput.trim()) {
        console.log('Console output:', consoleOutput);
      }

      // During AI Output, a returned string is the sentence.
      const returnsSentence = !!narration && returned.type === 'string';
      if (narration && assignedSentence.type !== 'string') return failure('narration.sentence must be a string', 'bad-write');
      const sentence = narration && (returnsSentence ? returned.text : assignedSentence.text);
      if ('error' in worldWrites) return failure(worldWrites.error, 'throw');
      const endChoices = choicesAtEnd(turn.choices, choicesDump.type === 'string' ? choicesDump.text : null);
      let choices: string[] | undefined;
      if (endChoices.changed && choicesWritable) {
        if (!isTextList(endChoices.end)) return failure('turn.choices must be a list of text with no blank item', 'bad-write');
        choices = endChoices.end;
      }
      if (currentStat && !returnsSentence && returned.type !== 'number' && returned.type !== 'undefined') {
        return nonNumberFailure('Code must return a number or nothing');
      }
      if (currentStat && !returnsSentence && returned.type === 'undefined' && written.type !== 'number') {
        return nonNumberFailure('self.value must be a number');
      }
      // A bound the code assigned is a write, changed or not; one it left alone keeps the pipeline's result.
      const wroteSelf = (field: string) => !!currentStat && Array.isArray(selfAssigned) && selfAssigned.includes(field);
      const bounds: CodeBounds = {};
      for (const [field, slot] of currentStat ? boundSlots : []) {
        if (!wroteSelf(field) && slot.type === 'number' && Object.is(slot.number, selfData[field])) continue;
        if (!Number.isFinite(slot.number)) return nonNumberFailure(`self.${field} must be a finite number`);
        bounds[field] = slot.number;
      }
      // `hidden` is a write whenever it was assigned, as a bound is.
      if (wroteSelf('hidden') && selfHidden.type !== 'boolean') return failure('self.hidden must be true or false', 'bad-write');
      const hidden = wroteSelf('hidden') ? { hidden: selfHidden.flag } : {};
      const statWrites = readStatWrites(JSON.parse(statsDump), keyedStats, 'stats');
      if ('error' in statWrites) return failure(statWrites.error, statWrites.kind);
      const ownerStatWrites = readStatWrites(JSON.parse(ownerStatsDump), keyedOwnerStats, 'owner.stats');
      if ('error' in ownerStatWrites) return failure(ownerStatWrites.error, ownerStatWrites.kind);
      const entityStatWrites = readEntityStatWrites(entityStatsDump, keyed, statEntriesOf);
      if ('error' in entityStatWrites) return failure(entityStatWrites.error, entityStatWrites.kind);
      const ownerRows: OwnerStatWrites[] = [
        ...(owner && ownerStatWrites.writes.length ? [{ ownerId: owner.id ?? '', writes: ownerStatWrites.writes }] : []),
        ...entityStatWrites.owners,
      ];
      const placeholderWrites = readPlaceholderWrites(writesDump, placeholderMap.nodes);
      if ('error' in placeholderWrites) return failure(placeholderWrites.error, 'bad-write');
      const traitWrites = readTraitWrites(JSON.parse(traitsDump), traits, 'traits');
      if ('error' in traitWrites) return failure(traitWrites.error, 'bad-write');
      const entityWrites = readEntityWrites(entitiesDump, keyed, place);
      if ('error' in entityWrites) return failure(entityWrites.error, 'bad-write');
      const loreWrites = readDictionaryWrites(dictionariesDump, dictionaries);
      if ('error' in loreWrites) return failure(loreWrites.error, 'bad-write');
      const unknownStatWrites = [...statWrites.unknown, ...ownerStatWrites.unknown, ...entityStatWrites.unknown];
      const disabledStatWrites = [...statWrites.disabled, ...ownerStatWrites.disabled, ...entityStatWrites.disabled];
      const readOnlyWrites = [
        ...statWrites.readOnly,
        ...ownerStatWrites.readOnly,
        ...entityStatWrites.readOnly,
        ...(Array.isArray(loose) ? loose : []).filter((path): path is string => typeof path === 'string'),
        ...placeholderWrites.readOnly,
        ...traitWrites.readOnly,
        ...entityWrites.readOnly,
        ...loreWrites.readOnly,
        ...(endChoices.changed && !choicesWritable ? ['turn.choices'] : []),
      ];

      const settled = (value: number | null): StatCodeResult => ({
        value,
        error: null,
        ...(Object.keys(bounds).length ? { bounds } : {}),
        ...hidden,
        ...(statWrites.writes.length ? { statWrites: statWrites.writes } : {}),
        ...(ownerRows.length ? { ownerStatWrites: ownerRows } : {}),
        ...(unknownStatWrites.length ? { unknownStatWrites } : {}),
        ...(disabledStatWrites.length ? { disabledStatWrites } : {}),
        ...(placeholderWrites.writes.length ? { placeholders: placeholderWrites.writes } : {}),
        ...(placeholderWrites.unknown.length ? { unknownPlaceholders: placeholderWrites.unknown } : {}),
        ...(placeholderWrites.unknownOwned.length ? { unknownOwnerPlaceholders: placeholderWrites.unknownOwned } : {}),
        ...(traitWrites.writes.length ? { traits: traitWrites.writes } : {}),
        ...(traitWrites.unknown.length ? { unknownTraits: traitWrites.unknown } : {}),
        ...(traitWrites.acquired.length ? { acquiredWrites: traitWrites.acquired } : {}),
        ...(entityWrites.writes.length ? { entities: entityWrites.writes } : {}),
        ...(entityWrites.unknown.length ? { unknownEntities: entityWrites.unknown } : {}),
        ...(loreWrites.writes.length ? { lore: loreWrites.writes } : {}),
        ...(loreWrites.unknown.length ? { unknownLore: loreWrites.unknown } : {}),
        ...(readOnlyWrites.length ? { readOnlyWrites } : {}),
        ...(choices ? { choices } : {}),
        ...(sentence === undefined ? {} : { sentence }),
        ...(worldWrites.writes ? { worldWrites: worldWrites.writes } : {}),
        ...(worldWrites.maybeDiary ? { maybeDiary: worldWrites.maybeDiary } : {}),
        ...(args ? { reply: replyOf() } : {}),
      });
      if (!currentStat || returnsSentence) return settled(null);
      if (returned.type === 'number') return settled(returned.number);
      return settled(Object.is(written.number, selfData.value) ? null : written.number);
    }, hostFunctions, engine);
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
