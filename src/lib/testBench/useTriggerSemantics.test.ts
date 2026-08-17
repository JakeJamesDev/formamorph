import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { Dictionary } from '@/types';
import { entryVectorKey } from '@/lib/semanticDictionary';
import { getVectors } from '@/lib/embeddingCache';
import { embedTexts, isEmbeddingModelReady, loadEmbeddingModel } from '@/lib/embeddingWorkerClient';
import type { TriggerWorld } from './triggers';
import { useTriggerSemantics } from './useTriggerSemantics';

vi.mock('@/lib/embeddingCache', () => ({ getVectors: vi.fn() }));
vi.mock('@/lib/embeddingWorkerClient', () => ({
  embedTexts: vi.fn(),
  isEmbeddingModelReady: vi.fn(),
  loadEmbeddingModel: vi.fn(),
}));

const book: Dictionary = {
  id: 'book1',
  name: 'Sedge Lore',
  entries: [
    { id: 'd1', name: 'Old Beacon', key: ['beacon'], value: 'The beacon has not burned in years.' },
    { id: 'd2', name: 'Tides', key: ['tide'], value: 'The tide runs twice a day.' },
  ],
};
const world: TriggerWorld = { entities: [], dictionaries: [book], placeholders: [] };
const keys = book.entries.map(entryVectorKey);
const vector = () => new Float32Array([1, 0]);

/** The cache holding a vector for every entry — a world that has been played with semantic lore on. */
const indexed = () => new Map(keys.map((k) => [k, vector()]));

const cached = vi.mocked(getVectors);
const embed = vi.mocked(embedTexts);
const modelReady = vi.mocked(isEmbeddingModelReady);
const loadModel = vi.mocked(loadEmbeddingModel);

/** The debounce every test drives the hook at — its own, not the default, so the parameter is exercised
 *  rather than merely offered. */
const DELAY = 40;

/** Let the debounce fire and every promise behind it settle. The probe and the embed are two debounced
 *  stages in sequence, so reaching a score takes more than one of these windows. */
