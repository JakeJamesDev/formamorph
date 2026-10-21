import {
  getQuickJS, newQuickJSAsyncWASMModule,
  type QuickJSAsyncContext, type QuickJSAsyncWASMModule, type QuickJSContext, type QuickJSHandle, type QuickJSWASMModule,
} from 'quickjs-emscripten';

// Untrusted scripts get a fresh QuickJS runtime per run: no page globals, a timeout interrupt, memory and stack caps.
const EXECUTION_TIMEOUT_MS = 1000;
const MEMORY_LIMIT_BYTES = 16 * 1024 * 1024;
const MAX_STACK_BYTES = 512 * 1024;

/** `sync` is the plain engine. `async` is the Asyncify build, where a host function that returns a promise
 *  suspends the VM until it settles; it is larger and slower, so a run takes it only when it needs a host answer. */
export type SandboxEngine = 'sync' | 'async';

// Each engine loads once and is shared; each run gets its own disposable runtime and context.
let quickJSPromise: Promise<QuickJSWASMModule> | null = null;
const loadQuickJS = () => (quickJSPromise ??= getQuickJS());
let asyncQuickJSPromise: Promise<QuickJSAsyncWASMModule> | null = null;
const loadAsyncQuickJS = () => (asyncQuickJSPromise ??= newQuickJSAsyncWASMModule());

// An Asyncify module suspends for one host call at a time, so async runs take turns on the shared module.
let asyncTurn: Promise<unknown> = Promise.resolve();

/** A host function a program calls as a global. It may return a handle for the program to read, or a call
 *  result whose `error` the program sees thrown. On the async engine it may return a promise of either, and
 *  the program waits for it with no `await`. The run's time budget pauses during every host call (Q49). */
export type SandboxHostFunction = (vm: QuickJSContext, ...args: QuickJSHandle[]) => SandboxHostReturn | Promise<SandboxHostReturn>;

export type SandboxHostReturn = QuickJSHandle | { error: QuickJSHandle } | undefined;

/** One finished run, live until `read` returns. */
export interface SandboxOutcome {
  vm: QuickJSContext;
  /** The program's completion value, or what it threw. */
  result: { value: QuickJSHandle; error?: undefined } | { error: QuickJSHandle; value?: undefined };
  /** Every `console.log` line, each ending in a newline. */
  consoleOutput: string;
  /** Whether the timeout interrupt stopped the program. */
  timedOut: boolean;
  engine: SandboxEngine;
}

/** Evaluate `program` in a fresh sandbox with `console.log` and `hostFunctions` as its only host globals, then
 *  hand the outcome to `read`. Every handle is disposed when `read` returns. */
export async function runInSandbox<T>(
  program: string,
  read: (outcome: SandboxOutcome) => T,
  hostFunctions: Readonly<Record<string, SandboxHostFunction>> = {},
  engine: SandboxEngine = 'sync',
): Promise<T> {
  if (engine === 'sync') return runOn(await loadQuickJS(), program, read, hostFunctions, engine);
  const QuickJS = await loadAsyncQuickJS();
  const run = () => runOn(QuickJS, program, read, hostFunctions, engine);
  const turn = asyncTurn.then(run, run);
  asyncTurn = turn.catch(() => undefined);
  return turn;
}

async function runOn<T>(
  QuickJS: QuickJSWASMModule,
  program: string,
  read: (outcome: SandboxOutcome) => T,
  hostFunctions: Readonly<Record<string, SandboxHostFunction>>,
  engine: SandboxEngine,
): Promise<T> {
  const runtime = QuickJS.newRuntime();
  // The budget moves out by the time each host call takes, so a prompt held open never times out.
  let deadline = Date.now() + EXECUTION_TIMEOUT_MS;
  let timedOut = false;
  runtime.setInterruptHandler(() => (timedOut ||= Date.now() > deadline));
  runtime.setMemoryLimit(MEMORY_LIMIT_BYTES);
  runtime.setMaxStackSize(MAX_STACK_BYTES);
  const vm = runtime.newContext();
  try {
    // QuickJS has no console: collect the output and forward it to the host console.
    let consoleOutput = '';
    const logFn = vm.newFunction('log', (...args) => {
      const started = Date.now();
      const parts = args.map((arg) => vm.dump(arg));
      consoleOutput += parts.map(String).join(' ') + '\n';
      console.log(...parts);
      deadline += Date.now() - started;
    });
    const consoleObj = vm.newObject();
    vm.setProp(consoleObj, 'log', logFn);
    vm.setProp(vm.global, 'console', consoleObj);
    logFn.dispose();
    consoleObj.dispose();

    const asyncVm = engine === 'async' ? (vm as QuickJSAsyncContext) : null;
    for (const [name, fn] of Object.entries(hostFunctions)) {
      const handle = asyncVm
        ? asyncVm.newAsyncifiedFunction(name, async (...args) => {
          const started = Date.now();
          try {
            return await fn(vm, ...args);
          } finally {
            deadline += Date.now() - started;
          }
        })
        : vm.newFunction(name, (...args) => {
          const started = Date.now();
          try {
            const returned = fn(vm, ...args);
            if (returned instanceof Promise) throw new Error(`${name} returned a promise on the sync engine`);
            return returned;
          } finally {
            deadline += Date.now() - started;
          }
        });
      vm.setProp(vm.global, name, handle);
      handle.dispose();
    }

    const result = asyncVm ? await asyncVm.evalCodeAsync(program) : vm.evalCode(program);
    try {
      return read({ vm, result, consoleOutput, timedOut, engine });
    } finally {
      if (result.alive) result.dispose();
    }
  } finally {
    vm.dispose();
    runtime.dispose();
  }
}
