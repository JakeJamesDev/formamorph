import type {
  CascadeOffTraitIds, CodeBounds, CodePins, Dictionary, EntityStatValues, OwnedTraitStates, Placeholder, PlayerStat, Script, Trait,
} from '@/types';
import {
  CODE_BOUND_FIELDS, executeStatCode, keyedEntities, type EntityTraitWrites, type KeyedEntities, type NarrationInput, type PlaceholderWrite,
  type SandboxStats, type SandboxTrait, type StatClock, type StatCodeResult, type StatTurnInputs, type StatWrite, type SwitchedTrait,
  type TraitWrite, type ValueAndMax, type SandboxPlace, type SandboxPlaces, type WorldWrites,
} from './statCodeExecutor';
import { mergeWorldWrites } from './worldWrites';
import { statCodeName, statCodeNamed } from './statCodeNames';
import {
  codeDictionaries, sandboxDictionaries, sandboxPlaceholders, withLibraryPlaceholders, type StatCodePlaceholderSet,
} from './statCodePlaceholders';
import { recordKey } from './ownedTraitState';
import {
  codeEntities, sandboxTraits, type CodeEntities, type CodeEntity, type StatCodeOwners,
} from './statCodeTraits';
import {
  applyCodeTraitSwitches, codeDeltaFor, gateStatsOf, ownerStatTraitsInForce, sameCodeDelta, traitForceScope, traitSwitchEvents, withCodeDelta,
  type AppliedTraitValues, type CodeTraitSwitch, type TraitForceState, type TraitRuntimeState, type TraitSwitchEvent, type TraitWorld,
} from './traitRuntime';
import type { GateStats } from './traitGates';
import { readsTurnStart, type RunTiming } from './statCodeTiming';
import { filledScriptsAt, inRunOrder, SCRIPT_TIMING_LABEL, scriptLabel } from './scripts';
import { inAuthoredOrder, traitOrderIndex } from './traitEffects';
import { clamp } from './utils';
import type { OwnerId, Scoped } from './scope';
import type { ScriptPromptHost } from './scriptPrompts';

/** The trait state a run's switches left, and the log lines they wrote. */
export interface StatCodeTraitResult {
  acquired: Trait[];
  disabledTraitIds: string[];
  appliedValues: AppliedTraitValues;
  cascadeOffTraitIds: CascadeOffTraitIds;
  ownedTraits: OwnedTraitStates;
  /** The owner's stat traits in force after the switches, which the bounds re-derive under. */
  inForce: Trait[];
  log: string[];
  /** The record key of the trait each `log` line reports, null for a line no single switch owns. Absent ⇒ none
   *  is tagged. */
  logTraits?: (string | null)[];
}

/** Everything one turn hands to stat code. The forward turn and the re-roll both build one of these; a turn
 *  with no stat response builds one with no asks. */
export interface StatCodeTurn {
  /** Which timing's scripts run. `before`, `start` and `output` run over the turn's starting state, reading every
   *  `delta` as zero and `previous` as `self` whatever the turn carries. `after`, the default, runs over the asks
   *  and the regen. `output` runs one sentence: see `narration`. */
  timing?: RunTiming;
  /** The sentence an `output` run rewrites. The run's scripts chain in run order: each reads the sentence the
   *  one before it left. Their writes to anything else merge over one snapshot, the later one winning. */
  narration?: NarrationInput;
  /** The switch a `switch` run fires on. The run's state is the one the switch left. */
  switched?: TraitSwitchEvent;
  /** The world the switches held under before they fired, when it differs (a persona change). A switch-off's
   *  trait reads this one (Q16). Absent ⇒ `ownerTraits.world`. */
  switchedFrom?: TraitWorld;
  /** The world's own scripts, which run with no `self` and no `owner`. Absent ⇒ none. */
  worldScripts?: readonly Script[];
  /** Every stat as the turn's pipeline left it: AI asks and regen applied, code not yet run. Names are the
   *  authored ones, chips and all — code reads each stat's code name, derived here. */
  stats: readonly PlayerStat[];
  /** The live stat-enabled map. A disabled stat's code never runs; other code reads it with `enabled: false`. */
  enabled: Readonly<Record<string, boolean>>;
  /** The stats as they stood at the start of the turn, matched by id. A stat missing here reads its
   *  `previous` as a copy of its own current entry. */
  previous: readonly PlayerStat[];
  /** This turn's AI asks, raw: before flags and clamping. */
  asks: readonly (ValueAndMax & { id: string })[];
  /** Regen applied this turn, by stat id. */
  regenApplied: Readonly<Record<string, number>>;
  clock: StatClock;
  /** What `traits`, `entities` and `persona` read and switch. Bounds re-derive under the ones in force. */
  ownerTraits: StatCodeOwners;
  /** What `placeholders`, each owner entry's `placeholders` and `dictionaries` read. Absent, all are empty. */
  placeholders?: StatCodePlaceholderSet;
  /** A stat's name as the player reads it, for the turn log. Required, not defaulted: a caller that left
   *  it out would print an unresolved chip token in a line the player reads. */
  statNameOf: (stat: PlayerStat) => string;
  /** A trait's name as the player reads it, for the trait switch log. Required for the same reason
   *  `statNameOf` is; code reaches the trait by its code name, which the turn derives itself. */
  traitNameOf: (trait: Trait) => string;
  /** The entities whose stats also run this turn, in owner order: world entities in authored order, then
   *  library entities in pick order. Every script reads one snapshot: the global stats as `stats`, its owner's
   *  as `owner.stats`, and each one's as `entities[x].stats`. Writes land in run order: scripts with an `order`
   *  ascending, then the world's, then owner order and stat order; the later write wins a field. */
  owners?: readonly OwnerCodeTurn[];
  /** Every owner's stats as gates read them at the turn's start; the run lays its owners' stats over them.
   *  Absent ⇒ gates read only the run's owners. */
  gateStats?: GateStats;
  /** Stat id → the value a penalty takes from the turn owner's stat after the run, unless code moves that stat:
   *  the starvation penalty. */
  penalties?: Readonly<Record<string, number>>;
  /** Who answers `player.*`. Absent, the game's prompt store does. */
  prompts?: ScriptPromptHost;
  /** The world's locations, authored names and all, and where the turn stands. Absent, code names none. */
  places?: SandboxPlaces;
  /** The entities play discovered, which `diary` can name. Absent ⇒ none. */
  discovered?: readonly SandboxPlace[];
  /** World Tool calls that run ahead of every script of the timing, in this order (Q4). Absent ⇒ none. */
  triggers?: readonly ScriptTrigger[];
  /** Runs `triggers` and `replayed` alone, as an On Call Tool does. */
  triggersOnly?: boolean;
  /** Saved World Tool writes laid on ahead of `triggers`, in this order, with no script run (Q41). */
  replayed?: readonly ReplayedTrigger[];
}

