import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';
import { useAiReachable, type AiReachable } from '@/lib/useAiReachable';
import { markAutoLoadPending } from '@/lib/engineAutoLoad';
import { saveInstalledOrder } from '@/lib/installedModelOrder';
import type { LocalInstalledModel } from '@/lib/imageGen/desktop';
import { LocalEngineManager } from './LocalEngineManager';

const settings = { localModelActive: true, engineWanted: true, localAutoLoad: true, activeEndpointUrl: '', activeApiToken: '', activeModelName: '' };
vi.mock('@/contexts/SettingsContext', () => ({ useSettings: () => settings }));

type Status = 'stopped' | 'loading' | 'ready' | 'error';

/** The desktop bridge as main answers it: the engine starts stopped and reaches `loading` only after `load` does its own work. */
function stubEngine({ loadOutcome = 'ready' as Status | 'throw', models = ['m.gguf'] as string[], installed = undefined as { id: string; source: string }[] | undefined } = {}) {
  const listed = installed ?? models.map((id) => ({ id, source: 'root' }));
  let state = { status: 'stopped' as Status };
  const loaded: string[] = [];
  const listeners = new Set<(s: { status: Status }) => void>();
  const push = (status: Status) => { state = { status }; listeners.forEach((cb) => cb(state)); };
  let finishLoad: () => void = () => {};
  window.formamorphDesktop = {
    llm: {
      status: async () => state,
      onStatus: (cb: (s: { status: Status }) => void) => { listeners.add(cb); return () => { listeners.delete(cb); }; },
      listModels: async () => models,
      listInstalled: async () => listed,
      setOptions: async () => state,
      setContextOverflow: async () => 'truncate',
      stop: async () => state,
      // 'throw' is main refusing the start, such as a model that left its folder: the engine never leaves `stopped`.
      load: (id: string) => new Promise((resolve, reject) => {
        loaded.push(id);
        finishLoad = () => {
          if (loadOutcome === 'throw') { reject(new Error('That model is no longer in a searched folder.')); return; }
          push('loading'); push(loadOutcome); resolve(state);
        };
      }),
    },
  } as unknown as Window['formamorphDesktop'];
  return { loaded, finishLoad: () => act(() => finishLoad()) };
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
  localStorage.clear();
});

describe('which model auto-load picks', () => {
  const model = (id: string, source: LocalInstalledModel['source']): LocalInstalledModel =>
    ({ id, fileName: id, subpath: '', size: 1, path: `/models/${id}`, source, projector: null });
  const installed = [model('own-a.gguf', 'root'), model('own-b.gguf', 'root'), model('ext:lmstudio/c.gguf', 'external')];

  it('loads the top of the Installed order, even a model from a search folder', async () => {
    saveInstalledOrder([installed[2], installed[1], installed[0]]);
    const engine = stubEngine({ installed });
    mount();
    await flush();
    expect(engine.loaded).toEqual(['ext:lmstudio/c.gguf']);
  });

  it('loads the first listed model when no order is saved', async () => {
    const engine = stubEngine({ installed });
    mount();
    await flush();
    expect(engine.loaded).toEqual(['own-a.gguf']);
  });
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
