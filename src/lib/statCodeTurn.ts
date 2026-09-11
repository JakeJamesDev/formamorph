import type { PlayerStat } from '@/types';
import { executeStatCode, type StatClock, type StatTurnInputs, type ValueAndMax } from './statCodeExecutor';
import { sandboxPlaceholders, type StatCodePlaceholderSet } from './statCodePlaceholders';
import { enabledStats } from './traitEffects';

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
  /** What `placeholders` reads. Absent, the map is empty. */
  placeholders?: StatCodePlaceholderSet;
}

export interface StatCodeTurnResult {
  /** `stats` with the code writes applied, in the same order; the same array when nothing moved. */
  stats: readonly PlayerStat[];
  /** Ids of the stats whose value the code moved, in stat order. */
  moved: string[];
}

/** Run every enabled stat's code over one turn in the sandbox, in parallel over one snapshot. A failing
 *  run is logged and leaves its stat unchanged. */
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
  const writes = new Map<string, number>();
  await Promise.all(coded.map(async (stat) => {
    const result = await executeStatCode(stat.code ?? '', live, stat, turn.clock, inputs, placeholders);
    if (result.error) console.error(`Error executing code for stat ${stat.name}:`, result.error);
    else if (result.value !== null && result.value !== stat.value) writes.set(stat.id, result.value);
  }));

  if (writes.size === 0) return { stats: turn.stats, moved: [] };
  return {
    stats: turn.stats.map((stat) => {
      const value = writes.get(stat.id);
      return value === undefined ? stat : { ...stat, value };
    }),
    moved: turn.stats.filter((stat) => writes.has(stat.id)).map((stat) => stat.id),
  };
}
