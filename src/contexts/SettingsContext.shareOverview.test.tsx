import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { ReactNode } from 'react';
import { SettingsProvider, useSettings } from './SettingsContext';
import { presetStoreCodec, type PresetOverview, type PromptPresetStore } from '@/lib/promptPresets';

// Keep the provider's endpoint probes off the network.
vi.mock('@/lib/reasoningEffort', async () => {
  const actual = await vi.importActual<typeof import('@/lib/reasoningEffort')>('@/lib/reasoningEffort');
  return { ...actual, detectReasoningCapability: vi.fn().mockResolvedValue(null), resolveReasoningCapability: vi.fn().mockResolvedValue(null) };
});
vi.mock('@/lib/contextLength', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('@/lib/contextLength');
  return { ...actual, fetchContextLength: vi.fn().mockResolvedValue(32768) };
});

const PROMPTS_KEY = 'FORMAMORPH_promptPresets';
const wrapper = ({ children }: { children: ReactNode }) => <SettingsProvider>{children}</SettingsProvider>;
const OVERVIEW: PresetOverview = { author: 'Ann', description: 'For small models.', tags: ['dialogue'], models: ['Cydonia-24B'] };

function seed(activeId: string) {
  const store: PromptPresetStore = {
    activeId,
    presets: [
      { id: 'mine', name: 'Mine', values: { systemPrompt: 'A' } as never, style: 'markdown', overview: OVERVIEW },
      { id: 'other', name: 'Other', values: { systemPrompt: 'B' } as never, style: 'markdown' },
    ],
  };
  localStorage.setItem(PROMPTS_KEY, presetStoreCodec.serialize(store));
}

const stored = (id: string) => presetStoreCodec.parse(localStorage.getItem(PROMPTS_KEY)!).presets.find((p) => p.id === id);

beforeEach(() => {
  localStorage.clear();
  window.matchMedia = ((query: string) => ({
    matches: false, media: query, onchange: null,
    addListener: vi.fn(), removeListener: vi.fn(),
    addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia;
});

describe('SettingsContext: the Overview in export and import', () => {
  it('exports the active user preset with its Overview', () => {
    seed('mine');
    const { result } = renderHook(() => useSettings(), { wrapper });
    expect(result.current.exportActivePreset('2.9.2').overview).toEqual(OVERVIEW);
  });

  it('exports a built-in preset with no Overview', () => {
    seed('default');
    const { result } = renderHook(() => useSettings(), { wrapper });
    expect(result.current.exportActivePreset('2.9.2').overview).toBeUndefined();
  });

  it('stores the imported Overview on a new preset and on an overwrite, with or without tuning', () => {
    seed('mine');
    const { result } = renderHook(() => useSettings(), { wrapper });
    const gift = { name: 'Gift', style: 'markdown' as const, values: { systemPrompt: 'X' } as never, overview: OVERVIEW };
    let id = '';
    act(() => { id = result.current.importPreset(gift, { includeTuning: false, name: 'Gift' }); });
    expect(stored(id)?.overview).toEqual(OVERVIEW);

    act(() => { result.current.importPreset(gift, { includeTuning: true, name: 'Other', overwriteId: 'other' }); });
    expect(stored('other')?.overview).toEqual(OVERVIEW);
  });
});
