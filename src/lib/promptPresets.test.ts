import { describe, it, expect } from 'vitest';
import {
  PROMPT_TEXT_KEYS,
  DEFAULT_PRESET_ID,
  emptyStore,
  presetStoreCodec,
  isDefaultActive,
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

// A minimal full value-set built from the key list, so tests don't hardcode 15 fields.
const defaults: PromptValues = Object.fromEntries(
  PROMPT_TEXT_KEYS.map((k) => [k, `default:${k}`]),
) as PromptValues;

const storeWith = (preset: { id: string; name: string; values?: Partial<PromptValues> }): PromptPresetStore => ({
  activeId: preset.id,
  presets: [{ id: preset.id, name: preset.name, values: { ...defaults, ...preset.values } }],
});

describe('presetStoreCodec', () => {
  it('round-trips a store', () => {
    const store = addPreset(emptyStore, 'p1', 'Mine', defaults);
    expect(presetStoreCodec.parse(presetStoreCodec.serialize(store))).toEqual(store);
  });

  it('falls back to the empty store on malformed or wrong-shaped input', () => {
    expect(presetStoreCodec.parse('not json')).toEqual(emptyStore);
    expect(presetStoreCodec.parse('{"activeId":5}')).toEqual(emptyStore);
    expect(presetStoreCodec.parse('{"presets":[]}')).toEqual(emptyStore);
  });
});

describe('activeValues / isDefaultActive', () => {
  it('returns the shipped defaults when Default is active', () => {
    expect(isDefaultActive(emptyStore)).toBe(true);
    expect(activeValues(emptyStore, defaults)).toEqual(defaults);
  });

  it('treats an activeId with no matching preset as Default', () => {
    expect(isDefaultActive({ activeId: 'ghost', presets: [] })).toBe(true);
  });

  it('layers a preset over defaults so a missing key falls back', () => {
    const store = storeWith({ id: 'p1', name: 'Mine', values: { systemPrompt: 'custom narration' } });
    // Simulate a preset that lacks a key entirely.
    delete (store.presets[0].values as Partial<PromptValues>).choicesPrompt;
    const v = activeValues(store, defaults);
    expect(v.systemPrompt).toBe('custom narration');
    expect(v.choicesPrompt).toBe('default:choicesPrompt');
  });
});

describe('addPreset', () => {
  it('appends a copy of the given values and selects it', () => {
    const store = addPreset(emptyStore, 'p1', 'Mine', defaults);
    expect(store.activeId).toBe('p1');
    expect(store.presets).toHaveLength(1);
    // Copy, not reference.
    expect(store.presets[0].values).not.toBe(defaults);
    expect(store.presets[0].values).toEqual(defaults);
  });
});

describe('renamePreset', () => {
  it('renames only the matching preset', () => {
    const store = renamePreset(storeWith({ id: 'p1', name: 'Old' }), 'p1', 'New');
    expect(store.presets[0].name).toBe('New');
  });
});

describe('deletePreset', () => {
  it('removes the preset and falls back to Default when it was active', () => {
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
  it('is a no-op while Default is active', () => {
    expect(updateValue(emptyStore, 'systemPrompt', 'x')).toBe(emptyStore);
  });

  it('patches only the active preset', () => {
    const store = updateValue(storeWith({ id: 'p1', name: 'Mine' }), 'choicesPrompt', 'edited');
    expect(store.presets[0].values.choicesPrompt).toBe('edited');
    expect(store.presets[0].values.systemPrompt).toBe('default:systemPrompt');
  });
});

describe('resetPreset', () => {
  it('restores a preset\'s whole value-set to the defaults', () => {
    const edited = updateValue(storeWith({ id: 'p1', name: 'Mine' }), 'systemPrompt', 'changed');
    const store = resetPreset(edited, 'p1', defaults);
    expect(store.presets[0].values).toEqual(defaults);
    // Fresh copy, not the shared defaults reference.
    expect(store.presets[0].values).not.toBe(defaults);
  });
});

describe('setActive', () => {
  it('switches the active id', () => {
    expect(setActive(emptyStore, 'p9').activeId).toBe('p9');
  });
});
