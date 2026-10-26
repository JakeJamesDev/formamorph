import type {
  CascadeOffTraitIds, CodeBounds, CodePins, Connection, Dictionary, Entity, EntityPositions, EntityStatValues, GameLocation, LoreToggles, OwnedTraitStates,
  Placeholder, PlayerStat, Script, Trait,
} from '@/types';
import { bareLoreWrite, withLoreWrites, type LoreWrite } from './loreToggles';
import {
  CODE_BOUND_FIELDS, type EntityTraitWrites, type NarrationInput, type PlaceholderWrite, type StatClock, type StatCodeResult,
  type StatTurnInputs, type StatWrite, type SandboxTurn, type TraitWrite, type ValueAndMax, type SandboxMemory, type SandboxPlace, type WorldWrites,
} from './statCodeExecutor';
import { mergeWorldWrites } from './worldWrites';
import { statCodeNamed } from './statCodeNames';
import type { StatCodePlaceholderSet } from './statCodePlaceholders';
import { recordKey } from './ownedTraitState';
import type { StatCodeOwners } from './statCodeTraits';
import {
  applyCodeTraitSwitches, codeDeltaFor, gateStatsOf, ownerStatTraitsInForce, sameCodeDelta, sameHidden, traitForceScope, traitSwitchEvents, withCodeDelta,
  type AppliedTraitValues, type CodeTraitSwitch, type TraitForceState, type TraitSwitchEvent, type TraitWorld,
} from './traitRuntime';
import {
  runtimeStateOf, snapshotOf, switchedTraitOf, withStateGateStats, type TraitSwitchWrite, type UnitHome,
} from './sandboxSnapshot';
import type { GateStats } from './traitGates';
import { readsTurnStart, type RunTiming } from './statCodeTiming';
import { filledScriptsAt, inRunOrder, SCRIPT_TIMING_LABEL, scriptLabel } from './scripts';
import { inAuthoredOrder, traitOrderIndex } from './traitEffects';
import { clamp } from './utils';
import type { OwnerId, Scoped } from './scope';
import { silentPrompts, type ScriptPromptHost } from './scriptPrompts';
import { sameChoices } from './scriptedChoices';

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

/** The world's locations as authored, and where the turn stands. */
export interface StatePlaces {
  locations: readonly Pick<GameLocation, 'id' | 'name' | 'aiDescription' | 'aiSummary' | 'isStarting' | 'parentId'>[];
  location: SandboxPlace | null;
  /** The world's Connections, which the exits read as the router does. Absent ⇒ none. */
  connections?: readonly Connection[];
}

/** Authored text as the AI reads it: chips resolved, an entity's own against that entity. */
export type ResolveText = (text: string, owner: Entity | null) => string;

/** The world a script runs against, as the turn found it: everything but what this turn alone brings. */
export interface SandboxState {
  /** Every global stat as the turn's pipeline left it: AI asks and regen applied, code not yet run. Names are
   *  the authored ones, chips and all — code reads each stat's code name, derived here. */
  stats: readonly PlayerStat[];
  /** The live stat-enabled map. A disabled stat's code never runs; other code reads it with `enabled: false`. */
  enabled: Readonly<Record<string, boolean>>;
  /** The entities whose stats also run this turn, in owner order: world entities in authored order, then
   *  library entities in pick order. */
  owners?: readonly OwnerState[];
  /** Every owner's stats as gates read them at the turn's start; the run lays its owners' stats over them.
   *  Absent ⇒ gates read only the run's owners. */
  gateStats?: GateStats;
  /** What `traits`, `entities` and `persona` read and switch. Bounds re-derive under the ones in force. */
  ownerTraits: StatCodeOwners;
  /** What `placeholders`, each owner entry's `placeholders` and `dictionaries` read. Absent, all are empty. */
  placeholders?: StatCodePlaceholderSet;
  /** The world's locations, authored names and text and all, and where the turn stands. Absent, code names none. */
  places?: StatePlaces;
  /** Where each entity with a runtime position stands, by entity id. Absent ⇒ none has one. */
  positions?: Readonly<EntityPositions>;
  /** The ids of the entities following the player. Absent ⇒ none. */
  followers?: readonly string[];
  /** Absent, text reads as authored. */
  resolveText?: ResolveText;
  /** The story clock: the hours this turn consumed, the hours elapsed, and the calendar. */
  clock: StatClock;
  /** The Memory panel's rows as the turn began, oldest first; between turns, as they stand. Absent, `memories` is
   *  empty, as in the editor. */
  memories?: readonly SandboxMemory[];
  /** The player's notes. Absent, `notes` is empty, as in the editor. */
  notes?: string;
  /** What `turn` reads. Absent, an empty action at turn 0. */
  turn?: SandboxTurn;
  /** What scripts switched on the books' entries in play. Absent ⇒ none. */
  loreToggles?: LoreToggles;
}