/** One World Tool call a run fires: the Tool's name, its script, and the call's arguments. */
export interface ScriptTrigger {
  name: string;
  code: string;
  args: Readonly<Record<string, unknown>>;
}

/** What a World Tool call's script wrote to stats, pins and traits, in the shape a save keeps. Its scene
 *  writes are left out: a stat re-roll keeps the turn's location, clock and cast. */
export interface SavedScriptWrites {
  stats?: { owner: OwnerId; writes: TargetWrite[] }[];
  placeholders?: PlaceholderWrite[];
  traits?: StatTraitWrites;
}

/** A World Tool call replayed from its saved writes: the Tool's name, for the switch log, and the writes. */
export interface ReplayedTrigger {
  name: string;
  writes: SavedScriptWrites;
}

/** What the run's first trigger answered: its return value as text, or why it failed. */
export type TriggerReply = { text: string | null } | { error: string };

/** One entity owner's part of a turn, in the same terms as the turn owner's. */
export interface OwnerCodeTurn extends Pick<StatCodeTurn, 'stats' | 'enabled' | 'previous' | 'regenApplied'> {
  id: string;
  /** Absent ⇒ none. */
  asks?: StatCodeTurn['asks'];
}

/** What one entity owner's code and the run's trait switches did to its stats. */
export type OwnerCodeResult = Pick<StatCodeTurnResult, 'stats' | 'moved' | 'boundsChanged'> & {
  /** The owner's stat traits in force after the switches; absent when code switched no trait. */
  inForce?: Trait[];
};

export interface StatCodeTurnResult {
  /** `stats` with the trait switches, then the code writes, applied, in the same order; the same array when
   *  nothing moved. */
  stats: readonly PlayerStat[];
  /** Ids of the stats whose value the run moved, in stat order. */
  moved: string[];
  /** Ids of the stats whose code delta the run changed, in stat order. */
  boundsChanged: string[];
  /** Where two stats touched one placeholder, the later stat's action is the one here. */
  pinWrites: PinWrites;
  /** Absent when code switched no trait. */
  traits?: StatCodeTraitResult;
  /** Each entity owner's result by owner id; absent when the turn named none. */
  owners?: Readonly<Record<string, OwnerCodeResult>>;
  /** The one stat snapshot every settle in the run read (Q19): asks, regen, `penalties` and code writes landed,
   *  before any trait switch moved a stat. */
  gateStats: GateStats;
  /** The sentence an `output` run left: as it came when no script changed it. Absent on any other run. */
  sentence?: string;
  /** The run's location, clock and discovery writes, merged in run order. Absent when no script wrote one. */
  worldWrites?: WorldWrites;
  /** Present on a run with triggers. */
  reply?: TriggerReply;
  /** What the run's first trigger wrote, when it ran clean. */
  triggerWrites?: SavedScriptWrites;
}

const mergedWorldWrites = (writers: readonly (WorldWrites | undefined)[]): WorldWrites | undefined =>
  writers.reduce<WorldWrites | undefined>(mergeWorldWrites, undefined);

/** Placeholder id → what code pinned it to, or null where code unpinned it. An Object's pin is a list. */
export type PinWrites = Readonly<Record<string, string | string[] | null>>;

/** Whether two stored pins hold the same thing, so a rewrite of the same pin mints no new state. */
const samePin = (a: string | readonly string[] | undefined, b: string | readonly string[]): boolean => {
  if (typeof a === 'string' || a === undefined) return a === b;
  return Array.isArray(b) && a.length === b.length && a.every((item, i) => item === b[i]);
};

/** `codePins` with a turn's pin writes laid on; the same object when they change nothing. */
export function withPinWrites(codePins: CodePins, pinWrites: PinWrites): CodePins {
  const changed = Object.entries(pinWrites)
    .filter(([id, pin]) => (pin === null ? id in codePins : !samePin(codePins[id], pin)));
  if (!changed.length) return codePins;
  const next: Record<string, string | readonly string[]> = { ...codePins };
  for (const [id, pin] of changed) {
    if (pin === null) delete next[id];
    else next[id] = pin;
  }
  return next;
}

/** Lay a turn's code result onto the latest stats, which may have moved since the run read its snapshot:
 *  only a value the run moved and the code delta it changed carry over, re-derived onto the latest bases.
 *  After a trait switch every stat re-derives, under the traits the switch left in force. */
export function overlayStatCodeResult(
  latest: readonly PlayerStat[],
  result: OwnerCodeResult & { traits?: Pick<StatCodeTraitResult, 'inForce'> },
  active: readonly Trait[],
): PlayerStat[] {
  const coded = new Map(result.stats.map((stat) => [stat.id, stat]));
  const switched = result.traits?.inForce ?? result.inForce;
  const inForce = switched ?? active;
  return latest.map((stat) => {
    const run = coded.get(stat.id);
    const value = run && result.moved.includes(stat.id) ? run.value : stat.value;
    if (run && result.boundsChanged.includes(stat.id)) return withCodeDelta(stat, run.codeDelta, value, inForce);
    if (switched) return withCodeDelta(stat, stat.codeDelta, value, inForce);
    return value === stat.value ? stat : { ...stat, value };
  });
}

/** `set` listing only the authored books in play; a book turned off reads as an unknown dictionary. */
const withBooksInPlay = (set: StatCodePlaceholderSet): StatCodePlaceholderSet => {
  const { inPlayDictionaryIds: inPlay } = set;
  return inPlay ? { ...set, dictionaries: set.dictionaries?.filter((book) => inPlay.has(book.id)) } : set;
};

