/**
 * A turn's World Tool calls: a Script World Tool with a later timing arms a trigger and answers its Reply; an
 * On Call one runs at once. The trigger list lives as long as this object, which a turn opens and drops (R6).
 */
import type { Tool, ToolScriptHandler, TurnToolCall } from '@/types';
import type { ToolExecutor } from '@/lib/aiRequest/toolLoop';
import { parseToolArgs, type ToolArgs, type ToolCallResult } from './toolRunner';
import { armsTrigger } from './toolValidation';
import type { ReplayedTrigger, SavedScriptWrites, ScriptTrigger } from '@/lib/statCodeTurn';

/** What an armed call answers when its Reply is blank (Q1). */
export const DEFAULT_REPLY = 'Done.';

/** One call the AI made: the World Tool, the arguments it passed, and what an On Call run wrote. */
interface MadeCall {
  tool: Tool;
  args: ScriptTrigger['args'];
  writes?: SavedScriptWrites;
}

/** What an On Call run answers the AI, and what it wrote when it ran clean. */
export interface OnCallOutcome {
  reply: ToolCallResult;
  writes?: SavedScriptWrites;
}

/** Runs an On Call World Tool's script now, on the full script surface, and answers its value as text. */
export type OnCallRunner = (tool: Tool, code: string, args: ToolArgs) => Promise<OnCallOutcome>;

export interface WorldToolTurn {
  /** `fallback` with this turn's Script World Tools taken over: each call arms a trigger or runs On Call. */
  executor: (fallback: ToolExecutor) => ToolExecutor;
  /** The calls to fire at `timing`: Tools-tab order, then call order with Stack Calls on, else the last call (R4, Q4). */
  armed: (timing: 'output' | 'after') => ScriptTrigger[];
  /** What a narration's output run reads at each sentence: `armed('output')`. Undefined unless a trigger is
   *  armed already or `offered`, the narration request's Tools, holds an output World Tool (Q47). */
  outputTriggers: (offered: readonly Tool[]) => (() => ScriptTrigger[]) | undefined;
  /** Every call so far, in call order, as the turn saves them (Q39). */
  calls: () => TurnToolCall[];
}

const scriptOf = (tool: Tool): ToolScriptHandler | null => (tool.handler.kind === 'script' ? tool.handler : null);

/** The triggers `calls` fire at `timing`, over the world's Tools in Tools-tab order. */
function armedOf(worldTools: readonly Tool[], calls: readonly MadeCall[], timing: 'output' | 'after'): ScriptTrigger[] {
  return worldTools.flatMap((tool) => {
    const script = scriptOf(tool);
    if (script?.timing !== timing) return [];
    const made = calls.filter((call) => call.tool.id === tool.id).map(({ args }) => ({ name: tool.name, code: script.code, args }));
    return script.stack ? made : made.slice(-1);
  });
}

/** A fresh turn over the world's Tools, in Tools-tab order. */
export function openWorldToolTurn(worldTools: readonly Tool[], onCall: OnCallRunner): WorldToolTurn {
  const calls: MadeCall[] = [];
  const own = (tool: Tool) => worldTools.find((mine) => mine.id === tool.id);
  const armed: WorldToolTurn['armed'] = (timing) => armedOf(worldTools, calls, timing);
  return {
    executor: (fallback) => async (tool, argsText, signal) => {
      const mine = own(tool);
      const script = mine && scriptOf(mine);
      if (!mine || !script) return fallback(tool, argsText, signal);
      const parsed = parseToolArgs(mine.params, argsText);
      if ('error' in parsed) return { text: JSON.stringify({ error: parsed.error }), failure: 'arguments' };
      const call: MadeCall = { tool: mine, args: parsed.args };
      calls.push(call);
      if (armsTrigger(script.timing)) return { text: script.reply?.trim() ? script.reply : DEFAULT_REPLY };
      const { reply, writes } = await onCall(mine, script.code, parsed.args);
      if (writes) call.writes = writes;
      return reply;
    },
    armed,
    outputTriggers: (offered) => {
      const canArm = offered.some((tool) => scriptOf(tool)?.timing === 'output' && own(tool));
      return canArm || armed('output').length ? () => armed('output') : undefined;
    },
    calls: () => calls.map(({ tool, args, writes }) => ({
      toolId: tool.id, args: { ...args }, timing: scriptOf(tool)?.timing ?? 'call', ...(writes ? { writes } : {}),
    })),
  };
}

/** What a stat re-roll replays from a turn's saved calls: the On Call writes in call order, and the After
 *  triggers with their saved args (Q39, Q41). During AI Output calls replay nothing, as output Scripts do not. */
export function replayedToolEffects(
  worldTools: readonly Tool[], saved: readonly TurnToolCall[],
): { onCallWrites: ReplayedTrigger[]; afterTriggers: ScriptTrigger[] } {
  const byId = new Map(worldTools.map((tool) => [tool.id, tool]));
  const onCallWrites = saved.flatMap(({ toolId, timing, writes }) =>
    (timing === 'call' && writes ? [{ name: byId.get(toolId)?.name ?? toolId, writes }] : []));
  const after = saved.flatMap(({ toolId, timing, args }) => {
    const tool = byId.get(toolId);
    return timing === 'after' && tool ? [{ tool, args }] : [];
  });
  return { onCallWrites, afterTriggers: armedOf(worldTools, after, 'after') };
}
