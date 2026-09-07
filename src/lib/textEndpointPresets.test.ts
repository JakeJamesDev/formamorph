import { describe, it, expect } from 'vitest';
import {
  presetStoreFromEnv, activeValues, isBuiltInActive, setActive, addPreset, renamePreset,
  deletePreset, resetPreset, updateValue, emptyStore, DEFAULT_TEXT_ENDPOINT_VALUES, DEFAULT_TEXT_PRESET_ID,
  updateSamplerOverride, updateMaxOutputOverride, valuesForId, textEndpointPresetCodec, type TextEndpointValues,
} from './textEndpointPresets';
import { defaultEndpointSamplerOverrides } from './endpointSamplers';

const customValues: TextEndpointValues = {
  endpoint: 'https://my.host/v1',
  apiToken: 'sk-abc',
  model: 'my-model',
  contextWindowOverride: 16000,
  maxOutputOverride: { enabled: true, value: 2048 },
  samplerOverrides: defaultEndpointSamplerOverrides(),
};

describe('presetStoreFromEnv', () => {
  it('returns null when unset or malformed', () => {
    expect(presetStoreFromEnv('')).toBeNull();
    expect(presetStoreFromEnv('not json')).toBeNull();
    expect(presetStoreFromEnv('{"name":"x"}')).toBeNull(); // not an array
    expect(presetStoreFromEnv('[]')).toBeNull();
    expect(presetStoreFromEnv('[{"model":"x"}]')).toBeNull(); // no name → skipped → empty
  });

  it('seeds a preset per entry and activates the first', () => {
    const store = presetStoreFromEnv('[{"name":"Cloud","model":"gpt-x"},{"name":"Local","endpoint":"http://localhost:1234/v1"}]');
    expect(store?.presets.map((p) => p.name)).toEqual(['Cloud', 'Local']);
    expect(store?.activeId).toBe(store?.presets[0].id);
    expect(store?.presets[0].id).not.toBe(store?.presets[1].id);
    expect(store?.presets.every((preset) => !preset.values.maxOutputOverride.enabled)).toBe(true);
  });

  it('layers each entry over the built-in defaults, coercing per-field types', () => {
    const store = presetStoreFromEnv('[{"name":"Cloud","model":"gpt-x","maxTokens":"nope","contextWindowOverride":8000}]');
    const v = store!.presets[0].values;
    expect(v.model).toBe('gpt-x');
    expect(v.contextWindowOverride).toBe(8000);
    expect(v.maxOutputOverride.value).toBe(DEFAULT_TEXT_ENDPOINT_VALUES.maxOutputOverride.value); // wrong type falls back to default
    expect(v.endpoint).toBe(DEFAULT_TEXT_ENDPOINT_VALUES.endpoint); // unspecified → default
    expect(v.maxOutputOverride.enabled).toBe(false);
  });
});