/** A playthrough's placeholder set, short of the pins each run reads at its own base. The authored books in
 *  play are the ones `runtimeDictionaries` leaves on. */
export function playthroughPlaceholderSet({ runtimeDictionaries, ...set }: Omit<StatCodePlaceholderSet, 'inPlayDictionaryIds'> & {
  runtimeDictionaries: readonly Dictionary[];
}): StatCodePlaceholderSet {
  return { ...set, inPlayDictionaryIds: new Set(runtimeDictionaries.filter((book) => book.enabled !== false).map((book) => book.id)) };
}

/** Each result field that lists dropped writes, and how the turn's warning describes it. */
const RESULT_WARNINGS = {
  unknownPlaceholders: 'wrote placeholders the world does not have',
  unknownOwnerPlaceholders: 'wrote placeholders of owners not in the game',
  unknownTraits: 'switched traits the world does not have',
  acquiredWrites: 'wrote acquired on',
  readOnlyWrites: 'wrote read-only fields',
  unknownStatWrites: 'wrote stats that do not exist',
  disabledStatWrites: 'wrote switched-off stats',
  unknownEntities: 'switched traits of entities not in the game',
} as const satisfies Partial<Record<keyof StatCodeResult, string>>;

/** Each entity row field that lists dropped writes, and how the warning describes it for `whose` traits. */
const ENTITY_WARNINGS = {
  unknownTraits: (whose: string) => `switched traits ${whose} does not have`,
  acquiredWrites: (whose: string) => `wrote acquired on traits of ${whose}`,
} as const satisfies Partial<Record<keyof EntityTraitWrites, (whose: string) => string>>;

/** Warn of every write a run dropped, one line per result field that lists any. `who` names the script. */
function warnDroppedWrites(who: string, result: StatCodeResult): void {
  const warn = (message: string, names: readonly string[] | undefined) => {
    if (names) console.warn(`${who} ${message}: ${names.join(', ')}`);
  };
  for (const [field, message] of Object.entries(RESULT_WARNINGS) as [keyof typeof RESULT_WARNINGS, string][]) {
    warn(message, result[field]);
  }
  for (const row of result.entities ?? []) {
    for (const [field, message] of Object.entries(ENTITY_WARNINGS) as [keyof typeof ENTITY_WARNINGS, (whose: string) => string][]) {
      warn(message(row.owner ? 'the owner' : row.entity || 'the persona'), row[field]);
    }
  }
}

/** The owner name a world script's fallback label carries (Q6). */
const WORLD_OWNER = 'World';

/** A run's scope: global scope, with a null id, or an entity owner. */
type RunOwner = Omit<OwnerCodeTurn, 'id'> & { id: OwnerId };

/** One scope's part of a run: its stats under their code names, its turn inputs, and the scripts that run. */
interface OwnerRun<O extends RunOwner = RunOwner> {
  owner: O;
  named: PlayerStat[];
  inputs: Record<string, StatTurnInputs>;
  /** In owner order: the world's scripts on the global run, then each enabled stat's in stat order, then each
   *  active trait's in tree order. */
  units: ScriptUnit[];
}

/** One script's run in a scope: its stat or its trait (neither for a world script), and what it wrote. */
interface ScriptUnit {
  stat: PlayerStat | null;
  trait?: Trait;
  script: Script;
  /** A World Tool call's arguments; absent on a Script. */
  args?: ScriptTrigger['args'];
  /** Absent until the script ran clean. */
  writes?: ScriptWrites;
}

/** What one script wrote. `stats` holds its stat writes by target scope. */
interface ScriptWrites {
  stats: ReadonlyMap<OwnerId, readonly TargetWrite[]>;
  placeholders: readonly PlaceholderWrite[];
  traits?: StatTraitWrites;
  world?: WorldWrites;
}

/** One stat's fields a box wrote. */
type TargetWrite = Pick<StatWrite, 'id' | 'value' | keyof CodeBounds>;

/** A target's merged write, as `settleWrites` lays it on. */
type SettledWrite = { value: number | null; bounds: CodeBounds | null };

/** What one run wrote, by target scope: its own stat first, under `ownerId`; its `stats` writes under global
 *  scope; then each entity's. A world script has no stat of its own. */
function targetWrites(stat: PlayerStat | null, result: StatCodeResult, ownerId: OwnerId): Map<OwnerId, TargetWrite[]> {
  const out = new Map<OwnerId, TargetWrite[]>();
  const add = (id: OwnerId, writes: readonly TargetWrite[] = []) => {
    if (writes.length) out.set(id, [...out.get(id) ?? [], ...writes]);
  };
  if (stat && (result.value !== null || result.bounds)) {
    add(ownerId, [{ id: stat.id, ...result.bounds, ...(result.value === null ? {} : { value: result.value }) }]);
  }
  add(null, result.statWrites);
  for (const row of result.ownerStatWrites ?? []) add(row.ownerId, row.writes);
  return out;
}

/** `writes` as a save keeps them; empty fields are left out. */
function savedWrites({ stats, placeholders, traits }: ScriptWrites): SavedScriptWrites {
  return {
    ...(stats.size ? { stats: [...stats].map(([owner, writes]) => ({ owner, writes: [...writes] })) } : {}),
    ...(placeholders.length ? { placeholders: [...placeholders] } : {}),
    ...(traits ? { traits } : {}),
  };
}

/** Saved writes as a run lays them on. */
const scriptWritesOf = ({ stats = [], placeholders = [], traits }: SavedScriptWrites): ScriptWrites => ({
  stats: new Map(stats.map(({ owner, writes }) => [owner, writes])), placeholders, ...(traits ? { traits } : {}),
});

/** Each target scope's writes, each target stat's merged field by field in run order, the later script
 *  winning a field. */
function statWritesByOwner(writers: readonly (ScriptWrites | undefined)[]): Map<OwnerId, Map<string, SettledWrite>> {
  const out = new Map<OwnerId, Map<string, SettledWrite>>();
  for (const writes of writers) {
    for (const [ownerId, targets] of writes?.stats ?? []) {
      const owner = out.get(ownerId) ?? new Map<string, SettledWrite>();
      out.set(ownerId, owner);
      for (const { id, value, ...bounds } of targets) {
        const at = owner.get(id) ?? { value: null, bounds: null };
        const written = Object.fromEntries(CODE_BOUND_FIELDS.flatMap((field) => (bounds[field] === undefined ? [] : [[field, bounds[field]]])));
        owner.set(id, {
          value: value ?? at.value,
          bounds: Object.keys(written).length ? { ...at.bounds, ...written } : at.bounds,
        });
      }
    }
  }
  return out;
}

