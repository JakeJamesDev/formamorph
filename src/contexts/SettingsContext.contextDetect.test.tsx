import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { SettingsProvider, useSettings } from './SettingsContext';
import { textEndpointPresetCodec } from '@/lib/textEndpointPresets';
import { defaultEndpointSamplerOverrides } from '@/lib/endpointSamplers';
import { DEFAULT_CONTEXT_WINDOW } from './settingsDefaults';

vi.mock('@/lib/reasoningEffort', async () => ({
  ...await vi.importActual<typeof import('@/lib/reasoningEffort')>('@/lib/reasoningEffort'),
  detectReasoningCapability: vi.fn().mockResolvedValue(null),
  resolveReasoningCapability: vi.fn().mockResolvedValue(null),
}));
// Only the llama-server endpoint answers; the other one reports nothing.
const fetchContextLength = vi.fn((url: string) => Promise.resolve(url.includes('llama.test') ? 16384 : null));
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
      presets: [preset('llama', 'http://llama.test/v1'), preset('other', 'http://other.test/v1')],
    }));
  });
  afterEach(() => localStorage.clear());

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
