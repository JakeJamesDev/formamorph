import { describe, it, expect, vi, afterEach } from 'vitest';
import perfMeter from './perfMeter.cjs';

const { start, ENABLED } = perfMeter;

afterEach(() => { vi.restoreAllMocks(); });

// The meter is a diagnostic. Two things matter more than what it prints: that a normal launch never pays for
// it, and that it can never be the reason the app dies.
describe('perf meter', () => {
  it('stays off unless it was asked for', () => {
    // vitest is not launched with --perf-meter, so this is the shipped default.
    expect(ENABLED).toBe(false);
  });

  it('touches nothing and prints nothing when off', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const getWindow = vi.fn();
    const getEnginePid = vi.fn();

    const stop = start({ getWindow, getEnginePid });
    stop();

    expect(getWindow).not.toHaveBeenCalled();
    expect(getEnginePid).not.toHaveBeenCalled();
    expect(log).not.toHaveBeenCalled();
  });

  it('returns a stop function that is safe to call when off', () => {
    const stop = start();
    expect(() => { stop(); stop(); }).not.toThrow();
  });
});
