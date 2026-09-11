import type { CodeBounds, PlayerStat, Trait } from '@/types';
import {
  CODE_BOUND_FIELDS, executeStatCode, type StatClock, type StatTurnInputs, type ValueAndMax,
} from './statCodeExecutor';
import { sandboxPlaceholders, type StatCodePlaceholderSet } from './statCodePlaceholders';
import { enabledStats } from './traitEffects';
import { withCodeBounds } from './traitRuntime';

/** Everything one turn hands to stat code. The forward turn, the re-roll, and the clock-only run all
 *  build one of these; the clock-only run has no asks. */
export interface StatCodeTurn {
  /** Every stat as the turn's pipeline left it: AI asks and regen applied, code not yet run. */
  stats: readonly PlayerStat[];
  /** The live stat-enabled map. A disabled stat's code never runs and no other code sees it. */
  enabled: Readonly<Record<string, boolean>>;
  /** The stats as they stood at the start of the turn, matched by id. */
  previous: readonly (ValueAndMax & { id: string })[];
  /** This turn's AI asks, raw: before flags and clamping. */
  asks: readonly (ValueAndMax & { id: string })[];
  /** Regen applied this turn, by stat id. */
  regenApplied: Readonly<Record<string, number>>;
  clock: StatClock;
  /** The traits in force, which bounds re-derive under when code sets or clears one. */
  traits: readonly Trait[];
  /** What `placeholders` reads. Absent, the map is empty. */
  placeholders?: StatCodePlaceholderSet;
}

export interface StatCodeTurnResult {
  /** `stats` with the code writes applied, in the same order; the same array when nothing moved. */
  stats: readonly PlayerStat[];
  /** Ids of the stats whose value the code moved, in stat order. */
  moved: string[];
  /** Ids of the stats whose code bounds the run set or cleared, in stat order. */
  boundsChanged: string[];
}

const sameBounds = (a: CodeBounds = {}, b: CodeBounds = {}) =>
  CODE_BOUND_FIELDS.every((field) => a[field] === b[field]);

/** Lay a turn's code result onto the latest stats, which may have moved since the run read its snapshot:
 *  only a value the code moved and the code bounds it changed carry over, re-derived onto the latest bases. */
export function overlayStatCodeResult(
  latest: readonly PlayerStat[],
  result: StatCodeTurnResult,
  active: readonly Trait[],
): PlayerStat[] {
  const coded = new Map(result.stats.map((stat) => [stat.id, stat]));
  return latest.map((stat) => {
    const run = coded.get(stat.id);
    if (!run) return stat;
    const value = result.moved.includes(stat.id) ? run.value : stat.value;
    if (result.boundsChanged.includes(stat.id)) return withCodeBounds(stat, run.codeBounds ?? {}, value, active);
    return value === stat.value ? stat : { ...stat, value };
  });
}

/** Run every enabled stat's code over one turn in the sandbox, in parallel over one snapshot. A failing
 *  run is logged and leaves its stat unchanged. Empty code clears its stat's code bounds. */
export async function runStatCodeTurn(turn: StatCodeTurn): Promise<StatCodeTurnResult> {
  const live = enabledStats([...turn.stats], turn.enabled);
  const previous = new Map(turn.previous.map((stat) => [stat.id, stat]));
  const asks = new Map(turn.asks.map((ask) => [ask.id, ask]));
  // Only what this turn knows; the executor reads a missing part as untouched.
  const inputs: Record<string, StatTurnInputs> = Object.fromEntries(live.map((stat) => {
    const before = previous.get(stat.id);
    const ask = asks.get(stat.id);
    return [stat.id, {
      previous: before && { value: before.value, max: before.max },
      requested: ask && { value: ask.value, max: ask.max },
      regenApplied: turn.regenApplied[stat.id],
    }];
  }));

  const coded = live.filter((stat) => stat.code?.trim());
  // Resolved once, so every stat's code reads the same placeholders.
  const placeholders = coded.length && turn.placeholders ? sandboxPlaceholders(turn.placeholders) : [];
  const writes = new Map<string, { value: number | null; bounds: CodeBounds | null }>();
  await Promise.all(coded.map(async (stat) => {
    const result = await executeStatCode(stat.code ?? '', live, stat, turn.clock, inputs, placeholders);
    if (result.error) console.error(`Error executing code for stat ${stat.name}:`, result.error);
    else if (result.value !== null || result.bounds) {
      writes.set(stat.id, { value: result.value, bounds: result.bounds ? { ...stat.codeBounds, ...result.bounds } : null });
    }
  }));
  for (const stat of live) {
    if (!stat.code?.trim() && stat.codeBounds) writes.set(stat.id, { value: null, bounds: {} });
  }

  const moved: string[] = [];
  const boundsChanged: string[] = [];
  const stats = turn.stats.map((stat) => {
    const write = writes.get(stat.id);
    if (!write) return stat;
    const value = write.value ?? stat.value;
    // A value-only write keeps the bounds as they stand; the executor already clamped it to them.
    const next = write.bounds === null ? { ...stat, value } : withCodeBounds(stat, write.bounds, value, turn.traits);
    const boundsMoved = write.bounds !== null && !sameBounds(write.bounds, stat.codeBounds);
    if (next.value !== stat.value) moved.push(stat.id);
    if (boundsMoved) boundsChanged.push(stat.id);
    return next.value === stat.value && !boundsMoved ? stat : next;
  });
  if (moved.length === 0 && boundsChanged.length === 0) return { stats: turn.stats, moved, boundsChanged };
  return { stats, moved, boundsChanged };
}
