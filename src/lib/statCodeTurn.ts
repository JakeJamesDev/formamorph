import type { CodeBounds, CodePins, Placeholder, PlayerStat, Trait } from '@/types';
import {
  CODE_BOUND_FIELDS, executeStatCode, type PlaceholderWrite, type StatClock, type StatTurnInputs, type TraitWrite,
  type ValueAndMax,
} from './statCodeExecutor';
import { statCodeName, statCodeNamed } from './statCodeNames';
import { sandboxPlaceholders, type StatCodePlaceholderSet } from './statCodePlaceholders';
import { sandboxTraits, type StatCodeTraits } from './statCodeTraits';
import { enabledStats } from './traitEffects';
import {
  activeTraits, applyCodeTraitSwitches, withCodeBounds, type AppliedTraitValues, type CodeTraitSwitch,
  type TraitRuntimeState,
} from './traitRuntime';
import { clamp } from './utils';

/** Where in the turn a run sits: before the AI calls, or after the asks and the regen. */
export type StatCodeTiming = 'before' | 'after';

/** The box a run reads on one stat, empty where that stat leaves the box blank. */
export const boxCode = (stat: Pick<PlayerStat, 'beforeCode' | 'code'>, timing: StatCodeTiming): string =>
  (timing === 'before' ? stat.beforeCode : stat.code) ?? '';

/** Whether a stat leaves both boxes blank, which is what clears its code bounds. */
export const noBoxes = (stat: Pick<PlayerStat, 'beforeCode' | 'code'>): boolean =>
  !stat.beforeCode?.trim() && !stat.code?.trim();

/** The trait state a run's switches left, and the log lines they wrote. */
export interface StatCodeTraitResult {
  acquired: Trait[];
  disabledTraitIds: string[];
  appliedValues: AppliedTraitValues;
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
  /** The live stat-enabled map. A disabled stat's code never runs and no other code sees it. */
  enabled: Readonly<Record<string, boolean>>;
  /** The stats as they stood at the start of the turn, matched by id. A stat missing here reads its
   *  `previous` as a copy of its own current entry. */
  previous: readonly PlayerStat[];
  /** This turn's AI asks, raw: before flags and clamping. */
  asks: readonly (ValueAndMax & { id: string })[];
  /** Regen applied this turn, by stat id. */
  regenApplied: Readonly<Record<string, number>>;
  clock: StatClock;
  /** What `traits` reads and switches. Bounds re-derive under the ones in force. */
  traits: StatCodeTraits;
  /** What `placeholders` reads. Absent, the map is empty. */
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
  const inForce = result.traits ? activeTraits(result.traits.acquired, result.traits.disabledTraitIds) : active;
  return latest.map((stat) => {
    const run = coded.get(stat.id);
    const value = run && result.moved.includes(stat.id) ? run.value : stat.value;
    if (run && result.boundsChanged.includes(stat.id)) return withCodeBounds(stat, run.codeBounds ?? {}, value, inForce);
    if (result.traits) return withCodeBounds(stat, stat.codeBounds ?? {}, value, inForce);
    return value === stat.value ? stat : { ...stat, value };
  });
}

/** Run every enabled stat's code over one turn in the sandbox, in parallel over one snapshot. A failing
 *  run is logged and leaves its stat unchanged. Empty code clears its stat's code bounds. */
