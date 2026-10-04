// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useDebouncedValue } from './useDebouncedValue';

describe('useDebouncedValue', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('returns the first value at once', () => {
    const { result } = renderHook(() => useDebouncedValue('a', 500));
    expect(result.current).toBe('a');
  });

  it('holds the old value until the new one has held still for the delay', () => {
    const { result, rerender } = renderHook(({ v }) => useDebouncedValue(v, 500), { initialProps: { v: 'a' } });
    rerender({ v: 'ab' });
    act(() => { vi.advanceTimersByTime(400); });
    expect(result.current).toBe('a');
    rerender({ v: 'abc' });
    act(() => { vi.advanceTimersByTime(400); });
    expect(result.current).toBe('a');
    act(() => { vi.advanceTimersByTime(100); });
    expect(result.current).toBe('abc');
  });
});
