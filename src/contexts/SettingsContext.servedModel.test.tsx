import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { ReactNode } from 'react';
import { SettingsProvider, useSettings } from './SettingsContext';
import { textEndpointPresetCodec, type TextEndpointPresetStore } from '@/lib/textEndpointPresets';
import { defaultEndpointSamplerOverrides } from '@/lib/endpointSamplers';
import { resetProbeMemo } from '@/lib/probeMemo';
import { resetReasoningCatalog } from '@/lib/reasoningCatalog';
import { resetServedModels } from '@/lib/servedModel';
import { probeEndpoint } from '@/lib/useAiReachable';

// A local server the player names `default`, so the server picks which model answers. Every request the
// app sends goes through `serve`, which answers as the server would for whichever model is loaded now.
const ORIGIN = 'http://local.test';
const ENDPOINT = `${ORIGIN}/v1`;
const CHAT = `${ENDPOINT}/chat/completions`;

type Server = 'lmstudio' | 'llamacpp' | 'hosted';

/** What one model's LM Studio native list entry says about it. */
const LMS_CAPS: Record<string, unknown> = {
  'reasoner-26b': { trained_for_tool_use: true, reasoning: { allowed_options: ['off', 'on'] } },
  'plain-12b': { trained_for_tool_use: false },
};

let server: Server = 'lmstudio';
let loaded: string[] = [];
/** A loaded embedding model, which serves no chat. */
let embeddingLoaded = false;
/** Whether a completion carrying a Tool gets a 200. */
let toolsAccepted = true;
/** Holds the next completion's answer until the test releases it. */
let holdNext: Promise<void> | null = null;

function json(status: number, body: unknown): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => body, text: async () => '' } as Response;
}

const serve = vi.fn(async (url: string, init?: RequestInit): Promise<Response> => {
  if (url === CHAT && init?.method === 'POST') {
    const held = holdNext;
    holdNext = null;
    if (held) await held;
    const carriesTool = String(init.body).includes('"tools"');
    return json(carriesTool && !toolsAccepted ? 400 : 200, { choices: [] });
  }
  if (server === 'lmstudio') {
    if (url === `${ORIGIN}/api/v0/models`) {
      const rows = Object.keys(LMS_CAPS).map((id) => ({ id, type: 'llm', state: loaded.includes(id) ? 'loaded' : 'not-loaded' }));
      return json(200, { data: [...rows, { id: 'nomic-embed', type: 'embeddings', state: embeddingLoaded ? 'loaded' : 'not-loaded' }] });
    }
    if (url === `${ORIGIN}/api/v1/models`) {
      const rows = Object.entries(LMS_CAPS).map(([key, capabilities]) => ({
        key, type: 'llm', capabilities, loaded_instances: loaded.includes(key) ? [{ id: key }] : [],
      }));
      return json(200, {
        models: [...rows, { key: 'nomic-embed', type: 'embedding', capabilities: {}, loaded_instances: embeddingLoaded ? [{ id: 'nomic-embed' }] : [] }],
      });
    }
  }
  if (server === 'llamacpp' && url === `${ENDPOINT}/models`) {
    return json(200, { object: 'list', data: loaded.map((id) => ({ id, object: 'model', owned_by: 'llamacpp' })) });
  }
  if (server === 'hosted' && url === `${ENDPOINT}/models`) {
    return json(200, { object: 'list', data: [{ id: 'default', object: 'model' }] });
  }
  return json(404, {});
});

const completionRequests = () => serve.mock.calls.filter(([url, init]) => url === CHAT && init?.method === 'POST').length;
const listReads = (url: string) => serve.mock.calls.filter(([u]) => u === url).length;

function seedEndpoint(model: string) {
  const store: TextEndpointPresetStore = {
    activeId: 'only',
    presets: [{
      id: 'only',
      name: 'Only',
      values: {
        endpoint: ENDPOINT, apiToken: '', model, contextWindowOverride: 8192,
        maxOutputOverride: { enabled: true, value: 400 }, samplerOverrides: defaultEndpointSamplerOverrides(),
      },
    }],
  };
  localStorage.setItem('FORMAMORPH_textEndpointPresets', textEndpointPresetCodec.serialize(store));
}

/** A record an earlier version stored under the configured name. */
const PRE_UPGRADE = {
  reasons: false, levels: [], budget: null, dialect: 'unknown', offAllowed: null, tools: true, structuredOutput: null,
  sources: { reasons: 'probe', levels: 'probe', tools: 'probe' },
};

const wrapper = ({ children }: { children: ReactNode }) => <SettingsProvider>{children}</SettingsProvider>;

