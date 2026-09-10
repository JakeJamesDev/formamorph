import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { WorldOverview } from '@/types';
import { measurePublishBytes } from '@/lib/publishLimits';
import { worldPublishPayload } from '@/lib/publishPayload';
import { APP_VERSION } from '@/lib/version';
import { usePublishSize } from './usePublishSize';
import { RULE_DEBOUNCE_MS } from './useFindings';
import type { RuleWorld } from './rules';

// The worker itself can't run in jsdom; its stand-in answers with the real measure, off a promise.
const mocks = vi.hoisted(() => ({ measure: vi.fn(), terminate: vi.fn() }));
vi.mock('@/lib/jsonMeasureClient', () => ({
  measureJsonBytes: mocks.measure,
  terminateMeasureWorker: mocks.terminate,
}));

const world = (name: string): RuleWorld => ({
  worldOverview: { name, description: '' } as WorldOverview,
  stats: [], locations: [], entities: [], traits: [], statUpdates: [], dictionaries: [], placeholders: [],
});

/** Let the measure's promise settle inside act. */
const settle = () => act(async () => { await Promise.resolve(); });

beforeEach(() => {
  mocks.measure.mockReset().mockImplementation(async (value: unknown) => measurePublishBytes(value));
  mocks.terminate.mockReset();
});
afterEach(() => vi.useRealTimers());

describe('usePublishSize', () => {
  it('shows nothing until the first result, which does not wait for the debounce', async () => {
    const { result } = renderHook(() => usePublishSize(world('Sedge Landing')));
    expect(result.current).toBeNull();

    await settle();
    expect(result.current).not.toBeNull();
  });

  it('measures the content a publish sends: the stored copy, version stamped, tags included', async () => {
    // A world with no tags publishes `"tags":[]` in its overview, and the stored copy carries `version`. The
    // server counts both, so the editor's bare world is the wrong thing to measure.
    const w = world('Sedge Landing');
    const { result } = renderHook(() => usePublishSize(w));
    await settle();

    expect(result.current).toBe(measurePublishBytes(worldPublishPayload({ version: APP_VERSION, ...w }).contentData));
    expect(result.current).not.toBe(measurePublishBytes(worldPublishPayload(w).contentData));
    expect(result.current).not.toBe(measurePublishBytes(w));
  });

  it('keeps the last figure through an edit, and measures once the world has been still', async () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(({ w }) => usePublishSize(w), {
      initialProps: { w: world('Sedge') },
    });
    await settle();
    const first = result.current;

    rerender({ w: world('Sedge Landing, grown') });
    await act(async () => { vi.advanceTimersByTime(RULE_DEBOUNCE_MS - 1); });
    expect(mocks.measure).toHaveBeenCalledTimes(1);
    expect(result.current).toBe(first);

    await act(async () => { vi.advanceTimersByTime(1); });
    await settle();
    expect(mocks.measure).toHaveBeenCalledTimes(2);
    expect(result.current).toBeGreaterThan(first!);
  });

  it('measures a burst of edits once', async () => {
    vi.useFakeTimers();
    const { rerender } = renderHook(({ w }) => usePublishSize(w), { initialProps: { w: world('a') } });
    await settle();

    for (const name of ['ab', 'abc', 'abcd']) {
      rerender({ w: world(name) });
      await act(async () => { vi.advanceTimersByTime(RULE_DEBOUNCE_MS / 2); });
    }
    await act(async () => { vi.advanceTimersByTime(RULE_DEBOUNCE_MS); });
    expect(mocks.measure).toHaveBeenCalledTimes(2);
  });

  it('never lets a slow earlier result overwrite a newer one', async () => {
    vi.useFakeTimers();
    let finishFirst!: (bytes: number) => void;
    mocks.measure.mockImplementationOnce(() => new Promise<number>((resolve) => { finishFirst = resolve; }));
    const { result, rerender } = renderHook(({ w }) => usePublishSize(w), { initialProps: { w: world('a') } });

    rerender({ w: world('Sedge Landing') });
    await act(async () => { vi.advanceTimersByTime(RULE_DEBOUNCE_MS); });
    await settle();
    const newer = result.current;
    expect(newer).not.toBeNull();

    await act(async () => { finishFirst(1); });
    expect(result.current).toBe(newer);
  });

  it('keeps the last figure when a measure fails', async () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(({ w }) => usePublishSize(w), { initialProps: { w: world('a') } });
    await settle();
    const known = result.current;

    mocks.measure.mockRejectedValueOnce(new Error('Worker failed to load'));
    rerender({ w: world('ab') });
    await act(async () => { vi.advanceTimersByTime(RULE_DEBOUNCE_MS); });
    await settle();
    expect(result.current).toBe(known);
  });

  it('stops the measure worker when the editor closes', () => {
    const { unmount } = renderHook(() => usePublishSize(world('a')));
    unmount();
    expect(mocks.terminate).toHaveBeenCalled();
  });
});
