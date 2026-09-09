import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useLingeringMount } from './useLingeringMount';

describe('useLingeringMount', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('mounts with open in the same render and lingers for the delay after close', () => {
    const { result, rerender } = renderHook(({ open }) => useLingeringMount(open, 250), { initialProps: { open: false } });
    expect(result.current).toBe(false);
    rerender({ open: true });
    expect(result.current).toBe(true);
    rerender({ open: false });
    expect(result.current).toBe(true);
    act(() => { vi.advanceTimersByTime(249); });
    expect(result.current).toBe(true);
    act(() => { vi.advanceTimersByTime(1); });
    expect(result.current).toBe(false);
  });

  it('cancels the pending unmount when reopened before the delay ends', () => {
    const { result, rerender } = renderHook(({ open }) => useLingeringMount(open, 250), { initialProps: { open: true } });
    rerender({ open: false });
    act(() => { vi.advanceTimersByTime(100); });
    rerender({ open: true });
    act(() => { vi.advanceTimersByTime(500); });
    expect(result.current).toBe(true);
  });
});
