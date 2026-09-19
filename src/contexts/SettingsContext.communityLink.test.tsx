import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { ReactNode } from 'react';
import { SettingsProvider, useSettings } from './SettingsContext';
import { presetStoreCodec, type PromptPreset, type PromptPresetStore } from '@/lib/promptPresets';

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
const storedPreset = (id: string) => stored().presets.find((p) => p.id === id);

const LINK = {
  sourceId: 'listing-1',
  sourceUpdatedAt: '2026-09-01T00:00:00.000Z',
  sourceAuthorId: 'author-1',
  sourceAuthorName: 'Author',
  downloadedAt: '2026-09-02T00:00:00.000Z',
};

/** One linked user preset and one unlinked one, the linked one selected. */
function seed(activeId = 'linked') {
  const presets: PromptPreset[] = [
    { id: 'linked', name: 'Linked', values: { systemPrompt: 'A' } as never, style: 'markdown', ...LINK },
    { id: 'plain', name: 'Plain', values: { systemPrompt: 'B' } as never, style: 'markdown' },
  ];
  const store: PromptPresetStore = { activeId, presets };
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

describe('SettingsContext: a preset linked to a listing', () => {
  it.each([
    ['prompt text', (s: ReturnType<typeof useSettings>) => s.setSystemPrompt('Edited')],
    ['a sampler', (s: ReturnType<typeof useSettings>) => s.setPromptSamplerCustom('narration', 'temperature', true)],
    ['reasoning', (s: ReturnType<typeof useSettings>) => s.setPromptReasoning('narration', { enabled: false, level: 'global' })],
    ['max output', (s: ReturnType<typeof useSettings>) => s.setPromptMaxOutputCustom('summary', true)],
    ['verbatim turns', (s: ReturnType<typeof useSettings>) => s.setNarrationVerbatimTurns(7)],
    ['the Overview', (s: ReturnType<typeof useSettings>) => s.setPresetOverview({ author: 'Ann' })],
    ['a reset', (s: ReturnType<typeof useSettings>) => s.resetPreset('linked')],
    ['the name', (s: ReturnType<typeof useSettings>) => s.renamePreset('linked', 'Renamed')],
  ])('an edit to %s marks it dirty and stamps the edit', (_label, edit) => {
    seed();
    const { result } = renderHook(() => useSettings(), { wrapper });
    act(() => edit(result.current));

    const preset = storedPreset('linked')!;
    expect(preset.dirty).toBe(true);
    expect(Number.isNaN(Date.parse(preset.editedAt ?? ''))).toBe(false);
    expect(preset.sourceId).toBe(LINK.sourceId);
  });

  it('an edit to an unlinked preset leaves it without a link', () => {
    seed('plain');
    const { result } = renderHook(() => useSettings(), { wrapper });
    act(() => result.current.setSystemPrompt('Edited'));

    const preset = storedPreset('plain')!;
    expect(preset.dirty).toBeUndefined();
    expect(preset.editedAt).toBeUndefined();
  });

  it('a write that changes nothing leaves it clean', () => {
    seed();
    const { result } = renderHook(() => useSettings(), { wrapper });
    act(() => result.current.setSystemPrompt('A'));
    act(() => result.current.renamePreset('linked', 'Linked'));

    expect(storedPreset('linked')!.dirty).toBeUndefined();
  });

  it('a publish over a stale link replaces the source stamp and clears the edit', () => {
    seed();
    const { result } = renderHook(() => useSettings(), { wrapper });
    act(() => result.current.setSystemPrompt('Edited'));
    act(() => result.current.linkPresetToListing('linked', 'listing-2'));

    const preset = storedPreset('linked')!;
    expect(preset).toMatchObject({ sourceId: 'listing-2', dirty: false });
    expect(preset.sourceUpdatedAt).toBeUndefined();
    expect(preset.editedAt).toBeUndefined();
  });

  it('endpoint routing is local setup, not an edit', () => {
    seed();
    const { result } = renderHook(() => useSettings(), { wrapper });
    act(() => result.current.setPromptEndpoint('summary', 'some-endpoint'));

    expect(storedPreset('linked')!.dirty).toBeUndefined();
  });

  it('a duplicate has no link', () => {
    seed();
    const { result } = renderHook(() => useSettings(), { wrapper });
    let copy = '';
    act(() => { copy = result.current.addPreset('Linked (copy)'); });

    const preset = storedPreset(copy)!;
    expect(preset.values.systemPrompt).toBe('A');
    for (const key of ['sourceId', 'sourceUpdatedAt', 'sourceAuthorId', 'sourceAuthorName', 'downloadedAt', 'dirty', 'editedAt']) {
      expect(preset).not.toHaveProperty(key);
    }
  });

  it('deleting the preset drops its link', () => {
    seed();
    const { result } = renderHook(() => useSettings(), { wrapper });
    act(() => result.current.deletePreset('linked'));

    expect(stored().presets.some((p) => p.sourceId === LINK.sourceId)).toBe(false);
    expect(localStorage.getItem(PROMPTS_KEY)).not.toContain(LINK.sourceId);
  });

  it('a publish links the preset to its listing as a clean copy', () => {
    seed('plain');
    const { result } = renderHook(() => useSettings(), { wrapper });
    act(() => result.current.setSystemPrompt('Edited'));
    act(() => result.current.linkPresetToListing('plain', 'listing-9', '2026-09-19T00:00:00.000Z', { id: 'me', name: 'Me' }));

    expect(storedPreset('plain')).toMatchObject({
      sourceId: 'listing-9', sourceUpdatedAt: '2026-09-19T00:00:00.000Z', sourceAuthorId: 'me', sourceAuthorName: 'Me', dirty: false,
    });
    expect(storedPreset('plain')!.values.systemPrompt).toBe('Edited');
  });
});
