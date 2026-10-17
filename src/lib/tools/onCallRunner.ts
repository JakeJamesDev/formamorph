/**
 * A turn's On Call World Tool runs. Each run reads the turn as `prepare` builds it and lands its writes at
 * once, so the next run, and every prompt built after it, reads them (Q38, Q40).
 */
import type { Tool } from '@/types';
import { runStatCodeTurn, type StatCodeTurn, type StatCodeTurnResult } from '@/lib/statCodeTurn';
import type { ToolArgs } from './toolRunner';
import type { OnCallOutcome, OnCallRunner } from './worldToolTurn';

/** One run's turn, and how its result lands on live state. */
export interface OnCallRun {
  turn: StatCodeTurn;
  land: (result: StatCodeTurnResult) => void;
}

/** Runs each On Call script over a fresh `prepare`; a failed script lands no write (Q3). */
export function onCallRunner(prepare: () => OnCallRun): OnCallRunner {
  return async (tool: Tool, code: string, args: ToolArgs): Promise<OnCallOutcome> => {
    const { turn, land } = prepare();
    const result = await runStatCodeTurn({ ...turn, triggers: [{ name: tool.name, code, args }], triggersOnly: true });
    const reply = result.reply ?? { text: null };
    // The first line only: the stack trace is the author's, not the AI's.
    if ('error' in reply) {
      return { reply: { text: JSON.stringify({ error: `The script failed: ${reply.error.split('\n')[0]}` }), failure: 'script' } };
    }
    land(result);
    const { triggerWrites: writes } = result;
    return { reply: { text: reply.text?.trim() ? reply.text : tool.emptyResult }, ...(writes ? { writes } : {}) };
  };
}
