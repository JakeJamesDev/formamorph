import type {
  CascadeOffTraitIds, CodeBounds, CodePins, Dictionary, EntityStatValues, OwnedTraitStates, Placeholder, PlayerStat, Trait,
} from '@/types';
import {
  CODE_BOUND_FIELDS, executeStatCode, keyedEntities, type EntityTraitWrites, type KeyedEntities, type PlaceholderWrite,
  type SandboxStats, type StatClock, type StatCodeResult, type StatTurnInputs, type StatWrite, type TraitWrite, type ValueAndMax,
} from './statCodeExecutor';
import { statCodeName, statCodeNamed } from './statCodeNames';
import {
  codeDictionaries, sandboxDictionaries, sandboxPlaceholders, withLibraryPlaceholders, type StatCodePlaceholderSet,
} from './statCodePlaceholders';
import { recordKey } from './ownedTraitState';
import {
  codeEntities, sandboxTraits, type CodeEntities, type CodeEntity, type StatCodeOwners,
} from './statCodeTraits';
import { enabledStats } from './traitEffects';
import {
  applyCodeTraitSwitches, codeDeltaFor, gateStatsOf, ownerStatTraitsInForce, sameCodeDelta, withCodeDelta, type AppliedTraitValues,
  type CodeTraitSwitch, type TraitRuntimeState,
} from './traitRuntime';
import type { GateStats } from './traitGates';
import { boxCode, type StatCodeTiming } from './statCodeTiming';
import { clamp } from './utils';
import { PLAYER_OWNER } from './statOwners';

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
}

/** Everything one turn hands to stat code. The forward turn and the re-roll both build one of these; a turn
 *  with no stat response builds one with no asks. */
export interface StatCodeTurn {
  /** Which box runs. `before` runs each stat's before-the-AI code over the turn's starting state, reading
   *  every `delta` as zero and `previous` as `self` whatever the turn carries. `after`, the default, runs
   *  the after-the-AI box over the asks and the regen. */
  timing?: StatCodeTiming;
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
   *  library entities in pick order. Every owner's code reads one snapshot: the player's stats as `stats`,
   *  its own as `owner.stats`, and each one's as `entities[x].stats`. Every write lands in owner order, the
   *  turn owner first, then stat order within each writer's owner; the later write wins a field. */
  owners?: readonly OwnerCodeTurn[];
  /** Every owner's stats as gates read them at the turn's start; the run lays its owners' stats over them.
   *  Absent ⇒ gates read only the run's owners. */
  gateStats?: GateStats;
  /** Stat id → the value a penalty takes from the turn owner's stat after the run, unless code moves that stat:
   *  the starvation penalty. */
  penalties?: Readonly<Record<string, number>>;
}

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
}

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

