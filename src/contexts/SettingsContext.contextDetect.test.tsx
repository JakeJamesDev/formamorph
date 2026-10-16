import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { SettingsProvider, useSettings } from './SettingsContext';
import { textEndpointPresetCodec } from '@/lib/textEndpointPresets';
import { defaultEndpointSamplerOverrides } from '@/lib/endpointSamplers';
import { DEFAULT_CONTEXT_WINDOW } from './settingsDefaults';
import { presetStoreCodec } from '@/lib/promptPresets';
import { PROBE_RETRY_MIN_MS } from '@/lib/probeBackoff';

vi.mock('@/lib/reasoningEffort', async () => ({
  ...await vi.importActual<typeof import('@/lib/reasoningEffort')>('@/lib/reasoningEffort'),
  detectReasoningCapability: vi.fn().mockResolvedValue(null),
  resolveReasoningCapability: vi.fn().mockResolvedValue(null),
}));
// Only the llama-server endpoints answer, and only while they are up; the other one reports nothing.
let serverUp = true;
const fetchContextLength = vi.fn((url: string) => Promise.resolve(serverUp && url.includes('llama') ? 16384 : null));
vi.mock('@/lib/contextLength', async () => ({
  ...await vi.importActual<typeof import('@/lib/contextLength')>('@/lib/contextLength'),
  fetchContextLength: (url: string) => fetchContextLength(url),
}));

const wrapper = ({ children }: { children: ReactNode }) => <SettingsProvider>{children}</SettingsProvider>;

function preset(id: string, endpoint: string) {
  return {
    id, name: id,
    values: {
      endpoint, apiToken: '', model: 'local', contextWindowOverride: null,
      maxOutputOverride: { enabled: false, value: 512 }, samplerOverrides: defaultEndpointSamplerOverrides(),
    },
  };
}

describe('SettingsContext detected context window', () => {
  beforeEach(() => {
    localStorage.clear();
    window.matchMedia = ((query: string) => ({
      matches: false, media: query, onchange: null, addListener: vi.fn(), removeListener: vi.fn(),
      addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn(),
    })) as unknown as typeof window.matchMedia;
    localStorage.setItem('FORMAMORPH_textEndpointPresets', textEndpointPresetCodec.serialize({
      activeId: 'llama',
      presets: [
        preset('llama', 'http://llama.test/v1'), preset('other', 'http://other.test/v1'),
        preset('llama2', 'http://llama2.test/v1'),
      ],
    }));
    serverUp = true;
    fetchContextLength.mockClear();
  });
  afterEach(() => { vi.useRealTimers(); localStorage.clear(); });

  /** Pins narration to the endpoint preset `id` on an active user prompt preset. */
  function pinNarration(id: string) {
    localStorage.setItem('FORMAMORPH_promptPresets', presetStoreCodec.serialize({
      activeId: 'mine',
      presets: [{ id: 'mine', name: 'Mine', values: { systemPrompt: 'A' } as never, style: 'markdown', promptEndpoints: { narration: id } }],
    }));
  }

  it('gives narration pinned to the active preset the window found once the server comes up', async () => {
    vi.useFakeTimers();
    pinNarration('llama');
    serverUp = false;
    const { result, unmount } = renderHook(() => useSettings(), { wrapper });
    await act(() => vi.advanceTimersByTimeAsync(1000));
    expect(result.current.resolveEndpointForKind('narration').contextWindow).toBe(DEFAULT_CONTEXT_WINDOW);

    serverUp = true;
    await act(() => vi.advanceTimersByTimeAsync(PROBE_RETRY_MIN_MS));
    expect(result.current.detectedContextWindow).toBe(16384);
    expect(result.current.resolveEndpointForKind('narration').contextWindow).toBe(16384);
    unmount();
  });

  it('retries a routed probe only after its backoff', async () => {
    vi.useFakeTimers();
    pinNarration('llama2');
    serverUp = false;
    const { result, unmount } = renderHook(() => useSettings(), { wrapper });
    const routedAsks = () => fetchContextLength.mock.calls.filter(([url]) => url.includes('llama2')).length;
    await act(async () => { result.current.resolveEndpointForKind('narration'); await vi.advanceTimersByTimeAsync(0); });
    expect(routedAsks()).toBe(1);

    serverUp = true;
    await act(async () => { result.current.resolveEndpointForKind('narration'); await vi.advanceTimersByTimeAsync(0); });
    expect(routedAsks()).toBe(1);
    expect(result.current.resolveEndpointForKind('narration').contextWindow).toBe(DEFAULT_CONTEXT_WINDOW);

    await act(async () => { await vi.advanceTimersByTimeAsync(PROBE_RETRY_MIN_MS); result.current.resolveEndpointForKind('narration'); await vi.advanceTimersByTimeAsync(0); });
    expect(routedAsks()).toBe(2);
    expect(result.current.resolveEndpointForKind('narration').contextWindow).toBe(16384);
    unmount();
  });

  it('keeps each endpoint to its own detected window', async () => {
    const { result, unmount } = renderHook(() => useSettings(), { wrapper });

    await act(() => result.current.detectContextWindow(true));
    expect(result.current.detectedContextWindow).toBe(16384);
    expect(result.current.contextWindow).toBe(16384);

    act(() => result.current.selectTextEndpointPreset('other'));
    await act(() => result.current.detectContextWindow(true));
    expect(result.current.detectedContextWindow).toBeNull();
    expect(result.current.contextWindow).toBe(DEFAULT_CONTEXT_WINDOW);

    act(() => result.current.selectTextEndpointPreset('llama'));
    await waitFor(() => expect(result.current.contextWindow).toBe(16384));
    unmount();
  });
});
