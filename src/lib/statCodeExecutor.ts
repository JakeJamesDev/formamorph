import type { Stat } from '@/types';
import { getQuickJS, shouldInterruptAfterDeadline, type QuickJSWASMModule } from 'quickjs-emscripten';
import { clamp } from './utils';

// Stat `code` ships inside world definitions, and worlds are downloaded from Discover — treat it as
// untrusted. It runs in an isolated QuickJS (WASM) VM: no page globals (window/fetch/localStorage),
// only the marshalled stat data below. A runtime interrupt enforces the timeout (kills `while(true)`),
// and memory/stack caps bound allocation.
const EXECUTION_TIMEOUT_MS = 1000;
const MEMORY_LIMIT_BYTES = 16 * 1024 * 1024;
const MAX_STACK_BYTES = 512 * 1024;

// The WASM engine loads once and is shared; each execution gets a fresh disposable runtime/context.
let quickJSPromise: Promise<QuickJSWASMModule> | null = null;
const loadQuickJS = () => (quickJSPromise ??= getQuickJS());

/**
 * Executes JavaScript code to calculate a stat value based on other stats
 * @param code - The JavaScript code to execute
 * @param stats - The array of all stats
 * @param currentStat - The current stat being calculated
 * @returns The calculated value or error
 */
export const executeStatCode = async (
  code: string,
  stats: Stat[],
  currentStat: Stat,
): Promise<{ value: number | null; error: string | null }> => {
  // If code is empty, return null (use the manually set value)
  if (!code || code.trim() === '') {
    return { value: null, error: null };
  }

  try {
    const QuickJS = await loadQuickJS();

    // Only whitelisted plain data crosses into the VM (never `code`/`descriptors`).
    const statsData = stats.map(stat => ({
      id: String(stat.id),
      name: stat.name || '',
      type: stat.type || 'number',
      description: stat.description || '',
      min: stat.min || 0,
      max: stat.max || 100,
      value: stat.value || 0,
      regen: stat.regen || 0
    }));

    const runtime = QuickJS.newRuntime();
    runtime.setInterruptHandler(shouldInterruptAfterDeadline(Date.now() + EXECUTION_TIMEOUT_MS));
    runtime.setMemoryLimit(MEMORY_LIMIT_BYTES);
    runtime.setMaxStackSize(MAX_STACK_BYTES);
    const vm = runtime.newContext();

    try {
      // console.log shim: QuickJS has no console; collect output and forward it to the host console.
      let consoleOutput = '';
      const logFn = vm.newFunction('log', (...args) => {
        const parts = args.map((a) => vm.dump(a));
        consoleOutput += parts.map(String).join(' ') + '\n';
        console.log(...parts);
      });
      const consoleObj = vm.newObject();
      vm.setProp(consoleObj, 'log', logFn);
      vm.setProp(vm.global, 'console', consoleObj);
      logFn.dispose();
      consoleObj.dispose();

      // The stat data rides in as JSON literals (JSON is valid JS expression syntax), so no host
      // references ever enter the VM. The user code runs as a function body so `return` works.
      const program = [
        `const stats = ${JSON.stringify(statsData)};`,
        `const currentStatId = ${JSON.stringify(String(currentStat.id))};`,
        `(function() {`,
        code,
        `})();`,
      ].join('\n');

      const result = vm.evalCode(program);

      if (result.error) {
        const dumped = vm.dump(result.error) as { name?: string; message?: string; stack?: string } | string;
        result.error.dispose();
        const err = typeof dumped === 'object' && dumped !== null ? dumped : { message: String(dumped) };
        // The interrupt handler surfaces as an "interrupted" InternalError — report it as the timeout.
        if (/interrupted/i.test(err.message || '')) {
          return { value: null, error: 'Execution timed out' };
        }
        return {
          value: null,
          error: `Error: ${err.message}\nStack: ${err.stack || 'No stack trace available'}`
        };
      }

      const raw = vm.dump(result.value);
      result.value.dispose();

      if (consoleOutput.trim()) {
        console.log('Console output:', consoleOutput);
      }

      // Ensure the result is a number, clamped to the stat's min/max range.
      if (typeof raw !== 'number') {
        return { value: null, error: 'Error: Code must return a number\nStack: No stack trace available' };
      }
      return { value: clamp(raw, currentStat.min || 0, currentStat.max || 100), error: null };
    } finally {
      vm.dispose();
      runtime.dispose();
    }
  } catch (error) {
    console.error('Error in executeStatCode:', error);

    // Provide more detailed error information
    return {
      value: null,
      error: `Error: ${(error as Error).message}\nStack: ${(error as Error).stack || 'No stack trace available'}`
    };
  }
};