function ownerRun<O extends RunOwner>(
  owner: O, timing: RunTiming, placeholderDefs: readonly Placeholder[], worldScripts: readonly Script[] = [],
  /** The owner's active traits, whose scripts run after its stats' (Q3). */
  traits: readonly Trait[] = [],
): OwnerRun<O> {
  // Code reaches a stat by its code name, which no roll moves. The log and the panel keep the rolled text.
  const named = statCodeNamed(owner.stats, placeholderDefs);
  const previous = new Map(statCodeNamed(owner.previous, placeholderDefs).map((stat) => [stat.id, stat]));
  const asks = new Map((owner.asks ?? []).map((ask) => [ask.id, ask]));
  // Only what this turn knows; the executor reads a missing part as untouched. The before box, the start
  // scripts and the output scripts run at the turn's start, so they hand over nothing at all: the executor then
  // reads `previous` as `self` and every delta source as zero, whatever the turn it rides in already holds.
  const inputs: Record<string, StatTurnInputs> = readsTurnStart(timing) ? {} : Object.fromEntries(named.map((stat) => {
    const before = previous.get(stat.id);
    const ask = asks.get(stat.id);
    return [stat.id, {
      previous: before,
      delta: { ai: ask && { value: ask.value, max: ask.max }, regen: { value: owner.regenApplied[stat.id] } },
    }];
  }));
  const units: ScriptUnit[] = [
    ...filledScriptsAt({ scripts: worldScripts }, timing).map((script) => ({ stat: null, script })),
    ...named.filter((stat) => owner.enabled[stat.id] !== false)
      .flatMap((stat) => filledScriptsAt(stat, timing).map((script) => ({ stat, script }))),
    ...traits.flatMap((trait) => filledScriptsAt(trait, timing).map((script) => ({ stat: null, trait, script }))),
  ];
  return { owner, named, inputs, units };
}

/** Nested rounds of switch runs one action fires before a further switch stops firing scripts (Q47). */
export const SWITCH_DEPTH_CAP = 8;

/** Run one timing's scripts over one turn in the sandbox, then the When a Trait Switches runs its trait
 *  switches fire. An `output` run's switches fire with the After batch instead, where its writes land (Q42). */
export async function runStatCodeTurn(turn: StatCodeTurn): Promise<StatCodeTurnResult> {
  const result = await runScripts(turn);
  if (turn.timing === 'output') return result;
  const switched = await withSwitchRuns(turn, result);
  const { reply, triggerWrites } = result;
  return reply ? { ...switched, reply, ...(triggerWrites ? { triggerWrites } : {}) } : switched;
}

/** `result` with the switch runs fired by the switches it made over `turn`, as one result over `turn`. */
export async function withSwitchRuns(turn: StatCodeTurn, result: StatCodeTurnResult): Promise<StatCodeTurnResult> {
  const after = afterRun(turn, result);
  return (await chainSwitchRuns(turn, [result], after, switchesBetween(turn, after))) ?? result;
}

/** One switch run per event, over `turn`, the state the switches left (Q12, Q47). */
export const runSwitchScripts = (turn: StatCodeTurn, events: readonly TraitSwitchEvent[]): Promise<StatCodeTurnResult | null> =>
  chainSwitchRuns(turn, [], turn, events);

/** `events`' switch runs from `at`, laid after `steps`, as one result over `start`; null with no event. */
async function chainSwitchRuns(
  start: StatCodeTurn, steps: StatCodeTurnResult[], at: StatCodeTurn, events: readonly TraitSwitchEvent[],
): Promise<StatCodeTurnResult | null> {
  if (!events.length) return null;
  const now = await switchRuns(at, events, 1, steps);
  return chainedResult(start, steps, now);
}

/** The traits that switched from one turn's state to the next's, as the timing fires on them. */
const switchesBetween = (from: StatCodeTurn, to: StatCodeTurn): TraitSwitchEvent[] =>
  traitSwitchEvents(forceStateOf(from), forceStateOf(to), to.ownerTraits.world);

/** Runs `events` in order, each over the state the run before left, and each run's own switches nested
 *  under it. Every run's result joins `steps`. */
async function switchRuns(
  turn: StatCodeTurn, events: readonly TraitSwitchEvent[], depth: number, steps: StatCodeTurnResult[],
): Promise<StatCodeTurn> {
  if (depth > SWITCH_DEPTH_CAP) {
    console.warn(`Trait switches nested past ${SWITCH_DEPTH_CAP} rounds; ${events.length} switch(es) fired no script`);
    return turn;
  }
  let now = turn;
  for (const switched of events) {
    const step = await runScripts({ ...now, timing: 'switch', switched });
    steps.push(step);
    // A run's own switches hold under the world it ran in.
    const next = { ...afterRun(now, step), switchedFrom: undefined };
    now = { ...await switchRuns(next, switchesBetween(now, next), depth + 1, steps), switchedFrom: turn.switchedFrom };
  }
  return now;
}

/** The trait slice of a turn, as the switch diff reads it. */
const forceStateOf = ({ ownerTraits }: StatCodeTurn): TraitForceState => ({
  traits: ownerTraits.acquired, disabledTraitIds: ownerTraits.disabledTraitIds, ownedTraits: ownerTraits.ownedTraits,
});

/** `turn` as the next run finds it after `result`: the stats, traits and pins the run left. */
export function afterRun(turn: StatCodeTurn, result: StatCodeTurnResult): StatCodeTurn {
  const { traits } = result;
  const ownerTraits = !traits ? turn.ownerTraits : {
    ...turn.ownerTraits,
    acquired: traits.acquired,
    disabledTraitIds: traits.disabledTraitIds,
    appliedValues: traits.appliedValues,
    cascadeOffTraitIds: traits.cascadeOffTraitIds,
    ownedTraits: traits.ownedTraits,
  };
  const set = turn.placeholders;
  const codePins = withPinWrites(set?.codePins ?? {}, result.pinWrites);
  const pins = set?.pinsAfter?.({
    codePins, acquired: ownerTraits.acquired, disabledTraitIds: ownerTraits.disabledTraitIds, ownedTraits: ownerTraits.ownedTraits,
    stats: result.stats,
  });
  return {
    ...turn,
    stats: result.stats,
    gateStats: result.gateStats,
    owners: turn.owners?.map((owner) => {
      const ran = result.owners?.[owner.id];
      return ran ? { ...owner, stats: ran.stats } : owner;
    }),
    ownerTraits,
    placeholders: set && { ...set, codePins, ...(pins ? { pins } : {}) },
  };
}

