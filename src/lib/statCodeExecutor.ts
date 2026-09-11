import type { CodeBounds, Stat } from '@/types';
import { getQuickJS, shouldInterruptAfterDeadline, type QuickJSWASMModule } from 'quickjs-emscripten';
import { clamp } from './utils';
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

/** The clock variable names stat code may read. Exported so the per-turn gate and the editor's help text
 *  read from the same list rather than restating it. */
export const STAT_CLOCK_VARS = [
  'deltaHours', 'elapsedHours', 'day', 'daypart', 'startDay', 'startDaypart',
] as const;

const CLOCK_VAR_PATTERN = new RegExp(`\\b(${STAT_CLOCK_VARS.join('|')})\\b`);

/** Whether a stat's code reads the clock, and so has to re-run every turn rather than only when another
 *  stat moved. A plain source scan: over-matching (a mention in a comment) costs one harmless recompute,
 *  and code that reaches the variable without naming it literally simply doesn't tick. */
export const usesStatClock = (code?: string | null): boolean => !!code && CLOCK_VAR_PATTERN.test(code);

/** The clock readings a run exposes, resolved from `clock` and its defaults. */
const resolveClock = (clock?: StatClock) => {
  const deltaHours = Math.max(0, clock?.deltaHours ?? FLAT_HOURS_PER_TURN);
  const elapsedHours = Math.max(0, clock?.elapsedHours ?? deltaHours);
  const end = dayAndHour(elapsedHours, clock?.calendar);
  // A turn spans time, so its start can sit in a different day/daypart than its end — a long sleep begins
  // in the afternoon and ends at night. Both readings are exposed; neither is derivable from the other.
  const start = dayAndHour(Math.max(0, elapsedHours - deltaHours), clock?.calendar);
  return {
    deltaHours,
    elapsedHours,
    day: end.day,
    daypart: daypart(end.hour, clock?.calendar),
    startDay: start.day,
    startDaypart: daypart(start.hour, clock?.calendar),
  };
};

/** How a run failed, for a caller that sorts failures rather than printing them. `bad-write` is a
 *  placeholder or trait written a value of the wrong type. */
export type StatCodeFailure = 'timeout' | 'non-number' | 'throw' | 'bad-write';

/** The bounds a stat's code may set on itself, in the order the host reads them back. */
export const CODE_BOUND_FIELDS = ['min', 'max', 'regen'] as const satisfies readonly (keyof CodeBounds)[];
export type CodeBoundField = (typeof CODE_BOUND_FIELDS)[number];

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
  /** Names the code wrote that no placeholder has; each write was dropped. */
  unknownPlaceholders?: string[];
  /** The traits the code switched, in map order. Absent when it switched none. */
  traits?: TraitWrite[];
  /** Names the code switched that no trait has; each switch was dropped. */
  unknownTraits?: string[];
  /** Traits whose `acquired` the code wrote; each write was dropped. */
  acquiredWrites?: string[];
}

/** One placeholder a run pinned to new text, or released with `unpin()`. */
export type PlaceholderWrite = { name: string; text: string } | { name: string; unpin: true };

/** One trait a run switched on or off. */
export interface TraitWrite {
  name: string;
  enabled: boolean;
}

