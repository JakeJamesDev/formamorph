import { describe, it, expect } from 'vitest';
import type { Tool } from '@/types';
import {
  activeEnabledTools, setToolEnabled, dropToolEverywhere, saveUserTool, deleteUserTool, userToolsCodec,
  addPreset, presetStoreCodec, activeBuiltinId, setBuiltinToolEnabled, dropToolFromBuiltins, builtinToolSwitchesCodec,
  type BuiltinToolSwitches, type PromptPresetStore, type PromptValues,
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
/** The active preset's switches when no built-in switch was ever flipped. */
const unflipped = (s: PromptPresetStore) => activeEnabledTools(s, {});
const onAt = (s: PromptPresetStore, presetId: string) => unflipped({ ...s, activeId: presetId });

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
    expect(unflipped(twoPresets())).toEqual({});
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
    expect(unflipped(presetStoreCodec.parse(presetStoreCodec.serialize(s)))).toEqual({ t1: true });
  });
});

describe('a built-in preset', () => {
  const builtIn: PromptPresetStore = { activeId: 'experimental', presets: [{ id: 'u1', name: 'Mine', values }] };
  /** Flip one switch on the built-in `store` shows, the way the settings context does. */
  const flip = (switches: BuiltinToolSwitches, store: PromptPresetStore, id: string, on: boolean) =>
    setBuiltinToolEnabled(switches, activeBuiltinId(store)!, id, on);

  it('defaults to its shipped map: Experimental has get_entity on, the others have nothing on', () => {
    expect(activeEnabledTools(builtIn, {})).toEqual({ get_entity: true });
    expect(activeEnabledTools({ activeId: 'default', presets: [] }, {})).toEqual({});
  });

  it('keeps a flipped switch, over its shipped defaults, on that built-in only', () => {
    let switches = flip({}, builtIn, 't1', true);
    expect(activeEnabledTools(builtIn, switches)).toEqual({ get_entity: true, t1: true });
    switches = flip(switches, builtIn, 'get_entity', false);
    expect(activeEnabledTools(builtIn, switches)).toEqual({ get_entity: false, t1: true });
    expect(activeEnabledTools({ ...builtIn, activeId: 'default' }, switches)).toEqual({});
    expect(activeEnabledTools({ ...builtIn, activeId: 'u1' }, switches)).toEqual({});
  });

  it('keeps a later shipped default live under the switches a player flipped before it shipped', () => {
    const switches = builtinToolSwitchesCodec.parse(JSON.stringify({ experimental: { t1: true } }));
    expect(activeEnabledTools(builtIn, switches)).toEqual({ get_entity: true, t1: true });
  });

  it('reads a ghost id as Default, switches included', () => {
    const ghost: PromptPresetStore = { activeId: 'gone', presets: [] };
    expect(activeBuiltinId(ghost)).toBe('default');
    expect(activeEnabledTools(ghost, flip({}, ghost, 't1', true))).toEqual({ t1: true });
  });

  it('is not a built-in when a user preset is active', () => {
    expect(activeBuiltinId({ ...builtIn, activeId: 'u1' })).toBeNull();
  });

  it('leaves the preset store alone, so its prompt text stays read-only', () => {
    expect(setToolEnabled(builtIn, 'get_entity', false)).toBe(builtIn);
  });

  it('drops a deleted Tool from every built-in and keeps the other switches', () => {
    let switches = flip({}, builtIn, 't1', true);
    switches = flip(switches, { ...builtIn, activeId: 'default' }, 't1', true);
    switches = dropToolFromBuiltins(switches, 't1');
    expect(activeEnabledTools(builtIn, switches)).toEqual({ get_entity: true });
    expect(activeEnabledTools({ ...builtIn, activeId: 'default' }, switches)).toEqual({});
  });

  it('persists its switches through their codec, dropping unknown presets and malformed maps', () => {
    const switches = flip(flip({}, builtIn, 'get_entity', false), { ...builtIn, activeId: 'default' }, 't1', true);
    expect(builtinToolSwitchesCodec.parse(builtinToolSwitchesCodec.serialize(switches))).toEqual(switches);
    const stored = JSON.stringify({ experimental: { get_entity: false, t1: 'yes' }, u1: { t1: true }, simple: [] });
    expect(builtinToolSwitchesCodec.parse(stored)).toEqual({ experimental: { get_entity: false } });
    expect(builtinToolSwitchesCodec.parse('{nope')).toEqual({});
    expect(builtinToolSwitchesCodec.parse('[]')).toEqual({});
  });

  it('hands a copy its shipped map, so a duplicate of Experimental keeps get_entity on', () => {
    const copy = addPreset(builtIn, 'c1', 'Copy', values, 'markdown', undefined, activeEnabledTools(builtIn, {}));
    expect(unflipped(copy)).toEqual({ get_entity: true });
  });

  it('hands a copy its current switches, flipped and default alike', () => {
    const switches = flip({}, builtIn, 't1', true);
    const copy = addPreset(builtIn, 'c1', 'Copy', values, 'markdown', undefined, activeEnabledTools(builtIn, switches));
    expect(unflipped(copy)).toEqual({ get_entity: true, t1: true });
  });
});

describe('copying a user preset', () => {
  it('carries its enabled map as its own copy', () => {
    const s = setToolEnabled(twoPresets(), 't1', true);
    const copy = addPreset(s, 'c1', 'Copy', values, 'markdown', undefined, unflipped(s));
    expect(unflipped(copy)).toEqual({ t1: true });
    expect(onAt(setToolEnabled(copy, 't1', false), 'u1')).toEqual({ t1: true });
  });

  it('adds no map when the source switches nothing on', () => {
    const copy = addPreset(twoPresets(), 'c1', 'Copy', values, 'markdown', undefined, unflipped(twoPresets()));
    expect(copy.presets[2]).toEqual({ id: 'c1', name: 'Copy', values, style: 'markdown' });
  });
});
