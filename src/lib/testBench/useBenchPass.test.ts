// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { Component, type ReactNode } from 'react';
import { act, renderHook } from '@testing-library/react';
import type { Entity, WorldOverview } from '@/types';
import { measurePublishBytes } from '@/lib/publishLimits';
import { worldPublishPayload } from '@/lib/publishPayload';
import { APP_VERSION } from '@/lib/version';
import { createBenchReplier } from './benchPass';
import { createWorldMirror, type WorldPatch } from './worldMirror';
import { PASS_DEBOUNCE_MS, useBenchPass } from './useBenchPass';
import type { RuleWorld } from './rules';

// Structurally sound (a starting location, the entity placed and described, a prompt and a readme), so only
// the authored alias defect fires.
const world = (entities: Entity[], name = 'Sedge Landing'): RuleWorld => ({
  worldOverview: {
    name, description: '', systemPrompt: 'Narrate the fen.', readme: 'A fen primer.',
  } as WorldOverview,
  stats: [],
  locations: [{ id: 'harbor', name: 'Harbor Steps', isStarting: true }],
  entities: entities.map((e) => ({
    locations: ['harbor'], playerDescription: 'Seen around.', aiDescription: 'A fen regular.', ...e,
  })),
  traits: [], statUpdates: [], dictionaries: [], placeholders: [],
});

const clean = world([{ id: 'e1', name: 'Maren' }]);
const broken = world([{ id: 'e1', name: 'Maren', aliases: ['the visitor'] }]);

/**
 * The Bench worker, run in-thread: the same mirror and pass the real one holds, answering off a promise.
 * `hold` keeps replies back until `release` sends them, oldest first.
 */
class FakeWorker {
  static all: FakeWorker[] = [];
  static hold = false;
  static failLoad = false;
  patches: WorldPatch[] = [];
  terminated = false;
  private held: (() => void)[] = [];
  private listeners = new Map<string, ((event: unknown) => void)[]>();
  private mirror = createWorldMirror();
  private reply = createBenchReplier();

  constructor() { FakeWorker.all.push(this); }

  addEventListener(type: string, fn: (event: unknown) => void) {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), fn]);
  }

  postMessage({ id, patch }: { id: string; patch: WorldPatch }) {
    this.patches.push(patch);
    const emit = (type: string, event: unknown) => this.listeners.get(type)?.forEach((fn) => fn(event));
    if (FakeWorker.failLoad) { queueMicrotask(() => emit('error', { message: 'Worker failed to load' })); return; }
    const result = this.reply(this.mirror.apply(patch));
    const reply = () => emit('message', { data: { type: 'success', id, result: structuredClone(result) } });
    if (FakeWorker.hold) this.held.push(reply); else queueMicrotask(reply);
  }

  release() { this.held.splice(0).forEach((reply) => reply()); }

  terminate() { this.terminated = true; }
}

const withWorker = () => {
  FakeWorker.all = [];
  FakeWorker.hold = false;
  FakeWorker.failLoad = false;
  vi.stubGlobal('Worker', FakeWorker);
};

