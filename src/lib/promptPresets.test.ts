import { describe, it, expect } from 'vitest';
import {
  PROMPT_TEXT_KEYS,
  DEFAULT_PRESET_ID,
  emptyStore,
  presetStoreCodec,
  isBuiltInActive,
  activeStyle,
  activeValues,
  setActive,
  addPreset,
  renamePreset,
  deletePreset,
  resetPreset,
  updateValue,
  type PromptValues,
  type PromptPresetStore,
} from './promptPresets';

// Minimal full value-sets built from the key list, so tests don't hardcode 15 fields.
const defaults: PromptValues = Object.fromEntries(
  PROMPT_TEXT_KEYS.map((k) => [k, `default:${k}`]),
) as PromptValues;
const simpleValues: PromptValues = Object.fromEntries(
  PROMPT_TEXT_KEYS.map((k) => [k, `simple:${k}`]),
) as PromptValues;
// The built-in id → values map the context supplies to activeValues (`default` = markdown, `simple` = labels).
const builtinValues: Record<string, PromptValues> = { default: defaults, simple: simpleValues };

const storeWith = (preset: { id: string; name: string; values?: Partial<PromptValues>; style?: 'markdown' | 'labels' }): PromptPresetStore => ({
  activeId: preset.id,
  presets: [{ id: preset.id, name: preset.name, values: { ...defaults, ...preset.values }, style: preset.style }],
});

describe('presetStoreCodec', () => {
  it('round-trips a store', () => {
    const store = addPreset(emptyStore, 'p1', 'Mine', defaults, 'markdown');
    expect(presetStoreCodec.parse(presetStoreCodec.serialize(store))).toEqual(store);
  });

  it('falls back to the empty store on malformed or wrong-shaped input', () => {
    expect(presetStoreCodec.parse('not json')).toEqual(emptyStore);
    expect(presetStoreCodec.parse('{"activeId":5}')).toEqual(emptyStore);
    expect(presetStoreCodec.parse('{"presets":[]}')).toEqual(emptyStore);
  });
});

describe('activeValues / isBuiltInActive', () => {
  it('returns the default built-in values when Default is active', () => {
    expect(isBuiltInActive(emptyStore)).toBe(true);
    expect(activeValues(emptyStore, builtinValues)).toEqual(defaults);
  });

  it('resolves a non-default built-in to its own values by id', () => {
    const store: PromptPresetStore = { activeId: 'simple', presets: [] };
    expect(isBuiltInActive(store)).toBe(true);
    expect(activeValues(store, builtinValues)).toEqual(simpleValues);
  });

  it('treats an activeId with no matching preset as a built-in (Default base)', () => {
    const ghost: PromptPresetStore = { activeId: 'ghost', presets: [] };
    expect(isBuiltInActive(ghost)).toBe(true);
    expect(activeValues(ghost, builtinValues)).toEqual(defaults);
  });

  it('layers a user preset over the default built-in so a missing key falls back', () => {
    const store = storeWith({ id: 'p1', name: 'Mine', values: { systemPrompt: 'custom narration' } });
    delete (store.presets[0].values as Partial<PromptValues>).choicesPrompt;
    const v = activeValues(store, builtinValues);
    expect(v.systemPrompt).toBe('custom narration');
    expect(v.choicesPrompt).toBe('default:choicesPrompt');
  });
});

describe('activeStyle', () => {
  it('is the built-in\'s style, a user preset\'s stored style, or markdown by default', () => {
    expect(activeStyle(emptyStore)).toBe('markdown'); // Default built-in
    expect(activeStyle({ activeId: 'simple', presets: [] })).toBe('labels'); // Simple built-in
    expect(activeStyle(storeWith({ id: 'p1', name: 'Mine', style: 'labels' }))).toBe('labels');
    expect(activeStyle(storeWith({ id: 'p2', name: 'Legacy' }))).toBe('markdown'); // no stored style
  });
});

describe('addPreset', () => {
  it('appends a copy of the given values + style and selects it', () => {
    const store = addPreset(emptyStore, 'p1', 'Mine', simpleValues, 'labels');
    expect(store.activeId).toBe('p1');
    expect(store.presets).toHaveLength(1);
    expect(store.presets[0].style).toBe('labels');
    expect(store.presets[0].values).not.toBe(simpleValues); // copy, not reference
    expect(store.presets[0].values).toEqual(simpleValues);
  });
});

describe('renamePreset', () => {
  it('renames only the matching preset', () => {
    const store = renamePreset(storeWith({ id: 'p1', name: 'Old' }), 'p1', 'New');
    expect(store.presets[0].name).toBe('New');
  });
});

describe('deletePreset', () => {
  it('removes the preset and falls back to the default built-in when it was active', () => {
    const store = deletePreset(storeWith({ id: 'p1', name: 'Mine' }), 'p1');
    expect(store.presets).toHaveLength(0);
    expect(store.activeId).toBe(DEFAULT_PRESET_ID);
  });

  it('keeps the active selection when deleting a different preset', () => {
    const base: PromptPresetStore = {
      activeId: 'p2',
      presets: [
        { id: 'p1', name: 'A', values: defaults },
        { id: 'p2', name: 'B', values: defaults },
      ],
    };
    const store = deletePreset(base, 'p1');
    expect(store.activeId).toBe('p2');
    expect(store.presets.map((p) => p.id)).toEqual(['p2']);
  });
});

describe('updateValue', () => {
  it('is a no-op while any built-in is active', () => {
    expect(updateValue(emptyStore, 'systemPrompt', 'x')).toBe(emptyStore); // Default
    const simpleActive: PromptPresetStore = { activeId: 'simple', presets: [{ id: 'p1', name: 'Mine', values: defaults }] };
    expect(updateValue(simpleActive, 'systemPrompt', 'x')).toBe(simpleActive); // Simple
  });

  it('patches only the active user preset', () => {
    const store = updateValue(storeWith({ id: 'p1', name: 'Mine' }), 'choicesPrompt', 'edited');
    expect(store.presets[0].values.choicesPrompt).toBe('edited');
    expect(store.presets[0].values.systemPrompt).toBe('default:systemPrompt');
  });
});

describe('resetPreset', () => {
  it('restores a preset\'s whole value-set to the supplied values', () => {
    const edited = updateValue(storeWith({ id: 'p1', name: 'Mine', style: 'labels' }), 'systemPrompt', 'changed');
    const store = resetPreset(edited, 'p1', simpleValues);
    expect(store.presets[0].values).toEqual(simpleValues);
    expect(store.presets[0].values).not.toBe(simpleValues); // fresh copy
  });
});

describe('setActive', () => {
  it('switches the active id', () => {
    expect(setActive(emptyStore, 'p9').activeId).toBe('p9');
  });
});
