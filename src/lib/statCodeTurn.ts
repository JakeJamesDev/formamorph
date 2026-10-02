import type { CascadeOffTraitIds, CodeBounds, CodePins, Dictionary, OwnedTraitStates, Placeholder, PlayerStat, Trait } from '@/types';
import {
  CODE_BOUND_FIELDS, executeStatCode, keyedEntities, type EntityTraitWrites, type KeyedEntities, type PlaceholderWrite,
  type SandboxPlaceholderNode, type StatClock, type StatCodeResult, type StatTurnInputs, type TraitWrite, type ValueAndMax,
} from './statCodeExecutor';
import { statCodeName, statCodeNamed } from './statCodeNames';
import {
  codeDictionaries, sandboxDictionaries, sandboxPlaceholders, withLibraryPlaceholders, type StatCodePlaceholderSet,
} from './statCodePlaceholders';
import { recordKey } from './ownedTraitState';
import {
  codeEntities, sandboxTraits, type CodeEntities, type CodeEntity, type StatCodeBearers,
} from './statCodeTraits';
import { enabledStats } from './traitEffects';
import {
  applyCodeTraitSwitches, statTraitsInForce, withCodeBounds, type AppliedTraitValues, type CodeTraitSwitch,
  type TraitRuntimeState,
} from './traitRuntime';
import { boxCode, noBoxes, type StatCodeTiming } from './statCodeTiming';
import { clamp } from './utils';

/** The trait state a run's switches left, and the log lines they wrote. */
export interface StatCodeTraitResult {
  acquired: Trait[];
  disabledTraitIds: string[];
  appliedValues: AppliedTraitValues;
  cascadeOffTraitIds: CascadeOffTraitIds;
  ownedTraits: OwnedTraitStates;
  /** Every stat trait in force after the switches, which the bounds re-derive under. */
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
  bearers: StatCodeBearers;
  /** What `placeholders`, each owner entry's `placeholders` and `dictionaries` read. Absent, all are empty. */
  placeholders?: StatCodePlaceholderSet;
  /** A stat's name as the player reads it, for the turn log. Required, not defaulted: a caller that left
   *  it out would print an unresolved chip token in a line the player reads. */
  statNameOf: (stat: PlayerStat) => string;
  /** A trait's name as the player reads it, for the trait switch log. Required for the same reason
   *  `statNameOf` is; code reaches the trait by its code name, which the turn derives itself. */
  traitNameOf: (trait: Trait) => string;
}