/** The ids of the stats in `now` whose value or code delta differs from `start`, matched by id. */
function changedStats(start: readonly PlayerStat[], now: readonly PlayerStat[]): { moved: string[]; boundsChanged: string[] } {
  const was = new Map(start.map((stat) => [stat.id, stat]));
  const moved: string[] = [];
  const boundsChanged: string[] = [];
  for (const stat of now) {
    const before = was.get(stat.id);
    if (!before) continue;
    if (stat.value !== before.value) moved.push(stat.id);
    if (!sameCodeDelta(before.codeDelta, stat.codeDelta)) boundsChanged.push(stat.id);
  }
  return { moved, boundsChanged };
}

/** Runs chained from `start` to `now`, one after the other, as one run's result over `start`. The later step
 *  wins a pin. */
export function chainedResult(start: StatCodeTurn, steps: readonly StatCodeTurnResult[], now: StatCodeTurn): StatCodeTurnResult {
  const finalStep = steps.at(-1);
  if (!finalStep) throw new Error('A chained result needs a step');
  const pinWrites: PinWrites = Object.assign({}, ...steps.map((step) => step.pinWrites));
  const worldWrites = mergedWorldWrites(steps.map((step) => step.worldWrites));
  const last = steps.findLast((step) => step.traits)?.traits;
  const logs = steps.map((step) => step.traits?.log ?? []);
  const traits: StatCodeTraitResult | undefined = last && {
    ...last, log: logs.flat(),
    logTraits: steps.flatMap((step, i) => step.traits?.logTraits ?? logs[i].map(() => null)),
  };
  const owners = start.owners && Object.fromEntries(start.owners.map((owner): [string, OwnerCodeResult] => {
    const after = now.owners?.find((ran) => ran.id === owner.id) ?? owner;
    const inForce = steps.findLast((step) => step.owners?.[owner.id]?.inForce)?.owners?.[owner.id]?.inForce;
    return [owner.id, { stats: after.stats, ...changedStats(owner.stats, after.stats), ...(inForce ? { inForce } : {}) }];
  }));
  return {
    stats: now.stats, ...changedStats(start.stats, now.stats), pinWrites, gateStats: finalStep.gateStats,
    ...(traits ? { traits } : {}), ...(owners ? { owners } : {}), ...(worldWrites ? { worldWrites } : {}),
  };
}

/** The scripts a run runs on traits, by scope. A switch run runs the switched trait's own scripts alone,
 *  whichever way it switched, so a trait's script sees its own switch-off (Q13). */
function scriptTraits(
  timing: RunTiming, switched: TraitSwitchEvent | undefined, inForce: Scoped<Trait[]>, world: TraitWorld,
): Scoped<readonly Trait[]> {
  if (timing !== 'switch' || !switched) return inForce;
  const trait = switchedTraitOf(switched, world);
  const own = (ownerId: OwnerId) => (trait && ownerId === switched.ownerId ? [trait] : []);
  // An owner that left the world with the switch still runs its trait's script.
  const ownerIds = new Set([...Object.keys(inForce.owners), ...(switched.ownerId === null ? [] : [switched.ownerId])]);
  return { global: own(null), owners: Object.fromEntries([...ownerIds].map((id) => [id, own(id)])) };
}

/** The authored trait a switch names, in its owner's tree. */
function switchedTraitOf({ traitId, ownerId }: TraitSwitchEvent, world: TraitWorld): Trait | undefined {
  const tree = ownerId === null ? world.traits : world.owners?.find((owner) => owner.id === ownerId)?.traits;
  return tree?.find((trait) => trait.id === traitId);
}

/** The world a switch's trait reads: a switch-off's is the one it held under. */
const switchedWorldOf = (turn: StatCodeTurn, switched: TraitSwitchEvent): TraitWorld =>
  (!switched.enabled && turn.switchedFrom && switchedTraitOf(switched, turn.switchedFrom) ? turn.switchedFrom : turn.ownerTraits.world);

/** The `trait` a switch run reads: the switched trait's entry in its owner's map after the switch, else one
 *  built from the authored trait. */
function switchedTraitEntry(
  switched: TraitSwitchEvent, traits: readonly SandboxTrait[], inPlay: CodeEntities | null, world: TraitWorld,
  placeholders: readonly Placeholder[],
): SwitchedTrait | undefined {
  const { traitId, ownerId, enabled } = switched;
  const entity = ownerId === null ? null : inPlay && [...inPlay.entities, inPlay.persona].find((cast) => cast.id === ownerId);
  const entry = (entity ? entity.traits : ownerId === null ? traits : []).find((trait) => trait.id === traitId);
  const ownerName = world.owners?.find((owner) => owner.id === ownerId)?.name;
  const owner = entity?.name ?? (ownerName ? statCodeName(ownerName, placeholders) : '');
  // A trait that left the tree keeps its stored state, so the switch sets `enabled`.
  if (entry) return { ...entry, enabled, owner };
  const authored = switchedTraitOf(switched, world);
  return authored && { id: traitId, name: statCodeName(authored.name, placeholders), enabled, acquired: true, owner };
}

/** Run one timing's scripts over one turn in the sandbox: the world's and every owner's enabled stats', in
 *  parallel over one snapshot. A failing script is logged and writes nothing. */