/** Past the resolve's debounce, letting every request it starts answer. */
const settle = () => act(async () => { await vi.advanceTimersByTimeAsync(1500); });

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
  resetProbeMemo();
  resetReasoningCatalog();
  resetServedModels();
  serve.mockClear();
  embeddingLoaded = false;
  toolsAccepted = true;
  holdNext = null;
  vi.stubGlobal('fetch', serve);
  window.matchMedia = ((query: string) => ({
    matches: false, media: query, onchange: null,
    addListener: vi.fn(), removeListener: vi.fn(),
    addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia;
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe('capability answers follow the model behind `default`', () => {
  it('reads a fresh record when LM Studio loads another model', async () => {
    server = 'lmstudio';
    loaded = ['reasoner-26b'];
    seedEndpoint('default');
    const view = renderHook(() => useSettings(), { wrapper });
    await settle();
    expect(view.result.current.reasoningCapability?.tools).toBe(true);
    expect(view.result.current.capabilityModelName).toBe('reasoner-26b');

    loaded = ['plain-12b'];
    await act(async () => { await probeEndpoint(CHAT, '', 'default'); });
    await settle();
    expect(view.result.current.capabilityModelName).toBe('plain-12b');
    expect(view.result.current.reasoningCapability?.tools).toBe(false);
    expect(view.result.current.reasoningCapability?.reasons).toBe(false);
  });

  it('reuses a model’s record with no paid request when that model loads again', async () => {
    server = 'llamacpp';
    loaded = ['first.gguf'];
    seedEndpoint('default');
    const view = renderHook(() => useSettings(), { wrapper });
    await settle();
    expect(view.result.current.reasoningCapability?.tools).toBe(true);
    expect(completionRequests()).toBe(1);

    loaded = ['second.gguf'];
    await act(async () => { await probeEndpoint(CHAT, '', 'default'); });
    await settle();
    expect(view.result.current.capabilityModelName).toBe('second.gguf');
    expect(completionRequests()).toBe(2);

    loaded = ['first.gguf'];
    await act(async () => { await probeEndpoint(CHAT, '', 'default'); });
    await settle();
    expect(view.result.current.capabilityModelName).toBe('first.gguf');
    expect(view.result.current.reasoningCapability?.tools).toBe(true);
    expect(completionRequests()).toBe(2);
  });

  it('sends the completion probe once per model across fresh sessions', async () => {
    server = 'llamacpp';
    loaded = ['first.gguf'];
    seedEndpoint('default');
    const first = renderHook(() => useSettings(), { wrapper });
    await settle();
    first.unmount();
    resetServedModels();
    resetProbeMemo();

    renderHook(() => useSettings(), { wrapper });
    await settle();
    expect(completionRequests()).toBe(1);
  });

  it('stores answers about the probed model, not one loaded after the probe', async () => {
    server = 'lmstudio';
    loaded = ['reasoner-26b'];
    seedEndpoint('default');
    const view = renderHook(() => useSettings(), { wrapper });
    await act(async () => { await probeEndpoint(CHAT, '', 'default'); });
    loaded = ['plain-12b'];
    await settle();
    expect(view.result.current.capabilityModelName).toBe('reasoner-26b');
    expect(view.result.current.reasoningCapability?.tools).toBe(true);
  });

  it('keys an explicitly named model by that name, whatever LM Studio has loaded', async () => {
    server = 'lmstudio';
    loaded = ['plain-12b'];
    seedEndpoint('reasoner-26b');
    const view = renderHook(() => useSettings(), { wrapper });
    await settle();
    // The player named it, so no line repeats the name back.
    expect(view.result.current.capabilityModelName).toBeNull();
    expect(view.result.current.reasoningCapability?.tools).toBe(true);
    expect(view.result.current.reasoningCapability?.reasons).toBe(true);
  });

  it('falls back to the configured name when LM Studio has two models loaded', async () => {
    server = 'lmstudio';
    loaded = ['reasoner-26b', 'plain-12b'];
    seedEndpoint('default');
    localStorage.setItem('FORMAMORPH_reasoningSupport', JSON.stringify({ [`${CHAT}|default`]: PRE_UPGRADE }));
    const view = renderHook(() => useSettings(), { wrapper });
    await act(async () => { await probeEndpoint(CHAT, '', 'default'); });
    await settle();
    expect(view.result.current.capabilityModelName).toBeNull();
    expect(view.result.current.reasoningCapability?.sources.tools).toBe('probe');
    expect(view.result.current.reasoningCapability?.tools).toBe(true);
  });

  it('takes no loaded model’s answers when two are loaded and no record exists', async () => {
    server = 'lmstudio';
    loaded = ['reasoner-26b', 'plain-12b'];
    seedEndpoint('default');
    const view = renderHook(() => useSettings(), { wrapper });
    await settle();
    expect(view.result.current.capabilityModelName).toBeNull();
    expect(view.result.current.reasoningCapability?.sources.tools).toBe('probe');
  });

  it('names the chat model when an embedding model is loaded beside it', async () => {
    server = 'lmstudio';
    loaded = ['plain-12b'];
    embeddingLoaded = true;
    seedEndpoint('default');
    const view = renderHook(() => useSettings(), { wrapper });
    await settle();
    expect(view.result.current.capabilityModelName).toBe('plain-12b');
    expect(view.result.current.reasoningCapability?.tools).toBe(false);
  });

  it('skips the LM Studio per-session reread for a record under a real name', async () => {
    server = 'lmstudio';
    loaded = ['reasoner-26b'];
    seedEndpoint('default');
    const first = renderHook(() => useSettings(), { wrapper });
    await settle();
    expect(first.result.current.reasoningCapability?.tools).toBe(true);
    first.unmount();
    resetServedModels();
    resetProbeMemo();
    serve.mockClear();

    const second = renderHook(() => useSettings(), { wrapper });
    await settle();
    expect(second.result.current.capabilityModelName).toBe('reasoner-26b');
    expect(listReads(`${ORIGIN}/api/v1/models`)).toBe(0);
  });

  it('keeps a pre-upgrade record where the server names no model, and sends no paid request', async () => {
    server = 'hosted';
    loaded = [];
    seedEndpoint('default');
    localStorage.setItem('FORMAMORPH_reasoningSupport', JSON.stringify({ [`${CHAT}|default`]: PRE_UPGRADE }));
    const view = renderHook(() => useSettings(), { wrapper });
    await settle();
    expect(view.result.current.capabilityModelName).toBeNull();
    expect(view.result.current.reasoningCapability?.tools).toBe(true);
    expect(view.result.current.reasoningCapability?.sources.tools).toBe('probe');
    expect(completionRequests()).toBe(0);
  });
});

describe('Recheck', () => {
  it('reads the served model again, drops the whole record, and asks again', async () => {
    server = 'llamacpp';
    loaded = ['first.gguf'];
    seedEndpoint('default');
    const view = renderHook(() => useSettings(), { wrapper });
    await settle();
    expect(completionRequests()).toBe(1);
    await act(async () => { view.result.current.noteSchemaRejected({ url: CHAT, model: 'default' }); });
    expect(view.result.current.reasoningCapability?.structuredOutput).toBe(false);

    const listsBefore = listReads(`${ENDPOINT}/models`);
    await act(async () => { await view.result.current.recheckCapability(); });
    expect(listReads(`${ENDPOINT}/models`)).toBeGreaterThan(listsBefore);
    expect(completionRequests()).toBe(2);
    expect(view.result.current.reasoningCapability?.structuredOutput).toBeNull();
    expect(view.result.current.reasoningCapability?.tools).toBe(true);
  });

  it('keeps a resolve that started before it from writing its answer back', async () => {
    server = 'llamacpp';
    loaded = ['first.gguf'];
    seedEndpoint('default');
    let release = () => {};
    holdNext = new Promise<void>((resolve) => { release = resolve; });
    const view = renderHook(() => useSettings(), { wrapper });
    await settle();

    await act(async () => { await view.result.current.recheckCapability(); });
    expect(view.result.current.reasoningCapability?.tools).toBe(true);
    toolsAccepted = false;
    await act(async () => { release(); await vi.advanceTimersByTimeAsync(100); });
    expect(view.result.current.reasoningCapability?.tools).toBe(true);
  });

  it('asks again without what earlier replies showed', async () => {
    server = 'llamacpp';
    loaded = ['first.gguf'];
    seedEndpoint('default');
    const view = renderHook(() => useSettings(), { wrapper });
    await settle();
    // A reply that asked for a high effort and came back with no reasoning rules the model out.
    await act(async () => { view.result.current.noteReasoningReply({ url: CHAT, model: 'default' }, '', 'Plain prose.', 'high'); });
    await settle();
    expect(view.result.current.reasoningCapability?.reasons).toBe(false);

    await act(async () => { await view.result.current.recheckCapability(); });
    expect(view.result.current.reasoningCapability?.reasons).not.toBe(false);
  });

  it('answers for the model loaded now after a swap no probe saw', async () => {
    server = 'lmstudio';
    loaded = ['reasoner-26b'];
    seedEndpoint('default');
    const view = renderHook(() => useSettings(), { wrapper });
    await settle();
    expect(view.result.current.reasoningCapability?.tools).toBe(true);

    loaded = ['plain-12b'];
    await act(async () => { await view.result.current.recheckCapability(); });
    expect(view.result.current.capabilityModelName).toBe('plain-12b');
    expect(view.result.current.reasoningCapability?.tools).toBe(false);
  });
});
