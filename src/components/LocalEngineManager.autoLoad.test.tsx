import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';
import { useAiReachable, type AiReachable } from '@/lib/useAiReachable';
import { markAutoLoadPending } from '@/lib/engineAutoLoad';
import { LocalEngineManager } from './LocalEngineManager';

const settings = { localModelActive: true, engineWanted: true, localAutoLoad: true, activeEndpointUrl: '', activeApiToken: '', activeModelName: '' };
vi.mock('@/contexts/SettingsContext', () => ({ useSettings: () => settings }));

type Status = 'stopped' | 'loading' | 'ready' | 'error';

/** The desktop bridge as main answers it: the engine starts stopped and reaches `loading` only after `load` does its own work. */
function stubEngine({ loadOutcome = 'ready' as Status | 'throw', models = ['m.gguf'] } = {}) {
  let state = { status: 'stopped' as Status };
  const listeners = new Set<(s: { status: Status }) => void>();
  const push = (status: Status) => { state = { status }; listeners.forEach((cb) => cb(state)); };
  let finishLoad: () => void = () => {};
  window.formamorphDesktop = {
    llm: {
      status: async () => state,
      onStatus: (cb: (s: { status: Status }) => void) => { listeners.add(cb); return () => { listeners.delete(cb); }; },
      listModels: async () => models,
      listInstalled: async () => models.map((id) => ({ id, source: 'root' })),
      setOptions: async () => state,
      setContextOverflow: async () => 'truncate',
      stop: async () => state,
      // 'throw' is main refusing the start, such as a model that left its folder: the engine never leaves `stopped`.
      load: () => new Promise((resolve, reject) => {
        finishLoad = () => {
          if (loadOutcome === 'throw') { reject(new Error('That model is no longer in a searched folder.')); return; }
          push('loading'); push(loadOutcome); resolve(state);
        };
      }),
    },
  } as unknown as Window['formamorphDesktop'];
  return { finishLoad: () => act(() => finishLoad()) };
}

/** Every value the hook rendered, in order. */
function mount(bootHeld = false) {
  const seen: AiReachable[] = [];
  function Probe() { seen.push(useAiReachable()); return null; }
  const view = render(<><LocalEngineManager bootHeld={bootHeld} /><Probe /></>);
  return { seen, rerender: (held: boolean) => view.rerender(<><LocalEngineManager bootHeld={held} /><Probe /></>) };
}

const flush = () => act(async () => { for (let i = 0; i < 10; i++) await Promise.resolve(); });

afterEach(() => {
  cleanup();
  delete (window as { formamorphDesktop?: unknown }).formamorphDesktop;
  Object.assign(settings, { engineWanted: true, localAutoLoad: true });
  markAutoLoadPending();
});

describe('AI reachability while the engine auto-loads', () => {
  it('stays undecided between boot and the load, then turns ready', async () => {
    const engine = stubEngine();
    const { seen } = mount();
    await flush();
    expect(seen.map((r) => r.reachable)).not.toContain(false);

    await engine.finishLoad();
    expect(seen.at(-1)?.reachable).toBe(true);
    expect(seen.map((r) => r.reachable)).not.toContain(false);
  });

  it('stays undecided through the boot hold', async () => {
    stubEngine();
    const { seen, rerender } = mount(true);
    await flush();
    rerender(false);
    await flush();
    expect(seen.map((r) => r.reachable)).not.toContain(false);
  });

  it('reports engineDown once the load fails', async () => {
    const engine = stubEngine({ loadOutcome: 'error' });
    const { seen } = mount();
    await flush();
    await engine.finishLoad();
    await flush();
    expect(seen.at(-1)).toMatchObject({ reachable: false, blocker: 'engineDown' });
  });

  it('reports engineDown when the load is refused and the engine stays stopped', async () => {
    const engine = stubEngine({ loadOutcome: 'throw' });
    const { seen } = mount();
    await flush();
    await engine.finishLoad();
    await flush();
    expect(seen.at(-1)).toMatchObject({ reachable: false, blocker: 'engineDown' });
  });

  it('reports noModel when nothing is installed', async () => {
    stubEngine({ models: [] });
    const { seen } = mount();
    await flush();
    expect(seen.at(-1)).toMatchObject({ reachable: false, blocker: 'noModel' });
  });

  it('reports engineDown for a stopped engine with auto-load off', async () => {
    settings.localAutoLoad = false;
    stubEngine();
    const { seen } = mount();
    await flush();
    expect(seen.at(-1)).toMatchObject({ reachable: false, blocker: 'engineDown' });
  });
});
