/**
 * Which of a stat's two code boxes something belongs to. Its own module because the editor, the template
 * library and the help text all name a box, and none of them should pull the turn runner in to do it.
 */

export type StatCodeTiming = 'before' | 'after';

/** Both boxes in the order the turn runs them. */
export const STAT_CODE_TIMINGS = ['before', 'after'] as const satisfies readonly StatCodeTiming[];

/** What each box is called wherever an author reads it: the editor caption, the template menu, the help. */
export const TIMING_LABEL: Record<StatCodeTiming, string> = {
  before: 'Before The AI',
  after: 'After The AI',
};
