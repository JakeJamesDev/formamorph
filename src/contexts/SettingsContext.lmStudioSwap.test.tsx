import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { SettingsProvider, useSettings } from './SettingsContext';
import { textEndpointPresetCodec, type TextEndpointPresetStore } from '@/lib/textEndpointPresets';
import { defaultEndpointSamplerOverrides } from '@/lib/endpointSamplers';
import { resetProbeMemo } from '@/lib/probeMemo';
import { resetReasoningCatalog } from '@/lib/reasoningCatalog';

// LM Studio serves whichever model is loaded when the request names `default`, so the model behind one
// endpoint-and-model signature changes whenever the player loads another model in LM Studio.
const ENDPOINT = 'http://lms.test/v1';
const MODEL = 'default';
const SIG = `${ENDPOINT}/chat/completions|${MODEL}`;
const LIST_URL = 'http://lms.test/api/v1/models';

/** What an earlier session stored for the model loaded then: it reasons, with a budget, and takes Tools. */
const STALE_RECORD = {
  reasons: true, levels: ['none', 'medium'], budget: true, dialect: 'lmstudio', offAllowed: null, tools: true,
  sources: { reasons: 'native', levels: 'native', budget: 'native', tools: 'native', dialect: 'native' },
};

/** The list as LM Studio serves it now: a different model loaded, one that neither reasons nor takes Tools. */
const SWAPPED_LIST = {
  models: [
    { key: 'old-reasoner', loaded_instances: [], capabilities: { trained_for_tool_use: true, reasoning: { allowed_options: ['off', 'on'] } } },
    { key: 'plain-12b', loaded_instances: [{ id: 'plain-12b' }], capabilities: { trained_for_tool_use: false } },
  ],
};

function seed() {
  const store: TextEndpointPresetStore = {
    activeId: 'only',
    presets: [{
      id: 'only',
      name: 'Only',
      values: {
        endpoint: ENDPOINT, apiToken: '', model: MODEL, contextWindowOverride: 8192,
        maxOutputOverride: { enabled: true, value: 400 }, samplerOverrides: defaultEndpointSamplerOverrides(),
      },
    }],
  };
  localStorage.setItem('FORMAMORPH_textEndpointPresets', textEndpointPresetCodec.serialize(store));
  localStorage.setItem('FORMAMORPH_reasoningSupport', JSON.stringify({ [SIG]: STALE_RECORD }));
}

const wrapper = ({ children }: { children: ReactNode }) => <SettingsProvider>{children}</SettingsProvider>;

const lmStudioFetch = vi.fn(async (url: string) => {
  const found = url === LIST_URL;
  return { ok: found, status: found ? 200 : 404, json: async () => (found ? SWAPPED_LIST : {}), text: async () => '' } as Response;
});

beforeEach(() => {
  localStorage.clear();
  resetProbeMemo();
  resetReasoningCatalog();
  lmStudioFetch.mockClear();
  vi.stubGlobal('fetch', lmStudioFetch);
  window.matchMedia = ((query: string) => ({
    matches: false, media: query, onchange: null,
    addListener: vi.fn(), removeListener: vi.fn(),
    addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia;
  seed();
});

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe('a stored LM Studio record after a model swap', () => {
  it('re-reads the model list once per session and takes the loaded model’s answers whole', async () => {
    const view = renderHook(() => useSettings(), { wrapper });
    expect(view.result.current.reasoningCapability?.tools).toBe(true);
    await act(async () => { view.result.current.setNativeReasoning({ enabled: true, level: 'high' }); });

    await waitFor(() => expect(view.result.current.reasoningCapability?.tools).toBe(false), { timeout: 4000 });
    const record = view.result.current.reasoningCapability;
    expect(record?.reasons).toBe(false);
    // Replaced, not merged: the old model's budget answer does not survive onto the new model.
    expect(record?.budget).toBeNull();
    expect(lmStudioFetch.mock.calls.filter(([url]) => url === LIST_URL)).toHaveLength(1);
    // No completion probe: the list answered every question.
    expect(lmStudioFetch.mock.calls.some(([url]) => String(url).endsWith('/chat/completions'))).toBe(false);
  });
});