export async function runStatCodeTurn(turn: StatCodeTurn): Promise<StatCodeTurnResult> {
  const timing = turn.timing ?? 'after';
  const live = enabledStats([...turn.stats], turn.enabled);
  // Code reaches a stat by its code name, which no roll moves. The log and the panel keep the rolled text.
  const placeholderDefs = turn.placeholders?.placeholders ?? [];
  const named = statCodeNamed(live, placeholderDefs);
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

  const coded = named.filter((stat) => boxCode(stat, timing).trim());
  // Resolved once, so every stat's code reads the same placeholders and the same traits.
  const placeholders = coded.length && turn.placeholders ? sandboxPlaceholders(turn.placeholders) : [];
  const traits = coded.length ? sandboxTraits(turn.traits, placeholderDefs) : [];
  const writes = new Map<string, { value: number | null; bounds: CodeBounds | null }>();
  const placeholderWritesByStat = new Map<string, readonly PlaceholderWrite[]>();
  const traitWritesByStat = new Map<string, readonly TraitWrite[]>();
  await Promise.all(coded.map(async (stat) => {
    const result = await executeStatCode(boxCode(stat, timing), named, stat, { clock: turn.clock, turn: inputs, placeholders, traits });
    if (result.error) {
      console.error(`Error executing code for stat ${stat.name}:`, result.error);
      return;
    }
    if (result.value !== null || result.bounds) {
      writes.set(stat.id, { value: result.value, bounds: result.bounds ? { ...stat.codeBounds, ...result.bounds } : null });
    }
    if (result.placeholders) placeholderWritesByStat.set(stat.id, result.placeholders);
    if (result.traits) traitWritesByStat.set(stat.id, result.traits);
    if (result.unknownPlaceholders) {
      console.warn(`Stat ${stat.name} wrote placeholders the world does not have: ${result.unknownPlaceholders.join(', ')}`);
    }
    if (result.unknownTraits) {
      console.warn(`Stat ${stat.name} switched traits the world does not have: ${result.unknownTraits.join(', ')}`);
    }
    if (result.acquiredWrites) {
      console.warn(`Stat ${stat.name} wrote acquired on: ${result.acquiredWrites.join(', ')}`);
    }
  }));
  const pinWrites = pinWritesInStatOrder(live, placeholderWritesByStat);
  for (const stat of live) {
    // Code bounds outlive one box: only a stat that has emptied both loses them.
    if (noBoxes(stat) && stat.codeBounds) writes.set(stat.id, { value: null, bounds: {} });
  }

  // Trait switches first, so bounds re-derive under them; the code's own bounds and values then go on top.
  const before: TraitRuntimeState = {
    stats: [...turn.stats],
    traits: [...turn.traits.acquired],
    disabledTraitIds: [...turn.traits.disabledTraitIds],
    appliedValues: turn.traits.appliedValues,
  };
  const switched = applyCodeTraitSwitches(
    before,
    traitSwitchesInStatOrder(live, traitWritesByStat, turn.traits, placeholderDefs, turn.statNameOf),
    turn.traits.world, turn.traitNameOf,
  );
  const traitResult: StatCodeTraitResult | undefined = switched.state === before ? undefined : {
    acquired: switched.state.traits,
    disabledTraitIds: switched.state.disabledTraitIds,
    appliedValues: switched.state.appliedValues,
    log: switched.log,
  };
  const active = activeTraits(switched.state.traits, switched.state.disabledTraitIds);

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

/** Each stat's trait switches keyed by trait, laid in stat order so the later stat wins and its switch lands
 *  where that stat stands. A name reaches the last authored trait carrying it, as the sandbox map does. */
function traitSwitchesInStatOrder(
  stats: readonly PlayerStat[],
  writesByStat: ReadonlyMap<string, readonly TraitWrite[]>,
  traits: StatCodeTraits,
  placeholders: readonly Placeholder[],
  /** The switching stat's name as the player reads it — the log line names it. */
  statNameOf: (stat: PlayerStat) => string,
): CodeTraitSwitch[] {
  const idByName = new Map(traits.world.traits.map((trait) => [statCodeName(trait.name, placeholders), trait.id]));
  const out = new Map<string, CodeTraitSwitch>();
  for (const stat of stats) {
    for (const write of writesByStat.get(stat.id) ?? []) {
      const traitId = idByName.get(write.name);
      if (traitId === undefined) continue;
      out.delete(traitId);
      out.set(traitId, { traitId, enabled: write.enabled, by: statNameOf(stat) });
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