/** One entity owner's stats in the state, in the same terms as the global ones. */
export interface OwnerState extends Pick<SandboxState, 'stats' | 'enabled'> {
  /** The owner entity's id. */
  id: string;
}

/** One entity owner's part of this turn alone, in the same terms as the turn owner's. */
export interface OwnerTurn extends Pick<StatCodeTurn, 'previous' | 'regenApplied'> {
  /** Absent ⇒ none. */
  asks?: StatCodeTurn['asks'];
}

/** Everything one turn hands to stat code: the state, and what this turn alone brings. The forward turn and
 *  the re-roll both build one of these; a turn with no stat response builds one with no asks. Every script
 *  reads one snapshot: the global stats as `stats`, its owner's as `owner.stats`, and each one's as
 *  `entities[x].stats`. Writes land in run order: scripts with an `order` ascending, then the world's, then
 *  owner order and stat order; the later write wins a field. */
export interface StatCodeTurn {
  state: SandboxState;
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
  /** The global stats as they stood at the start of the turn, matched by id. A stat missing here reads its
   *  `previous` as a copy of its own current entry. */
  previous: readonly PlayerStat[];
  /** This turn's AI asks, raw: before flags and clamping. */
  asks: readonly (ValueAndMax & { id: string })[];
  /** Regen applied this turn, by stat id. */
  regenApplied: Readonly<Record<string, number>>;
  /** Each entity owner's part of this turn, by owner id. An owner missing here reads its `previous` as its
   *  own stats, with no asks and no regen. */
  ownerTurns?: Readonly<Record<string, OwnerTurn>>;
  /** A stat's name as the player reads it, for the turn log. Required, not defaulted: a caller that left
   *  it out would print an unresolved chip token in a line the player reads. */
  statNameOf: (stat: PlayerStat) => string;
  /** A trait's name as the player reads it, for the trait switch log. Required for the same reason
   *  `statNameOf` is; code reaches the trait by its code name, which the turn derives itself. */
  traitNameOf: (trait: Trait) => string;
  /** Stat id → the value a penalty takes from the turn owner's stat after the run, unless code moves that stat:
   *  the starvation penalty. */
  penalties?: Readonly<Record<string, number>>;
  /** Who answers `player.*`. Absent, the game's prompt store does. */
  prompts?: ScriptPromptHost;
  /** World Tool calls that run ahead of every script of the timing, in this order (Q4). Absent ⇒ none. */
  triggers?: readonly ScriptTrigger[];
  /** Runs `triggers` and `replayed` alone, as an On Call Tool does. */
  triggersOnly?: boolean;
  /** Runs the scripts alone, as Re-generate Choices does: `choices` is the one thing the result carries, and every
   *  `player` call answers through {@link silentPrompts} (Q10, Q20). */
  choicesOnly?: boolean;
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
  /** Absent ⇒ none (Q50). */
  lore?: LoreWrite[];
}

/** A World Tool call replayed from its saved writes: the Tool's name, for the switch log, and the writes. */
export interface ReplayedTrigger {
  name: string;
  writes: SavedScriptWrites;
}

