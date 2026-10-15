import type { PlayerStat } from '@/types';
import type { SentenceRewrite } from './aiRequest/narrationRewrite';
import { filledScriptsAt } from './scripts';
import {
  afterRun, chainedResult, runStatCodeTurn, withSwitchRuns, type StatCodeTurn, type StatCodeTurnResult,
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
  /** `result` with the switch runs its trait switches fire, which land with it in the After batch (Q42, Q47). */
  landing: () => Promise<StatCodeTurnResult | null>;
}

/** Whether any script of the timing has code to run: the world's, or an enabled stat's of any owner. */
const hasOutputScripts = (turn: StatCodeTurn): boolean => {
  const enabledStat = (enabled: Readonly<Record<string, boolean>>) => (stat: PlayerStat) =>
    enabled[stat.id] !== false && filledScriptsAt(stat, 'output').length > 0;
  return filledScriptsAt({ scripts: turn.worldScripts }, 'output').length > 0
    || turn.stats.some(enabledStat(turn.enabled))
    || (turn.owners ?? []).some((owner) => owner.stats.some(enabledStat(owner.enabled)));
};

/**
 * The run of one reply's sentences over `turn`; null when the turn has no output script to run. `released`
 * reads how many of the reply's sentences the reveal has put on screen; a reply with no paced reveal shows
 * each sentence as it passes.
 */
export function openOutputRun(turn: StatCodeTurn, released: () => number = () => Number.POSITIVE_INFINITY): OutputRun | null {
  if (!hasOutputScripts(turn)) return null;
  let now = turn;
  const steps: StatCodeTurnResult[] = [];

  const rewrite: SentenceRewrite = async (sentence, { index, full, earlier }) => {
    // A reply starts at sentence 0, so a retract that restarts it leaves none of the first attempt's writes.
    if (index === 0) {
      now = turn;
      steps.length = 0;
    }
    const shown = Math.min(released(), earlier.length);
    const narration = { sentence, full, index, sent: earlier.slice(0, shown), buffered: earlier.slice(shown) };
    const step = await runStatCodeTurn({ ...now, timing: 'output', narration });
    steps.push(step);
    now = afterRun(now, step);
    return step.sentence ?? sentence;
  };

  const result = (): StatCodeTurnResult | null => (steps.length ? chainedResult(turn, steps, now) : null);
  const landing = async (): Promise<StatCodeTurnResult | null> => {
    const ran = result();
    return ran && withSwitchRuns(turn, ran);
  };

  return { rewrite, result, landing };
}
