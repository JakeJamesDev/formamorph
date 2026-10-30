import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { SettingsProvider, useSettings } from './SettingsContext';
import AuthService from '@/services/AuthService';
import { textEndpointPresetCodec, FORMAMORPH_AI_PRESET_ID, type TextEndpointPresetStore } from '@/lib/textEndpointPresets';
import { defaultEndpointSamplerOverrides } from '@/lib/endpointSamplers';
import { presetStoreCodec, type PromptPresetStore } from '@/lib/promptPresets';
import { hostedSession } from '@/lib/hostedAi/hostedSession';
import { HOSTED_CHAT_URL, HOSTED_STATE_URL } from '@/lib/hostedAi/hostedUrls';

// Any capability resolve or context probe for Formamorph AI is a bug; these spies count them.
const resolveCapability = vi.fn().mockResolvedValue(null);
vi.mock('@/lib/reasoningEffort', async () => {
  const actual = await vi.importActual<typeof import('@/lib/reasoningEffort')>('@/lib/reasoningEffort');
  return {
    ...actual,
    detectReasoningCapability: vi.fn().mockResolvedValue(null),
    resolveReasoningCapability: (...args: unknown[]) => resolveCapability(...args),
  };
});
const fetchContextLength = vi.fn().mockResolvedValue(4096);
vi.mock('@/lib/contextLength', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('@/lib/contextLength');
  return { ...actual, fetchContextLength: (...args: unknown[]) => fetchContextLength(...args) };
});

const STATE = {
  // maxTokens sits below any local VITE_DEFAULT_MAX_TOKENS, so the state's cap is what binds.
  tier: 'supporter', state: 'ready', window: 24000, maxTokens: 200, tokenMargin: 800,
  model: { id: 'entry-7', capabilities: { tools: true, reasoning: 'openrouter', budget: true } },
  percentUsed: 5, turnsLeft: 200, resetAt: '2026-11-01T00:00:00.000Z', acknowledged: [],
};

const wrapper = ({ children }: { children: ReactNode }) => <SettingsProvider>{children}</SettingsProvider>;
const ENDPOINTS_KEY = 'FORMAMORPH_textEndpointPresets';
const PROMPTS_KEY = 'FORMAMORPH_promptPresets';

function seed(activeId: string) {
  // These players already made their one-time choice on this device; the switch has its own tests.
  localStorage.setItem('FORMAMORPH_hostedAiDevice', JSON.stringify({ switched: true, previousPresetId: null }));
  const store: TextEndpointPresetStore = {
    activeId,
    presets: [{ id: 'mine', name: 'Mine', values: { endpoint: 'http://mine.test/v1', apiToken: 'k', model: 'mine-8b', contextWindowOverride: 8192, maxOutputOverride: { enabled: true, value: 300 }, samplerOverrides: defaultEndpointSamplerOverrides() } }],
  };
  localStorage.setItem(ENDPOINTS_KEY, textEndpointPresetCodec.serialize(store));
  const prompts: PromptPresetStore = { activeId: 'p', presets: [{ id: 'p', name: 'P', values: { systemPrompt: 'A' } as never, style: 'markdown' }] };
  localStorage.setItem(PROMPTS_KEY, presetStoreCodec.serialize(prompts));
}

