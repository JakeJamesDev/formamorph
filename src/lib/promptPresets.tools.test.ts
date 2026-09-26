import { describe, it, expect } from 'vitest';
import type { Tool } from '@/types';
import {
  activeEnabledTools, setToolEnabled, dropToolEverywhere, saveUserTool, deleteUserTool, userToolsCodec,
  addPreset, presetStoreCodec, type PromptPresetStore, type PromptValues,
} from './promptPresets';

const values = {} as PromptValues;
const tool = (patch: Partial<Tool> = {}): Tool => ({
  id: 't1', name: 'get_weather', description: 'Purpose: weather.', params: [],
  handler: { kind: 'template', body: 'Sunny.' }, emptyResult: '', offeredTo: ['narration'], ...patch,
});
const twoPresets = (patch: Partial<PromptPresetStore['presets'][number]> = {}): PromptPresetStore => ({
  activeId: 'u1',
  presets: [{ id: 'u1', name: 'Mine', values, ...patch }, { id: 'u2', name: 'Other', values }],
});
const onAt = (s: PromptPresetStore, presetId: string) => activeEnabledTools({ ...s, activeId: presetId });

describe('the global user Tool list', () => {
  it('saves a new Tool, replaces it by id, and deletes it', () => {
    let tools = saveUserTool([], tool());
    expect(tools).toEqual([tool()]);
    tools = saveUserTool(tools, tool({ description: 'Purpose: better weather.' }));
    expect(tools).toEqual([tool({ description: 'Purpose: better weather.' })]);
    tools = saveUserTool(tools, tool({ id: 't2', name: 'get_time' }));
    expect(deleteUserTool(tools, 't1').map((t) => t.id)).toEqual(['t2']);
  });

  it('refuses a Tool whose name is invalid, taken or built-in', () => {
    const tools = saveUserTool([], tool());
    for (const bad of [tool({ id: 't2', name: 'bad name' }), tool({ id: 't2' }), tool({ id: 't2', name: 'get_entity' })]) {
      expect(saveUserTool(tools, bad)).toBe(tools);
    }
  });

  it('round-trips through its codec, dropping a malformed Tool and an old enabled bit', () => {
    const tools = [tool({ callLimit: 3 }), tool({ id: 't2', name: 'get_time' })];
    expect(userToolsCodec.parse(userToolsCodec.serialize(tools))).toEqual(tools);
    const stored = JSON.stringify([{ ...tool(), enabled: true }, { ...tool({ id: 't3', name: 'bad name' }) }]);
    expect(userToolsCodec.parse(stored)).toEqual([tool()]);
    expect(userToolsCodec.parse('{nope')).toEqual([]);
  });
});

describe('enabled maps', () => {
  it('a user preset without a map switches nothing on', () => {
    expect(activeEnabledTools(twoPresets())).toEqual({});
  });

  it('switches a Tool on for the active preset only', () => {
    const s = setToolEnabled(twoPresets(), 't1', true);
    expect(onAt(s, 'u1')).toEqual({ t1: true });
    expect(onAt(s, 'u2')).toEqual({});
    expect(onAt(setToolEnabled(s, 't1', false), 'u1')).toEqual({ t1: false });
  });

  it('drops a deleted Tool from every preset', () => {
    let s = setToolEnabled(twoPresets({ enabledTools: { get_entity: true } }), 't1', true);
    s = setToolEnabled({ ...s, activeId: 'u2' }, 't1', true);
    s = dropToolEverywhere(s, 't1');
    expect(onAt(s, 'u1')).toEqual({ get_entity: true });
    expect(onAt(s, 'u2')).toEqual({});
  });

  it('persists through the store codec', () => {
    const s = setToolEnabled(twoPresets(), 't1', true);
    expect(activeEnabledTools(presetStoreCodec.parse(presetStoreCodec.serialize(s)))).toEqual({ t1: true });
  });
});

describe('a built-in preset', () => {
  const builtIn: PromptPresetStore = { activeId: 'experimental', presets: [{ id: 'u1', name: 'Mine', values }] };

  it('Experimental ships get_entity on, and the others ship nothing on', () => {
    expect(activeEnabledTools(builtIn)).toEqual({ get_entity: true });
    expect(activeEnabledTools({ activeId: 'default', presets: [] })).toEqual({});
  });

  it('refuses a switch change', () => {
    expect(setToolEnabled(builtIn, 'get_entity', false)).toBe(builtIn);
  });

  it('hands its shipped map to a copy, so a duplicate of Experimental keeps get_entity on', () => {
    const copy = addPreset(builtIn, 'c1', 'Copy', values, 'markdown', undefined, activeEnabledTools(builtIn));
    expect(activeEnabledTools(copy)).toEqual({ get_entity: true });
  });
});

describe('copying a user preset', () => {
  it('carries its enabled map as its own copy', () => {
    const s = setToolEnabled(twoPresets(), 't1', true);
    const copy = addPreset(s, 'c1', 'Copy', values, 'markdown', undefined, activeEnabledTools(s));
    expect(activeEnabledTools(copy)).toEqual({ t1: true });
    expect(onAt(setToolEnabled(copy, 't1', false), 'u1')).toEqual({ t1: true });
  });

  it('adds no map when the source switches nothing on', () => {
    const copy = addPreset(twoPresets(), 'c1', 'Copy', values, 'markdown', undefined, activeEnabledTools(twoPresets()));
    expect(copy.presets[2]).toEqual({ id: 'c1', name: 'Copy', values, style: 'markdown' });
  });
});
