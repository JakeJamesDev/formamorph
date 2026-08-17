import { describe, it, expect, vi, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { entryVectorKey } from '@/lib/semanticDictionary';
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
    const { result, rerender } = renderHook(({ text }) => useDebouncedTriggerReport(world, text, '', { delayMs: 250 }), {
      initialProps: { text: '' },
    });
    rerender({ text: 'The tide pulls out.' });
    expect(result.current.fired).toBe(0);
    act(() => { vi.advanceTimersByTime(250); });
    expect(result.current.fired).toBe(1);
  });

  it('does not re-scan the dictionary per keystroke — only the last text is traced', () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(({ text }) => useDebouncedTriggerReport(world, text, '', { delayMs: 250 }), {
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
      ({ history }) => useDebouncedTriggerReport(deep, 'A quiet morning.', history, { delayMs: 250 }),
      { initialProps: { history: '' } },
    );
    expect(result.current.fired).toBe(0);
    rerender({ history: 'The tide pulled out.' });
    act(() => { vi.advanceTimersByTime(250); });
    expect(result.current.fired).toBe(1);
  });

  it('re-traces when the semantic vectors arrive, and again when they are taken away', () => {
    vi.useFakeTimers();
    // Nothing in this text is a keyword, so only a semantic pass can make the entry fire.
    const text = 'A quiet morning on the water.';
    const semantic = {
      queryVec: new Float32Array([1, 0]),
      vectors: new Map([[entryVectorKey(book.entries[0]), new Float32Array([1, 0])]]),
      threshold: 0.4,
    };
    const { result, rerender } = renderHook(
      ({ input }) => useDebouncedTriggerReport(world, text, '', { semantic: input, delayMs: 250 }),
      { initialProps: { input: undefined as typeof semantic | undefined } },
    );
    expect(result.current.fired).toBe(0);
    rerender({ input: semantic });
    act(() => { vi.advanceTimersByTime(250); });
    expect(result.current.entries[0].reason).toBe('semantic');
    // Losing the vectors takes effect at once: the toggle beside the results already reads "off", and a
    // score outliving it by a debounce would contradict it on screen.
    rerender({ input: undefined });
    expect(result.current.fired).toBe(0);
    expect(result.current.semantic).toBeUndefined();
  });

  it('re-traces the same text when the world beneath it changes', () => {
    vi.useFakeTimers();
    const text = 'The tide pulls out.';
    const { result, rerender } = renderHook(({ w }) => useDebouncedTriggerReport(w, text, '', { delayMs: 250 }), {
      initialProps: { w: world },
    });
    expect(result.current.fired).toBe(1);
    rerender({ w: { ...world, dictionaries: [{ ...book, enabled: false }] } });
    act(() => { vi.advanceTimersByTime(250); });
    expect(result.current.fired).toBe(0);
  });
});
