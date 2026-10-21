/**
 * @vitest-environment node
 * (No DOM needed; node keeps the QuickJS WASM engine loading through its filesystem path.)
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { runInSandbox, type SandboxEngine } from './scriptSandbox';

afterEach(() => { vi.restoreAllMocks(); });

/** A program whose first call takes five seconds of the clock the budget reads; the loop after it gives the
 *  interrupt a turn. `slow` moves that clock. */
async function runAfterSlowCall(engine: SandboxEngine, call: string, slow: (advance: () => void) => void) {
  const realNow = Date.now.bind(Date);
  let offset = 0;
  vi.spyOn(Date, 'now').mockImplementation(() => realNow() + offset);
  slow(() => { offset += 5000; });
  const program = `${call}; let n = 0; for (let i = 0; i < 300000; i++) n += i; 'done';`;
  return runInSandbox(program, ({ vm, result, timedOut }) => ({ timedOut, value: (result.error ? vm.dump(result.error) : vm.dump(result.value)) as unknown }), {
    slowHost: (vm) => { offset += 5000; return vm.undefined; },
  }, engine);
}

describe('the run budget', () => {
  it.each<SandboxEngine>(['sync', 'async'])('pauses while a host function runs on the %s engine (Q49)', async (engine) => {
    expect(await runAfterSlowCall(engine, 'slowHost()', () => {})).toEqual({ timedOut: false, value: 'done' });
  });

  it.each<SandboxEngine>(['sync', 'async'])('pauses while console.log runs on the %s engine (Q49)', async (engine) => {
    const outcome = await runAfterSlowCall(engine, 'console.log("x")', (advance) => {
      vi.spyOn(console, 'log').mockImplementation(advance);
    });
    expect(outcome).toEqual({ timedOut: false, value: 'done' });
  });
});
