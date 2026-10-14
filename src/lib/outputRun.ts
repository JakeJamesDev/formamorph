import type { PlayerStat } from '@/types';
import type { SentenceRewrite } from './aiRequest/narrationRewrite';
import { filledScriptsAt } from './scripts';
import { sameCodeDelta } from './traitRuntime';
import {
  runStatCodeTurn, withPinWrites, type OwnerCodeResult, type PinWrites, type StatCodeTraitResult, type StatCodeTurn,
  type StatCodeTurnResult,
} from './statCodeTurn';

/**
 * One reply's During AI Output run. Each completed sentence runs the world's and every owner's output scripts
 * over what the sentences before it left, so what they write sums across the reply. The run holds those
 * writes back: `result` lays them out as one result, which lands with the turn's After batch.
 */
export interface OutputRun {
  /** Rewrites one sentence. Calls must not overlap, which the sentence rewrite's queue guarantees. */
  rewrite: SentenceRewrite;
  /** What every sentence so far wrote, as one run's result over the turn's starting state. Null before the
   *  first sentence ran. */
  result: () => StatCodeTurnResult | null;
}

/** Whether any script of the timing has code to run: the world's, or an enabled stat's of any owner. */
const hasOutputScripts = (turn: StatCodeTurn): boolean => {
  const enabledStat = (enabled: Readonly<Record<string, boolean>>) => (stat: PlayerStat) =>
    enabled[stat.id] !== false && filledScriptsAt(stat, 'output').length > 0;
  return filledScriptsAt({ scripts: turn.worldScripts }, 'output').length > 0
    || turn.stats.some(enabledStat(turn.enabled))
    || (turn.owners ?? []).some((owner) => owner.stats.some(enabledStat(owner.enabled)));
};

/** `turn` as the sentence after `result` finds it: the stats, traits and pins the sentence left. */
function afterSentence(turn: StatCodeTurn, result: StatCodeTurnResult): StatCodeTurn {
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

/** The run of one reply's sentences over `turn`; null when the turn has no output script to run. */
export function openOutputRun(turn: StatCodeTurn): OutputRun | null {
  if (!hasOutputScripts(turn)) return null;
  let now = turn;
  const steps: StatCodeTurnResult[] = [];

  const rewrite: SentenceRewrite = async (sentence, { index, full }) => {
    // A reply starts at sentence 0, so a retract that restarts it leaves none of the first attempt's writes.
    if (index === 0) {
      now = turn;
      steps.length = 0;
    }
    const step = await runStatCodeTurn({ ...now, timing: 'output', narration: { sentence, full, index } });
    steps.push(step);
    now = afterSentence(now, step);
    return step.sentence ?? sentence;
  };

  const result = (): StatCodeTurnResult | null => {
    const finalStep = steps.at(-1);
    if (!finalStep) return null;
    const pinWrites: PinWrites = Object.assign({}, ...steps.map((step) => step.pinWrites));
    const last = steps.findLast((step) => step.traits)?.traits;
    const traits: StatCodeTraitResult | undefined = last && { ...last, log: steps.flatMap((step) => step.traits?.log ?? []) };
    const owners = turn.owners && Object.fromEntries(turn.owners.map((start): [string, OwnerCodeResult] => {
      const after = now.owners?.find((owner) => owner.id === start.id) ?? start;
      const inForce = steps.findLast((step) => step.owners?.[start.id]?.inForce)?.owners?.[start.id]?.inForce;
      return [start.id, { stats: after.stats, ...changedStats(start.stats, after.stats), ...(inForce ? { inForce } : {}) }];
    }));
    return {
      stats: now.stats, ...changedStats(turn.stats, now.stats), pinWrites, gateStats: finalStep.gateStats,
      ...(traits ? { traits } : {}), ...(owners ? { owners } : {}),
    };
  };

  return { rewrite, result };
}
