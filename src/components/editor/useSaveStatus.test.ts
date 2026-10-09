// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { SAVED_HOLD_MS, saveStatusOf, useSaveStatus } from './useSaveStatus';

/** A save the test settles by hand. */
const deferred = () => {
  let settle!: (ok: boolean) => void;
  const promise = new Promise<boolean>((resolve) => { settle = resolve; });
  return { promise, settle };
};

describe('saveStatusOf', () => {
  it.each([
    ['idle', false, 'clean'],
    ['idle', true, 'pending'],
    ['saving', true, 'saving'],
    ['saved', false, 'saved'],
    ['saved', true, 'pending'],
    ['failed', false, 'failed'],
    ['failed', true, 'failed'],
  ] as const)('reads %s with dirty %s as %s', (phase, dirty, status) => {
    expect(saveStatusOf(phase, dirty)).toBe(status);
  });
});

describe('useSaveStatus', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('walks Saving, Saved, then the muted Save after the hold', async () => {
    const { result, rerender } = renderHook(({ dirty }) => useSaveStatus(dirty), { initialProps: { dirty: true } });
    expect(result.current.status).toBe('pending');
    const save = deferred();
    act(() => { void result.current.track(() => save.promise); });
    expect(result.current.status).toBe('saving');

    rerender({ dirty: false });
    await act(async () => { save.settle(true); });
    expect(result.current.status).toBe('saved');

    act(() => { vi.advanceTimersByTime(SAVED_HOLD_MS - 1); });
    expect(result.current.status).toBe('saved');
    act(() => { vi.advanceTimersByTime(1); });
    expect(result.current.status).toBe('clean');
  });

  it('ends the hold on an edit, and an undo back to the saved world stays the muted Save', async () => {
    const { result, rerender } = renderHook(({ dirty }) => useSaveStatus(dirty), { initialProps: { dirty: false } });
    await act(async () => { await result.current.track(async () => true); });
    expect(result.current.status).toBe('saved');

    rerender({ dirty: true });
    expect(result.current.status).toBe('pending');
    rerender({ dirty: false });
    expect(result.current.status).toBe('clean');
  });

  it('skips Saved for a save the world was edited during, so an undo back reads the muted Save', async () => {
    const { result, rerender } = renderHook(({ dirty }) => useSaveStatus(dirty), { initialProps: { dirty: true } });
    const save = deferred();
    act(() => { void result.current.track(() => save.promise); });
    act(() => { result.current.edited(); });
    await act(async () => { save.settle(true); });
    expect(result.current.status).toBe('pending');
    rerender({ dirty: false });
    expect(result.current.status).toBe('clean');
  });

  it('holds Failed through edits until a save succeeds', async () => {
    const { result, rerender } = renderHook(({ dirty }) => useSaveStatus(dirty), { initialProps: { dirty: true } });
    await act(async () => { await result.current.track(async () => false); });
    expect(result.current.status).toBe('failed');

    act(() => { vi.advanceTimersByTime(SAVED_HOLD_MS * 5); });
    rerender({ dirty: false });
    rerender({ dirty: true });
    expect(result.current.status).toBe('failed');

    await act(async () => { await result.current.track(async () => true); });
    rerender({ dirty: false });
    expect(result.current.status).toBe('saved');
  });

  it('shows Saved when the save lands a render before the dirty flag clears', async () => {
    const { result, rerender } = renderHook(({ dirty }) => useSaveStatus(dirty), { initialProps: { dirty: true } });
    await act(async () => { await result.current.track(async () => true); });
    expect(result.current.status).toBe('pending');
    rerender({ dirty: false });
    expect(result.current.status).toBe('saved');
  });

  it('reads a save that throws as Failed and passes the error on', async () => {
    const { result } = renderHook(() => useSaveStatus(true));
    let caught: unknown;
    await act(async () => { await result.current.track(() => Promise.reject(new Error('disk'))).catch((e: unknown) => { caught = e; }); });
    expect(result.current.status).toBe('failed');
    expect(caught).toBeInstanceOf(Error);
  });

  it('gives a second call during a save the running save, not a second write', async () => {
    const { result } = renderHook(() => useSaveStatus(true));
    const save = deferred();
    const write = vi.fn(() => save.promise);
    let first!: Promise<boolean>;
    let second!: Promise<boolean>;
    act(() => { first = result.current.track(write); });
    act(() => { second = result.current.track(write); });
    expect(second).toBe(first);
    expect(write).toHaveBeenCalledTimes(1);
    await act(async () => { save.settle(true); });
    await expect(second).resolves.toBe(true);
  });

  it('starts a new hold for a save made during the old one', async () => {
    const { result } = renderHook(() => useSaveStatus(false));
    await act(async () => { await result.current.track(async () => true); });
    act(() => { vi.advanceTimersByTime(SAVED_HOLD_MS - 500); });
    await act(async () => { await result.current.track(async () => true); });
    act(() => { vi.advanceTimersByTime(1000); });
    expect(result.current.status).toBe('saved');
  });
});
