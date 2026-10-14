import { getQuickJS, type QuickJSContext, type QuickJSHandle, type QuickJSWASMModule } from 'quickjs-emscripten';

// Untrusted scripts get a fresh QuickJS runtime per run: no page globals, a timeout interrupt, memory and stack caps.
const EXECUTION_TIMEOUT_MS = 1000;
const MEMORY_LIMIT_BYTES = 16 * 1024 * 1024;
const MAX_STACK_BYTES = 512 * 1024;

// The WASM engine loads once and is shared; each run gets its own disposable runtime and context.
let quickJSPromise: Promise<QuickJSWASMModule> | null = null;
const loadQuickJS = () => (quickJSPromise ??= getQuickJS());

/** A host function a program calls as a global. */
export type SandboxHostFunction = (vm: QuickJSContext, ...args: QuickJSHandle[]) => QuickJSHandle | undefined;

/** One finished run, live until `read` returns. */
export interface SandboxOutcome {
  vm: QuickJSContext;
  /** The program's completion value, or what it threw. */
  result: { value: QuickJSHandle; error?: undefined } | { error: QuickJSHandle; value?: undefined };
  /** Every `console.log` line, each ending in a newline. */
  consoleOutput: string;
  /** Whether the timeout interrupt stopped the program. */
  timedOut: boolean;
}

/** Evaluate `program` in a fresh sandbox with `console.log` and `hostFunctions` as its only host globals, then
 *  hand the outcome to `read`. Every handle is disposed when `read` returns. */
export async function runInSandbox<T>(
  program: string,
  read: (outcome: SandboxOutcome) => T,
  hostFunctions: Readonly<Record<string, SandboxHostFunction>> = {},
): Promise<T> {
  const QuickJS = await loadQuickJS();
  const runtime = QuickJS.newRuntime();
  const deadline = Date.now() + EXECUTION_TIMEOUT_MS;
  let timedOut = false;
  runtime.setInterruptHandler(() => (timedOut ||= Date.now() > deadline));
  runtime.setMemoryLimit(MEMORY_LIMIT_BYTES);
  runtime.setMaxStackSize(MAX_STACK_BYTES);
  const vm = runtime.newContext();
  try {
    // QuickJS has no console: collect the output and forward it to the host console.
    let consoleOutput = '';
    const logFn = vm.newFunction('log', (...args) => {
      const parts = args.map((arg) => vm.dump(arg));
      consoleOutput += parts.map(String).join(' ') + '\n';
      console.log(...parts);
    });
    const consoleObj = vm.newObject();
    vm.setProp(consoleObj, 'log', logFn);
    vm.setProp(vm.global, 'console', consoleObj);
    logFn.dispose();
    consoleObj.dispose();

    for (const [name, fn] of Object.entries(hostFunctions)) {
      const handle = vm.newFunction(name, (...args) => fn(vm, ...args));
      vm.setProp(vm.global, name, handle);
      handle.dispose();
    }

    const result = vm.evalCode(program);
    try {
      return read({ vm, result, consoleOutput, timedOut });
    } finally {
      if (result.alive) result.dispose();
    }
  } finally {
    vm.dispose();
    runtime.dispose();
  }
}
