import { describe, it, expect, beforeEach, afterEach, vi, type MockInstance } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { ReactNode } from 'react';
import { SettingsProvider } from '@/contexts/SettingsContext';
import { textEndpointPresetCodec, BUILTIN_ENGINE_PRESET_ID, type TextEndpointPresetStore } from '@/lib/textEndpointPresets';
import { defaultEndpointSamplerOverrides } from '@/lib/endpointSamplers';
import { presetStoreCodec, type PromptPresetStore } from '@/lib/promptPresets';
import type { PromptEndpointMap } from '@/lib/promptEndpoints';
import { useEndpointTip } from './useEndpointTip';

const wrapper = ({ children }: { children: ReactNode }) => <SettingsProvider>{children}</SettingsProvider>;

const preset = (id: string, name: string, model: string) => ({
  id, name,
  values: {
    endpoint: `http://${id}.test/v1`, apiToken: '', model, contextWindowOverride: null,
    maxOutputOverride: { enabled: false, value: 0 }, samplerOverrides: defaultEndpointSamplerOverrides(),
  },
});

/** Two endpoint presets with Big Model active, and a prompt preset carrying `routing`. */
function seed(routing: PromptEndpointMap) {
  const endpoints: TextEndpointPresetStore = {
    activeId: 'big',
    presets: [preset('big', 'Big Model', 'big-24b'), preset('small', 'Small Model', 'small-1b')],
  };
  localStorage.setItem('FORMAMORPH_textEndpointPresets', textEndpointPresetCodec.serialize(endpoints));
  const prompts: PromptPresetStore = {
    activeId: 'mine',
    presets: [{ id: 'mine', name: 'Mine', values: { systemPrompt: 'A' } as never, style: 'markdown', promptEndpoints: routing }],
  };
  localStorage.setItem('FORMAMORPH_promptPresets', presetStoreCodec.serialize(prompts));
}

let fetchSpy: MockInstance<typeof fetch>;

beforeEach(() => {
  localStorage.clear();
  window.matchMedia = ((query: string) => ({
    matches: false, media: query, onchange: null,
    addListener: vi.fn(), removeListener: vi.fn(),
    addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia;
  fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response('{}', { status: 404 }));
});
afterEach(() => {
  fetchSpy.mockRestore();
  delete (window as unknown as { formamorphDesktop?: unknown }).formamorphDesktop;
});

/** The tip function, once the provider's own mount-time probes have settled. */
async function renderTip() {
  const { result } = renderHook(() => useEndpointTip(), { wrapper });
  await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
  fetchSpy.mockClear();
  return result;
}

describe('useEndpointTip', () => {
  it('names the preset and model a pinned kind sends to', async () => {
    seed({ summary: 'small' });
    const tip = await renderTip();
    expect(tip.current('summary')).toBe('Sends to Small Model · small-1b');
  });

  it('names the active endpoint for a kind pinned to a deleted preset', async () => {
    seed({ summary: 'gone' });
    const tip = await renderTip();
    expect(tip.current('summary')).toBe('Sends to Big Model · big-24b');
  });

  it('names the active endpoint for an unpinned kind', async () => {
    seed({ summary: 'small' });
    const tip = await renderTip();
    expect(tip.current('narration')).toBe('Sends to Big Model · big-24b');
  });

  it('names the Built-In Engine for a kind pinned to it', async () => {
    (window as unknown as { formamorphDesktop?: unknown }).formamorphDesktop = {};
    seed({ summary: BUILTIN_ENGINE_PRESET_ID });
    const tip = await renderTip();
    expect(tip.current('summary')).toMatch(/^Sends to Built-In Engine/);
  });

  it('sends nothing while building the line for a pinned kind', async () => {
    seed({ summary: 'small' });
    const tip = await renderTip();
    tip.current('summary');
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