/** What the run's first trigger answered: its return value as text, or why it failed. */
export type TriggerReply = { text: string | null } | { error: string };

/** One entity owner's stats and its part of this turn, as play assembles them. */
export type OwnerCodeTurn = OwnerState & OwnerTurn;

/** Owner rows split into the board's part and this turn's part, by owner id. */
export function splitOwnerTurns(rows: readonly OwnerCodeTurn[]): { owners: OwnerState[]; ownerTurns: Record<string, OwnerTurn> } {
  return {
    owners: rows.map(({ id, stats, enabled }) => ({ id, stats, enabled })),
    ownerTurns: Object.fromEntries(rows.map(({ id, previous, regenApplied, asks }) => [id, { previous, regenApplied, ...(asks ? { asks } : {}) }])),
  };
}

/** What one entity owner's code and the run's trait switches did to its stats. */
export type OwnerCodeResult = Pick<StatCodeTurnResult, 'stats' | 'moved' | 'boundsChanged' | 'hiddenChanged'> & {
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
  /** Ids of the stats the run hid or showed, in stat order. */
  hiddenChanged: string[];
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
  /** The `turn.choices` an `after` run's scripts left, in run order. Absent when none changed it. */
  choices?: readonly string[];
  /** The run's location, clock and discovery writes, merged in run order. Absent when no script wrote one. */
  worldWrites?: WorldWrites;
  /** Every entry field the run's scripts wrote, in run order, so the later write wins. Absent when none wrote one. */
  loreWrites?: LoreWrite[];
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
 *  only a value the run moved, the code delta it changed and the `hidden` it flipped apply, re-derived
 *  onto the latest bases. After a trait switch every stat re-derives, under the traits the switch left in force. */
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
    const withHidden = run && result.hiddenChanged.includes(stat.id) ? { ...stat, hidden: run.hidden === true } : stat;
    if (run && result.boundsChanged.includes(stat.id)) return withCodeDelta(withHidden, run.codeDelta, value, inForce);
    if (switched) return withCodeDelta(withHidden, stat.codeDelta, value, inForce);
    return value === stat.value ? withHidden : { ...withHidden, value };
  });
}

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
  unknownLore: 'wrote dictionary entries the game does not have',
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
  home: UnitHome;
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
  lore?: readonly LoreWrite[];
}

/** One stat's fields a box wrote. */
type TargetWrite = Pick<StatWrite, 'id' | 'value' | keyof CodeBounds | 'hidden'>;

/** A target's merged write, as `settleWrites` lays it on. */
type SettledWrite = { value: number | null; bounds: CodeBounds | null; hidden: boolean | null };

/** What one run wrote, by target scope: its own stat first, under `ownerId`; its `stats` writes under global
 *  scope; then each entity's. A world script has no stat of its own. */
function targetWrites(stat: PlayerStat | null, result: StatCodeResult, ownerId: OwnerId): Map<OwnerId, TargetWrite[]> {
  const out = new Map<OwnerId, TargetWrite[]>();
  const add = (id: OwnerId, writes: readonly TargetWrite[] = []) => {
    if (writes.length) out.set(id, [...out.get(id) ?? [], ...writes]);
  };
  if (stat && (result.value !== null || result.bounds || result.hidden !== undefined)) {
    add(ownerId, [{
      id: stat.id, ...result.bounds, ...(result.value === null ? {} : { value: result.value }),
      ...(result.hidden === undefined ? {} : { hidden: result.hidden }),
    }]);
  }
  add(null, result.statWrites);
  for (const row of result.ownerStatWrites ?? []) add(row.ownerId, row.writes);
  return out;
}

/** `writes` as a save keeps them; empty fields are left out. */
function savedWrites({ stats, placeholders, traits, lore }: ScriptWrites): SavedScriptWrites {
  return {
    ...(stats.size ? { stats: [...stats].map(([owner, writes]) => ({ owner, writes: [...writes] })) } : {}),
    ...(placeholders.length ? { placeholders: [...placeholders] } : {}),
    ...(traits ? { traits } : {}),
    ...(lore?.length ? { lore: [...lore] } : {}),
  };
}

