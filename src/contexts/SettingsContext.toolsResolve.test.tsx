import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { ReactNode } from 'react';
import { SettingsProvider, useSettings } from './SettingsContext';
import { presetStoreCodec, type PromptPresetStore } from '@/lib/promptPresets';
import { textEndpointPresetCodec, type TextEndpointPresetStore } from '@/lib/textEndpointPresets';
import { defaultEndpointSamplerOverrides } from '@/lib/endpointSamplers';
import { ALL_REQUEST_KINDS, resolveReasoningCapability } from '@/lib/reasoningEffort';

// The resolver is the network seam; these cases only count whether play asks it.
vi.mock('@/lib/reasoningEffort', async () => ({
  ...await vi.importActual<typeof import('@/lib/reasoningEffort')>('@/lib/reasoningEffort'),
  resolveReasoningCapability: vi.fn(),
}));

const wrapper = ({ children }: { children: ReactNode }) => <SettingsProvider>{children}</SettingsProvider>;

/** A user preset with reasoning off on every prompt, and the catalog's `get_entity` on or off. */
function seedPreset(getEntityOn: boolean) {
  const store: PromptPresetStore = {
    activeId: 'mine',
    presets: [{
      id: 'mine',
      name: 'Mine',
      values: { systemPrompt: 'A' } as never,
      style: 'markdown',
      reasoning: Object.fromEntries(ALL_REQUEST_KINDS.map((kind) => [kind, { enabled: false, level: 'global' }])),
      toolOverrides: { get_entity: { enabled: getEntityOn, offeredTo: ['narration'] } },
    }],
  };
  localStorage.setItem('FORMAMORPH_promptPresets', presetStoreCodec.serialize(store));
}

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
  const endpoints: TextEndpointPresetStore = {
    activeId: 'only',
    presets: [{
      id: 'only',
      name: 'Only',
      values: {
        endpoint: 'http://tools.test/v1', apiToken: '', model: 'tool-12b', contextWindowOverride: 8192,
        maxOutputOverride: { enabled: true, value: 400 }, samplerOverrides: defaultEndpointSamplerOverrides(),
      },
    }],
  };
  localStorage.setItem('FORMAMORPH_textEndpointPresets', textEndpointPresetCodec.serialize(endpoints));
  // Native reasoning ships on, which asks on its own; every case here has it off.
  localStorage.setItem('FORMAMORPH_reasoningEffort', JSON.stringify({ enabled: false, level: 'auto' }));
  window.matchMedia = ((query: string) => ({
    matches: false, media: query, onchange: null,
    addListener: vi.fn(), removeListener: vi.fn(),
    addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia;
  vi.mocked(resolveReasoningCapability).mockReset().mockResolvedValue(null);
});

afterEach(() => {
  vi.useRealTimers();
  localStorage.clear();
});

/** Past the resolve's 1200 ms debounce. */
const pastDebounce = () => act(async () => { await vi.advanceTimersByTimeAsync(1500); });

describe('SettingsContext: the tools answer', () => {
  it('asks for the capability record when a prompt offers a Tool, with reasoning off', async () => {
    seedPreset(true);
    const { result } = renderHook(() => useSettings(), { wrapper });
    expect(result.current.reasoningEngaged).toBe(false);
    await pastDebounce();
    expect(resolveReasoningCapability).toHaveBeenCalledTimes(1);
  });

  it('asks nothing when no prompt offers a Tool and reasoning is off', async () => {
    seedPreset(false);
    const { result } = renderHook(() => useSettings(), { wrapper });
    expect(result.current.reasoningEngaged).toBe(false);
    await pastDebounce();
    expect(resolveReasoningCapability).not.toHaveBeenCalled();
  });
});
