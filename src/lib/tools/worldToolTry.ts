/**
 * Try It and the Variable menu for a Script World Tool run on the script surface. A run reads the authored world,
 * applies nothing, and reports what the AI would read back and every write the script staged.
 */
import type { Tool } from '@/types';
import type { ScriptPromptHost } from '@/lib/scriptPrompts';
import { runTestCode, type TestCodeReport } from '@/lib/statCodeTestRun';
import type { OpeningFoldWorld } from '@/lib/openingState';
import { parseToolArgs, type ToolCallFailure } from './toolRunner';
import { armsTrigger } from './toolValidation';
import { DEFAULT_REPLY } from './worldToolTurn';
import { SCRIPT_TIMING_OF_TOOL, toolTimingOf } from './worldTools';

/** What one Try It run found. */
export interface WorldToolTry {
  /** What the AI reads back: the Reply of a trigger, the value of an On Call script, or the error. */
  text: string;
  /** Present exactly when `text` is an error result. */
  failure?: ToolCallFailure;
  /** Each write the script staged, none applied. */
  writes: string[];
  /** Writes the run dropped, and names play may resolve that the editor can't. */
  warnings: string[];
  /** The sentence a During AI Output run left. */
  sentence?: string;
}

export interface WorldToolTryOptions {
  /** The sentence a During AI Output run rewrites. */
  sentence?: string;
  prompts?: ScriptPromptHost;
}

const errorResult = (failure: ToolCallFailure, error: string): WorldToolTry =>
  ({ text: JSON.stringify({ error }), failure, writes: [], warnings: [] });

/** Run a Script World Tool's code over `argsText` on the authored `world`, as play would run its call. */
export async function tryWorldToolScript(
  tool: Tool, argsText: string, world: OpeningFoldWorld, { sentence, prompts }: WorldToolTryOptions = {},
): Promise<WorldToolTry> {
  const { handler } = tool;
  if (handler.kind !== 'script') return errorResult('handler', 'The Tool has no script');
  const parsed = parseToolArgs(tool.params, argsText);
  if ('error' in parsed) return errorResult('arguments', parsed.error);
  const timing = toolTimingOf(tool);
  let report: TestCodeReport;
  try {
    report = await runTestCode(handler.code, SCRIPT_TIMING_OF_TOOL[timing], { kind: 'tool' }, world, {
      args: parsed.args, ...(timing === 'output' && { sentence: sentence ?? '' }), ...(prompts && { prompts }),
    });
  } catch (error) {
    return errorResult('handler', `The Tool failed: ${error instanceof Error ? error.message : String(error)}`);
  }
  // The first line only: the stack trace is the author's, not the AI's.
  if (report.error) return errorResult('script', `The script failed: ${report.error.replace(/^Error: /, '').split('\n')[0]}`);
  const reply = armsTrigger(timing)
    ? handler.reply?.trim() ? handler.reply : DEFAULT_REPLY
    : report.reply?.trim() ? report.reply : tool.emptyResult;
  return {
    text: reply, writes: report.writes, warnings: report.dropped,
    ...(report.sentence !== undefined && { sentence: report.sentence }),
  };
}
