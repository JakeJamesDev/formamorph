import type { Stat } from '@/types';
import { getQuickJS, shouldInterruptAfterDeadline, type QuickJSWASMModule } from 'quickjs-emscripten';
import { clamp } from './utils';
import { dayAndHour, daypart, FLAT_HOURS_PER_TURN, type WorldCalendar } from './gameClock';

// Stat `code` ships inside world definitions, and worlds are downloaded from the community server — treat it as
// untrusted. It runs in an isolated QuickJS (WASM) VM: no page globals (window/fetch/localStorage),
// only the marshalled stat data below. A runtime interrupt enforces the timeout (kills `while(true)`),
// and memory/stack caps bound allocation.
const EXECUTION_TIMEOUT_MS = 1000;
const MEMORY_LIMIT_BYTES = 16 * 1024 * 1024;
const MAX_STACK_BYTES = 512 * 1024;

// The WASM engine loads once and is shared; each execution gets a fresh disposable runtime/context.
let quickJSPromise: Promise<QuickJSWASMModule> | null = null;
const loadQuickJS = () => (quickJSPromise ??= getQuickJS());

/** Where the story's clock stands for one stat-code run. `elapsedHours` is the total as of the END of the
 *  turn, so the turn's own duration is already included; the start-of-turn readings derive from it. */
export interface StatClock {
  /** Story hours this turn consumed. Defaults to the flat hour, which is also what a clock-off game charges. */
  deltaHours?: number;
  /** Total story hours at the end of this turn. Defaults to one turn's worth, so a clock-less caller reads
   *  as the opening turn having just closed rather than as no time having passed at all. */
  elapsedHours?: number;
  calendar?: WorldCalendar;
}

/** The clock variable names stat code may read. Exported so the per-turn gate and the editor's help text
 *  read from the same list rather than restating it. */
export const STAT_CLOCK_VARS = [
  'deltaHours', 'elapsedHours', 'day', 'daypart', 'startDay', 'startDaypart',
] as const;

const CLOCK_VAR_PATTERN = new RegExp(`\\b(${STAT_CLOCK_VARS.join('|')})\\b`);

/** Whether a stat's code reads the clock, and so has to re-run every turn rather than only when another
 *  stat moved. A plain source scan: over-matching (a mention in a comment) costs one harmless recompute,
 *  and code that reaches the variable without naming it literally simply doesn't tick. */
export const usesStatClock = (code?: string | null): boolean => !!code && CLOCK_VAR_PATTERN.test(code);

/** The clock readings a run exposes, resolved from `clock` and its defaults. */
const resolveClock = (clock?: StatClock) => {
  const deltaHours = Math.max(0, clock?.deltaHours ?? FLAT_HOURS_PER_TURN);
  const elapsedHours = Math.max(0, clock?.elapsedHours ?? deltaHours);
  const end = dayAndHour(elapsedHours, clock?.calendar);
  // A turn spans time, so its start can sit in a different day/daypart than its end — a long sleep begins
  // in the afternoon and ends at night. Both readings are exposed; neither is derivable from the other.
  const start = dayAndHour(Math.max(0, elapsedHours - deltaHours), clock?.calendar);
  return {
    deltaHours,
    elapsedHours,
    day: end.day,
    daypart: daypart(end.hour, clock?.calendar),
    startDay: start.day,
    startDaypart: daypart(start.hour, clock?.calendar),
  };
};

/** How a run failed, for a caller that sorts failures rather than printing them. */
export type StatCodeFailure = 'timeout' | 'non-number' | 'throw';

export interface StatCodeResult {
  value: number | null;
  error: string | null;
  /** Present exactly when `error` is. */
  kind?: StatCodeFailure;
}

/** Run a stat's untrusted `code` in an isolated QuickJS (WASM) VM to compute `currentStat`'s value from
 *  the other stats and the story clock, clamped to its `[min, max]`. A ~1s interrupt timeout, memory, and
 *  stack caps bound it; empty code yields `{value: null}` (keep the manual value), and any error/non-number
 *  surfaces in `error`. Omitting `clock` runs at the flat hour on day one, which is what the editor's
 *  test button and any clock-less caller want. */
export const executeStatCode = async (
  code: string,
  stats: Stat[],
  currentStat: Stat,
  clock?: StatClock,
): Promise<StatCodeResult> => {
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
        ...Object.entries(resolveClock(clock)).map(([name, value]) => `const ${name} = ${JSON.stringify(value)};`),
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
          return { value: null, error: 'Execution timed out', kind: 'timeout' };
        }
        return {
          value: null,
          error: `Error: ${err.message}\nStack: ${err.stack || 'No stack trace available'}`,
          kind: 'throw'
        };
      }

      const raw = vm.dump(result.value);
      result.value.dispose();

      if (consoleOutput.trim()) {
        console.log('Console output:', consoleOutput);
      }

      // Ensure the result is a number, clamped to the stat's min/max range.
      if (typeof raw !== 'number') {
        return {
          value: null,
          error: 'Error: Code must return a number\nStack: No stack trace available',
          kind: 'non-number'
        };
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
      error: `Error: ${(error as Error).message}\nStack: ${(error as Error).stack || 'No stack trace available'}`,
      kind: 'throw'
    };
  }
};
