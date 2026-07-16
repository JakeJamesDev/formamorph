import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useResetOnOpen } from './useResetOnOpen';

describe('useResetOnOpen', () => {
  it('resets on the open transition, but never on close (the flash guard)', () => {
    const reset = vi.fn();
    const { rerender } = renderHook(({ open }) => useResetOnOpen(open, reset), { initialProps: { open: false } });
    expect(reset).toHaveBeenCalledTimes(0);

    rerender({ open: true }); // open → reset
    expect(reset).toHaveBeenCalledTimes(1);

    rerender({ open: true }); // still open → no re-reset (wouldn't clobber typing)
    expect(reset).toHaveBeenCalledTimes(1);

    rerender({ open: false }); // close → must NOT reset (else the content flashes during fade-out)
    expect(reset).toHaveBeenCalledTimes(1);

    rerender({ open: true }); // reopen → reset again
    expect(reset).toHaveBeenCalledTimes(2);
  });

  it('resets on mount when it starts open', () => {
    const reset = vi.fn();
    renderHook(() => useResetOnOpen(true, reset));
    expect(reset).toHaveBeenCalledTimes(1);
  });
});
