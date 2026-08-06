import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { ReactNode } from 'react';
import { SettingsProvider, useSettings } from './SettingsContext';
import { presetStoreCodec, type PromptPresetStore } from '@/lib/promptPresets';

// The provider probes the endpoint for reasoning support on mount; keep the network out of it.
vi.mock('@/lib/reasoningEffort', async () => {
  const actual = await vi.importActual<typeof import('@/lib/reasoningEffort')>('@/lib/reasoningEffort');
  return { ...actual, detectReasoningCapability: vi.fn().mockResolvedValue(null) };
});

// jsdom has no `matchMedia`; the provider reads it for the contrast-aware default theme color.
beforeEach(() => {
  window.matchMedia = ((query: string) => ({
    matches: false, media: query, onchange: null,
    addListener: vi.fn(), removeListener: vi.fn(),
    addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia;
});

const KEY = 'FORMAMORPH_promptPresets';
const wrapper = ({ children }: { children: ReactNode }) => <SettingsProvider>{children}</SettingsProvider>;

/** Two user presets, GLOBAL selected — the arrangement every case below pins away from. */
function seedStore() {
  const store: PromptPresetStore = {
    activeId: 'global-preset',
    presets: [
      { id: 'global-preset', name: 'Global', values: { systemPrompt: 'GLOBAL TEXT' } as never, style: 'markdown' },
      { id: 'pinned-preset', name: 'Pinned', values: { systemPrompt: 'PINNED TEXT' } as never, style: 'markdown' },
    ],
  };
  localStorage.setItem(KEY, presetStoreCodec.serialize(store));
}

const storedActiveId = () => presetStoreCodec.parse(localStorage.getItem(KEY)!).activeId;
const storedValue = (id: string) =>
  presetStoreCodec.parse(localStorage.getItem(KEY)!).presets.find((p) => p.id === id)?.values.systemPrompt;

describe('SettingsContext: a world pinned to a preset', () => {
  beforeEach(() => {
    localStorage.clear();
    seedStore();
  });

  it('resolves prompts from the global preset until a pin is applied', () => {
    const { result } = renderHook(() => useSettings(), { wrapper });
    expect(result.current.systemPrompt).toBe('GLOBAL TEXT');
    expect(result.current.presetPinnedToWorld).toBe(false);
  });

  it('serves the pinned preset while pinned, and the global one again after', () => {
    const { result } = renderHook(() => useSettings(), { wrapper });

    act(() => result.current.beginSessionPreset('pinned-preset'));
    expect(result.current.systemPrompt).toBe('PINNED TEXT');
    expect(result.current.activePresetId).toBe('pinned-preset');
    expect(result.current.presetPinnedToWorld).toBe(true);

    act(() => result.current.endSessionPreset());
    expect(result.current.systemPrompt).toBe('GLOBAL TEXT');
    expect(result.current.activePresetId).toBe('global-preset');
  });

  it('edits the pinned preset, never the global one, and leaves the global selection alone', () => {
    // The trap this guards: the store ops key off `activeId`, so an override held outside the store
    // would display the pinned preset while writing the player's global one.
    const { result } = renderHook(() => useSettings(), { wrapper });
    act(() => result.current.beginSessionPreset('pinned-preset'));

    act(() => result.current.setSystemPrompt('EDITED WHILE PINNED'));

    expect(storedValue('pinned-preset')).toBe('EDITED WHILE PINNED');
    expect(storedValue('global-preset')).toBe('GLOBAL TEXT'); // untouched
    // The other trap: injecting the pin into the store to make the edit land must not persist it as
    // the global selection, or leaving the world would strand the player on the world's preset.
    expect(storedActiveId()).toBe('global-preset');
  });

  it('re-pins the world when a preset is chosen mid-play, without moving the global selection', () => {
    const { result } = renderHook(() => useSettings(), { wrapper });
    const persisted: (string | null)[] = [];
    act(() => result.current.beginSessionPreset('pinned-preset', (id) => persisted.push(id)));

    act(() => result.current.selectPreset('global-preset'));

    expect(persisted).toEqual(['global-preset']); // written back to the world's pin
    expect(storedActiveId()).toBe('global-preset');

    // And picking the other one moves the pin again rather than the global choice.
    act(() => result.current.selectPreset('pinned-preset'));
    expect(persisted).toEqual(['global-preset', 'pinned-preset']);
    expect(storedActiveId()).toBe('global-preset');
  });

  it('falls back to the global preset when the pinned preset is deleted', () => {
    const { result } = renderHook(() => useSettings(), { wrapper });
    act(() => result.current.beginSessionPreset('pinned-preset'));
    expect(result.current.systemPrompt).toBe('PINNED TEXT');

    act(() => result.current.deletePreset('pinned-preset'));

    expect(result.current.systemPrompt).toBe('GLOBAL TEXT');
    expect(result.current.presetPinnedToWorld).toBe(false);
  });

  it('still moves the global selection when no world is pinned', () => {
    const { result } = renderHook(() => useSettings(), { wrapper });
    act(() => result.current.selectPreset('pinned-preset'));
    expect(storedActiveId()).toBe('pinned-preset');
  });
});
