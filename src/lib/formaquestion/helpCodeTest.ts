/**
 * The code test: a fixed function of Formaquestion. It runs a script the AI wrote through the editor's
 * analysis and a Test Code run on the open world, and applies nothing. It is app-internal and no Tool
 * (ADR-0009). The analysis and the sandbox engine load at the first call, so the help bundle stays small.
 */
import type { ToolExecutor } from '@/lib/aiRequest/toolLoop';
import type { StatCodeWorld } from '@/lib/statCodeTestRun';
import { SCRIPT_TIMING_LABEL, SCRIPT_TIMINGS } from '@/lib/scripts';
import { parseToolArgs, type ToolCallResult } from '@/lib/tools/toolRunner';
import type { OfferedFunction } from '@/lib/tools/toolSchema';
import type { ScriptTiming } from '@/types';
import type { CodeTestOwner } from './helpCodeTestRun';
import type { StatCodeWorldSource } from './helpWorld';

/** The kinds of home a tested script can sit on. */
const CODE_TEST_OWNERS = ['stat', 'trait', 'world'] as const satisfies readonly CodeTestOwner['kind'][];

/** The default most code test calls one help question runs. */
export const HELP_CODE_TEST_CALL_LIMIT = 3;

export const HELP_CODE_TEST: OfferedFunction = {
  id: 'help-code-test',
  name: 'test_script',
  description: [
    'Purpose: Check a script you wrote, and run it once on the open world, before you give it to the player.',
    'Use when: You wrote a script for the player. Call it before you answer. When it reports errors or dropped writes, fix the code and call it again. When an error remains after your last call, give your best code and name the remaining error in one sentence.',
    'Input: code, timing, owner and name. The script runs in its timing on its owner. A stat or trait script reads that stat or trait as self. Without owner and name, the script sits on the stat, trait or world the player has open, else on a stat. Without name, self is the open stat or trait of that kind, if any.',
    'Output: JSON with errors and warnings, each with its line; notInWorld: the names the world does not have yet, each with its kind; and run: the value the code set, its writes, its pending writes, its assumed stats, its dropped writes, the sentence a During AI Output script left, or the error it threw. A During AI Output script runs on a sample sentence, and a When a Trait Switches script on a sample switched trait. A pending write lands on the played persona during the game. It is not an error. A notInWorld name and an assumed stat are not errors: keep the code, tell the player to create each one, and name its kind. An assumed stat is a stat the world does not have yet, run as a number at 0 in 0–100. With world false, no world is open: names go unchecked and nothing runs.',
  ].join('\n'),
  params: [
    { name: 'code', type: 'string', description: 'The whole contents of the script.', required: true, options: [] },
    {
      name: 'timing', type: 'enum', required: true, options: [...SCRIPT_TIMINGS],
      description: `When the script runs: ${SCRIPT_TIMINGS.map((timing) => `${timing} is ${SCRIPT_TIMING_LABEL[timing]}`).join(', ')}.`,
    },
    { name: 'owner', type: 'enum', description: 'What the script sits on.', required: false, options: [...CODE_TEST_OWNERS] },
    { name: 'name', type: 'string', description: 'The name of the stat or trait the script sits on.', required: false, options: [] },
  ],
};

/** The line the Code rider ends with while the code test is offered. It asks for the call before the answer. */
export const CODE_TEST_RIDER_LINE = `- Before you answer, test the block with the \`${HELP_CODE_TEST.name}\` function. Fix each error and dropped write it reports.`;
/** The name of the open stat or trait when it is of `kind`; none for the world or another kind. */
const openNameOf = (openHome: CodeTestOwner | undefined, kind: CodeTestOwner['kind']): string =>
  (openHome && openHome.kind === kind && openHome.kind !== 'world' ? openHome.name : '');

/**
 * The code test's executor for one help question. The world is read once, at the first call; none means no
 * world is open. A call that names no owner tests `openHome`, the stat or trait whose panel is open or the world, and a
 * stat or trait call that names no item tests the open one of its kind.
 */
export function createCodeTest(world: StatCodeWorldSource | undefined, openHome?: CodeTestOwner): ToolExecutor<OfferedFunction> {
  let read: StatCodeWorld | undefined;
  return async (_fn, argumentsText): Promise<ToolCallResult> => {
    const parsed = parseToolArgs(HELP_CODE_TEST.params, argumentsText);
    if ('error' in parsed) return { text: JSON.stringify({ error: parsed.error }), failure: 'arguments' };
    read ??= world?.();
    const { testScript } = await import('./helpCodeTestRun');
    const { code, timing, name } = parsed.args;
    const typed = typeof name === 'string' ? name.trim() : '';
    // A call with a name and no owner is a stat's, as it was before traits had a default.
    // The enum options are checked when the arguments are parsed.
    const owner = (parsed.args.owner ?? (typed ? 'stat' : openHome?.kind ?? 'stat')) as CodeTestOwner['kind'];
    const named = typed || openNameOf(openHome, owner);
    if (owner === 'trait' && !named) return { text: JSON.stringify({ error: 'A trait script needs the name of its trait.' }), failure: 'arguments' };
    const target: CodeTestOwner = owner === 'world' ? { kind: 'world' }
      : owner === 'trait' ? { kind: 'trait', name: named } : { kind: 'stat', name: named };
    return { text: JSON.stringify(await testScript(String(code), timing as ScriptTiming, target, read)) };
  };
}