/** Let the pass's promise settle inside act. */
const settle = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('useBenchPass', () => {
  it('shows nothing until the first pass, which lands just after mount without waiting for the debounce', async () => {
    vi.useFakeTimers();
    withWorker();
    const { result } = renderHook(() => useBenchPass(broken));
    expect(result.current).toEqual({ findings: null, bytes: null });

    await act(async () => { vi.advanceTimersByTime(0); });
    await settle();
    expect(result.current.findings).toHaveLength(1);
    expect(result.current.bytes).not.toBeNull();
  });

  it('measures the content a publish sends: the stored copy, version stamped, tags included', async () => {
    withWorker();
    const { result } = renderHook(() => useBenchPass(clean));
    await vi.waitFor(() => expect(result.current.bytes).not.toBeNull());

    // A world with no tags publishes `"tags":[]` in its overview, and the stored copy carries `version`. The
    // server counts both, so the editor's bare world is the wrong thing to measure.
    expect(result.current.bytes).toBe(measurePublishBytes(worldPublishPayload({ version: APP_VERSION, ...clean }).contentData));
    expect(result.current.bytes).not.toBe(measurePublishBytes(worldPublishPayload(clean).contentData));
  });

  it('holds the previous answer until the edits stop, then makes one pass for the burst', async () => {
    vi.useFakeTimers();
    withWorker();
    const typing = ['t', 'th', 'the visitor'].map((alias) => world([{ id: 'e1', name: 'Maren', aliases: [alias] }]));
    const { result, rerender } = renderHook(({ w }) => useBenchPass(w), { initialProps: { w: clean } });
    await act(async () => { vi.advanceTimersByTime(0); });
    await settle();
    expect(result.current.findings).toEqual([]);

    for (const w of typing) {
      rerender({ w });
      await act(async () => { vi.advanceTimersByTime(PASS_DEBOUNCE_MS - 100); });
    }
    expect(result.current.findings).toEqual([]);
    expect(FakeWorker.all[0].patches).toHaveLength(1);

    await act(async () => { vi.advanceTimersByTime(PASS_DEBOUNCE_MS); });
    await settle();
    expect(result.current.findings).toHaveLength(1);
    expect(FakeWorker.all[0].patches).toHaveLength(2);
  });

  it('sends the worker only the records an edit replaced', async () => {
    vi.useFakeTimers();
    withWorker();
    const first = world([{ id: 'e1', name: 'Maren' }, { id: 'e2', name: 'Odd Wick' }]);
    const { rerender } = renderHook(({ w }) => useBenchPass(w), { initialProps: { w: first } });
    await act(async () => { vi.advanceTimersByTime(0); });
    await settle();

    const edited = { ...first, entities: [first.entities[0], { ...first.entities[1], name: 'Odd Wick the Elder' }] };
    rerender({ w: edited });
    await act(async () => { vi.advanceTimersByTime(PASS_DEBOUNCE_MS); });
    await settle();

    const patch = FakeWorker.all[0].patches[1];
    expect(Object.keys(patch.slices)).toEqual(['entities']);
    expect(patch.slices.entities).toEqual({ kind: 'records', order: ['e1', 'e2'], upserts: [edited.entities[1]] });
  });

  it('keeps the same list through an edit that changes no finding', async () => {
    vi.useFakeTimers();
    withWorker();
    const { result, rerender } = renderHook(({ w }) => useBenchPass(w), { initialProps: { w: broken } });
    await act(async () => { vi.advanceTimersByTime(0); });
    await settle();
    const before = result.current;

    rerender({ w: { ...broken, worldOverview: { ...broken.worldOverview, description: 'A fen, grown.' } } });
    await act(async () => { vi.advanceTimersByTime(PASS_DEBOUNCE_MS); });
    await settle();
    expect(result.current.bytes).toBeGreaterThan(before.bytes!);
    expect(result.current.findings).toBe(before.findings);

    rerender({ w: world([{ id: 'e1', name: 'Maren', aliases: ['the stranger'] }]) });
    await act(async () => { vi.advanceTimersByTime(PASS_DEBOUNCE_MS); });
    await settle();
    expect(result.current.findings).not.toBe(before.findings);
    expect(result.current.findings?.[0].message).toContain('the stranger');
  });

  it('never lets a slow earlier pass overwrite a newer one', async () => {
    vi.useFakeTimers();
    withWorker();
    FakeWorker.hold = true;
    const { result, rerender } = renderHook(({ w }) => useBenchPass(w), { initialProps: { w: clean } });
    await act(async () => { vi.advanceTimersByTime(0); });
    rerender({ w: broken });
    await act(async () => { vi.advanceTimersByTime(PASS_DEBOUNCE_MS); });

    // Both replies arrive, oldest first: the clean world's answer is stale by the time it lands.
    await act(async () => { FakeWorker.all[0].release(); });
    await settle();
    expect(result.current.findings).toHaveLength(1);
  });

  it('checks on the main thread when the worker fails to load', async () => {
    withWorker();
    FakeWorker.failLoad = true;
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { result } = renderHook(() => useBenchPass(broken));
    await vi.waitFor(() => expect(result.current.findings).toHaveLength(1));
  });

  it('hands a pass that breaks to the error boundary rather than checking forever', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const shown: unknown[] = [];
    class Boundary extends Component<{ children: ReactNode }, { error: unknown }> {
      state = { error: null as unknown };
      static getDerivedStateFromError(error: unknown) { return { error }; }
      componentDidCatch(error: unknown) { shown.push(error); }
      render() { return this.state.error ? null : this.props.children; }
    }
    const unreadable = { ...broken, entities: [null] } as unknown as RuleWorld;
    renderHook(() => useBenchPass(unreadable), { wrapper: Boundary });
    await vi.waitFor(() => expect(shown).toHaveLength(1));
  });

  it('runs in-thread where there is no worker', async () => {
    const { result } = renderHook(() => useBenchPass(broken));
    await vi.waitFor(() => expect(result.current.findings).toHaveLength(1));
  });

  it('stops the worker when the editor closes', async () => {
    withWorker();
    const { result, unmount } = renderHook(() => useBenchPass(clean));
    await vi.waitFor(() => expect(result.current.bytes).not.toBeNull());
    unmount();
    expect(FakeWorker.all.every((w) => w.terminated)).toBe(true);
  });
});
