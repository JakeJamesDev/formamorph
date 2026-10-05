/**
 * The code test: a fixed function of Formaquestion. It runs stat code the AI wrote through the editor's
 * analysis and a Test Code run on the open world, and applies nothing. It is app-internal and no Tool
 * (ADR-0009). The analysis and the sandbox engine load at the first call, so the help bundle stays small.
 */
import type { ToolExecutor } from '@/lib/aiRequest/toolLoop';
import type { StatCodeWorld } from '@/lib/statCodeTestRun';
import { STAT_CODE_TIMINGS, type StatCodeTiming } from '@/lib/statCodeTiming';
import { parseToolArgs, type ToolCallResult } from '@/lib/tools/toolRunner';
import type { OfferedFunction } from '@/lib/tools/toolSchema';
import type { StatCodeWorldSource } from './helpWorld';

/** The default most code test calls one help question runs. */
export const HELP_CODE_TEST_CALL_LIMIT = 3;

export const HELP_CODE_TEST: OfferedFunction = {
  id: 'help-code-test',
  name: 'test_stat_code',
  description: [
    'Purpose: Check stat code you wrote, and run it once on the open world, before you give it to the player.',
    'Use when: You wrote stat code for the player. Call it before you answer. When it reports errors or dropped writes, fix the code and call it again. When an error remains after your last call, give your best code and name the remaining error in one sentence.',
    'Input: code, box and stat. The code reads that stat as self.',
    'Output: JSON with errors and warnings, each with its line; notInWorld: the names the world does not have yet, each with its kind; and run: the value the code set, its writes, its pending writes, its assumed stats, its dropped writes, or the error it threw. A pending write lands on the played persona in play. It is not an error. A notInWorld name and an assumed stat are not errors: keep the code, tell the player to create each one, and name its kind. An assumed stat is a stat the world does not have yet, run as a number at 0 in 0–100. With world false, no world is open: names go unchecked and run is null.',
  ].join('\n'),
  params: [
    { name: 'code', type: 'string', description: 'The whole contents of the box.', required: true, options: [] },
    { name: 'box', type: 'enum', description: 'The box the code goes in.', required: true, options: [...STAT_CODE_TIMINGS] },
    { name: 'stat', type: 'string', description: 'The name of the stat whose code it is.', required: true, options: [] },
  ],
};

/** The code test's executor for one help question. The world is read once, at the first call; none means no world is open. */
export function createCodeTest(world: StatCodeWorldSource | undefined): ToolExecutor<OfferedFunction> {
  let read: StatCodeWorld | undefined;
  return async (_fn, argumentsText): Promise<ToolCallResult> => {
    const parsed = parseToolArgs(HELP_CODE_TEST.params, argumentsText);
    if ('error' in parsed) return { text: JSON.stringify({ error: parsed.error }), failure: 'arguments' };
    read ??= world?.();
    const { testStatCode } = await import('./helpCodeTestRun');
    const { code, box, stat } = parsed.args;
    return { text: JSON.stringify(await testStatCode(String(code), box as StatCodeTiming, String(stat), read)) };
  };
}
