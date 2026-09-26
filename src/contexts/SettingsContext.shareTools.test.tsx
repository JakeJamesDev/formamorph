import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { ReactNode } from 'react';
import type { Tool } from '@/types';
import { SettingsProvider, useSettings } from './SettingsContext';
import { presetStoreCodec, userToolsCodec, type PromptPresetStore } from '@/lib/promptPresets';
import type { ImportedPreset } from '@/lib/promptPresetShare';

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
const TOOLS_KEY = 'FORMAMORPH_tools';
const BUILTIN_KEY = 'FORMAMORPH_builtinPresetTools';
const wrapper = ({ children }: { children: ReactNode }) => <SettingsProvider>{children}</SettingsProvider>;
const TOOL: Tool = {
  id: 't1', name: 'get_weather', description: 'Purpose: weather.', params: [],
  handler: { kind: 'template', body: 'Sunny.' }, emptyResult: '', offeredTo: ['narration'],
};
const SWITCHES = { get_entity: true, t1: true };
const gift: ImportedPreset = { name: 'Gift', style: 'markdown', values: { systemPrompt: 'X' } as never, enabledTools: { get_entity: true } };

function seed(activeId: string) {
  const store: PromptPresetStore = {
    activeId,
    presets: [
      { id: 'mine', name: 'Mine', values: { systemPrompt: 'A' } as never, style: 'markdown', enabledTools: SWITCHES },
      { id: 'other', name: 'Other', values: { systemPrompt: 'B' } as never, style: 'markdown', enabledTools: { t1: true } },
    ],
  };
  localStorage.setItem(PROMPTS_KEY, presetStoreCodec.serialize(store));
  localStorage.setItem(TOOLS_KEY, userToolsCodec.serialize([TOOL]));
}

const stored = (id: string) => presetStoreCodec.parse(localStorage.getItem(PROMPTS_KEY)!).presets.find((p) => p.id === id);
const storedTools = () => userToolsCodec.parse(localStorage.getItem(TOOLS_KEY) ?? '[]');

