import { getQuickJS, shouldInterruptAfterDeadline } from 'quickjs-emscripten';
import type { ToolSnapshot } from './toolSnapshot';

// Tool scripts ship in shared presets, so they are untrusted. They run in their own QuickJS runtime with the
// stat-code limits and see only `args`, `world`, `scene` and `console.log`.
const EXECUTION_TIMEOUT_MS = 1000;
const MEMORY_LIMIT_BYTES = 16 * 1024 * 1024;
const MAX_STACK_BYTES = 512 * 1024;

/** A script's outcome: its text, nothing (null), or why it failed. */
export type ToolScriptResult =
  | { text: string | null }
  | { error: string; kind: 'script' | 'timeout' };

/** `data` as JS source for a string that JSON-parses back to it, so a `__proto__` key stays a plain key. */
const jsonSource = (data: unknown) => JSON.stringify(JSON.stringify(data));

// The host reads the completion value `[tag, text]`: 0 for nothing, 1 for a string, 2 for JSON text
// (undefined when the value has no JSON form).
const FINISH = '__formamorphFinish';

/** Run a Tool script over `args` and the snapshot. A string return is the text; any other value is JSON. */
export async function runToolScript(
  code: string,
  args: Readonly<Record<string, unknown>>,
  snapshot: ToolSnapshot,
): Promise<ToolScriptResult> {
  const QuickJS = await getQuickJS();
  const runtime = QuickJS.newRuntime();
  const pastDeadline = shouldInterruptAfterDeadline(Date.now() + EXECUTION_TIMEOUT_MS);
  let timedOut = false;
  runtime.setInterruptHandler((rt) => (timedOut ||= !!pastDeadline(rt)));
  runtime.setMemoryLimit(MEMORY_LIMIT_BYTES);
  runtime.setMaxStackSize(MAX_STACK_BYTES);
  const vm = runtime.newContext();
  try {
    const logFn = vm.newFunction('log', (...handles) => console.log(...handles.map((h) => vm.dump(h))));
    const consoleObj = vm.newObject();
    vm.setProp(consoleObj, 'log', logFn);
    vm.setProp(vm.global, 'console', consoleObj);
    logFn.dispose();
    consoleObj.dispose();

    // The helpers live in a closure, `JSON.stringify` taken before the script can replace it. The script runs
    // as a function body whose parameter shadows the one global it could otherwise reach.
    const program = [
      `const [args, world, scene, ${FINISH}] = ((parse, stringify, freezeOne, isFrozen, values) => {`,
      '  const freeze = (o) => { if (o && typeof o === "object" && !isFrozen(o)) { freezeOne(o); values(o).forEach(freeze); } return o; };',
      '  const finish = (v) => (v == null ? [0] : typeof v === "string" ? [1, v] : [2, stringify(v)]);',
      `  return [freeze(parse(${jsonSource(args)})), freeze(parse(${jsonSource(snapshot.world)})),`,
      `    freeze(parse(${jsonSource(snapshot.scene)})), finish];`,
      '})(JSON.parse, JSON.stringify, Object.freeze, Object.isFrozen, Object.values);',
      `${FINISH}((function (${FINISH}) {`,
      code,
      '})());',
    ].join('\n');

    const result = vm.evalCode(program);
    if (result.error) {
      const dumped: unknown = vm.dump(result.error);
      result.error.dispose();
      if (timedOut) return { error: 'The script ran too long and was stopped.', kind: 'timeout' };
      const message = dumped && typeof dumped === 'object' && 'message' in dumped ? String(dumped.message) : String(dumped);
      return { error: `The script failed: ${message}`, kind: 'script' };
    }
    const [tag, text] = vm.dump(result.value) as [number, string | null | undefined];
    result.value.dispose();
    if (tag === 0) return { text: null };
    if (typeof text !== 'string') return { error: 'The script returned a value with no JSON form.', kind: 'script' };
    return { text };
  } finally {
    vm.dispose();
    runtime.dispose();
  }
}