const settle = async (ms = DELAY, rounds = 3) => {
  for (let round = 0; round < rounds; round++) {
    await act(async () => {
      vi.advanceTimersByTime(ms);
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
  }
};

beforeEach(() => {
  vi.useFakeTimers();
  cached.mockResolvedValue(indexed());
  embed.mockResolvedValue([vector()]);
  modelReady.mockReturnValue(true);
  loadModel.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe('useTriggerSemantics — whether the toggle can be turned on', () => {
  it('asks the cache for this world’s entry vectors and reports an index it finds', async () => {
    const { result } = renderHook(() => useTriggerSemantics(true, false, world, 'The tide pulls out.', DELAY));
    expect(result.current.status).toBe('checking');
    await settle();
    expect(cached).toHaveBeenCalledWith(keys);
    expect(result.current.available).toBe(true);
    expect(result.current.status).toBe('off');
  });

  it('reports no index when the cache holds nothing for them', async () => {
    cached.mockResolvedValue(new Map());
    const { result } = renderHook(() => useTriggerSemantics(true, false, world, 'The tide pulls out.', DELAY));
    await settle();
    expect(result.current.available).toBe(false);
    expect(result.current.status).toBe('unavailable');
  });

  it('treats a cache that will not open as no index rather than an error', async () => {
    cached.mockRejectedValue(new Error('IndexedDB is gone'));
    const { result } = renderHook(() => useTriggerSemantics(true, false, world, 'The tide pulls out.', DELAY));
    await settle();
    expect(result.current.status).toBe('unavailable');
  });

  it('reads nothing at all while the tab is not on screen', async () => {
    renderHook(() => useTriggerSemantics(false, false, world, 'The tide pulls out.', DELAY));
    await settle();
    expect(cached).not.toHaveBeenCalled();
  });

  it('does not even hash the dictionary behind a closed tab', async () => {
    // Content-hashing every entry to answer a question nobody is asking is exactly the background cost this
    // instrument exists to make visible, and the editor moves the world object on every keystroke.
    let reads = 0;
    const watched = (): TriggerWorld => ({
      entities: [],
      placeholders: [],
      get dictionaries() { reads++; return [book]; },
    });
    const { rerender } = renderHook(
      ({ w, on }) => useTriggerSemantics(on, false, w, 'The tide pulls out.', DELAY),
      { initialProps: { w: watched(), on: false } },
    );
    rerender({ w: watched(), on: false });
    await settle();
    expect(reads).toBe(0);

    // And the probe is not simply dead: opening the tab reads the very same world.
    rerender({ w: watched(), on: true });
    await settle();
    expect(reads).toBeGreaterThan(0);
  });
});

describe('useTriggerSemantics — with the toggle off', () => {
  it('never opens the model and never embeds anything', async () => {
    const { result, rerender } = renderHook(
      ({ text }) => useTriggerSemantics(true, false, world, text, DELAY),
      { initialProps: { text: '' } },
    );
    for (const text of ['The tide', 'The tide pulls out past the tower.']) {
      rerender({ text });
      await settle();
    }
    expect(loadModel).not.toHaveBeenCalled();
    expect(embed).not.toHaveBeenCalled();
    expect(result.current.input).toBeUndefined();
  });
});

describe('useTriggerSemantics — with the toggle on', () => {
  it('embeds the pasted text and hands over both halves of the score', async () => {
    const { result } = renderHook(() => useTriggerSemantics(true, true, world, 'The tide pulls out.', DELAY));
    await settle();
    expect(embed).toHaveBeenCalledWith(['The tide pulls out.']);
    expect(result.current.status).toBe('ready');
    expect(result.current.input?.queryVec).toEqual(vector());
    expect([...(result.current.input?.vectors.keys() ?? [])]).toEqual(keys);
  });

  it('opens the model first when this session has not loaded it', async () => {
    modelReady.mockReturnValue(false);
    const { result } = renderHook(() => useTriggerSemantics(true, true, world, 'The tide pulls out.', DELAY));
    await settle();
    expect(loadModel).toHaveBeenCalled();
    expect(result.current.status).toBe('ready');
  });

  it('has nothing to score before anything is pasted', async () => {
    const { result } = renderHook(() => useTriggerSemantics(true, true, world, '   ', DELAY));
    await settle();
    expect(embed).not.toHaveBeenCalled();
    expect(result.current.status).toBe('waiting');
  });

  it('drops the old vector the moment the text changes, rather than scoring new prose with it', async () => {
    const { result, rerender } = renderHook(
      ({ text }) => useTriggerSemantics(true, true, world, text, DELAY),
      { initialProps: { text: 'The tide pulls out.' } },
    );
    await settle();
    const first = result.current.input;
    expect(first).toBeDefined();

    embed.mockResolvedValue([new Float32Array([0, 1])]);
    rerender({ text: 'The beacon is cold.' });
    // Before the new vector lands there is no input at all — no score beside text it was not computed for.
    expect(result.current.input).toBeUndefined();
    expect(result.current.status).toBe('loading');
    await settle();
    expect(result.current.input?.queryVec).toEqual(new Float32Array([0, 1]));
  });

  it('embeds once for one text, whatever else moves beneath it', async () => {
    const { rerender } = renderHook(
      ({ w }) => useTriggerSemantics(true, true, w, 'The tide pulls out.', DELAY),
      { initialProps: { w: world } },
    );
    await settle();
    // A keystroke elsewhere in the editor: a new world object, the same entries.
    rerender({ w: { ...world } });
    await settle();
    expect(embed).toHaveBeenCalledTimes(1);
  });

  it('reports a failed embed instead of pretending there are no matches', async () => {
    embed.mockRejectedValue(new Error('worker died'));
    const { result } = renderHook(() => useTriggerSemantics(true, true, world, 'The tide pulls out.', DELAY));
    await settle();
    expect(result.current.status).toBe('error');
    expect(result.current.input).toBeUndefined();
  });

  it('stops reporting a failure once the text it failed on is gone', async () => {
    embed.mockRejectedValue(new Error('worker died'));
    const { result, rerender } = renderHook(
      ({ text }) => useTriggerSemantics(true, true, world, text, DELAY),
      { initialProps: { text: 'The tide pulls out.' } },
    );
    await settle();
    expect(result.current.status).toBe('error');

    embed.mockResolvedValue([vector()]);
    rerender({ text: 'The beacon is cold.' });
    // The old failure was about text that is no longer on screen; this one is being embedded right now.
    expect(result.current.status).toBe('loading');
    await settle();
    expect(result.current.status).toBe('ready');
  });

  it('gives back nothing the moment the author turns it off', async () => {
    const { result, rerender } = renderHook(
      ({ on }) => useTriggerSemantics(true, on, world, 'The tide pulls out.', DELAY),
      { initialProps: { on: true } },
    );
    await settle();
    expect(result.current.input).toBeDefined();
    rerender({ on: false });
    expect(result.current.input).toBeUndefined();
    expect(result.current.status).toBe('off');
  });
});