beforeEach(() => {
  localStorage.clear();
  window.matchMedia = ((query: string) => ({
    matches: false, media: query, onchange: null,
    addListener: vi.fn(), removeListener: vi.fn(),
    addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia;
});

describe('SettingsContext: the global Tool list', () => {
  it('lists the same user Tools under every preset, with each preset’s own switches', () => {
    seed('mine');
    const { result } = renderHook(() => useSettings(), { wrapper });
    expect(result.current.userTools).toEqual([TOOL]);
    expect(result.current.enabledTools).toEqual(SWITCHES);
    act(() => { result.current.selectPreset('default'); });
    expect(result.current.userTools).toEqual([TOOL]);
    expect(result.current.enabledTools).toEqual({});
  });

  it('switches a Tool for the active preset only', () => {
    seed('mine');
    const { result } = renderHook(() => useSettings(), { wrapper });
    act(() => { result.current.setToolEnabled('t1', false); });
    expect(stored('mine')?.enabledTools).toEqual({ get_entity: true, t1: false });
    expect(stored('other')?.enabledTools).toEqual({ t1: true });
  });

  it('deletes a Tool from the list and from every preset’s switches', () => {
    seed('mine');
    const { result } = renderHook(() => useSettings(), { wrapper });
    act(() => { result.current.deleteTool('t1'); });
    expect(storedTools()).toEqual([]);
    expect(stored('mine')?.enabledTools).toEqual({ get_entity: true });
    expect(stored('other')).not.toHaveProperty('enabledTools.t1');
  });
});

describe('SettingsContext: Tool switches in export, import and copy', () => {
  it('exports a user preset’s catalog switches and a copy of each user Tool it switches on', () => {
    seed('mine');
    const { result } = renderHook(() => useSettings(), { wrapper });
    const shared = result.current.exportActivePreset('2.9.2');
    expect(shared.enabledTools).toEqual({ get_entity: true });
    expect(shared.tools).toEqual([TOOL]);
    act(() => { result.current.setToolEnabled('t1', false); });
    expect('tools' in result.current.exportActivePreset('2.9.2')).toBe(false);
  });

  it('adds an embedded Tool with an unknown name and switches it on for the imported preset only', () => {
    seed('mine');
    const { result } = renderHook(() => useSettings(), { wrapper });
    const forecast: Tool = { ...TOOL, id: 't1', name: 'get_forecast' };
    let id = '';
    act(() => { id = result.current.importPreset({ ...gift, tools: [forecast] }, { includeTuning: false, name: 'Gift' }); });
    const [, added] = storedTools();
    expect(storedTools()).toEqual([TOOL, { ...forecast, id: added.id }]);
    expect(added.id).not.toBe('t1');
    expect(stored(id)?.enabledTools).toEqual({ get_entity: true, [added.id]: true });
    expect(stored('mine')?.enabledTools).toEqual(SWITCHES);
    expect(stored('other')?.enabledTools).toEqual({ t1: true });
  });

  it('keeps the local Tool on a name match and switches the local one on, overwrite included', () => {
    seed('mine');
    const { result } = renderHook(() => useSettings(), { wrapper });
    const theirs: Tool = { ...TOOL, id: 'far-away', name: 'Get_Weather', description: 'Their weather.' };
    let id = '';
    act(() => { id = result.current.importPreset({ ...gift, tools: [theirs] }, { includeTuning: false, name: 'Gift' }); });
    expect(storedTools()).toEqual([TOOL]);
    expect(stored(id)?.enabledTools).toEqual({ get_entity: true, t1: true });
    act(() => { result.current.importPreset({ ...gift, enabledTools: undefined, tools: [theirs] }, { includeTuning: false, name: 'Other', overwriteId: 'other' }); });
    expect(storedTools()).toEqual([TOOL]);
    expect(stored('other')?.enabledTools).toEqual({ t1: true });
  });

  it('merges a community download’s Tools by name and reports an added Script Tool', () => {
    seed('mine');
    const { result } = renderHook(() => useSettings(), { wrapper });
    const dice: Tool = { ...TOOL, id: 'far-away', name: 'roll_dice', handler: { kind: 'script', code: 'return 4;' } };
    let report = { scriptToolAdded: false };
    act(() => { report = result.current.storeDownloadedPreset('dl-1', { ...gift, tools: [TOOL, dice] }, { sourceId: 'listing-1' }, 'Listed'); });
    expect(report).toEqual({ scriptToolAdded: true });
    const [, added] = storedTools();
    expect(storedTools()).toEqual([TOOL, { ...dice, id: added.id }]);
    expect(stored('dl-1')?.enabledTools).toEqual({ get_entity: true, t1: true, [added.id]: true });
    act(() => { report = result.current.storeDownloadedPreset('dl-1', { ...gift, tools: [TOOL, dice] }, { sourceId: 'listing-1' }, 'Listed'); });
    expect(report).toEqual({ scriptToolAdded: false });
    expect(storedTools()).toHaveLength(2);
  });

  it('adds a name once when two downloads carrying it land before a re-render', () => {
    seed('mine');
    const { result } = renderHook(() => useSettings(), { wrapper });
    const dice: Tool = { ...TOOL, id: 'far-away', name: 'roll_dice', handler: { kind: 'script', code: 'return 4;' } };
    const reports: { scriptToolAdded: boolean }[] = [];
    act(() => {
      const { storeDownloadedPreset } = result.current;
      reports.push(storeDownloadedPreset('dl-1', { ...gift, tools: [dice] }, { sourceId: 'listing-1' }, 'One'));
      reports.push(storeDownloadedPreset('dl-2', { ...gift, tools: [dice] }, { sourceId: 'listing-2' }, 'Two'));
    });
    const [, added] = storedTools();
    expect(storedTools()).toHaveLength(2);
    expect(stored('dl-1')?.enabledTools).toEqual({ get_entity: true, [added.id]: true });
    expect(stored('dl-2')?.enabledTools).toEqual({ get_entity: true, [added.id]: true });
    expect(reports).toEqual([{ scriptToolAdded: true }, { scriptToolAdded: false }]);
  });

  it('exports Experimental with get_entity on and Default with no switches', () => {
    seed('experimental');
    const { result } = renderHook(() => useSettings(), { wrapper });
    expect(result.current.exportActivePreset('2.9.2').enabledTools).toEqual({ get_entity: true });
    act(() => { result.current.selectPreset('default'); });
    expect('enabledTools' in result.current.exportActivePreset('2.9.2')).toBe(false);
  });

  it('stores imported switches with or without tuning', () => {
    seed('mine');
    const { result } = renderHook(() => useSettings(), { wrapper });
    let id = '';
    act(() => { id = result.current.importPreset(gift, { includeTuning: false, name: 'Gift' }); });
    expect(stored(id)?.enabledTools).toEqual({ get_entity: true });
  });

  it('copies the switches into a new preset, and a copy of Experimental keeps get_entity on', () => {
    seed('mine');
    const { result } = renderHook(() => useSettings(), { wrapper });
    let id = '';
    act(() => { id = result.current.addPreset('Copy'); });
    expect(stored(id)?.enabledTools).toEqual(SWITCHES);
    act(() => { result.current.selectPreset('experimental'); });
    act(() => { id = result.current.addPreset('Experimental Copy'); });
    expect(stored(id)?.enabledTools).toEqual({ get_entity: true });
  });
});

describe('SettingsContext: Tool switches on a built-in preset', () => {
  it('switches a Tool on a built-in, keeps its shipped defaults, and persists across reload', () => {
    seed('experimental');
    const presetsBefore = localStorage.getItem(PROMPTS_KEY);
    const first = renderHook(() => useSettings(), { wrapper });
    act(() => { first.result.current.setToolEnabled('t1', true); });
    expect(first.result.current.enabledTools).toEqual({ get_entity: true, t1: true });
    expect(localStorage.getItem(PROMPTS_KEY)).toBe(presetsBefore);
    first.unmount();

    const { result } = renderHook(() => useSettings(), { wrapper });
    expect(result.current.enabledTools).toEqual({ get_entity: true, t1: true });
    act(() => { result.current.selectPreset('default'); });
    expect(result.current.enabledTools).toEqual({});
    act(() => { result.current.selectPreset('mine'); });
    expect(result.current.enabledTools).toEqual(SWITCHES);
  });

  it('leaves the user presets’ switches alone', () => {
    seed('experimental');
    const { result } = renderHook(() => useSettings(), { wrapper });
    act(() => { result.current.setToolEnabled('get_entity', false); });
    expect(stored('mine')?.enabledTools).toEqual(SWITCHES);
    expect(stored('other')?.enabledTools).toEqual({ t1: true });
    expect(JSON.parse(localStorage.getItem(BUILTIN_KEY)!)).toEqual({ experimental: { get_entity: false } });
  });

  it('copies and exports a built-in with its current switches', () => {
    seed('experimental');
    const { result } = renderHook(() => useSettings(), { wrapper });
    act(() => { result.current.setToolEnabled('t1', true); });
    let id = '';
    act(() => { id = result.current.addPreset('Experimental Copy'); });
    expect(stored(id)?.enabledTools).toEqual({ get_entity: true, t1: true });

    act(() => { result.current.selectPreset('experimental'); });
    act(() => { result.current.setToolEnabled('get_entity', false); });
    expect(result.current.exportActivePreset('2.9.2').enabledTools).toEqual({ get_entity: false });
  });

  it('drops a deleted Tool from a built-in’s switches', () => {
    seed('experimental');
    const { result } = renderHook(() => useSettings(), { wrapper });
    act(() => { result.current.setToolEnabled('t1', true); });
    act(() => { result.current.deleteTool('t1'); });
    expect(result.current.enabledTools).toEqual({ get_entity: true });
    expect(JSON.parse(localStorage.getItem(BUILTIN_KEY)!)).toEqual({ experimental: {} });
  });

  it('switches the built-in a world pins, not the global preset', () => {
    seed('mine');
    const { result } = renderHook(() => useSettings(), { wrapper });
    act(() => { result.current.beginSessionPreset('experimental'); });
    expect(result.current.enabledTools).toEqual({ get_entity: true });
    act(() => { result.current.setToolEnabled('t1', true); });
    expect(result.current.enabledTools).toEqual({ get_entity: true, t1: true });
    expect(stored('mine')?.enabledTools).toEqual(SWITCHES);
    expect(JSON.parse(localStorage.getItem(BUILTIN_KEY)!)).toEqual({ experimental: { t1: true } });
  });
});
