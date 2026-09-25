import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { ReactNode } from 'react';
import type { Tool } from '@/types';
import { SettingsProvider, useSettings } from './SettingsContext';
import { presetStoreCodec, type PromptPresetStore } from '@/lib/promptPresets';

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
const TOOL: Tool = {
  id: 't1', name: 'get_weather', description: 'Purpose: weather.', params: [],
  handler: { kind: 'template', body: 'Sunny.' }, emptyResult: '', offeredTo: ['narration'], enabled: true,
};
const OVERRIDES = { get_entity: { enabled: true, offeredTo: ['narration' as const] } };

function seed(activeId: string) {
  const store: PromptPresetStore = {
    activeId,
    presets: [{ id: 'mine', name: 'Mine', values: { systemPrompt: 'A' } as never, style: 'markdown', tools: [TOOL], toolOverrides: OVERRIDES }],
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

describe('SettingsContext: Tools in export, import and copy', () => {
  it('exports a user preset with its Tools and overrides', () => {
    seed('mine');
    const { result } = renderHook(() => useSettings(), { wrapper });
    const shared = result.current.exportActivePreset('2.9.2');
    expect(shared.tools).toEqual([TOOL]);
    expect(shared.toolOverrides).toEqual(OVERRIDES);
  });

  it('exports Experimental with its shipped override and Default with none', () => {
    seed('experimental');
    const { result } = renderHook(() => useSettings(), { wrapper });
    expect(result.current.exportActivePreset('2.9.2').toolOverrides).toEqual(OVERRIDES);
    act(() => { result.current.selectPreset('default'); });
    const shared = result.current.exportActivePreset('2.9.2');
    expect('toolOverrides' in shared).toBe(false);
    expect('tools' in shared).toBe(false);
  });

  it('stores imported Tools with or without tuning', () => {
    seed('mine');
    const { result } = renderHook(() => useSettings(), { wrapper });
    const gift = { name: 'Gift', style: 'markdown' as const, values: { systemPrompt: 'X' } as never, tools: [TOOL], toolOverrides: OVERRIDES };
    let id = '';
    act(() => { id = result.current.importPreset(gift, { includeTuning: false, name: 'Gift' }); });
    expect(stored(id)).toMatchObject({ tools: [TOOL], toolOverrides: OVERRIDES });
  });

  it('copies Tools into a new preset, and a copy of Experimental keeps get_entity on', () => {
    seed('mine');
    const { result } = renderHook(() => useSettings(), { wrapper });
    let id = '';
    act(() => { id = result.current.addPreset('Copy'); });
    expect(stored(id)).toMatchObject({ tools: [TOOL], toolOverrides: OVERRIDES });
    act(() => { result.current.selectPreset('experimental'); });
    act(() => { id = result.current.addPreset('Experimental Copy'); });
    expect(stored(id)?.toolOverrides).toEqual(OVERRIDES);
  });
});