let stateReads = 0;
let modelProbes = 0;
let served: Omit<typeof STATE, 'model'> & { model: { id: string; capabilities: object } } = STATE;
beforeEach(() => {
  served = STATE;
  localStorage.clear();
  resolveCapability.mockClear();
  fetchContextLength.mockClear();
  stateReads = 0;
  modelProbes = 0;
  window.matchMedia = ((query: string) => ({
    matches: false, media: query, onchange: null,
    addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia;
  vi.stubGlobal('fetch', vi.fn(async (input: string) => {
    if (input === HOSTED_STATE_URL) { stateReads += 1; return new Response(JSON.stringify({ success: true, data: served })); }
    if (String(input).startsWith(HOSTED_CHAT_URL.replace(/\/chat\/completions$/, ''))) modelProbes += 1;
    return new Response('{}', { status: 404 });
  }));
  AuthService.token = 'token-a';
  hostedSession.reset();
});
afterEach(() => {
  vi.unstubAllGlobals();
  AuthService.token = null;
  hostedSession.reset();
});

describe('SettingsContext: Formamorph AI', () => {
  it('takes the active window, cap, model and capabilities from the hosted state, and probes nothing', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    seed(FORMAMORPH_AI_PRESET_ID);
    // Reasoning engaged, so the capability resolve would run for any other endpoint.
    localStorage.setItem('FORMAMORPH_thinkingMode', 'precall');
    const { result } = renderHook(() => useSettings(), { wrapper });

    await waitFor(() => expect(result.current.hostedAi.presetState).toBe('ready'));
    const narration = result.current.resolveEndpointForKind('narration');
    expect(narration).toMatchObject({ hosted: true, url: HOSTED_CHAT_URL, model: 'entry-7', maxTokens: 200, contextWindow: 23200 });
    expect(narration.reasoning).toMatchObject({ tools: true, dialect: 'openrouter', budget: true });
    expect(result.current.contextWindow).toBe(23200);

    // Past every probe's debounce: nothing asked the proxy for a window, a model or a capability.
    await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
    vi.useRealTimers();
    expect(fetchContextLength).not.toHaveBeenCalled();
    expect(resolveCapability).not.toHaveBeenCalled();
    expect(modelProbes).toBe(0);
  });

  it('probes nothing even when the capability record leaves questions open', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    served = { ...STATE, model: { id: 'entry-8', capabilities: {} } };
    seed(FORMAMORPH_AI_PRESET_ID);
    localStorage.setItem('FORMAMORPH_thinkingMode', 'precall');
    const { result } = renderHook(() => useSettings(), { wrapper });

    await waitFor(() => expect(result.current.hostedAi.presetState).toBe('ready'));
    await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
    vi.useRealTimers();
    expect(resolveCapability).not.toHaveBeenCalled();
    expect(modelProbes).toBe(0);
  });

  it('routes a pinned pass to Formamorph AI with the hosted window, and keeps the others on their preset', async () => {
    seed('mine');
    const { result } = renderHook(() => useSettings(), { wrapper });
    act(() => result.current.setPromptEndpoint('summary', FORMAMORPH_AI_PRESET_ID));

    await waitFor(() => expect(stateReads).toBeGreaterThan(0));
    await waitFor(() => expect(result.current.resolveEndpointForKind('summary').contextWindow).toBe(23200));
    expect(result.current.resolveEndpointForKind('summary')).toMatchObject({ hosted: true, presetId: FORMAMORPH_AI_PRESET_ID });
    expect(result.current.resolveEndpointForKind('narration')).toMatchObject({ hosted: false, model: 'mine-8b', contextWindow: 8192 });
    expect(fetchContextLength.mock.calls.filter((c) => String(c[0]) === HOSTED_CHAT_URL)).toHaveLength(0);
    expect(resolveCapability.mock.calls.filter((c) => (c[0] as { url?: string }).url === HOSTED_CHAT_URL)).toHaveLength(0);
  });

  it('turns signed-out when another tab signs out, with no read for the old account', async () => {
    seed(FORMAMORPH_AI_PRESET_ID);
    const { result } = renderHook(() => useSettings(), { wrapper });
    await waitFor(() => expect(result.current.hostedAi.presetState).toBe('ready'));
    const before = stateReads;

    // A sign-out in another tab: the stored token goes, then the storage event arrives.
    act(() => {
      localStorage.removeItem('authToken');
      window.dispatchEvent(new StorageEvent('storage', { key: 'authToken' }));
    });

    await waitFor(() => expect(result.current.hostedAi.presetState).toBe('signed-out'));
    expect(stateReads).toBe(before);
  });
});
