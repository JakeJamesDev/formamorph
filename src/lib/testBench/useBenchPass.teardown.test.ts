// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { Entity, WorldOverview } from '@/types';
import { createBenchReplier } from './benchPass';
import { createWorldMirror, type WorldPatch } from './worldMirror';
import type { RuleWorld } from './rules';

// Counts main-thread passes: the hook's runner runs one only in its in-thread fallback.
const localPasses = vi.hoisted(() => ({ ran: 0 }));
vi.mock('./benchPass', async (importOriginal) => {
  const real = await importOriginal<typeof import('./benchPass')>();
  return {
    ...real,
    createBenchPass: () => {
      const pass = real.createBenchPass();
      return (world: RuleWorld) => { localPasses.ran += 1; return pass(world); };
    },
  };
});

const { useBenchPass } = await import('./useBenchPass');

const world = (entities: Entity[]): RuleWorld => ({
  worldOverview: { name: 'Sedge Landing', description: '', systemPrompt: 'Narrate the fen.', readme: 'A fen primer.' } as WorldOverview,
  stats: [],
  locations: [{ id: 'harbor', name: 'Harbor Steps', isStarting: true }],
  entities: entities.map((e) => ({ locations: ['harbor'], playerDescription: 'Seen around.', aiDescription: 'A fen regular.', ...e })),
  traits: [], statUpdates: [], dictionaries: [], placeholders: [],
});

/** The Bench worker in-thread; it never replies, so every pass stays in flight. */
class HeldWorker {
  static all: HeldWorker[] = [];
  terminated = false;
  pending = 0;
  private mirror = createWorldMirror();
  private reply = createBenchReplier();
  constructor() { HeldWorker.all.push(this); }
  addEventListener() {}
  postMessage({ patch }: { id: string; patch: WorldPatch }) {
    this.reply(this.mirror.apply(patch));
    this.pending += 1;
  }
  terminate() { this.terminated = true; }
}

const settle = () => act(async () => { for (let i = 0; i < 5; i++) await Promise.resolve(); });

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('useBenchPass teardown', () => {
  it('does not fall back to a main-thread pass when the editor unmounts mid-pass', async () => {
    HeldWorker.all = [];
    localPasses.ran = 0;
    vi.stubGlobal('Worker', HeldWorker);
    vi.useFakeTimers();
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { rerender, unmount } = renderHook(({ w }) => useBenchPass(w), { initialProps: { w: world([{ id: 'e1', name: 'Maren' }]) } });
    await act(async () => { vi.advanceTimersByTime(0); });
    // A second edit while the first pass is still in the worker: two requests in flight, as on a large world.
    rerender({ w: world([{ id: 'e1', name: 'Maren Vell' }]) });
    await act(async () => { vi.advanceTimersByTime(400); });
    expect(HeldWorker.all[0].pending).toBe(2);

    unmount();
    await settle();

    expect(HeldWorker.all[0].terminated).toBe(true);
    expect(localPasses.ran).toBe(0);
    expect(errors.mock.calls.filter(([m]) => String(m).includes('Test Bench worker failed'))).toHaveLength(0);
  });
});
