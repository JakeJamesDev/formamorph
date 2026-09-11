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
  /** The value the code set, by return or by `self.value`, clamped; null when it left the value alone. */
  value: number | null;
  error: string | null;
  /** Present exactly when `error` is. */
  kind?: StatCodeFailure;
}

/** A stat's value and max, as one turn input carries them. */
export interface ValueAndMax {
  value: number;
  max: number;
}

/** What this turn did to one stat before its code runs. Every entry in `stats` carries these; a part left
 *  out reads as untouched: `previous` as the current numbers, the rest as zero. */
export interface StatTurnInputs {
  /** Value and max at the start of the turn. */
  previous?: ValueAndMax;
  /** The AI's asked change to value and max, raw: before flags and clamping. */
  requested?: ValueAndMax;
  /** Regen applied this turn, after the enabled gate and clamping. */
  regenApplied?: number;
}

/** One entry of the sandbox's `placeholders` map. `roll` runs on the host; the rest rides in as data. */
export interface SandboxPlaceholder {
  name: string;
  value: string;
  values: readonly string[];
  roll: () => string;
}

// The host hook every entry's `roll()` calls. The prelude takes it and deletes the global before user code runs.
const ROLL_HOOK = '__formamorphRollPlaceholder';

/** The prelude line that builds `placeholders`. Parsed from a JSON string, not a literal, so a name like
 *  `__proto__` is an own key; the map has no prototype, so `toString` is not a name. */
const placeholdersPrelude = (entries: readonly SandboxPlaceholder[]): string => {
  const data = Object.fromEntries(entries.map(({ name, value, values }) => [name, { value, values }]));
  return [
    `const placeholders = ((roll) => {`,
    `  const map = Object.assign(Object.create(null), JSON.parse(${JSON.stringify(JSON.stringify(data))}));`,
    `  for (const name of Object.keys(map)) map[name].roll = () => roll(name);`,
    `  return map;`,
    `})(globalThis.${ROLL_HOOK});`,
    `delete globalThis.${ROLL_HOOK};`,
  ].join('\n');
};

const nonNumberFailure = (what: string): StatCodeResult => ({
  value: null,
  error: `Error: ${what}\nStack: No stack trace available`,
  kind: 'non-number',
});

/** Run a stat's untrusted `code` in an isolated QuickJS (WASM) VM over `stats`, `self`, the turn inputs,
 *  the clock, and `placeholders`. A number return or a `self.value` write sets the value, clamped; a
 *  failure discards it. Of two placeholders sharing a name, the later one is the entry. */
export const executeStatCode = async (
  code: string,
  stats: Stat[],
  currentStat: Stat,
  clock?: StatClock,
  turn?: Readonly<Record<string, StatTurnInputs>>,
  placeholders: readonly SandboxPlaceholder[] = [],
): Promise<StatCodeResult> => {
  // If code is empty, return null (use the manually set value)
  if (!code || code.trim() === '') {
    return { value: null, error: null };
  }

  try {
    const QuickJS = await loadQuickJS();

    // Only whitelisted plain data crosses into the VM (never `code`/`descriptors`).
    const marshal = (stat: Stat) => {
      const value = stat.value || 0;
      const max = stat.max || 100;
      const inputs = turn?.[stat.id];
      return {
        id: String(stat.id),
        name: stat.name || '',
        type: stat.type || 'number',
        description: stat.description || '',
        min: stat.min || 0,
        max,
        value,
        regen: stat.regen || 0,
        previous: { value: inputs?.previous?.value ?? value, max: inputs?.previous?.max ?? max },
        requested: { value: inputs?.requested?.value ?? 0, max: inputs?.requested?.max ?? 0 },
        regenApplied: inputs?.regenApplied ?? 0,
      };
    };
    const statsData = stats.map(marshal);
    // `self` is the current stat's own entry in `stats`; a stat missing from `stats` stands alone.
    const selfIndex = stats.findIndex(stat => stat.id === currentStat.id);
    const selfData = selfIndex >= 0 ? statsData[selfIndex] : marshal(currentStat);

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

      const rollByName = new Map(placeholders.map((entry) => [entry.name, entry.roll]));
      const rollFn = vm.newFunction('roll', (nameHandle) => vm.newString(rollByName.get(vm.getString(nameHandle))?.() ?? ''));
      vm.setProp(vm.global, ROLL_HOOK, rollFn);
      rollFn.dispose();

      // The stat data rides in as JSON literals (JSON is valid JS expression syntax); console.log and the
      // roll hook are the only host functions. The user code runs as a function body so `return` works; the
      // program's completion value pairs what it returned with what `self.value` holds afterwards.
      const program = [
        `const stats = ${JSON.stringify(statsData)};`,
        `const currentStatId = ${JSON.stringify(String(currentStat.id))};`,
        `const self = ${selfIndex >= 0 ? `stats[${selfIndex}]` : JSON.stringify(selfData)};`,
        ...Object.entries(resolveClock(clock)).map(([name, value]) => `const ${name} = ${JSON.stringify(value)};`),
        placeholdersPrelude(placeholders),
        `[(function() {`,
        code,
        `})(), self.value];`,
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

      // Each half is read by its own handle and typeof, never through a JSON dump: a dump turns
      // `undefined` and `NaN` into `null`, which would erase the difference between them.
      const readSlot = (index: number): { type: string; number: number } => {
        const handle = vm.getProp(result.value, index);
        try {
          const type = vm.typeof(handle);
          return { type, number: type === 'number' ? vm.getNumber(handle) : NaN };
        } finally {
          handle.dispose();
        }
      };
      const returned = readSlot(0);
      const written = readSlot(1);
      result.value.dispose();

      if (consoleOutput.trim()) {
        console.log('Console output:', consoleOutput);
      }

      const clampToRange = (value: number) => clamp(value, selfData.min, selfData.max);
      if (returned.type === 'number') return { value: clampToRange(returned.number), error: null };
      if (returned.type !== 'undefined') return nonNumberFailure('Code must return a number or nothing');
      if (written.type !== 'number') return nonNumberFailure('self.value must be a number');
      // A field the code left alone keeps the pipeline's result, so only a changed value is a write.
      if (Object.is(written.number, selfData.value)) return { value: null, error: null };
      return { value: clampToRange(written.number), error: null };
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
