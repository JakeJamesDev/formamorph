import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { ReactNode } from 'react';
import { SettingsProvider, useSettings } from './SettingsContext';
import { presetStoreCodec, type PromptPresetStore } from '@/lib/promptPresets';

// The provider probes the active endpoint; keep the network out of it.
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
const stored = () => presetStoreCodec.parse(localStorage.getItem(PROMPTS_KEY)!);

function seed(activeId: string) {
  const store: PromptPresetStore = {
    activeId,
    presets: [{ id: 'mine', name: 'Mine', values: { systemPrompt: 'A' } as never, style: 'markdown' }],
  };
  localStorage.setItem(PROMPTS_KEY, presetStoreCodec.serialize(store));
}

beforeEach(() => {
  localStorage.clear();
  window.matchMedia = ((query: string) => ({
    matches: false, media: query, onchange: null,
    addListener: vi.fn(), removeListener: vi.fn(),
    addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia;
});

describe('SettingsContext: preset Overview', () => {
  it('writes through to the stored user preset', () => {
    seed('mine');
    const { result } = renderHook(() => useSettings(), { wrapper });
    act(() => result.current.setPresetOverview({ author: 'Ann', tags: ['Noir', 'noir'] }));
    expect(result.current.presetOverview).toMatchObject({ author: 'Ann', tags: ['noir'] });
    expect(stored().presets[0].overview).toMatchObject({ author: 'Ann', tags: ['noir'] });
  });

  it('changes nothing while a built-in is active', () => {
    seed('default');
    const before = localStorage.getItem(PROMPTS_KEY);
    const { result } = renderHook(() => useSettings(), { wrapper });
    expect(result.current.presetOverview).toBeNull();
    act(() => result.current.setPresetOverview({ author: 'Ann' }));
    expect(result.current.presetOverview).toBeNull();
    expect(stored()).toEqual(presetStoreCodec.parse(before!));
  });

  it('a duplicated preset keeps the Overview', () => {
    seed('mine');
    const { result } = renderHook(() => useSettings(), { wrapper });
    act(() => result.current.setPresetOverview({ description: 'For small models', models: ['Cydonia-24B'] }));
    let copyId = '';
    act(() => { copyId = result.current.addPreset('Mine (copy)'); });
    expect(result.current.activePresetId).toBe(copyId);
    expect(result.current.presetOverview).toMatchObject({ description: 'For small models', models: ['Cydonia-24B'] });
  });
});
