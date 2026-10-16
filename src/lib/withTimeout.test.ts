import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { withTimeout } from './withTimeout';

describe('withTimeout', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('returns the value and leaves no timer when the promise wins', async () => {
    await expect(withTimeout(Promise.resolve('done'), 1000, null)).resolves.toBe('done');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('returns the fallback and leaves no timer when the timeout wins', async () => {
    const result = withTimeout(new Promise<string>(() => {}), 1000, 'late');
    await vi.advanceTimersByTimeAsync(1000);
    await expect(result).resolves.toBe('late');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('rejects and leaves no timer when the promise rejects first', async () => {
    await expect(withTimeout(Promise.reject(new Error('boom')), 1000, null)).rejects.toThrow('boom');
    expect(vi.getTimerCount()).toBe(0);
  });
});