async function runScripts(turn: StatCodeTurn): Promise<StatCodeTurnResult> {
  const timing = turn.timing ?? 'after';
  const placeholderDefs = turn.placeholders?.placeholders ?? [];
  const globalTurn: RunOwner = {
    id: null, stats: turn.stats, enabled: turn.enabled, previous: turn.previous,
    asks: turn.asks, regenApplied: turn.regenApplied,
  };
  const world = turn.ownerTraits.world;
  const switchWorld = turn.switched ? switchedWorldOf(turn, turn.switched) : world;
  const before: TraitRuntimeState = {
    stats: [...turn.stats],
    traits: [...turn.ownerTraits.acquired],
    disabledTraitIds: [...turn.ownerTraits.disabledTraitIds],
    appliedValues: turn.ownerTraits.appliedValues,
    cascadeOffTraitIds: turn.ownerTraits.cascadeOffTraitIds,
    ownedTraits: turn.ownerTraits.ownedTraits,
    entityStats: Object.fromEntries((turn.owners ?? []).map((owner) => [owner.id, [...owner.stats]])),
  };
  // A trait's scripts run while it is active (Q3). A global pick reads the world's current trait, not its stored copy,
  // and runs in the world's tree order, not pick order (Q38).
  const force = traitForceScope(before, world);
  const authored = new Map(world.traits.map((trait) => [trait.id, trait]));
  const inForce = scriptTraits(timing, turn.switched, {
    global: inAuthoredOrder(force.global.map((trait) => authored.get(trait.id) ?? trait), traitOrderIndex(world.traits, world.groups)),
    owners: force.owners,
  }, switchWorld);
  const globalRun = ownerRun(globalTurn, timing, placeholderDefs, turn.worldScripts, inForce.global);
  const entityRuns = (turn.owners ?? []).map((owner) => ownerRun(owner, timing, placeholderDefs, [], inForce.owners[owner.id]));
  // An owner with no stats of its own still runs its traits' scripts, in owner order: ahead of the next owner
  // with stats in the played-first owner list, the owners that hold no trait last.
  const withStats = new Set(entityRuns.map((run) => run.owner.id));
  const order = [...new Set([...Object.keys(inForce.owners), ...withStats])];
  const ahead = new Map<string, OwnerRun[]>();
  let waiting: OwnerRun[] = [];
  for (const id of order) {
    if (withStats.has(id)) {
      if (waiting.length) ahead.set(id, waiting);
      waiting = [];
      continue;
    }
    const run = ownerRun({ id, stats: [], enabled: {}, previous: [], regenApplied: {} }, timing, placeholderDefs, [], inForce.owners[id]);
    if (run.units.length) waiting.push(run);
  }
  const ownerRuns = [...entityRuns.flatMap((run) => [...ahead.get(run.owner.id) ?? [], run]), ...waiting];
  const runs: OwnerRun[] = [globalRun, ...ownerRuns];
  if (turn.triggersOnly) for (const run of runs) run.units = [];
  /** A World Tool call's unit on the global run. */
  const toolUnit = (name: string, code: string, rest: Pick<ScriptUnit, 'args' | 'writes'>): { unit: ScriptUnit; run: OwnerRun } => ({
    unit: { stat: null, script: { id: `tool:${name}`, name, timing, code }, ...rest }, run: globalRun,
  });
  const triggers = (turn.triggers ?? []).map(({ name, code, args }) => toolUnit(name, code, { args }));
  const replayed = (turn.replayed ?? []).map(({ name, writes }) => toolUnit(name, '', { writes: scriptWritesOf(writes) }));
  const anyCoded = replayed.length > 0 || triggers.length > 0 || runs.some((run) => run.units.length);
  const gateStatsAt = (mainStats: PlayerStat[], ownerStats: EntityStatValues): GateStats => {
    const live = gateStatsOf({ ...before, stats: mainStats, entityStats: ownerStats }, world);
    return { global: live.global, owners: { ...turn.gateStats?.owners, ...live.owners } };
  };
  // Resolved once, so every stat's code reads the same placeholders and the same traits.
  const readOwnerTraits = anyCoded
    ? { ...turn.ownerTraits, world: { ...world, gateStats: gateStatsAt([...turn.stats], before.entityStats ?? {}) } }
    : turn.ownerTraits;
  const traits = anyCoded ? sandboxTraits(readOwnerTraits, placeholderDefs) : [];
  const cast = anyCoded ? codeEntities(readOwnerTraits, placeholderDefs) : null;
  // The library's pools join the run as the session's Placeholder Set joins them.
  const placeholderSet = turn.placeholders && withLibraryPlaceholders(withBooksInPlay(turn.placeholders), turn.ownerTraits.library ?? []);
  const sandbox = anyCoded && placeholderSet ? sandboxPlaceholders(placeholderSet) : null;
  const placeholders = sandbox?.top ?? [];
  // The first run is the global one; every other run is an entity's, which reads the global stats as `stats`.
  const ownerStats = ({ named, inputs, owner }: OwnerRun): SandboxStats => ({ stats: named, turn: inputs, enabled: owner.enabled });
  const globalStats = ownerStats(globalRun);
  const runOf = new Map(entityRuns.map((run) => [run.owner.id, run]));
  const inPlay = cast && withEntityFields(cast, (id) => {
    const node = sandbox?.owners.get(id);
    const run = runOf.get(id);
    return {
      ...(node ? { placeholders: node } : {}),
      ...(run ? { stats: ownerStats(run) } : {}),
    };
  });
  /** A run's `owner`: its entity as `entities` holds it, else an entry of its own; none for the global run. */
  const ownerEntryOf = (run: OwnerRun): CodeEntity | undefined => {
    const { id } = run.owner;
    if (id === null) return undefined;
    return inPlay?.entities.find((entity) => entity.id === id)
      ?? { id, name: '', type: '', pronouns: '', inScene: false, traits: [], stats: ownerStats(run) };
  };
  const ownerEntries = new Map(runs.map((run) => [run, ownerEntryOf(run)]));
  const places = turn.places && codePlaces(turn.places, placeholderDefs);
  const discovered = turn.discovered && codePlaces({ locations: turn.discovered, location: null }, placeholderDefs).locations;
  const dictionaries = sandboxDictionaries(codeDictionaries(placeholderSet?.dictionaries, placeholderDefs), sandbox?.owners);
  /** A script's name in the logs: its stat's or trait's, else its own name or the world-and-timing fallback. */
  const whoRan = ({ stat, trait, script, args }: ScriptUnit) => (stat ? `Stat ${stat.name}`
    : trait ? `Trait ${trait.name}` : `${args ? 'Tool' : 'Script'} ${scriptLabel(script, WORLD_OWNER)}`);
  /** A trait script's `self`: its trait's entry where its owner's map holds it. */
  const selfTraitOf = (trait: Trait, owner: CodeEntity | undefined): SandboxTrait | undefined =>
    (owner ? owner.traits : traits).find((entry) => entry.id === trait.id);
  const switchedTrait = timing === 'switch' && turn.switched ? switchedTraitEntry(turn.switched, traits, inPlay, switchWorld, placeholderDefs) : undefined;
  // Run order: the replayed writes, the triggers, then ordered scripts, then owner order and stat order, so the
  // later write wins.
  const ordered: { unit: ScriptUnit; run: OwnerRun }[] = [
    ...replayed, ...triggers, ...inRunOrder(runs.flatMap((run) => run.units.map((unit) => ({ unit, run, script: unit.script })))),
  ];
  // The sentence a During AI Output run hands from one script to the next.
  let sentence = timing === 'output' ? turn.narration?.sentence : undefined;
  let reply: TriggerReply | undefined;
  const runUnit = async ({ unit, run }: (typeof ordered)[number]) => {
    // A replayed unit holds its saved writes already and runs no script.
    if (unit.writes) return;
    const { stat, trait, script, args } = unit;
    const owner = ownerEntries.get(run);
    const selfTrait = trait && selfTraitOf(trait, owner);
    const result = await executeStatCode(script.code, [...globalStats.stats], stat, {
      clock: turn.clock, turn: globalStats.turn, enabled: globalStats.enabled, placeholders, traits, ...inPlay,
      owner, dictionaries, prompts: turn.prompts, places, discovered,
      ...(sentence === undefined || !turn.narration ? {} : { narration: { ...turn.narration, sentence } }),
      ...(selfTrait && { selfTrait }), ...(switchedTrait && { switchedTrait }), ...(args && { args }),
    });
    const first = args && unit === triggers[0]?.unit;
    if (result.error) {
      console.error(`Error executing code for ${whoRan(unit)}${args ? '' : ` (${SCRIPT_TIMING_LABEL[script.timing]})`}:`, result.error);
      if (first) reply = { error: result.error };
      return;
    }
    if (first) reply = { text: result.reply ?? null };
    if (result.sentence !== undefined) sentence = result.sentence;
    unit.writes = {
      stats: targetWrites(stat, result, run.owner.id),
      placeholders: result.placeholders ?? [],
      ...(result.traits || result.entities ? { traits: { world: result.traits ?? [], entities: result.entities ?? [] } } : {}),
      ...(result.worldWrites ? { world: result.worldWrites } : {}),
    };
    warnDroppedWrites(whoRan(unit), result);
  };
  // A sentence chains through its scripts, so they run one after the other; every other timing runs them together.
  if (timing === 'output') for (const entry of ordered) await runUnit(entry);
  else await Promise.all(ordered.map(runUnit));
  const inOrder = ordered.map(({ unit, run }) => ({ ...unit, owner: ownerEntries.get(run) }));
  const pinWrites = pinWritesInRunOrder(inOrder.map(({ writes }) => writes?.placeholders ?? []));
  const worldWrites = mergedWorldWrites(inOrder.map(({ writes }) => writes?.world));
  const firstWrites = triggers[0]?.unit.writes;
  const withWorld = {
    ...(worldWrites ? { worldWrites } : {}), ...(reply ? { reply } : {}),
    ...(firstWrites ? { triggerWrites: savedWrites(firstWrites) } : {}),
  };

  // Merged per target before the first settle, so the gate snapshot and the penalties see every owner's writes.
  const byOwner = statWritesByOwner(inOrder.map(({ writes }) => writes));
  const mainWrites = byOwner.get(null) ?? new Map<string, SettledWrite>();
  const ownerWrites = new Map(entityRuns.map(({ owner }) => [owner.id, byOwner.get(owner.id) ?? new Map<string, SettledWrite>()]));
  // The snapshot every settle below reads: the code writes landed with no switch yet, then the penalties.
  const landedMain = withPenalties(
    settleWrites(turn.stats, turn.stats, mainWrites, ownerStatTraitsInForce(before, world, null)), turn.penalties,
  );
  const landedOwners = Object.fromEntries(entityRuns.map(({ owner }) => [owner.id, settleWrites(
    owner.stats, owner.stats, ownerWrites.get(owner.id) ?? new Map(), ownerStatTraitsInForce(before, world, owner.id),
  ).stats]));
  const gateStats = gateStatsAt(landedMain, landedOwners);

  // Trait switches first, so bounds re-derive under them; the code's own bounds and values then go on top.
  const keyed = inPlay && keyedEntities(inPlay.entities, inPlay.persona);
  // The switch log names the switching stat as the player reads it, or the world script.
  const switches = inOrder.map(({ stat, trait, script, writes, owner }) => ({
    by: stat ? turn.statNameOf(stat) : trait ? turn.traitNameOf(trait) : scriptLabel(script, WORLD_OWNER), written: writes?.traits, owner,
  }));
  const switched = applyCodeTraitSwitches(
    before,
    traitSwitchesInRunOrder(switches, turn.ownerTraits, keyed, placeholderDefs),
    { ...world, gateStats }, turn.traitNameOf,
  );
  const active = ownerStatTraitsInForce(switched.state, world, null);
  const traitResult: StatCodeTraitResult | undefined = switched.state === before ? undefined : {
    acquired: switched.state.traits,
    disabledTraitIds: switched.state.disabledTraitIds,
    appliedValues: switched.state.appliedValues,
    cascadeOffTraitIds: switched.state.cascadeOffTraitIds ?? {},
    ownedTraits: switched.state.ownedTraits ?? {},
    inForce: active,
    log: switched.log,
    logTraits: switched.logTraits,
  };

  const owners = turn.owners && Object.fromEntries(entityRuns.map(({ owner }): [string, OwnerCodeResult] => {
    const inForce = ownerStatTraitsInForce(switched.state, world, owner.id);
    const result = settleWrites(
      owner.stats, switched.state.entityStats?.[owner.id] ?? owner.stats, ownerWrites.get(owner.id) ?? new Map(), inForce,
    );
    const settled = result.moved.length || result.boundsChanged.length ? result : { ...result, stats: owner.stats };
    return [owner.id, traitResult ? { ...settled, inForce } : settled];
  }));
  const withOwners = owners ? { owners } : {};
  const withSentence = sentence === undefined ? {} : { sentence };
  const { stats, moved, boundsChanged } = settleWrites(turn.stats, switched.state.stats, mainWrites, active);
  if (!traitResult && moved.length === 0 && boundsChanged.length === 0) {
    return { stats: turn.stats, moved, boundsChanged, pinWrites, gateStats, ...withOwners, ...withSentence, ...withWorld };
  }
  return {
    stats, moved, boundsChanged, pinWrites, gateStats, ...(traitResult ? { traits: traitResult } : {}), ...withOwners, ...withSentence,
    ...withWorld,
  };
}

