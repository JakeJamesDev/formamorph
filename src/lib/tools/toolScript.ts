import { runInSandbox } from '@/lib/scriptSandbox';
import type { ToolSnapshot } from './toolSnapshot';

// Tool scripts run on the shared script sandbox and see only `args`, `world`, `scene`, `placeholders` and
// `console.log`.

/** A script's outcome: its text, nothing (null), or why it failed. */
export type ToolScriptResult =
  | { text: string | null }
  | { error: string; kind: 'script' | 'timeout' };

/** `data` as JS source for a string that JSON-parses back to it, so a `__proto__` key stays a plain key. */
const jsonSource = (data: unknown) => JSON.stringify(JSON.stringify(data));

// The host reads the completion value `[tag, text]`: 0 for nothing, 1 for a string, 2 for JSON text
// (undefined when the value has no JSON form).
const FINISH = '__formamorphFinish';

/** The globals a script reads its inputs from. Each is deep-frozen, so no write reaches them. */
export const TOOL_SCRIPT_INPUTS = ['args', 'world', 'scene', 'placeholders'] as const;

/** Run a Tool script over `args` and the snapshot. A string return is the text; any other value is JSON. */
export async function runToolScript(
  code: string,
  args: Readonly<Record<string, unknown>>,
  snapshot: ToolSnapshot,
): Promise<ToolScriptResult> {
  // QuickJS seeds Math.random from the clock, so runs in one millisecond repeat it; sfc32 takes a crypto seed per run.
  const seed = [...crypto.getRandomValues(new Uint32Array(4))].join(', ');
  const inputs: Record<(typeof TOOL_SCRIPT_INPUTS)[number], unknown> = {
    args, world: snapshot.world, scene: snapshot.scene, placeholders: snapshot.placeholders,
  };
  // The helpers live in a closure, `JSON.stringify` taken before the script can replace it. The script runs
  // as a function body whose parameter shadows the one global it could otherwise reach.
  const program = [
    `((m, a, b, c, d) => { m.random = () => { const t = (a + b + d) | 0; d = (d + 1) | 0; a = b ^ (b >>> 9);`,
    '  b = (c + (c << 3)) | 0; c = (c << 21) | (c >>> 11); c = (c + t) | 0; return (t >>> 0) / 2 ** 32; };',
    `  for (let i = 0; i < 15; i++) m.random(); })(Math, ${seed});`,
    `const [${TOOL_SCRIPT_INPUTS.join(', ')}, ${FINISH}] = ((parse, stringify, freezeOne, isFrozen, values) => {`,
    '  const freeze = (o) => { if (o && typeof o === "object" && !isFrozen(o)) { freezeOne(o); values(o).forEach(freeze); } return o; };',
    '  const finish = (v) => (v == null ? [0] : typeof v === "string" ? [1, v] : [2, stringify(v)]);',
    `  return [${TOOL_SCRIPT_INPUTS.map((name) => `freeze(parse(${jsonSource(inputs[name])}))`).join(', ')}, finish];`,
    '})(JSON.parse, JSON.stringify, Object.freeze, Object.isFrozen, Object.values);',
    `${FINISH}((function (${FINISH}) {`,
    code,
    '})());',
  ].join('\n');

  return runInSandbox(program, ({ vm, result, timedOut }): ToolScriptResult => {
    if (result.error) {
      if (timedOut) return { error: 'The script ran too long and was stopped.', kind: 'timeout' };
      const dumped: unknown = vm.dump(result.error);
      const message = dumped && typeof dumped === 'object' && 'message' in dumped ? String(dumped.message) : String(dumped);
      return { error: `The script failed: ${message}`, kind: 'script' };
    }
    const [tag, text] = vm.dump(result.value) as [number, string | null | undefined];
    if (tag === 0) return { text: null };
    if (typeof text !== 'string') return { error: 'The script returned a value with no JSON form.', kind: 'script' };
    return { text };
  });
}
