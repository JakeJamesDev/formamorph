import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useClosingSnapshot } from './useClosingSnapshot';

describe('useClosingSnapshot', () => {
  it('returns the live value while open, and the last value while closing', () => {
    const { result, rerender } = renderHook(
      ({ open, value }) => useClosingSnapshot(open, value),
      { initialProps: { open: true, value: 'A' as string | null } },
    );
    expect(result.current).toBe('A');

    rerender({ open: false, value: null }); // closing + state cleared → keep showing A during fade-out
    expect(result.current).toBe('A');

    rerender({ open: true, value: 'B' }); // reopen with new content
    expect(result.current).toBe('B');

    rerender({ open: false, value: null });
    expect(result.current).toBe('B');
  });

  it('passes the live value through when uncontrolled (open undefined)', () => {
    const { result, rerender } = renderHook(
      ({ value }) => useClosingSnapshot(undefined, value),
      { initialProps: { value: 'X' } },
    );
    expect(result.current).toBe('X');
    rerender({ value: 'Y' });
    expect(result.current).toBe('Y');
  });
});
