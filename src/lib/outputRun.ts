import type { PlayerStat } from '@/types';
import type { NarrationListener } from './aiRequest/narrationStream';
import type { SentenceRewrite } from './aiRequest/narrationRewrite';
import { filledScriptsAt } from './scripts';
import {
  afterRun, chainedResult, runStatCodeTurn, timingStartOf, withSwitchRuns, type ScriptTrigger, type StatCodeTurn, type StatCodeTurnResult,
} from './statCodeTurn';

/**
 * One reply's During AI Output run. Each completed sentence runs the turn's armed output triggers, then the
 * world's and every owner's output scripts one by one, each over what the scripts and sentences before it left, so
 * what they write sums across the reply. The run holds those writes back: `result` lays them out as one result, which
 * lands with the turn's After batch.
 */
export interface OutputRun {
  /** Rewrites one sentence. Calls must not overlap, which the sentence rewrite's queue guarantees. */
  rewrite: SentenceRewrite;
  /** Hears the Narration Stream: a retract drops every write so far, a run still in progress included (Q9). */
  listener: NarrationListener;
  /** What every sentence so far wrote, as one run's result over the turn's starting state. Null before the
   *  first sentence ran. */
  result: () => StatCodeTurnResult | null;
  /** `result` with the switch runs its trait switches fire, which land with it in the After batch (Q42, Q47). */
  landing: () => Promise<StatCodeTurnResult | null>;
  /** An On Call run landed during the reply: later sentences and the landing read what it left. */
  onCallLanded: (result: StatCodeTurnResult) => void;
}

/** Whether any script of the timing has code to run: the world's, or an enabled stat's of any owner. */
const hasOutputScripts = ({ worldScripts, state }: StatCodeTurn): boolean => {
  const enabledStat = (enabled: Readonly<Record<string, boolean>>) => (stat: PlayerStat) =>
    enabled[stat.id] !== false && filledScriptsAt(stat, 'output').length > 0;
  return filledScriptsAt({ scripts: worldScripts }, 'output').length > 0
    || state.stats.some(enabledStat(state.enabled))
    || (state.owners ?? []).some((owner) => owner.stats.some(enabledStat(owner.enabled)));
};

export interface OutputRunOptions {
  /** How many of the reply's sentences the reveal has put on screen. Absent, each sentence shows as it passes. */
  released?: () => number;
  /** The turn's armed output triggers, read at each sentence. Present ⇒ the run opens with no output script. */
  triggers?: () => readonly ScriptTrigger[];
}

/** The run of one reply's sentences over `turn`; null when the turn has no output script and no trigger source. */
export function openOutputRun(
  turn: StatCodeTurn, { released = () => Number.POSITIVE_INFINITY, triggers }: OutputRunOptions = {},
): OutputRun | null {
  if (!triggers && !hasOutputScripts(turn)) return null;
  let start = turn;
  let now = turn;
  // The timing begins at the reply's first sentence, so every sentence's `previous` reads it (Q27).
  const began = timingStartOf(turn.state);
  const steps: StatCodeTurnResult[] = [];
  // Bumped on a retract, so a sentence run that was in progress then leaves no write.
  let round = 0;

  const listener: NarrationListener = (event) => {
    if (event.type !== 'retract') return;
    round += 1;
    now = start;
    steps.length = 0;
  };

  const rewrite: SentenceRewrite = async (sentence, { index, full, earlier }) => {
    const mine = round;
    const shown = Math.min(released(), earlier.length);
    const narration = { sentence, full, index, sent: earlier.slice(0, shown), buffered: earlier.slice(shown) };
    const step = await runStatCodeTurn({ ...now, timing: 'output', narration, triggers: triggers?.(), timingStart: began });
    if (mine !== round) return sentence;
    steps.push(step);
    now = afterRun(now, step);
    return step.sentence ?? sentence;
  };

  const result = (): StatCodeTurnResult | null => (steps.length ? chainedResult(start, steps, now) : null);
  const landing = async (): Promise<StatCodeTurnResult | null> => {
    const ran = result();
    return ran && withSwitchRuns(start, ran);
  };
  const onCallLanded = (landed: StatCodeTurnResult) => {
    start = afterRun(start, landed);
    now = afterRun(now, landed);
  };

  return { rewrite, listener, result, landing, onCallLanded };
}