/** Warn of every write a run dropped, one line per result field that lists any. */
function warnDroppedWrites(statName: string, result: StatCodeResult): void {
  const warn = (message: string, names: readonly string[] | undefined) => {
    if (names) console.warn(`Stat ${statName} ${message}: ${names.join(', ')}`);
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

/** One owner's part of a run: its stats under their code names, its turn inputs, the stats whose code runs,
 *  its live stats in order, and what its code wrote. */
interface OwnerRun {
  owner: OwnerCodeTurn;
  named: PlayerStat[];
  inputs: Record<string, StatTurnInputs>;
  coded: PlayerStat[];
  live: PlayerStat[];
  writes: OwnerWrites;
}

/** What one owner's code wrote, by the writing stat's id. `stats` holds its stat writes by target owner id. */
interface OwnerWrites {
  stats: Map<string, ReadonlyMap<string, readonly TargetWrite[]>>;
  placeholders: Map<string, readonly PlaceholderWrite[]>;
  traits: Map<string, StatTraitWrites>;
}

/** One stat's fields a box wrote. */
type TargetWrite = Pick<StatWrite, 'id' | 'value' | keyof CodeBounds>;

/** A target's merged write, as `settleWrites` lays it on. */
type SettledWrite = { value: number | null; bounds: CodeBounds | null };

/** What one run wrote, by target owner id: its own stat first, under `ownerId`; its `stats` writes under
 *  `worldId`; then each entity's. */
function targetWrites(stat: PlayerStat, result: StatCodeResult, ownerId: string, worldId: string): Map<string, TargetWrite[]> {
  const out = new Map<string, TargetWrite[]>();
  const add = (id: string, writes: readonly TargetWrite[] = []) => {
    if (writes.length) out.set(id, [...out.get(id) ?? [], ...writes]);
  };
  if (result.value !== null || result.bounds) add(ownerId, [{ id: stat.id, ...result.bounds, ...(result.value === null ? {} : { value: result.value }) }]);
  add(worldId, result.statWrites);
  for (const row of result.ownerStatWrites ?? []) add(row.ownerId, row.writes);
  return out;
}

/** Each target owner's writes, each target stat's merged field by field in writer order, the later writer
 *  winning a field. */
function statWritesByOwner(writers: readonly { stat: PlayerStat; writes: OwnerWrites }[]): Map<string, Map<string, SettledWrite>> {
  const out = new Map<string, Map<string, SettledWrite>>();
  for (const { stat: writer, writes } of writers) {
    for (const [ownerId, targets] of writes.stats.get(writer.id) ?? []) {
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

function ownerRun(owner: OwnerCodeTurn, timing: StatCodeTiming, placeholderDefs: readonly Placeholder[]): OwnerRun {
  // Code reaches a stat by its code name, which no roll moves. The log and the panel keep the rolled text.
  const named = statCodeNamed(owner.stats, placeholderDefs);
  const previous = new Map(statCodeNamed(owner.previous, placeholderDefs).map((stat) => [stat.id, stat]));
  const asks = new Map((owner.asks ?? []).map((ask) => [ask.id, ask]));
  // Only what this turn knows; the executor reads a missing part as untouched. The before box runs at the
  // turn's start, so it hands over nothing at all: the executor then reads `previous` as `self` and every
  // delta source as zero, whatever the turn it rides in already holds.
  const inputs: Record<string, StatTurnInputs> = timing === 'before' ? {} : Object.fromEntries(named.map((stat) => {
    const before = previous.get(stat.id);
    const ask = asks.get(stat.id);
    return [stat.id, {
      previous: before,
      delta: { ai: ask && { value: ask.value, max: ask.max }, regen: { value: owner.regenApplied[stat.id] } },
    }];
  }));
  const coded = named.filter((stat) => owner.enabled[stat.id] !== false && boxCode(stat, timing).trim());
  return {
    owner, named, inputs, coded, live: enabledStats([...owner.stats], owner.enabled),
    writes: { stats: new Map(), placeholders: new Map(), traits: new Map() },
  };
}

/** Run every owner's enabled stats' code over one turn in the sandbox, in parallel over one snapshot. A
 *  failing run is logged and leaves its stat unchanged. */
export async function runStatCodeTurn(turn: StatCodeTurn): Promise<StatCodeTurnResult> {
  const timing = turn.timing ?? 'after';
  const placeholderDefs = turn.placeholders?.placeholders ?? [];
  const main: OwnerCodeTurn = {
    id: PLAYER_OWNER, stats: turn.stats, enabled: turn.enabled, previous: turn.previous,
    asks: turn.asks, regenApplied: turn.regenApplied,
  };
  const [worldRun, ...entityRuns] = [main, ...turn.owners ?? []].map((owner) => ownerRun(owner, timing, placeholderDefs));
  const runs = [worldRun, ...entityRuns];
  const anyCoded = runs.some((run) => run.coded.length);
  const world = turn.ownerTraits.world;
  const before: TraitRuntimeState = {
    stats: [...turn.stats],
    traits: [...turn.ownerTraits.acquired],
    disabledTraitIds: [...turn.ownerTraits.disabledTraitIds],
    appliedValues: turn.ownerTraits.appliedValues,
    cascadeOffTraitIds: turn.ownerTraits.cascadeOffTraitIds,
    ownedTraits: turn.ownerTraits.ownedTraits,
    entityStats: Object.fromEntries((turn.owners ?? []).map((owner) => [owner.id, [...owner.stats]])),
  };
  const gateStatsAt = (mainStats: PlayerStat[], ownerStats: EntityStatValues): GateStats =>
    ({ ...turn.gateStats, ...gateStatsOf({ ...before, stats: mainStats, entityStats: ownerStats }, world) });
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
  // The first run is the world's; every other run is an entity's, which reads the world's stats as `stats`.
  const ownerStats = ({ named, inputs, owner }: OwnerRun): SandboxStats => ({ stats: named, turn: inputs, enabled: owner.enabled });
  const worldStats = ownerStats(worldRun);
  const runOf = new Map(runs.filter((run) => run !== worldRun).map((run) => [run.owner.id, run]));
  const inPlay = cast && withEntityFields(cast, (id) => {
    const node = sandbox?.owners.get(id);
    const run = runOf.get(id);
    return {
      ...(node ? { placeholders: node } : {}),
      ...(run ? { stats: ownerStats(run) } : {}),
    };
  });
  /** A run's `owner`: its entity as `entities` holds it, else an entry of its own; none for the world run. */
  const ownerEntryOf = (run: OwnerRun): CodeEntity | undefined => (run === worldRun ? undefined
    : inPlay?.entities.find((entity) => entity.id === run.owner.id)
      ?? { id: run.owner.id, name: '', type: '', pronouns: '', inScene: false, traits: [], stats: ownerStats(run) });
  const ownerEntries = new Map(runs.map((run) => [run, ownerEntryOf(run)]));
  const dictionaries = sandboxDictionaries(codeDictionaries(placeholderSet?.dictionaries, placeholderDefs), sandbox?.owners);
  await Promise.all(runs.map(async (run) => {
    const { coded, writes } = run;
    const ownerEntry = ownerEntries.get(run);
    await Promise.all(coded.map(async (stat) => {
      const result = await executeStatCode(boxCode(stat, timing), [...worldStats.stats], stat, {
        clock: turn.clock, turn: worldStats.turn, enabled: worldStats.enabled, placeholders, traits, ...inPlay, owner: ownerEntry, dictionaries,
      });
      if (result.error) {
        console.error(`Error executing code for stat ${stat.name}:`, result.error);
        return;
      }
      const statWrites = targetWrites(stat, result, run.owner.id, worldRun.owner.id);
      if (statWrites.size) writes.stats.set(stat.id, statWrites);
      if (result.placeholders) writes.placeholders.set(stat.id, result.placeholders);
      if (result.traits || result.entities) {
        writes.traits.set(stat.id, { world: result.traits ?? [], entities: result.entities ?? [] });
      }
      warnDroppedWrites(stat.name, result);
    }));
  }));
  // Owner order, then stat order: the player first, then each entity, so the later write wins.
  const inOrder = runs.flatMap((run) => run.live.map((stat) => ({ stat, writes: run.writes, owner: ownerEntries.get(run) })));
  const pinWrites = pinWritesInStatOrder(inOrder.map(({ stat, writes }) => writes.placeholders.get(stat.id) ?? []));

  // Merged per target before the first settle, so the gate snapshot and the penalties see every owner's writes.
  const writesByOwner = statWritesByOwner(inOrder);
  const mainWrites = writesByOwner.get(main.id) ?? new Map<string, SettledWrite>();
  const ownerWrites = new Map(entityRuns.map(({ owner }) => [owner.id, writesByOwner.get(owner.id) ?? new Map<string, SettledWrite>()]));
  // The snapshot every settle below reads: the code writes landed with no switch yet, then the penalties.
  const landedMain = withPenalties(
    settleWrites(turn.stats, turn.stats, mainWrites, ownerStatTraitsInForce(before, world, main.id)), turn.penalties,
  );
  const landedOwners = Object.fromEntries(entityRuns.map(({ owner }) => [owner.id, settleWrites(
    owner.stats, owner.stats, ownerWrites.get(owner.id) ?? new Map(), ownerStatTraitsInForce(before, world, owner.id),
  ).stats]));
  const gateStats = gateStatsAt(landedMain, landedOwners);

  // Trait switches first, so bounds re-derive under them; the code's own bounds and values then go on top.
  const keyed = inPlay && keyedEntities(inPlay.entities, inPlay.persona);
  const switches = inOrder.map(({ stat, writes, owner }) => ({ stat, written: writes.traits.get(stat.id), owner }));
  const switched = applyCodeTraitSwitches(
    before,
    traitSwitchesInStatOrder(switches, turn.ownerTraits, keyed, placeholderDefs, turn.statNameOf),
    { ...world, gateStats }, turn.traitNameOf,
  );
  const active = ownerStatTraitsInForce(switched.state, world, main.id);
  const traitResult: StatCodeTraitResult | undefined = switched.state === before ? undefined : {
    acquired: switched.state.traits,
    disabledTraitIds: switched.state.disabledTraitIds,
    appliedValues: switched.state.appliedValues,
    cascadeOffTraitIds: switched.state.cascadeOffTraitIds ?? {},
    ownedTraits: switched.state.ownedTraits ?? {},
    inForce: active,
    log: switched.log,
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
  const { stats, moved, boundsChanged } = settleWrites(turn.stats, switched.state.stats, mainWrites, active);
  if (!traitResult && moved.length === 0 && boundsChanged.length === 0) {
    return { stats: turn.stats, moved, boundsChanged, pinWrites, gateStats, ...withOwners };
  }
  return { stats, moved, boundsChanged, pinWrites, gateStats, ...(traitResult ? { traits: traitResult } : {}), ...withOwners };
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

/** Each stat's trait switches keyed by owner and trait, in stat order: the later stat wins, and its switch
 *  applies at that stat's position. A name resolves to the last trait with it, as the sandbox map does. */
function traitSwitchesInStatOrder(
  /** `owner` is the writing stat's owner, which a row through `owner` alone switches. */
  inOrder: readonly { stat: PlayerStat; written: StatTraitWrites | undefined; owner: CodeEntity | undefined }[],
  ownerTraits: StatCodeOwners,
  inPlay: KeyedEntities<CodeEntity> | null,
  placeholders: readonly Placeholder[],
  /** The switching stat's name as the player reads it — the log line names it. */
  statNameOf: (stat: PlayerStat) => string,
): CodeTraitSwitch[] {
  const idByName = new Map(ownerTraits.world.traits.map((trait) => [statCodeName(trait.name, placeholders), trait.id]));
  const out = new Map<string, CodeTraitSwitch>();
  const setLast = (key: string, at: CodeTraitSwitch) => {
    out.delete(key);
    out.set(key, at);
  };
  for (const { stat, written, owner } of inOrder) {
    for (const write of written?.world ?? []) {
      const traitId = idByName.get(write.name);
      if (traitId !== undefined) setLast(traitId, { traitId, enabled: write.enabled, by: statNameOf(stat) });
    }
    for (const { entity: name, owner: viaOwner, traits: switched = [] } of written?.entities ?? []) {
      // An empty name is `persona`, which an unnamed persona entity can still be.
      const entity = viaOwner ? owner : name ? inPlay?.byName.get(name) : inPlay?.persona;
      if (!entity?.id) continue;
      const idByTraitName = new Map(entity.traits.map((trait) => [trait.name, trait.id]));
      for (const write of switched) {
        const traitId = idByTraitName.get(write.name);
        if (traitId !== undefined) {
          setLast(recordKey(entity.id, traitId), { traitId, enabled: write.enabled, by: statNameOf(stat), ownerId: entity.id });
        }
      }
    }
  }
  return [...out.values()];
}

/** Each stat's placeholder writes keyed by placeholder id, laid in stat order so the later stat wins. Each
 *  write already names the placeholder it landed on, whichever path the code reached it by. */
function pinWritesInStatOrder(inOrder: readonly (readonly PlaceholderWrite[])[]): PinWrites {
  const out: Record<string, string | string[] | null> = {};
  for (const writes of inOrder) {
    for (const write of writes) {
      out[write.id] = 'unpin' in write ? null : write.value;
    }
  }
  return out;
}
