import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { ReactNode } from 'react';
import { SettingsProvider, useSettings } from './SettingsContext';
import { presetStoreCodec, type PromptPreset, type PromptPresetStore } from '@/lib/promptPresets';
import { parseSharedContent, type ImportedPreset } from '@/lib/promptPresetShare';
import { resolveEffectivePreset } from '@/lib/worldPromptPreset';
import { PROMPT_TEXT_DEFAULTS } from '@/components/game/GamePrompts';

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
  sourceAuthorId: 'uploader-1',
  sourceAuthorName: 'Uploader',
  downloadedAt: '2026-09-02T00:00:00.000Z',
  dirty: false,
};

/** A listing's content as the server hands it back, read through the share sanitizer. */
function listingContent(raw: Record<string, unknown>): ImportedPreset {
  const parsed = parseSharedContent({ kind: 'formamorph-prompt-preset', formatVersion: 1, appVersion: '2.0.3', name: 'Listed', style: 'markdown', ...raw }, '2.0.3');
  if (!parsed.ok || !parsed.preset) throw new Error(parsed.error);
  return parsed.preset;
}

function seed(store: PromptPresetStore) {
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

describe('SettingsContext: a downloaded preset', () => {
  it('a first download adds a linked, clean preset and leaves the selection alone', () => {
    const { result } = renderHook(() => useSettings(), { wrapper });
    act(() => result.current.storeDownloadedPreset('dl-1', listingContent({ values: { systemPrompt: 'Shared' } }), LINK, 'Listed'));

    expect(storedPreset('dl-1')).toMatchObject({ name: 'Listed', ...LINK });
    expect(storedPreset('dl-1')!.values.systemPrompt).toBe('Shared');
    expect(result.current.activePresetId).toBe('default');
  });

  it('an update replaces the preset under the same id and clears its edits', () => {
    const edited: PromptPreset = { id: 'dl-1', name: 'Listed', values: { systemPrompt: 'Mine' } as never, style: 'markdown', ...LINK, dirty: true, editedAt: '2026-09-03T00:00:00.000Z' };
    seed({ activeId: 'default', presets: [edited] });
    const { result } = renderHook(() => useSettings(), { wrapper });
    const newer = { ...LINK, sourceUpdatedAt: '2026-09-10T00:00:00.000Z' };
    act(() => result.current.storeDownloadedPreset('dl-1', listingContent({ values: { systemPrompt: 'Newer' } }), newer, 'Listed'));

    expect(stored().presets).toHaveLength(1);
    const preset = storedPreset('dl-1')!;
    expect(preset.values.systemPrompt).toBe('Newer');
    expect(preset).toMatchObject({ sourceUpdatedAt: newer.sourceUpdatedAt, dirty: false });
    expect(preset.editedAt).toBeUndefined();
  });

  it('a world pinned to the preset still resolves to it, and runs the new text, after an update', () => {
    seed({ activeId: 'default', presets: [{ id: 'dl-1', name: 'Listed', values: { systemPrompt: 'Old' } as never, style: 'markdown', ...LINK }] });
    const { result } = renderHook(() => useSettings(), { wrapper });
    act(() => result.current.beginSessionPreset('dl-1'));
    act(() => result.current.storeDownloadedPreset('dl-1', listingContent({ values: { systemPrompt: 'Newer' } }), LINK, 'Listed'));

    expect(resolveEffectivePreset('dl-1', undefined, stored()).presetId).toBe('dl-1');
    expect(result.current.systemPrompt).toBe('Newer');
  });

  it('prompt keys the listing lacks run on the current defaults', () => {
    const { result } = renderHook(() => useSettings(), { wrapper });
    act(() => result.current.storeDownloadedPreset('dl-1', listingContent({ values: { systemPrompt: 'Shared' } }), LINK, 'Listed'));
    act(() => result.current.selectPreset('dl-1'));

    expect(result.current.systemPrompt).toBe('Shared');
    expect(result.current.choicesPrompt).toBe(PROMPT_TEXT_DEFAULTS.choicesPrompt);
    expect(storedPreset('dl-1')!.values.choicesPrompt).toBe(PROMPT_TEXT_DEFAULTS.choicesPrompt);
  });

  it('always applies the listing\'s tuning', () => {
    const { result } = renderHook(() => useSettings(), { wrapper });
    act(() => result.current.storeDownloadedPreset('dl-1', listingContent({ values: {}, verbatim: { narration: 7 } }), LINK, 'Listed'));

    expect(storedPreset('dl-1')!.verbatim).toEqual({ narration: 7 });
  });

  it.each([
    ['no Overview', {}],
    ['a blank Author', { overview: { author: '  ', description: 'About', tags: [], models: ['m'] } }],
  ])('fills the Author with the uploader when the listing has %s', (_label, raw) => {
    const { result } = renderHook(() => useSettings(), { wrapper });
    act(() => result.current.storeDownloadedPreset('dl-1', listingContent({ values: {}, ...raw }), LINK, 'Listed'));

    expect(storedPreset('dl-1')!.overview?.author).toBe('Uploader');
  });

  it('keeps an Author the listing sets', () => {
    const { result } = renderHook(() => useSettings(), { wrapper });
    act(() => result.current.storeDownloadedPreset('dl-1', listingContent({ values: {}, overview: { author: 'Pen Name', description: '', tags: [], models: ['m'] } }), LINK, 'Listed'));

    expect(storedPreset('dl-1')!.overview?.author).toBe('Pen Name');
  });

  it('never exports the link', () => {
    const { result } = renderHook(() => useSettings(), { wrapper });
    act(() => result.current.storeDownloadedPreset('dl-1', listingContent({ values: {} }), LINK, 'Listed'));
    act(() => result.current.selectPreset('dl-1'));

    const exported = JSON.stringify(result.current.exportActivePreset('2.0.3'));
    for (const value of [LINK.sourceId, LINK.sourceUpdatedAt, LINK.sourceAuthorId, LINK.downloadedAt]) {
      expect(exported).not.toContain(value);
    }
  });

  it.each([false, true])('selects the downloaded preset as the global one (Advanced mode %s)', (advanced) => {
    const { result } = renderHook(() => useSettings(), { wrapper });
    act(() => result.current.setAdvancedMode(advanced));
    act(() => result.current.storeDownloadedPreset('dl-1', listingContent({ values: { systemPrompt: 'Shared' } }), LINK, 'Listed'));
    act(() => result.current.selectPreset('dl-1'));

    expect(stored().activeId).toBe('dl-1');
    expect(result.current.systemPrompt).toBe('Shared');
  });

  it('a file or share code import stays unlinked, even over a downloaded preset', () => {
    const { result } = renderHook(() => useSettings(), { wrapper });
    act(() => result.current.storeDownloadedPreset('dl-1', listingContent({ values: {} }), LINK, 'Listed'));
    let fresh = '';
    act(() => { fresh = result.current.importPreset(listingContent({ values: {} }), { includeTuning: true, name: 'From File' }); });
    act(() => { result.current.importPreset(listingContent({ values: {} }), { includeTuning: true, name: 'Over It', overwriteId: 'dl-1' }); });

    for (const id of [fresh, 'dl-1']) expect(storedPreset(id)).not.toHaveProperty('sourceId');
  });

  it('lists user presets with their link, for the browser to find a listing\'s copy', () => {
    const { result } = renderHook(() => useSettings(), { wrapper });
    act(() => result.current.storeDownloadedPreset('dl-1', listingContent({ values: {} }), LINK, 'Listed'));

    expect(result.current.userPromptPresets).toEqual([expect.objectContaining({ id: 'dl-1', sourceId: LINK.sourceId })]);
  });
});
