import { describe, it, expect, vi, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { Dictionary } from '@/types';
import { useDebouncedTriggerReport } from './useTriggerReport';
import type { TriggerWorld } from './triggers';

const book: Dictionary = {
  id: 'book1',
  name: 'Sedge Lore',
  entries: [{ id: 'd1', name: 'Tides', key: ['tide'], value: 'The tide runs twice a day.' }],
};

const world: TriggerWorld = { entities: [], dictionaries: [book], placeholders: [] };

afterEach(() => vi.useRealTimers());

describe('useDebouncedTriggerReport', () => {
  it('has an answer before the first paint', () => {
    const { result } = renderHook(() => useDebouncedTriggerReport(world, 'The tide pulls out.'));
    expect(result.current.fired).toBe(1);
  });

  it('holds the previous answer until the typing stops', () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(({ text }) => useDebouncedTriggerReport(world, text, '', 250), {
      initialProps: { text: '' },
    });
    rerender({ text: 'The tide pulls out.' });
    expect(result.current.fired).toBe(0);
    act(() => { vi.advanceTimersByTime(250); });
    expect(result.current.fired).toBe(1);
  });

  it('does not re-scan the dictionary per keystroke — only the last text is traced', () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(({ text }) => useDebouncedTriggerReport(world, text, '', 250), {
      initialProps: { text: '' },
    });
    for (const text of ['T', 'The t', 'The tide pulls out.']) {
      rerender({ text });
      act(() => { vi.advanceTimersByTime(200); });
    }
    // Every keystroke restarted the clock, so nothing has been traced yet.
    expect(result.current.fired).toBe(0);
    act(() => { vi.advanceTimersByTime(250); });
    expect(result.current.fired).toBe(1);
  });

  it('re-traces when the history behind the text changes', () => {
    vi.useFakeTimers();
    // One stable world identity, so the only thing that can move the verdict is the history.
    const deep: TriggerWorld = {
      ...world,
      dictionaries: [{ ...book, entries: [{ ...book.entries[0], scanDepth: 1 }] }],
    };
    const { result, rerender } = renderHook(
      ({ history }) => useDebouncedTriggerReport(deep, 'A quiet morning.', history, 250),
      { initialProps: { history: '' } },
    );
    expect(result.current.fired).toBe(0);
    rerender({ history: 'The tide pulled out.' });
    act(() => { vi.advanceTimersByTime(250); });
    expect(result.current.fired).toBe(1);
  });

  it('re-traces the same text when the world beneath it changes', () => {
    vi.useFakeTimers();
    const text = 'The tide pulls out.';
    const { result, rerender } = renderHook(({ w }) => useDebouncedTriggerReport(w, text, '', 250), {
      initialProps: { w: world },
    });
    expect(result.current.fired).toBe(1);
    rerender({ w: { ...world, dictionaries: [{ ...book, enabled: false }] } });
    act(() => { vi.advanceTimersByTime(250); });
    expect(result.current.fired).toBe(0);
  });
});