export interface StatCodeTurnResult {
  /** `stats` with the trait switches, then the code writes, applied, in the same order; the same array when
   *  nothing moved. */
  stats: readonly PlayerStat[];
  /** Ids of the stats whose value the run moved, in stat order. */
  moved: string[];
  /** Ids of the stats whose code bounds the run set or cleared, in stat order. */
  boundsChanged: string[];
  /** Where two stats touched one placeholder, the later stat's action is the one here. */
  pinWrites: PinWrites;
  /** Absent when code switched no trait. */
  traits?: StatCodeTraitResult;
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

const sameBounds = (a: CodeBounds = {}, b: CodeBounds = {}) =>
  CODE_BOUND_FIELDS.every((field) => a[field] === b[field]);

/** Lay a turn's code result onto the latest stats, which may have moved since the run read its snapshot:
 *  only a value the run moved and the code bounds it changed carry over, re-derived onto the latest bases.
 *  After a trait switch every stat re-derives, under the traits the switch left in force. */
export function overlayStatCodeResult(
  latest: readonly PlayerStat[],
  result: StatCodeTurnResult,
  active: readonly Trait[],
): PlayerStat[] {
  const coded = new Map(result.stats.map((stat) => [stat.id, stat]));
  const inForce = result.traits ? result.traits.inForce : active;
  return latest.map((stat) => {
    const run = coded.get(stat.id);
    const value = run && result.moved.includes(stat.id) ? run.value : stat.value;
    if (run && result.boundsChanged.includes(stat.id)) return withCodeBounds(stat, run.codeBounds ?? {}, value, inForce);
    if (result.traits) return withCodeBounds(stat, stat.codeBounds ?? {}, value, inForce);
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
  unknownOwnerPlaceholders: 'wrote placeholders of owners not in play',
  unknownTraits: 'switched traits the world does not have',
  acquiredWrites: 'wrote acquired on',
  readOnlyWrites: 'wrote read-only fields',
  unknownEntities: 'switched traits of entities not in play',
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
      warn(message(row.entity || 'the persona'), row[field]);
    }
  }
}

/** Run every enabled stat's code over one turn in the sandbox, in parallel over one snapshot. A failing
 *  run is logged and leaves its stat unchanged. Empty code clears its stat's code bounds. */
export async function runStatCodeTurn(turn: StatCodeTurn): Promise<StatCodeTurnResult> {
  const timing = turn.timing ?? 'after';
  const live = enabledStats([...turn.stats], turn.enabled);
  // Code reaches a stat by its code name, which no roll moves. The log and the panel keep the rolled text.
  const placeholderDefs = turn.placeholders?.placeholders ?? [];
  const named = statCodeNamed(turn.stats, placeholderDefs);
  const previous = new Map(statCodeNamed(turn.previous, placeholderDefs).map((stat) => [stat.id, stat]));
  const asks = new Map(turn.asks.map((ask) => [ask.id, ask]));
  // Only what this turn knows; the executor reads a missing part as untouched. The before box runs at the
  // turn's start, so it hands over nothing at all: the executor then reads `previous` as `self` and every
  // delta source as zero, whatever the turn it rides in already holds.
  const inputs: Record<string, StatTurnInputs> = timing === 'before' ? {} : Object.fromEntries(named.map((stat) => {
    const before = previous.get(stat.id);
    const ask = asks.get(stat.id);
    return [stat.id, {
      previous: before,
      delta: { ai: ask && { value: ask.value, max: ask.max }, regen: { value: turn.regenApplied[stat.id] } },
    }];
  }));

  const coded = named.filter((stat) => turn.enabled[stat.id] !== false && boxCode(stat, timing).trim());
  // Resolved once, so every stat's code reads the same placeholders and the same traits.
  const traits = coded.length ? sandboxTraits(turn.bearers, placeholderDefs) : [];
  const cast = coded.length ? codeEntities(turn.bearers, placeholderDefs) : null;
  // The library's pools join the run as the session's Placeholder Set joins them.
  const placeholderSet = turn.placeholders && withLibraryPlaceholders(withBooksInPlay(turn.placeholders), turn.bearers.library ?? []);
  const sandbox = coded.length && placeholderSet ? sandboxPlaceholders(placeholderSet) : null;
  const placeholders = sandbox?.top ?? [];
  const inPlay = cast && withOwnerNodes(cast, sandbox?.owners);
  const dictionaries = sandboxDictionaries(codeDictionaries(placeholderSet?.dictionaries, placeholderDefs), sandbox?.owners);
  const writes = new Map<string, { value: number | null; bounds: CodeBounds | null }>();
  const placeholderWritesByStat = new Map<string, readonly PlaceholderWrite[]>();
  const traitWritesByStat = new Map<string, StatTraitWrites>();
  await Promise.all(coded.map(async (stat) => {
    const result = await executeStatCode(boxCode(stat, timing), named, stat, {
      clock: turn.clock, turn: inputs, enabled: turn.enabled, placeholders, traits, ...inPlay, dictionaries,
    });
    if (result.error) {
      console.error(`Error executing code for stat ${stat.name}:`, result.error);
      return;
    }
    if (result.value !== null || result.bounds) {
      writes.set(stat.id, { value: result.value, bounds: result.bounds ? { ...stat.codeBounds, ...result.bounds } : null });
    }
    if (result.placeholders) placeholderWritesByStat.set(stat.id, result.placeholders);
    if (result.traits || result.entities) {
      traitWritesByStat.set(stat.id, { world: result.traits ?? [], entities: result.entities ?? [] });
    }
    warnDroppedWrites(stat.name, result);
  }));
  const pinWrites = pinWritesInStatOrder(live, placeholderWritesByStat);
  for (const stat of live) {
    // Code bounds outlive one box: only a stat that has emptied both loses them.
    if (noBoxes(stat) && stat.codeBounds) writes.set(stat.id, { value: null, bounds: {} });
  }

  // Trait switches first, so bounds re-derive under them; the code's own bounds and values then go on top.
  const before: TraitRuntimeState = {
    stats: [...turn.stats],
    traits: [...turn.bearers.acquired],
    disabledTraitIds: [...turn.bearers.disabledTraitIds],
    appliedValues: turn.bearers.appliedValues,
    cascadeOffTraitIds: turn.bearers.cascadeOffTraitIds,
    ownedTraits: turn.bearers.ownedTraits,
  };
  const keyed = inPlay && keyedEntities(inPlay.entities, inPlay.persona);
  const switched = applyCodeTraitSwitches(
    before,
    traitSwitchesInStatOrder(live, traitWritesByStat, turn.bearers, keyed, placeholderDefs, turn.statNameOf),
    turn.bearers.world, turn.traitNameOf,
  );
  const active = statTraitsInForce(switched.state, turn.bearers.world);
  const traitResult: StatCodeTraitResult | undefined = switched.state === before ? undefined : {
    acquired: switched.state.traits,
    disabledTraitIds: switched.state.disabledTraitIds,
    appliedValues: switched.state.appliedValues,
    cascadeOffTraitIds: switched.state.cascadeOffTraitIds ?? {},
    ownedTraits: switched.state.ownedTraits ?? {},
    inForce: active,
    log: switched.log,
  };

  const moved: string[] = [];
  const boundsChanged: string[] = [];
  const stats = switched.state.stats.map((stat, i) => {
    const write = writes.get(stat.id);
    // A value-only write keeps the bounds as they stand, which a trait switch may have moved.
    const next = !write ? stat
      : write.bounds === null ? { ...stat, value: clamp(write.value ?? stat.value, stat.min, stat.max) }
        : withCodeBounds(stat, write.bounds, write.value ?? stat.value, active);
    if (write?.bounds && !sameBounds(write.bounds, stat.codeBounds)) boundsChanged.push(stat.id);
    if (next.value !== turn.stats[i].value) moved.push(stat.id);
    return next.value === stat.value && !boundsChanged.includes(stat.id) ? stat : next;
  });
  if (!traitResult && moved.length === 0 && boundsChanged.length === 0) return { stats: turn.stats, moved, boundsChanged, pinWrites };
  return { stats, moved, boundsChanged, pinWrites, ...(traitResult ? { traits: traitResult } : {}) };
}

/** The entities with each one's owner node as its `placeholders`, `persona` still one of them. */
function withOwnerNodes(cast: CodeEntities, owners: ReadonlyMap<string, SandboxPlaceholderNode> | undefined): CodeEntities {
  if (!owners?.size) return cast;
  const entities = cast.entities.map((entity) => {
    const node = owners.get(entity.id);
    return node ? { ...entity, placeholders: node } : entity;
  });
  return { entities, persona: entities.find((entity) => cast.persona.id && entity.id === cast.persona.id) ?? cast.persona };
}

/** One stat's switches: through `traits`, then through each entity's `traits`. */
interface StatTraitWrites {
  world: readonly TraitWrite[];
  entities: readonly EntityTraitWrites[];
}

/** Each stat's trait switches keyed by bearer and trait, in stat order: the later stat wins, and its switch
 *  applies at that stat's position. A name resolves to the last trait with it, as the sandbox map does. */
function traitSwitchesInStatOrder(
  stats: readonly PlayerStat[],
  writesByStat: ReadonlyMap<string, StatTraitWrites>,
  bearers: StatCodeBearers,
  inPlay: KeyedEntities<CodeEntity> | null,
  placeholders: readonly Placeholder[],
  /** The switching stat's name as the player reads it — the log line names it. */
  statNameOf: (stat: PlayerStat) => string,
): CodeTraitSwitch[] {
  const idByName = new Map(bearers.world.traits.map((trait) => [statCodeName(trait.name, placeholders), trait.id]));
  const out = new Map<string, CodeTraitSwitch>();
  const setLast = (key: string, at: CodeTraitSwitch) => {
    out.delete(key);
    out.set(key, at);
  };
  for (const stat of stats) {
    const written = writesByStat.get(stat.id);
    for (const write of written?.world ?? []) {
      const traitId = idByName.get(write.name);
      if (traitId !== undefined) setLast(traitId, { traitId, enabled: write.enabled, by: statNameOf(stat) });
    }
    for (const { entity: name, traits: switched = [] } of written?.entities ?? []) {
      // An empty name is `persona`, which an unnamed persona entity can still be.
      const entity = name ? inPlay?.byName.get(name) : inPlay?.persona;
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
function pinWritesInStatOrder(
  stats: readonly PlayerStat[],
  writesByStat: ReadonlyMap<string, readonly PlaceholderWrite[]>,
): PinWrites {
  const out: Record<string, string | string[] | null> = {};
  for (const stat of stats) {
    for (const write of writesByStat.get(stat.id) ?? []) {
      out[write.id] = 'unpin' in write ? null : write.value;
    }
  }
  return out;
}
