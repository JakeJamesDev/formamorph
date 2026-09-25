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

/** A frozen copy of `data`, parsed from a string so a `__proto__` key stays a plain key. */
const frozenGlobal = (name: string, data: unknown) =>
  `const ${name} = __freeze(JSON.parse(${JSON.stringify(JSON.stringify(data))}));`;

/** Run a Tool script over `args` and the snapshot. A string return is the text; any other value is JSON. */
export async function runToolScript(
  code: string,
  args: Readonly<Record<string, unknown>>,
  snapshot: ToolSnapshot,
): Promise<ToolScriptResult> {
  const QuickJS = await getQuickJS();
  const runtime = QuickJS.newRuntime();
  runtime.setInterruptHandler(shouldInterruptAfterDeadline(Date.now() + EXECUTION_TIMEOUT_MS));
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

    // The completion value is `[tag, text]`: 0 for nothing, 1 for a string, 2 for JSON text (undefined when
    // the value has no JSON form). `__stringify` is taken before the script can replace `JSON.stringify`.
    const program = [
      'const __stringify = JSON.stringify;',
      'const __freeze = (o) => { if (o && typeof o === "object" && !Object.isFrozen(o)) { Object.freeze(o); Object.values(o).forEach(__freeze); } return o; };',
      frozenGlobal('args', args),
      frozenGlobal('world', snapshot.world),
      frozenGlobal('scene', snapshot.scene),
      'const __value = (function () {',
      code,
      '})();',
      '__value == null ? [0] : typeof __value === "string" ? [1, __value] : [2, __stringify(__value)];',
    ].join('\n');

    const result = vm.evalCode(program);
    if (result.error) {
      const dumped: unknown = vm.dump(result.error);
      result.error.dispose();
      const message = dumped && typeof dumped === 'object' && 'message' in dumped ? String(dumped.message) : String(dumped);
      if (/interrupted/i.test(message)) return { error: 'The script ran too long and was stopped.', kind: 'timeout' };
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
