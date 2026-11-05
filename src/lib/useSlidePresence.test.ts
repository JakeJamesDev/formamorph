// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useSlidePresence } from './useSlidePresence';

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

const run = (ms: number) => act(() => { vi.advanceTimersByTime(ms); });

describe('useSlidePresence', () => {
  it('keeps the section mounted through the close, then unmounts it', () => {
    const { result, rerender } = renderHook(({ want }) => useSlidePresence(want, 200, false), { initialProps: { want: true } });
    expect(result.current).toEqual({ mounted: true, open: true });

    rerender({ want: false });
    expect(result.current).toEqual({ mounted: true, open: false });
    run(199);
    expect(result.current.mounted).toBe(true);
    run(2);
    expect(result.current).toEqual({ mounted: false, open: false });
  });

  it('mounts closed, then opens a frame later so the slide has a start', () => {
    const { result, rerender } = renderHook(({ want }) => useSlidePresence(want, 200, false), { initialProps: { want: false } });
    expect(result.current.mounted).toBe(false);
    rerender({ want: true });
    expect(result.current).toEqual({ mounted: true, open: false });
    run(50);
    expect(result.current).toEqual({ mounted: true, open: true });
  });

  it('ends open when a reopen interrupts the close, and never unmounts afterwards', () => {
    const { result, rerender } = renderHook(({ want }) => useSlidePresence(want, 200, false), { initialProps: { want: true } });
    rerender({ want: false });
    run(100);
    rerender({ want: true });
    run(400);
    expect(result.current).toEqual({ mounted: true, open: true });
  });

  it('ends closed when a close interrupts the open', () => {
    const { result, rerender } = renderHook(({ want }) => useSlidePresence(want, 200, false), { initialProps: { want: false } });
    rerender({ want: true });
    rerender({ want: false });
    run(400);
    expect(result.current).toEqual({ mounted: false, open: false });
  });

  it('changes at once with reduced motion', () => {
    const { result, rerender } = renderHook(({ want }) => useSlidePresence(want, 200, true), { initialProps: { want: true } });
    rerender({ want: false });
    expect(result.current).toEqual({ mounted: false, open: false });
    rerender({ want: true });
    expect(result.current).toEqual({ mounted: true, open: true });
  });
});
