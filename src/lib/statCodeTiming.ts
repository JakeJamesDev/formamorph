/**
 * Which of a stat's two code boxes something belongs to. Its own module because the editor, the template
 * library, the Test Bench and the help text all name a box, and none of them should pull the turn runner
 * — and the QuickJS engine behind it — in to do it.
 */

import type { PlayerStat } from '@/types';

export type StatCodeTiming = 'before' | 'after';

/** Both boxes in the order the turn runs them. */
export const STAT_CODE_TIMINGS = ['before', 'after'] as const satisfies readonly StatCodeTiming[];

/** What each box is called wherever an author reads it: the editor caption, the template menu, the help,
 *  the Test Bench findings. */
export const TIMING_LABEL: Record<StatCodeTiming, string> = {
  before: 'Before The AI',
  after: 'After The AI',
};

/** A stat as far as its two boxes go. Everything that reads code takes this much and no more. */
export type CodedStat = Pick<PlayerStat, 'beforeCode' | 'code'>;

/** Which field of a stat each box is. The one place the two names meet, so a reader and a writer cannot
 *  disagree about which box they are working on. */
export const CODE_FIELD: Record<StatCodeTiming, keyof CodedStat> = { before: 'beforeCode', after: 'code' };

/** The box a run reads on one stat, empty where that stat leaves the box blank. */
export const boxCode = (stat: CodedStat, timing: StatCodeTiming): string => stat[CODE_FIELD[timing]] ?? '';

/** Whether a stat leaves both boxes blank, which is what clears its code bounds. */
export const noBoxes = (stat: CodedStat): boolean =>
  STAT_CODE_TIMINGS.every((timing) => !boxCode(stat, timing).trim());

/** One box that holds code, for a reader that has to visit both and say which it is reporting on. */
export interface CodeBox {
  timing: StatCodeTiming;
  code: string;
}

/** The boxes a stat actually fills, in turn order. A blank box is left out rather than reported on. */
export const filledCodeBoxes = (stat: CodedStat): CodeBox[] =>
  STAT_CODE_TIMINGS.flatMap((timing) => {
    const code = boxCode(stat, timing);
    return code.trim() ? [{ timing, code }] : [];
  });