/** Saved writes as a run lays them on. */
const scriptWritesOf = ({ stats = [], placeholders = [], traits, lore }: SavedScriptWrites): ScriptWrites => ({
  stats: new Map(stats.map(({ owner, writes }) => [owner, writes])), placeholders, ...(traits ? { traits } : {}), ...(lore ? { lore } : {}),
});

/** Each target scope's writes, each target stat's merged field by field in run order, the later script
 *  winning a field. */
function statWritesByOwner(writers: readonly (ScriptWrites | undefined)[]): Map<OwnerId, Map<string, SettledWrite>> {
  const out = new Map<OwnerId, Map<string, SettledWrite>>();
  for (const writes of writers) {
    for (const [ownerId, targets] of writes?.stats ?? []) {
      const owner = out.get(ownerId) ?? new Map<string, SettledWrite>();
      out.set(ownerId, owner);
      for (const { id, value, hidden, ...bounds } of targets) {
        const at = owner.get(id) ?? { value: null, bounds: null, hidden: null };
        const written = Object.fromEntries(CODE_BOUND_FIELDS.flatMap((field) => (bounds[field] === undefined ? [] : [[field, bounds[field]]])));
        owner.set(id, {
          value: value ?? at.value,
          bounds: Object.keys(written).length ? { ...at.bounds, ...written } : at.bounds,
          hidden: hidden ?? at.hidden,
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
  const statHome = (stat: PlayerStat): UnitHome =>
    (owner.id === null ? { kind: 'globalStat', stat } : { kind: 'entityStat', entityId: owner.id, stat });
  const units: ScriptUnit[] = [
    ...filledScriptsAt({ scripts: worldScripts }, timing).map((script): ScriptUnit => ({ home: { kind: 'world' }, stat: null, script })),
    ...named.filter((stat) => owner.enabled[stat.id] !== false)
      .flatMap((stat) => filledScriptsAt(stat, timing).map((script): ScriptUnit => ({ home: statHome(stat), stat, script }))),
    ...traits.flatMap((trait) => filledScriptsAt(trait, timing)
      .map((script): ScriptUnit => ({ home: { kind: 'trait', trait, entityId: owner.id }, stat: null, trait, script }))),
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
  const { reply, triggerWrites, choices } = result;
  return {
    ...switched, ...(choices ? { choices } : {}), ...(reply ? { reply, ...(triggerWrites ? { triggerWrites } : {}) } : {}),
  };
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
  traitSwitchEvents(forceStateOf(from), forceStateOf(to), to.state.ownerTraits.world);

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
const forceStateOf = ({ state: { ownerTraits } }: StatCodeTurn): TraitForceState => ({
  traits: ownerTraits.acquired, disabledTraitIds: ownerTraits.disabledTraitIds, ownedTraits: ownerTraits.ownedTraits,
});

/** `turn` as the next run finds it after `result`: the stats, traits and pins the run left. */
export function afterRun(turn: StatCodeTurn, result: StatCodeTurnResult): StatCodeTurn {
  const { traits } = result;
  const { state } = turn;
  const ownerTraits = !traits ? state.ownerTraits : {
    ...state.ownerTraits,
    acquired: traits.acquired,
    disabledTraitIds: traits.disabledTraitIds,
    appliedValues: traits.appliedValues,
    cascadeOffTraitIds: traits.cascadeOffTraitIds,
    ownedTraits: traits.ownedTraits,
  };
  const set = state.placeholders;
  const codePins = withPinWrites(set?.codePins ?? {}, result.pinWrites);
  const pins = set?.pinsAfter?.({
    codePins, acquired: ownerTraits.acquired, disabledTraitIds: ownerTraits.disabledTraitIds, ownedTraits: ownerTraits.ownedTraits,
    stats: result.stats,
  });
  return {
    ...turn,
    state: {
      ...state,
      stats: result.stats,
      gateStats: result.gateStats,
      owners: state.owners?.map((owner) => {
        const ran = result.owners?.[owner.id];
        return ran ? { ...owner, stats: ran.stats } : owner;
      }),
      ownerTraits,
      placeholders: set && { ...set, codePins, ...(pins ? { pins } : {}) },
      ...(result.loreWrites ? { loreToggles: withLoreWrites(state.loreToggles ?? {}, result.loreWrites) } : {}),
      // The switch runs read the choices the batch left.
      ...(result.choices && state.turn ? { turn: { ...state.turn, choices: result.choices } } : {}),
    },
  };
}

/** The stat ids a run changed: its value, its code delta, or its `hidden`. */
export type ChangedStats = Pick<StatCodeTurnResult, 'moved' | 'boundsChanged' | 'hiddenChanged'>;

/** Whether a run changed any stat. */
export const changedAnyStat = ({ moved, boundsChanged, hiddenChanged }: ChangedStats): boolean =>
  moved.length > 0 || boundsChanged.length > 0 || hiddenChanged.length > 0;

/** The ids of the stats in `now` whose value, code delta or `hidden` differs from `start`, matched by id. */
function changedStats(start: readonly PlayerStat[], now: readonly PlayerStat[]): ChangedStats {
  const was = new Map(start.map((stat) => [stat.id, stat]));
  const moved: string[] = [];
  const boundsChanged: string[] = [];
  const hiddenChanged: string[] = [];
  for (const stat of now) {
    const before = was.get(stat.id);
    if (!before) continue;
    if (stat.value !== before.value) moved.push(stat.id);
    if (!sameCodeDelta(before.codeDelta, stat.codeDelta)) boundsChanged.push(stat.id);
    if (!sameHidden(before, stat)) hiddenChanged.push(stat.id);
  }
  return { moved, boundsChanged, hiddenChanged };
}

/** Runs chained from `start` to `now`, one after the other, as one run's result over `start`. The later step
 *  wins a pin. */
export function chainedResult(start: StatCodeTurn, steps: readonly StatCodeTurnResult[], now: StatCodeTurn): StatCodeTurnResult {
  const finalStep = steps.at(-1);
  if (!finalStep) throw new Error('A chained result needs a step');
  const pinWrites: PinWrites = Object.assign({}, ...steps.map((step) => step.pinWrites));
  const worldWrites = mergedWorldWrites(steps.map((step) => step.worldWrites));
  const loreWrites = steps.flatMap((step) => step.loreWrites ?? []);
  const last = steps.findLast((step) => step.traits)?.traits;
  const logs = steps.map((step) => step.traits?.log ?? []);
  const traits: StatCodeTraitResult | undefined = last && {
    ...last, log: logs.flat(),
    logTraits: steps.flatMap((step, i) => step.traits?.logTraits ?? logs[i].map(() => null)),
  };
  const owners = start.state.owners && Object.fromEntries(start.state.owners.map((owner): [string, OwnerCodeResult] => {
    const after = now.state.owners?.find((ran) => ran.id === owner.id) ?? owner;
    const inForce = steps.findLast((step) => step.owners?.[owner.id]?.inForce)?.owners?.[owner.id]?.inForce;
    return [owner.id, { stats: after.stats, ...changedStats(owner.stats, after.stats), ...(inForce ? { inForce } : {}) }];
  }));
  return {
    stats: now.state.stats, ...changedStats(start.state.stats, now.state.stats), pinWrites, gateStats: finalStep.gateStats,
    ...(traits ? { traits } : {}), ...(owners ? { owners } : {}), ...(worldWrites ? { worldWrites } : {}),
    ...(loreWrites.length ? { loreWrites } : {}),
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

/** The world a switch's trait reads: a switch-off's is the one it held under. */
const switchedWorldOf = (turn: StatCodeTurn, switched: TraitSwitchEvent): TraitWorld =>
  (!switched.enabled && turn.switchedFrom && switchedTraitOf(switched, turn.switchedFrom) ? turn.switchedFrom : turn.state.ownerTraits.world);

/** Run one timing's scripts over one turn in the sandbox: the world's and every owner's enabled stats', in
 *  parallel over one snapshot. A failing script is logged and writes nothing. */
async function runScripts(turn: StatCodeTurn): Promise<StatCodeTurnResult> {
  const { state } = turn;
  const timing = turn.timing ?? 'after';
  const placeholderDefs = state.placeholders?.placeholders ?? [];
  const globalTurn: RunOwner = {
    id: null, stats: state.stats, enabled: state.enabled, previous: turn.previous,
    asks: turn.asks, regenApplied: turn.regenApplied,
  };
  const world = state.ownerTraits.world;
  const switchWorld = turn.switched ? switchedWorldOf(turn, turn.switched) : world;
  const before = runtimeStateOf(state);
  // A trait's scripts run while it is active (Q3). A global pick reads the world's current trait, not its stored copy,
  // and runs in the world's tree order, not pick order (Q38).
  const force = traitForceScope(before, world);
  const authored = new Map(world.traits.map((trait) => [trait.id, trait]));
  const inForce = scriptTraits(timing, turn.switched, {
    global: inAuthoredOrder(force.global.map((trait) => authored.get(trait.id) ?? trait), traitOrderIndex(world.traits, world.groups)),
    owners: force.owners,
  }, switchWorld);
  const globalRun = ownerRun(globalTurn, timing, placeholderDefs, turn.worldScripts, inForce.global);
  const entityRuns = (state.owners ?? []).map((owner) => ownerRun(
    { ...owner, ...turn.ownerTurns?.[owner.id] ?? { previous: owner.stats, regenApplied: {} } },
    timing, placeholderDefs, [], inForce.owners[owner.id],
  ));
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
    unit: { home: { kind: 'tool' }, stat: null, script: { id: `tool:${name}`, name, timing, code }, ...rest }, run: globalRun,
  });
  // A choices-only run runs no World Tool: its choice writes drop (Q21), and nothing else it writes lands.
  const triggers = (turn.choicesOnly ? [] : turn.triggers ?? []).map(({ name, code, args }) => toolUnit(name, code, { args }));
  const replayed = (turn.choicesOnly ? [] : turn.replayed ?? []).map(({ name, writes }) => toolUnit(name, '', { writes: scriptWritesOf(writes) }));
  const gateStatsAt = (mainStats: PlayerStat[], ownerStats: EntityStatValues): GateStats => {
    return withStateGateStats(state, gateStatsOf({ ...before, stats: mainStats, entityStats: ownerStats }, world));
  };
  const snapshot = snapshotOf(state, {
    readings: { global: globalRun.inputs, owners: Object.fromEntries(entityRuns.map((run) => [run.owner.id, run.inputs])) },
  });
  /** A script's name in the logs: its stat's or trait's, else its own name or the world-and-timing fallback. */
  const whoRan = ({ stat, trait, script, args }: ScriptUnit) => (stat ? `Stat ${stat.name}`
    : trait ? `Trait ${trait.name}` : `${args ? 'Tool' : 'Script'} ${scriptLabel(script, WORLD_OWNER)}`);
  const switchInput = timing === 'switch' && turn.switched ? { switched: { event: turn.switched, world: switchWorld } } : {};
  // Run order: the replayed writes, the triggers, then ordered scripts, then owner order and stat order, so the
  // later write wins.
  const ordered: { unit: ScriptUnit; run: OwnerRun }[] = [
    ...replayed, ...triggers, ...inRunOrder(runs.flatMap((run) => run.units.map((unit) => ({ unit, run, script: unit.script })))),
  ];
  // The sentence a During AI Output run hands from one script to the next.
  let sentence = timing === 'output' ? turn.narration?.sentence : undefined;
  // The choices an After the AI script left, which the next one reads (Q14). Unset until a script changes them.
  let choices: readonly string[] | undefined;
  let reply: TriggerReply | undefined;
  const prompts = turn.choicesOnly ? silentPrompts : turn.prompts;
  const runUnit = async ({ unit, run }: (typeof ordered)[number]) => {
    // A replayed unit holds its saved writes already and runs no script.
    if (unit.writes) return;
    const { stat, script, args } = unit;
    const result = await snapshot.run({
      home: unit.home, timing, code: script.code, ...switchInput, ...(args && { args }), ...(prompts && { prompts }),
      ...(sentence === undefined || !turn.narration ? {} : { narration: { ...turn.narration, sentence } }),
      ...(choices && { choices }),
    });
    const first = args && unit === triggers[0]?.unit;
    if (result.error) {
      console.error(`Error executing code for ${whoRan(unit)}${args ? '' : ` (${SCRIPT_TIMING_LABEL[script.timing]})`}:`, result.error);
      if (first) reply = { error: result.error };
      return;
    }
    if (first) reply = { text: result.reply ?? null };
    if (result.sentence !== undefined) sentence = result.sentence;
    if (result.choices) choices = result.choices;
    if (turn.choicesOnly) return;
    unit.writes = {
      stats: targetWrites(stat, result, run.owner.id),
      placeholders: result.placeholders ?? [],
      ...(result.traits || result.entities ? { traits: { world: result.traits ?? [], entities: result.entities ?? [] } } : {}),
      ...(result.worldWrites ? { world: result.worldWrites } : {}),
      ...(result.lore ? { lore: result.lore.map(bareLoreWrite) } : {}),
    };
    warnDroppedWrites(whoRan(unit), result);
  };
  // The sentence and the choices chain, so those timings run their scripts in turn; the rest run together.
  if (timing === 'output' || timing === 'after') for (const entry of ordered) await runUnit(entry);
  else await Promise.all(ordered.map(runUnit));
  const inOrder = ordered.map(({ unit }) => unit);
  const pinWrites = pinWritesInRunOrder(inOrder.map(({ writes }) => writes?.placeholders ?? []));
  const worldWrites = mergedWorldWrites(inOrder.map(({ writes }) => writes?.world));
  const loreWrites = inOrder.flatMap(({ writes }) => writes?.lore ?? []);
  const firstWrites = triggers[0]?.unit.writes;
  const withWorld = {
    ...(worldWrites ? { worldWrites } : {}), ...(loreWrites.length ? { loreWrites } : {}), ...(reply ? { reply } : {}),
    ...(firstWrites ? { triggerWrites: savedWrites(firstWrites) } : {}),
  };

  // Merged per target before the first settle, so the gate snapshot and the penalties see every owner's writes.
  const byOwner = statWritesByOwner(inOrder.map(({ writes }) => writes));
  const mainWrites = byOwner.get(null) ?? new Map<string, SettledWrite>();
  const ownerWrites = new Map(entityRuns.map(({ owner }) => [owner.id, byOwner.get(owner.id) ?? new Map<string, SettledWrite>()]));
  // The snapshot every settle below reads: the code writes landed with no switch yet, then the penalties.
  const landedMain = withPenalties(
    settleWrites(state.stats, state.stats, mainWrites, ownerStatTraitsInForce(before, world, null)), turn.penalties,
  );
  const landedOwners = Object.fromEntries(entityRuns.map(({ owner }) => [owner.id, settleWrites(
    owner.stats, owner.stats, ownerWrites.get(owner.id) ?? new Map(), ownerStatTraitsInForce(before, world, owner.id),
  ).stats]));
  const gateStats = gateStatsAt(landedMain, landedOwners);

  // Trait switches first, so bounds re-derive under them; the code's own bounds and values then go on top.
  // The switch log names the switching stat as the player reads it, or the world script.
  const switches = inOrder.map((unit) => {
    const { stat, trait, script, writes } = unit;
    return {
      by: stat ? turn.statNameOf(stat) : trait ? turn.traitNameOf(trait) : scriptLabel(script, WORLD_OWNER),
      written: writes?.traits ? snapshot.switchesOf(unit, { traits: writes.traits.world, entities: writes.traits.entities }) : [],
    };
  });
  const switched = applyCodeTraitSwitches(
    before,
    traitSwitchesInRunOrder(switches),
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

  const owners = state.owners && Object.fromEntries(entityRuns.map(({ owner }): [string, OwnerCodeResult] => {
    const inForce = ownerStatTraitsInForce(switched.state, world, owner.id);
    const result = settleWrites(
      owner.stats, switched.state.entityStats?.[owner.id] ?? owner.stats, ownerWrites.get(owner.id) ?? new Map(), inForce,
    );
    const settled = changedAnyStat(result) ? result : { ...result, stats: owner.stats };
    return [owner.id, traitResult ? { ...settled, inForce } : settled];
  }));
  const withOwners = owners ? { owners } : {};
  // What the chained scripts left: the sentence, and the choices once a script changed them.
  // Scripts that restore the list between them leave no change.
  const read = state.turn?.choices ?? [];
  const changedChoices = choices && !sameChoices(choices, read) ? { choices } : {};
  const withChained = { ...(sentence === undefined ? {} : { sentence }), ...changedChoices };
  const settledMain = settleWrites(state.stats, switched.state.stats, mainWrites, active);
  const { stats, moved, boundsChanged, hiddenChanged } = settledMain;
  if (!traitResult && !changedAnyStat(settledMain)) {
    return { stats: state.stats, moved, boundsChanged, hiddenChanged, pinWrites, gateStats, ...withOwners, ...withChained, ...withWorld };
  }
  return {
    stats, moved, boundsChanged, hiddenChanged, pinWrites, gateStats, ...(traitResult ? { traits: traitResult } : {}), ...withOwners, ...withChained,
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
): ChangedStats & { stats: PlayerStat[] } {
  const moved: string[] = [];
  const boundsChanged: string[] = [];
  const hiddenChanged: string[] = [];
  const stats = current.map((stat, i) => {
    const write = writes.get(stat.id);
    const codeDelta = write?.bounds && codeDeltaFor(stat, write.bounds, active);
    // A value-only write keeps the bounds as they stand, which a trait switch may have moved.
    const landed = !write ? stat
      : !codeDelta ? { ...stat, value: clamp(write.value ?? stat.value, stat.min, stat.max) }
        : withCodeDelta(stat, codeDelta, write.value ?? stat.value, active);
    const hiddenWrite = write?.hidden ?? null;
    const next = hiddenWrite === null || sameHidden(stat, { hidden: hiddenWrite }) ? landed : { ...landed, hidden: hiddenWrite };
    if (codeDelta && !sameCodeDelta(codeDelta, stat.codeDelta)) boundsChanged.push(stat.id);
    if (next.value !== start[i].value) moved.push(stat.id);
    if (!sameHidden(next, start[i])) hiddenChanged.push(stat.id);
    return next.value === stat.value && !boundsChanged.includes(stat.id) && next.hidden === stat.hidden ? stat : next;
  });
  return { stats, moved, boundsChanged, hiddenChanged };
}
/** One stat's switches: through `traits`, then through each entity's `traits`. */
interface StatTraitWrites {
  world: readonly TraitWrite[];
  entities: readonly EntityTraitWrites[];
}

/** Each script's trait switches keyed by owner and trait, in run order: the later script wins, and its switch
 *  applies at that script's position. `by` names the script in the log line. */
function traitSwitchesInRunOrder(inOrder: readonly { by: string; written: readonly TraitSwitchWrite[] }[]): CodeTraitSwitch[] {
  const out = new Map<string, CodeTraitSwitch>();
  for (const { by, written } of inOrder) {
    for (const { traitId, enabled, ownerId } of written) {
      const key = ownerId === undefined ? traitId : recordKey(ownerId, traitId);
      out.delete(key);
      out.set(key, { traitId, enabled, by, ...(ownerId === undefined ? {} : { ownerId }) });
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
