/**
 * Counts a sandbox run's host function calls. A test mocks `@/lib/scriptSandbox` with `countingSandbox` and reads
 * `hostCalls`, which the test clears before each case.
 */
import type * as Sandbox from '@/lib/scriptSandbox';

/** Every host function call of the counted runs, by hook name. */
export const hostCalls: string[] = [];

/** `sandbox` with every run's host functions recorded in `hostCalls` as they are called. */
export const countingSandbox = (sandbox: typeof Sandbox): typeof Sandbox => ({
  ...sandbox,
  runInSandbox: (program, read, hostFunctions = {}, engine) =>
    sandbox.runInSandbox(program, read, Object.fromEntries(Object.entries(hostFunctions).map(([name, fn]) =>
      [name, (...args: Parameters<typeof fn>) => { hostCalls.push(name); return fn(...args); }])), engine),
});
