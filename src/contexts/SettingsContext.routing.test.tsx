import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { SettingsProvider, useSettings } from './SettingsContext';
import { textEndpointPresetCodec, DEFAULT_TEXT_ENDPOINT_VALUES, type TextEndpointPresetStore } from '@/lib/textEndpointPresets';

// The provider probes endpoints for reasoning support; keep the network out of it. `detectSupported…` is
// the one routing calls lazily, so it stays a spy the cases below assert against.
const detectEfforts = vi.fn().mockResolvedValue(null);
vi.mock('@/lib/reasoningEffort', async () => {
  const actual = await vi.importActual<typeof import('@/lib/reasoningEffort')>('@/lib/reasoningEffort');
  return {
    ...actual,
    detectReasoningCapability: vi.fn().mockResolvedValue(null),
    detectSupportedReasoningEfforts: (...args: unknown[]) => detectEfforts(...args),
  };
});

// The context-window probe. Routed targets are probed lazily on first resolve; the active endpoint has its
// own effect. Returns a distinct window so a routed resolve can be told apart from the shipped default.
const fetchContextLength = vi.fn().mockResolvedValue(32768);
vi.mock('@/lib/contextLength', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('@/lib/contextLength');
  return { ...actual, fetchContextLength: (...args: unknown[]) => fetchContextLength(...args) };
});

beforeEach(() => {
  window.matchMedia = ((query: string) => ({
    matches: false, media: query, onchange: null,
    addListener: vi.fn(), removeListener: vi.fn(),
    addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia;
});

const ENDPOINTS_KEY = 'FORMAMORPH_textEndpointPresets';
const ROUTING_KEY = 'FORMAMORPH_promptEndpoints';
const wrapper = ({ children }: { children: ReactNode }) => <SettingsProvider>{children}</SettingsProvider>;

/** Two endpoint presets with the big one active — the arrangement each case routes away from. */
function seedEndpoints() {
  const store: TextEndpointPresetStore = {
    activeId: 'big',
    presets: [
      { id: 'big', name: 'Big Model', values: { endpoint: 'http://big.test/v1', apiToken: 'big-key', model: 'big-24b', contextWindowOverride: 16384, maxTokens: 900 } },
      { id: 'small', name: 'Small Model', values: { endpoint: 'http://small.test/v1', apiToken: 'small-key', model: 'small-1b', contextWindowOverride: 4096, maxTokens: 200 } },
    ],
  };
  localStorage.setItem(ENDPOINTS_KEY, textEndpointPresetCodec.serialize(store));
}

describe('SettingsContext: per-prompt endpoint routing', () => {
  beforeEach(() => {
    localStorage.clear();
    detectEfforts.mockClear();
    fetchContextLength.mockClear();
    seedEndpoints();
  });

  it('sends every prompt to the active endpoint until something is routed', () => {
    const { result } = renderHook(() => useSettings(), { wrapper });
    for (const kind of ['narration', 'summary', 'statUpdates'] as const) {
      const r = result.current.resolveEndpointForKind(kind);
      expect(r.presetId).toBeNull();
      expect(r.model).toBe('big-24b');
      expect(r.apiToken).toBe('big-key');
    }
    expect(result.current.hasRoutedPrompts).toBe(false);
  });

  it('routes only the pinned prompt and leaves the rest on the active endpoint', () => {
    const { result } = renderHook(() => useSettings(), { wrapper });

    act(() => result.current.setPromptEndpoint('summary', 'small'));

    const summary = result.current.resolveEndpointForKind('summary');
    expect(summary.model).toBe('small-1b');
    expect(summary.apiToken).toBe('small-key');
    expect(summary.maxTokens).toBe(200);
    expect(summary.url).toContain('small.test');

    const narration = result.current.resolveEndpointForKind('narration');
    expect(narration.model).toBe('big-24b');
    expect(narration.url).toContain('big.test');

    expect(result.current.hasRoutedPrompts).toBe(true);
    expect(JSON.parse(localStorage.getItem(ROUTING_KEY)!)).toEqual({ summary: 'small' });
  });

  it('pins a prompt to the built-in Default even while a user preset is active', () => {
    const { result } = renderHook(() => useSettings(), { wrapper });
    act(() => result.current.setPromptEndpoint('sceneTags', 'default'));

    const r = result.current.resolveEndpointForKind('sceneTags');
    expect(r.isBuiltIn).toBe(true);
    expect(r.model).toBe(DEFAULT_TEXT_ENDPOINT_VALUES.model);
  });

  it('returns a routed prompt to the active endpoint when unpinned', () => {
    const { result } = renderHook(() => useSettings(), { wrapper });
    act(() => result.current.setPromptEndpoint('summary', 'small'));
    expect(result.current.resolveEndpointForKind('summary').model).toBe('small-1b');

    act(() => result.current.setPromptEndpoint('summary', null));

    expect(result.current.resolveEndpointForKind('summary').model).toBe('big-24b');
    expect(result.current.hasRoutedPrompts).toBe(false);
    expect(JSON.parse(localStorage.getItem(ROUTING_KEY)!)).toEqual({});
  });

  it('falls back to the active endpoint — and forgets the route — when the routed preset is deleted', () => {
    const { result } = renderHook(() => useSettings(), { wrapper });
    act(() => result.current.setPromptEndpoint('summary', 'small'));

    act(() => result.current.deleteTextEndpointPreset('small'));

    const r = result.current.resolveEndpointForKind('summary');
    expect(r.presetId).toBeNull();
    expect(r.model).toBe('big-24b');
    expect(JSON.parse(localStorage.getItem(ROUTING_KEY)!)).toEqual({});
  });

  it("uses the routed preset's own context window rather than the active endpoint's", () => {
    const { result } = renderHook(() => useSettings(), { wrapper });
    act(() => result.current.setPromptEndpoint('summary', 'small'));
    // The preset carries a manual override, which beats any probe.
    expect(result.current.resolveEndpointForKind('summary').contextWindow).toBe(4096);
  });

  it('probes a routed endpoint once and then serves the detected window', async () => {
    // No manual override on this preset, so the probe is what supplies its window.
    const store: TextEndpointPresetStore = {
      activeId: 'big',
      presets: [
        { id: 'big', name: 'Big Model', values: { endpoint: 'http://big.test/v1', apiToken: 'big-key', model: 'big-24b', contextWindowOverride: 16384, maxTokens: 900 } },
        { id: 'unprobed', name: 'Unprobed', values: { endpoint: 'http://new.test/v1', apiToken: '', model: 'new-8b', contextWindowOverride: null, maxTokens: 500 } },
      ],
    };
    localStorage.setItem(ENDPOINTS_KEY, textEndpointPresetCodec.serialize(store));

    const { result } = renderHook(() => useSettings(), { wrapper });
    act(() => result.current.setPromptEndpoint('summary', 'unprobed'));

    // Resolving repeatedly must not re-probe the same target.
    act(() => { result.current.resolveEndpointForKind('summary'); });
    act(() => { result.current.resolveEndpointForKind('summary'); });

    await waitFor(() => expect(result.current.resolveEndpointForKind('summary').contextWindow).toBe(32768));
    const routedProbes = fetchContextLength.mock.calls.filter((c) => String(c[0]).includes('new.test'));
    expect(routedProbes).toHaveLength(1);
    // The capability probe rides the same lazy path, keyed to the routed target.
    expect(detectEfforts.mock.calls.some((c) => String(c[0]).includes('new.test'))).toBe(true);
  });
});
