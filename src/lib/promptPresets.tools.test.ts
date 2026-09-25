import { describe, it, expect } from 'vitest';
import type { Tool } from '@/types';
import {
  activeUserTools, activeToolOverrides, activeCatalogTools, storedToolSet, saveTool, deleteTool, setToolOverride,
  addPreset, presetStoreCodec, type PromptPresetStore, type PromptValues,
} from './promptPresets';

const values = {} as PromptValues;
const tool = (patch: Partial<Tool> = {}): Tool => ({
  id: 't1', name: 'get_weather', description: 'Purpose: weather.', params: [],
  handler: { kind: 'template', body: 'Sunny.' }, emptyResult: '', offeredTo: ['narration'], enabled: true, ...patch,
});
const userStore = (patch: Partial<PromptPresetStore['presets'][number]> = {}): PromptPresetStore => ({
  activeId: 'u1', presets: [{ id: 'u1', name: 'Mine', values, ...patch }],
});
const getEntity = (s: PromptPresetStore) => activeCatalogTools(s).find((t) => t.id === 'get_entity')!;

describe('user Tools on a preset', () => {
  it('saves a new Tool, replaces it by id, and deletes it', () => {
    let s = saveTool(userStore(), tool());
    expect(activeUserTools(s)).toEqual([tool()]);
    s = saveTool(s, tool({ description: 'Purpose: better weather.' }));
    expect(activeUserTools(s)).toEqual([tool({ description: 'Purpose: better weather.' })]);
    s = saveTool(s, tool({ id: 't2', name: 'get_time' }));
    s = deleteTool(s, 't1');
    expect(activeUserTools(s).map((t) => t.id)).toEqual(['t2']);
  });

  it('refuses a Tool whose name is invalid, taken or built-in', () => {
    const s = saveTool(userStore(), tool());
    for (const bad of [tool({ id: 't2', name: 'bad name' }), tool({ id: 't2' }), tool({ id: 't2', name: 'get_entity' })]) {
      expect(saveTool(s, bad)).toBe(s);
    }
  });

  it('persists through the store codec', () => {
    const s = setToolOverride(saveTool(userStore(), tool({ callLimit: 3 })), 'get_entity', { enabled: true, offeredTo: ['narration'] });
    const back = presetStoreCodec.parse(presetStoreCodec.serialize(s));
    expect(activeUserTools(back)).toEqual([tool({ callLimit: 3 })]);
    expect(getEntity(back).enabled).toBe(true);
  });
});

describe('built-in Tool overrides', () => {
  it('every preset sees the catalog, with get_entity off on a user preset that has no override', () => {
    expect(getEntity(userStore()).enabled).toBe(false);
    expect(getEntity({ activeId: 'default', presets: [] }).enabled).toBe(false);
  });

  it('a user preset stores its own override', () => {
    const s = setToolOverride(userStore(), 'get_entity', { enabled: true, offeredTo: ['narration', 'choices'] });
    expect(activeToolOverrides(s)).toEqual({ get_entity: { enabled: true, offeredTo: ['narration', 'choices'] } });
    expect(getEntity(s)).toMatchObject({ enabled: true, offeredTo: ['narration', 'choices'] });
  });

  it('ignores an override for an id outside the catalog', () => {
    const s = userStore();
    expect(setToolOverride(s, 't1', { enabled: true, offeredTo: [] })).toBe(s);
  });

  it('Experimental ships get_entity on', () => {
    const s: PromptPresetStore = { activeId: 'experimental', presets: [] };
    expect(getEntity(s)).toMatchObject({ enabled: true, offeredTo: ['narration'] });
  });
});

describe('a built-in preset', () => {
  const builtIn: PromptPresetStore = { activeId: 'experimental', presets: [{ id: 'u1', name: 'Mine', values }] };

  it('holds no user Tools and refuses every Tool edit', () => {
    expect(activeUserTools(builtIn)).toEqual([]);
    expect(saveTool(builtIn, tool())).toBe(builtIn);
    expect(deleteTool(builtIn, 't1')).toBe(builtIn);
    expect(setToolOverride(builtIn, 'get_entity', { enabled: false, offeredTo: [] })).toBe(builtIn);
  });

  it('hands its shipped overrides to a copy, so a duplicate of Experimental keeps get_entity on', () => {
    const copy = addPreset(builtIn, 'c1', 'Copy', values, 'markdown', undefined, storedToolSet(builtIn));
    expect(getEntity(copy).enabled).toBe(true);
  });
});

describe('copying a user preset', () => {
  it('carries its Tools and overrides', () => {
    const s = setToolOverride(saveTool(userStore(), tool()), 'get_entity', { enabled: true, offeredTo: ['narration'] });
    const copy = addPreset(s, 'c1', 'Copy', values, 'markdown', undefined, storedToolSet(s));
    expect(activeUserTools(copy)).toEqual([tool()]);
    expect(getEntity(copy).enabled).toBe(true);
  });

  it('adds no Tool fields when the source has none', () => {
    const copy = addPreset(userStore(), 'c1', 'Copy', values, 'markdown', undefined, storedToolSet(userStore()));
    expect(copy.presets[1]).toEqual({ id: 'c1', name: 'Copy', values, style: 'markdown' });
  });
});
