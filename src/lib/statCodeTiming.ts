/**
 * A stat's code as the Code tab's two boxes and the readers see it: each box is the stat's first script of its
 * timing. Its own module because the editor, the template library, the Test Bench and the help text all name a
 * box, and none of them should pull the turn runner — and the QuickJS engine behind it — in to do it.
 */

import type { Script } from '@/types';
import { filledScripts, firstCodeAt, SCRIPT_TIMING_LABEL, type ScriptHome } from './scripts';

/** The two timings a stat's Code tab shows a box for. */
export type StatCodeTiming = 'before' | 'after';

/** The timings the runner runs over a turn's stats: the two boxes, At Game Start before the opening, and During
 *  AI Output, which runs one narration sentence at a time. */
export type RunTiming = StatCodeTiming | 'start' | 'output';

/** Whether a run reads the turn's starting state: no ask, no regen and every delta zero. */
export const readsTurnStart = (timing: RunTiming): boolean => timing !== 'after';

/** Both boxes in the order the turn runs them. */
export const STAT_CODE_TIMINGS = ['before', 'after'] as const satisfies readonly StatCodeTiming[];

/** What each box is called wherever an author reads it: the editor caption, the template menu, the help,
 *  the Test Bench findings. */
export const TIMING_LABEL = SCRIPT_TIMING_LABEL;

/** A box's name where its stat is named beside it, as in a Find All Uses row. */
export const TIMING_SHORT: Record<Script['timing'], string> = {
  before: 'Before', after: 'After', output: 'Output', start: 'Start', switch: 'Switch',
};

/** Each box's target on the stat's Code tab, for a landing on it. */
export const CODE_BOX_TARGET = { before: 'before-code', after: 'after-code' } as const satisfies Record<StatCodeTiming, string>;

/** The confirm before an insert replaces a box's code, shared by the templates and the help window. */
export const REPLACE_CODE_TITLE = 'Replace The Existing Code';
export const replaceCodeDescription = (inserted: 'template' | 'code') =>
  `This box already has code. Inserting this ${inserted} overwrites it.`;

/** A stat as far as its scripts go. Everything that reads code takes this much and no more. */
export type CodedStat = ScriptHome;

/** The code a single box for `timing` edits on one stat: its first script of that timing, empty when it has none. */
export const boxCode = (stat: CodedStat, timing: StatCodeTiming): string => firstCodeAt(stat, timing);

/** Whether a stat holds no script with code. */
export const noBoxes = (stat: CodedStat): boolean => filledScripts(stat).length === 0;

/** One script that holds code, for a reader that visits every script and says which it reports on. */
export type CodeBox = Script;

/** The scripts a stat fills, in stored order. A blank script is left out rather than reported on. */
export const filledCodeBoxes = (stat: CodedStat): CodeBox[] => filledScripts(stat);