/** The landed stats with each penalty taken from a stat the run left unmoved, clamped into its bounds. A stat
 *  the code moved keeps the code's value, as the overlay keeps it over a penalty applied meanwhile. */
function withPenalties(
  landed: { stats: PlayerStat[]; moved: readonly string[] }, penalties: StatCodeTurn['penalties'],
): PlayerStat[] {
  if (!penalties) return landed.stats;
  return landed.stats.map((stat) => {
    const loss = penalties[stat.id];
    if (loss === undefined || landed.moved.includes(stat.id)) return stat;
    return { ...stat, value: clamp(stat.value - loss, stat.min, stat.max) };
  });
}

/** `current` with an owner's code writes laid on, re-derived under `active`. A bound write books its
 *  difference from the bound `active` derives into the code delta. `start` is the stats the run read, in
 *  the same order, which `moved` compares against. */
function settleWrites(
  start: readonly PlayerStat[],
  current: readonly PlayerStat[],
  writes: ReadonlyMap<string, SettledWrite>,
  active: readonly Trait[],
): { stats: PlayerStat[]; moved: string[]; boundsChanged: string[] } {
  const moved: string[] = [];
  const boundsChanged: string[] = [];
  const stats = current.map((stat, i) => {
    const write = writes.get(stat.id);
    const codeDelta = write?.bounds && codeDeltaFor(stat, write.bounds, active);
    // A value-only write keeps the bounds as they stand, which a trait switch may have moved.
    const next = !write ? stat
      : !codeDelta ? { ...stat, value: clamp(write.value ?? stat.value, stat.min, stat.max) }
        : withCodeDelta(stat, codeDelta, write.value ?? stat.value, active);
    if (codeDelta && !sameCodeDelta(codeDelta, stat.codeDelta)) boundsChanged.push(stat.id);
    if (next.value !== start[i].value) moved.push(stat.id);
    return next.value === stat.value && !boundsChanged.includes(stat.id) ? stat : next;
  });
  return { stats, moved, boundsChanged };
}