describe('store operations', () => {
  it('migrates legacy output caps as enabled, including hosted Default, without losing their values', () => {
    const legacy = textEndpointPresetCodec.parse(JSON.stringify({
      activeId: 'legacy',
      presets: [{ id: 'legacy', name: 'Legacy', values: { endpoint: 'https://legacy.test/v1', maxTokens: 2048 } }],
      defaultMaxTokens: 1024,
    }));

    expect(valuesForId(legacy, 'legacy').maxOutputOverride).toEqual({ enabled: true, value: 2048 });
    expect(valuesForId(legacy, DEFAULT_TEXT_PRESET_ID).maxOutputOverride).toEqual({ enabled: true, value: 1024 });

    const disabled = updateMaxOutputOverride(legacy, 'legacy', { enabled: false, value: 2048 });
    expect(valuesForId(disabled, 'legacy').maxOutputOverride).toEqual({ enabled: false, value: 2048 });
  });
  it('keeps disabled sampler values per endpoint, including the hosted Default', () => {
    const hosted = updateSamplerOverride(emptyStore, DEFAULT_TEXT_PRESET_ID, 'temperature', { enabled: true, value: 0 });
    const custom = updateSamplerOverride(
      addPreset(emptyStore, 'p1', 'Custom', customValues),
      'p1',
      'topK',
      { enabled: true, value: 64 },
    );

    expect(valuesForId(hosted, DEFAULT_TEXT_PRESET_ID).samplerOverrides.temperature).toEqual({ enabled: true, value: 0 });
    expect(valuesForId(custom, 'p1').samplerOverrides.topK).toEqual({ enabled: true, value: 64 });
    expect(valuesForId(custom, 'p1').samplerOverrides.temperature.enabled).toBe(false);
  });

  it('the empty store resolves to the read-only Default built-in', () => {
    expect(isBuiltInActive(emptyStore)).toBe(true);
    expect(activeValues(emptyStore)).toEqual(DEFAULT_TEXT_ENDPOINT_VALUES);
  });

  it('updateValue is a no-op while the Default built-in is active', () => {
    const next = updateValue(emptyStore, 'endpoint', 'https://hacked/v1');
    expect(next).toBe(emptyStore); // unchanged reference — the built-in is immutable
    expect(activeValues(next).endpoint).toBe(DEFAULT_TEXT_ENDPOINT_VALUES.endpoint);
  });

  it('adds a user preset, activates it, and makes it editable', () => {
    const store = addPreset(emptyStore, 'p1', 'Custom', customValues);
    expect(store.activeId).toBe('p1');
    expect(isBuiltInActive(store)).toBe(false);
    expect(activeValues(store)).toEqual({ ...customValues, maxOutputOverride: customValues.maxOutputOverride });

    const edited = updateValue(store, 'model', 'other-model');
    expect(activeValues(edited).model).toBe('other-model');
    expect(activeValues(edited).endpoint).toBe(customValues.endpoint); // siblings untouched
  });

  it('resetPreset restores a user preset to the built-in defaults', () => {
    const store = addPreset(emptyStore, 'p1', 'Custom', customValues);
    const reset = resetPreset(store, 'p1');
    expect(activeValues(reset)).toEqual(DEFAULT_TEXT_ENDPOINT_VALUES);
  });

  it('renamePreset changes only the name', () => {
    const store = renamePreset(addPreset(emptyStore, 'p1', 'Custom', customValues), 'p1', 'Renamed');
    expect(store.presets[0].name).toBe('Renamed');
    expect(store.presets[0].values).toEqual(customValues);
  });

  it('deleting the active preset falls back to the Default built-in', () => {
    const hosted = updateSamplerOverride(emptyStore, DEFAULT_TEXT_PRESET_ID, 'temperature', { enabled: true, value: 0 });
    const store = addPreset(hosted, 'p1', 'Custom', customValues);
    const deleted = deletePreset(store, 'p1');
    expect(deleted.activeId).toBe(DEFAULT_TEXT_PRESET_ID);
    expect(isBuiltInActive(deleted)).toBe(true);
    expect(deleted.presets).toHaveLength(0);
    expect(valuesForId(deleted, DEFAULT_TEXT_PRESET_ID).samplerOverrides.temperature).toEqual({ enabled: true, value: 0 });
    const reloaded = textEndpointPresetCodec.parse(textEndpointPresetCodec.serialize(deleted));
    expect(valuesForId(reloaded, DEFAULT_TEXT_PRESET_ID).samplerOverrides.temperature).toEqual({ enabled: true, value: 0 });
  });

  it('a ghost active id (missing preset) resolves to the Default built-in', () => {
    const ghost = setActive(addPreset(emptyStore, 'p1', 'Custom', customValues), 'does-not-exist');
    expect(isBuiltInActive(ghost)).toBe(true);
    expect(activeValues(ghost)).toEqual(DEFAULT_TEXT_ENDPOINT_VALUES);
  });

  it('layers a partial stored preset over the defaults so missing keys fall back', () => {
    const store = { activeId: 'p1', presets: [{ id: 'p1', name: 'Partial', values: { endpoint: 'https://x/v1' } as TextEndpointValues }] };
    expect(activeValues(store).endpoint).toBe('https://x/v1');
    expect(activeValues(store).maxOutputOverride).toEqual(DEFAULT_TEXT_ENDPOINT_VALUES.maxOutputOverride);
  });
});