/** One entry of the sandbox's `traits` map. */
export interface SandboxTrait {
  name: string;
  /** Acquired and not switched off. */
  enabled: boolean;
  /** In the player's list, on or off. */
  acquired: boolean;
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

/** One entry of the sandbox's `placeholders` map. `roll` runs on the host; the rest rides in as data. */
export interface SandboxPlaceholder {
  name: string;
  value: string;
  values: readonly string[];
  roll: () => string;
}

// The host hook every entry's `roll()` calls. The prelude takes it and deletes the global before user code runs.
const ROLL_HOOK = '__formamorphRollPlaceholder';
// The preludes' readers of what the run did to each map; the program's completion value calls them. User
// code runs in a function whose parameters shadow both names, so it cannot reach them.
const PLACEHOLDER_WRITES = '__formamorphPlaceholderWrites';
const TRAIT_WRITES = '__formamorphTraitWrites';

/** One sandbox map and how its entries are tracked. Every `string` field is JS source the prelude inlines. */
interface TrackedMapBase {
  /** The variable code reads the map by. */
  root: string;
  data: Record<string, unknown>;
  /** `(name, entry, state) => void`: installs the entry's accessors; `state` starts as `{ entry }`. */
  track: string;
  /** The literal an unknown name reads as. */
  blank: string;
  /** Host values the prelude closes over, as parameter and argument pairs. */
  hostArgs?: readonly (readonly [string, string])[];
}

/** How the host reads back what a run wrote to a map. A map the host reads nothing back from leaves it out. */
interface TrackedMapWrites {
  /** The variable the reader of the map's writes is bound to. */
  reader: string;
  /** `(name, state) => row | null` for an entry still in place; null when the run left it alone. */
  row: string;
  /** `(name, entry) => row` for an entry the code replaced wholesale. */
  replaced: string;
}

type TrackedMapSpec = TrackedMapBase & (TrackedMapWrites | { [K in keyof TrackedMapWrites]?: undefined });

/** The prelude that builds one sandbox map and a reader of what the run did to it. The map is parsed from a
 *  JSON string onto a null prototype, so `__proto__` is a plain name and `toString` is not one. A Proxy hands
 *  an unknown name a tracked blank entry, so a write to it is dropped rather than thrown, and reported when
 *  the map has a reader. */
const trackedMapPrelude = (spec: TrackedMapSpec): string => {
  const hostArgs = spec.hostArgs ?? [];
  const params = hostArgs.map(([param]) => `, ${param}`).join('');
  const args = hostArgs.map(([, arg]) => `, ${arg}`).join('');
  const writes = spec.reader === undefined ? null : spec;
  return [
    `const [${spec.root}${writes ? `, ${writes.reader}` : ''}] = ((stringify, keys${params}) => {`,
    `  const map = Object.assign(Object.create(null), JSON.parse(${JSON.stringify(JSON.stringify(spec.data))}));`,
    `  const own = Object.create(null);`,
    `  const track = (name, entry) => { const state = own[name] = { entry }; (${spec.track})(name, entry, state); return entry; };`,
    `  for (const name of keys(map)) track(name, map[name]);`,
    `  const ${spec.root} = new Proxy(map, {`,
    `    get: (target, key) => typeof key !== 'string' || key in target ? target[key]`,
    `      : own[key] ? own[key].entry : track(key, ${spec.blank}),`,
    `  });`,
    ...(writes ? [
      `  const readWrites = () => stringify([...keys(map), ...keys(own).filter((name) => !(name in map))].map((name) => {`,
      `    const entry = map[name], state = own[name];`,
      `    if (!state || (name in map && entry !== state.entry)) return (${writes.replaced})(name, entry);`,
      `    return (${writes.row})(name, state);`,
      `  }).filter((row) => row));`,
    ] : []),
    `  return [${spec.root}${writes ? ', readWrites' : ''}];`,
    `})(JSON.stringify, Object.keys${args});`,
  ].join('\n');
};

/** `entry` with every string emptied and every number zeroed, at every depth. */
const blankOf = (entry: unknown): unknown => {
  if (typeof entry === 'string') return '';
  if (typeof entry === 'number') return 0;
  if (typeof entry !== 'object' || entry === null) return entry;
  return Object.fromEntries(Object.entries(entry).map(([key, value]) => [key, blankOf(value)]));
};

/** The `stats` prelude: every entry keyed by name, the last authored winning a shared name. The host reads
 *  back only `self`'s fields, so the map has no reader. An unknown name reads as `blank`. */
const statsPrelude = (entries: readonly { name: string }[], blank: unknown): string => trackedMapPrelude({
  root: 'stats',
  data: Object.fromEntries(entries.map((entry) => [entry.name, entry])),
  track: '() => {}',
  blank: JSON.stringify(blank),
});

/** The `placeholders` prelude. `value` is an accessor, so the reader knows whether the entry was written and
 *  whether an unpin came after. `pin(text)` is an alias of the `value` setter — same state, same row — so the
 *  last of `pin`, `value` and `unpin` a run calls wins. Rows are `[name, 'set', value]` or `[name, 'unpin']`; a
 *  replaced entry is a write of itself when it is a string, else of its own value. */
const placeholdersPrelude = (entries: readonly SandboxPlaceholder[]): string => [
  trackedMapPrelude({
    root: 'placeholders',
    reader: PLACEHOLDER_WRITES,
    data: Object.fromEntries(entries.map(({ name, value, values }) => [name, { value, values }])),
    hostArgs: [['roll', `globalThis.${ROLL_HOOK}`]],
    track: `(name, entry, state) => {
      state.value = entry.value; state.assigned = false; state.unpinned = false;
      const set = (v) => { state.value = v; state.assigned = true; state.unpinned = false; };
      Object.defineProperty(entry, 'value', { enumerable: true, get: () => state.value, set });
      entry.roll = () => roll(name);
      entry.pin = set;
      entry.unpin = () => { state.unpinned = true; };
    }`,
    blank: `{ value: '', values: [] }`,
    row: `(name, state) => state.unpinned ? [name, 'unpin'] : state.assigned ? [name, 'set', state.value] : null`,
    replaced: `(name, entry) => [name, 'set', typeof entry === 'string' || entry == null ? entry : entry.value]`,
  }),
  `delete globalThis.${ROLL_HOOK};`,
].join('\n');

/** The `traits` prelude. Every assignment to `enabled` is a switch; `acquired` is read-only and a write to it
 *  is recorded. Rows are `[name, enabled, assigned, acquiredWritten]`; a replaced entry reads as itself when it
 *  is not an object. */
const traitsPrelude = (entries: readonly SandboxTrait[]): string => trackedMapPrelude({
  root: 'traits',
  reader: TRAIT_WRITES,
  data: Object.fromEntries(entries.map(({ name, enabled, acquired }) => [name, { enabled, acquired }])),
  track: `(name, entry, state) => {
    state.enabled = entry.enabled; state.acquired = entry.acquired; state.assigned = false; state.acquiredWritten = false;
    Object.defineProperty(entry, 'enabled', { enumerable: true, get: () => state.enabled, set: (v) => { state.enabled = v; state.assigned = true; } });
    Object.defineProperty(entry, 'acquired', { enumerable: true, get: () => state.acquired, set: () => { state.acquiredWritten = true; } });
  }`,
  blank: `{ enabled: false, acquired: false }`,
  row: `(name, state) => state.assigned || state.acquiredWritten ? [name, state.enabled, state.assigned, state.acquiredWritten] : null`,
  replaced: `(name, entry) => [name, typeof entry === 'object' && entry !== null ? entry.enabled : entry, true, false]`,
});

/** How code names an entry of `root`: dot syntax for an identifier, brackets otherwise. */
const memberPath = (root: string, name: string) =>
  /^[A-Za-z_$][\w$]*$/.test(name) ? `${root}.${name}` : `${root}[${JSON.stringify(name)}]`;
const placeholderPath = (name: string) => memberPath('placeholders', name);

/** A reader's dump as rows, split into those naming an entry and the names no entry has. */
function splitWriteRows(dump: string, entries: readonly { name: string }[]): { known: [string, ...unknown[]][]; unknown: string[] } {
  const names = new Set(entries.map((entry) => entry.name));
  const rows: unknown = JSON.parse(dump);
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
  dump: string,
  entries: readonly SandboxTrait[],
): { writes: TraitWrite[]; unknown: string[]; acquired: string[] } | { error: string } {
  const { known, unknown } = splitWriteRows(dump, entries);
  const writes: TraitWrite[] = [];
  const acquired: string[] = [];
  for (const [name, enabled, assigned, acquiredWritten] of known) {
    if (acquiredWritten === true) acquired.push(name);
    if (assigned !== true) continue;
    if (typeof enabled !== 'boolean') return { error: `${memberPath('traits', name)}.enabled must be true or false` };
    writes.push({ name, enabled });
  }
  return { writes, unknown, acquired };
}

/** The writes in the reader's dump. A name no placeholder has is dropped; a write holds text or a finite
 *  number, and anything else fails the run. */
function readPlaceholderWrites(
  dump: string,
  entries: readonly SandboxPlaceholder[],
): { writes: PlaceholderWrite[]; unknown: string[] } | { error: string } {
  const { known, unknown } = splitWriteRows(dump, entries);
  const writes: PlaceholderWrite[] = [];
  for (const [name, action, value] of known) {
    if (action === 'unpin') { writes.push({ name, unpin: true }); continue; }
    const text = typeof value === 'string' ? value
      : typeof value === 'number' && Number.isFinite(value) ? String(value) : null;
    if (text === null) return { error: `${placeholderPath(name)}.value must be text` };
    writes.push({ name, text });
  }
  return { writes, unknown };
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
  placeholders?: readonly SandboxPlaceholder[];
  traits?: readonly SandboxTrait[];
}

/** Run a stat's untrusted `code` in an isolated QuickJS (WASM) VM over `stats`, `self`, the turn inputs,
 *  the clock, `placeholders`, and `traits`. A number return or a `self.value` write sets the value, clamped;
 *  a `self.min`, `self.max` or `self.regen` write sets that bound; a `traits.<name>.enabled` write switches
 *  that trait; a failure discards every write. Of two placeholders or traits sharing a name, the later one
 *  is the entry. */
export const executeStatCode = async (
  code: string,
  stats: Stat[],
  currentStat: Stat,
  { clock, turn, placeholders = [], traits = [] }: StatCodeRunOptions = {},
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
        previous,
        delta: {
          ...sources,
          total: fieldwise((field) => DELTA_SOURCES.reduce((sum, source) => sum + sources[source][field], 0)),
          actual: fieldwise((field) => snapshot[field] - previous[field]),
        },
      };
    };
    const statsData = stats.map(marshal);
    // `self` is the current stat's own entry in `stats`. A stat missing from `stats`, or one that loses its
    // name to a later stat, stands alone.
    const selfIndex = stats.findIndex(stat => stat.id === currentStat.id);
    const selfData = selfIndex >= 0 ? statsData[selfIndex] : marshal(currentStat);
    const lastByName = new Map(statsData.map((entry, index) => [entry.name, index]));
    const selfIsEntry = selfIndex >= 0 && lastByName.get(selfData.name) === selfIndex;

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

      const rollByName = new Map(placeholders.map((entry) => [entry.name, entry.roll]));
      const rollFn = vm.newFunction('roll', (nameHandle) => vm.newString(rollByName.get(vm.getString(nameHandle))?.() ?? ''));
      vm.setProp(vm.global, ROLL_HOOK, rollFn);
      rollFn.dispose();

      // The stat data rides in as JSON literals (JSON is valid JS expression syntax); console.log and the
      // roll hook are the only host functions. The user code runs as a function body so `return` works, with
      // the readers' names shadowed as its parameters; the program's completion value pairs what it returned
      // with what `self`'s writable fields hold afterwards, then what it did to `placeholders` and to `traits`.
      const program = [
        statsPrelude(statsData, blankOf(selfData)),
        `const currentStatId = ${JSON.stringify(String(currentStat.id))};`,
        `const self = ${selfIsEntry ? `stats[${JSON.stringify(selfData.name)}]` : JSON.stringify(selfData)};`,
        // `previous` and `delta` describe the turn, not live fields: frozen, so a write is dropped.
        `for (const s of [...Object.values(stats), self]) {`,
        `  Object.freeze(s.previous);`,
        `  Object.values(s.delta).forEach(Object.freeze);`,
        `  Object.freeze(s.delta);`,
        `}`,
        ...Object.entries(resolveClock(clock)).map(([name, value]) => `const ${name} = ${JSON.stringify(value)};`),
        placeholdersPrelude(placeholders),
        traitsPrelude(traits),
        `[(function(${PLACEHOLDER_WRITES}, ${TRAIT_WRITES}) {`,
        code,
        `})(), self.value, ${CODE_BOUND_FIELDS.map((field) => `self.${field}`).join(', ')}, ${PLACEHOLDER_WRITES}(), ${TRAIT_WRITES}()];`,
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
      const placeholderWrites = readPlaceholderWrites(writesDump, placeholders);
      if ('error' in placeholderWrites) return failure(placeholderWrites.error, 'bad-write');
      const traitWrites = readTraitWrites(traitsDump, traits);
      if ('error' in traitWrites) return failure(traitWrites.error, 'bad-write');

      const min = bounds.min ?? selfData.min;
      const max = Math.max(min, bounds.max ?? selfData.max);
      const settled = (value: number | null): StatCodeResult => ({
        value: value === null ? null : clamp(value, min, max),
        error: null,
        ...(Object.keys(bounds).length ? { bounds } : {}),
        ...(placeholderWrites.writes.length ? { placeholders: placeholderWrites.writes } : {}),
        ...(placeholderWrites.unknown.length ? { unknownPlaceholders: placeholderWrites.unknown } : {}),
        ...(traitWrites.writes.length ? { traits: traitWrites.writes } : {}),
        ...(traitWrites.unknown.length ? { unknownTraits: traitWrites.unknown } : {}),
        ...(traitWrites.acquired.length ? { acquiredWrites: traitWrites.acquired } : {}),
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