/** `places` under the code names scripts reach them by. */
function codePlaces({ locations, location }: SandboxPlaces, placeholders: readonly Placeholder[]): SandboxPlaces {
  const coded = (place: SandboxPlace): SandboxPlace => ({ id: place.id, name: statCodeName(place.name, placeholders) });
  return { locations: locations.map(coded), location: location && coded(location) };
}

/** The entities with the fields `fieldsOf` gives each one laid on, `persona` still one of them. */
function withEntityFields(cast: CodeEntities, fieldsOf: (id: string) => Partial<CodeEntity>): CodeEntities {
  const entities = cast.entities.map((entity) => {
    const fields = fieldsOf(entity.id);
    return Object.keys(fields).length ? { ...entity, ...fields } : entity;
  });
  return { entities, persona: entities.find((entity) => cast.persona.id && entity.id === cast.persona.id) ?? cast.persona };
}

/** One stat's switches: through `traits`, then through each entity's `traits`. */
interface StatTraitWrites {
  world: readonly TraitWrite[];
  entities: readonly EntityTraitWrites[];
}

/** Each script's trait switches keyed by owner and trait, in run order: the later script wins, and its switch
 *  applies at that script's position. A name resolves to the last trait with it, as the sandbox map does. */
function traitSwitchesInRunOrder(
  /** `owner` is the writing script's owner, which a row through `owner` alone switches; `by` names the script
   *  in the log line. */
  inOrder: readonly { by: string; written: StatTraitWrites | undefined; owner: CodeEntity | undefined }[],
  ownerTraits: StatCodeOwners,
  inPlay: KeyedEntities<CodeEntity> | null,
  placeholders: readonly Placeholder[],
): CodeTraitSwitch[] {
  const idByName = new Map(ownerTraits.world.traits.map((trait) => [statCodeName(trait.name, placeholders), trait.id]));
  const out = new Map<string, CodeTraitSwitch>();
  const setLast = (key: string, at: CodeTraitSwitch) => {
    out.delete(key);
    out.set(key, at);
  };
  for (const { by, written, owner } of inOrder) {
    for (const write of written?.world ?? []) {
      const traitId = idByName.get(write.name);
      if (traitId !== undefined) setLast(traitId, { traitId, enabled: write.enabled, by });
    }
    for (const { entity: name, owner: viaOwner, traits: switched = [] } of written?.entities ?? []) {
      // An empty name is `persona`, which an unnamed persona entity can still be.
      const entity = viaOwner ? owner : name ? inPlay?.byName.get(name) : inPlay?.persona;
      if (!entity?.id) continue;
      const idByTraitName = new Map(entity.traits.map((trait) => [trait.name, trait.id]));
      for (const write of switched) {
        const traitId = idByTraitName.get(write.name);
        if (traitId !== undefined) {
          setLast(recordKey(entity.id, traitId), { traitId, enabled: write.enabled, by, ownerId: entity.id });
        }
      }
    }
  }
  return [...out.values()];
}

/** Each script's placeholder writes keyed by placeholder id, laid in run order so the later script wins. Each
 *  write already names the placeholder it landed on, whichever path the code reached it by. */
function pinWritesInRunOrder(inOrder: readonly (readonly PlaceholderWrite[])[]): PinWrites {
  const out: Record<string, string | string[] | null> = {};
  for (const writes of inOrder) {
    for (const write of writes) {
      out[write.id] = 'unpin' in write ? null : write.value;
    }
  }
  return out;
}
