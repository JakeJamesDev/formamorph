/**
 * A turn's World Tool calls: a Script World Tool with a later timing arms a trigger and answers its Reply; an
 * On Call one runs at once. The trigger list lives as long as this object, which a turn opens and drops (R6).
 */
import type { Tool, ToolScriptHandler } from '@/types';
import type { ToolExecutor } from '@/lib/aiRequest/toolLoop';
import { parseToolArgs, type ToolArgs, type ToolCallResult } from './toolRunner';
import { armsTrigger } from './toolValidation';
import type { ScriptTrigger } from '@/lib/statCodeTurn';

/** What an armed call answers when its Reply is blank (Q1). */
export const DEFAULT_REPLY = 'Done.';

/** One call the AI made: the World Tool and the arguments it passed. */
interface ArmedCall {
  tool: Tool;
  args: ToolArgs;
}

/** Runs an On Call World Tool's script now, on the full script surface, and answers its value as text. */
export type OnCallRunner = (tool: Tool, code: string, args: ToolArgs) => Promise<ToolCallResult>;

export interface WorldToolTurn {
  /** `fallback` with this turn's Script World Tools taken over: each call arms a trigger or runs On Call. */
  executor: (fallback: ToolExecutor) => ToolExecutor;
  /** The calls to fire at `timing`: Tools-tab order, then call order with Stack Calls on, else the last call (R4, Q4). */
  armed: (timing: 'output' | 'after') => ScriptTrigger[];
}

const scriptOf = (tool: Tool): ToolScriptHandler | null => (tool.handler.kind === 'script' ? tool.handler : null);

/** A fresh turn over the world's Tools, in Tools-tab order. */
export function openWorldToolTurn(worldTools: readonly Tool[], onCall: OnCallRunner): WorldToolTurn {
  const calls: ArmedCall[] = [];
  const own = (tool: Tool) => worldTools.find((mine) => mine.id === tool.id);
  return {
    executor: (fallback) => async (tool, argsText, signal) => {
      const mine = own(tool);
      const script = mine && scriptOf(mine);
      if (!mine || !script) return fallback(tool, argsText, signal);
      const parsed = parseToolArgs(mine.params, argsText);
      if ('error' in parsed) return { text: JSON.stringify({ error: parsed.error }), failure: 'arguments' };
      if (!armsTrigger(script.timing)) return onCall(mine, script.code, parsed.args);
      calls.push({ tool: mine, args: parsed.args });
      return { text: script.reply?.trim() ? script.reply : DEFAULT_REPLY };
    },
    armed: (timing) => worldTools.flatMap((tool) => {
      const script = scriptOf(tool);
      if (script?.timing !== timing) return [];
      const made = calls.filter((call) => call.tool.id === tool.id).map(({ args }) => ({ name: tool.name, code: script.code, args }));
      return script.stack ? made : made.slice(-1);
    }),
  };
}
