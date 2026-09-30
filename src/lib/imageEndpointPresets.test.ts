import { describe, it, expect } from 'vitest';
import {
  parseEnvPresets, presetStoreFromEnv, DEFAULT_IMAGE_ENDPOINT_VALUES, makeDefaultStore, activeValues,
  setProvider, providerSwitchValues, updateValue, resetPreset, migrateStore, envPresetId,
} from './imageEndpointPresets';
import { NOVELAI_DEFAULTS } from './imageGen/novelai';

describe('parseEnvPresets', () => {
  it('returns nothing when unset or malformed', () => {
    expect(parseEnvPresets(undefined)).toEqual([]);
    expect(parseEnvPresets('')).toEqual([]);
    expect(parseEnvPresets('not json')).toEqual([]);
    expect(parseEnvPresets('{"name":"x"}')).toEqual([]); // not an array
    expect(parseEnvPresets('[{"model":"x"}]')).toEqual([]); // no name → skipped
    expect(presetStoreFromEnv([])).toBeNull();
  });

  it('seeds a preset per entry with a stable id and activates the first', () => {
    const env = parseEnvPresets('[{"name":"2D","steps":35},{"name":"Realism","steps":27},{"name":"2D","steps":1}]');
    const store = presetStoreFromEnv(env);
    expect(store?.presets.map((p) => p.name)).toEqual(['2D', 'Realism']); // repeated name keeps the first
    expect(store?.presets.map((p) => p.id)).toEqual([envPresetId('2D'), envPresetId('Realism')]);
    expect(store?.activeId).toBe(envPresetId('2D'));
    expect(activeValues(store!, env).steps).toBe(35);
  });

  it('layers each entry over the built-in defaults, coercing per-field types', () => {
    const [{ values: v }] = parseEnvPresets('[{"name":"2D","model":"a.safetensors","cfg":4,"adetailer":true,"steps":"nope"}]');
    expect(v.model).toBe('a.safetensors');
    expect(v.cfg).toBe(4);
    expect(v.adetailer).toBe(true);
    expect(v.steps).toBe(DEFAULT_IMAGE_ENDPOINT_VALUES.steps); // wrong type falls back to default
    expect(v.negativePrompt).toBe(DEFAULT_IMAGE_ENDPOINT_VALUES.negativePrompt); // unspecified → default
    expect(v.portraitWidth).toBe(DEFAULT_IMAGE_ENDPOINT_VALUES.portraitWidth); // shared dims inherited
  });
});

describe('env-backed presets', () => {
  const envV1 = parseEnvPresets('[{"name":"Local","endpoint":"http://127.0.0.1:7860","steps":30}]');
  const envV2 = parseEnvPresets('[{"name":"Local","endpoint":"http://127.0.0.1:9090","steps":40}]');

  it('resets to the env entry, not the built-in defaults', () => {
    const edited = updateValue(presetStoreFromEnv(envV1)!, 'endpoint', 'http://other', envV1);
    expect(activeValues(edited, envV1).endpoint).toBe('http://other');
    const reset = resetPreset(edited, envPresetId('Local'));
    expect(activeValues(reset, envV1).endpoint).toBe('http://127.0.0.1:7860');
  });

  it('picks up an env edit for every field the user has not changed', () => {
    const edited = updateValue(presetStoreFromEnv(envV1)!, 'steps', 50, envV1);
    const v = activeValues(edited, envV2);
    expect(v.endpoint).toBe('http://127.0.0.1:9090'); // untouched → follows the env
    expect(v.steps).toBe(50); // user edit survives
  });

  it('drops an override that is set back to the base value', () => {
    const store = presetStoreFromEnv(envV1)!;
    const back = updateValue(updateValue(store, 'steps', 50, envV1), 'steps', 30, envV1);
    expect(back.presets[0].overrides).toEqual({});
    expect(activeValues(back, envV2).steps).toBe(40);
  });

  it('migrates a stored full copy onto its env entry, keeping only the edits', () => {
    const stored = {
      activeId: 'uuid-1',
      presets: [
        { id: 'uuid-1', name: 'Local', values: { ...envV1[0].values, model: 'mine' } },
        { id: 'uuid-2', name: 'Mine', values: { ...DEFAULT_IMAGE_ENDPOINT_VALUES, steps: 12 } },
      ],
    };
    const store = migrateStore(stored, envV1);
    expect(store.activeId).toBe(envPresetId('Local'));
    expect(store.presets[0]).toEqual({ id: envPresetId('Local'), name: 'Local', overrides: { model: 'mine' } });
    expect(store.presets[1]).toEqual({ id: 'uuid-2', name: 'Mine', overrides: { steps: 12 } });
    expect(activeValues(store, envV2).endpoint).toBe('http://127.0.0.1:9090');
    expect(migrateStore(store, envV1)).toEqual(store); // idempotent
  });

  it('keeps a user preset on the built-in defaults when its name is already claimed', () => {
    const stored = {
      activeId: envPresetId('Local'),
      presets: [
        { id: envPresetId('Local'), name: 'Local', overrides: {} },
        { id: 'uuid-3', name: 'Local', values: { ...DEFAULT_IMAGE_ENDPOINT_VALUES, steps: 12 } },
      ],
    };
    expect(migrateStore(stored, envV1).presets[1]).toEqual({ id: 'uuid-3', name: 'Local', overrides: { steps: 12 } });
  });
});

describe('provider switching', () => {
  it('keeps a novelai preset from the env var rather than coercing it away', () => {
    expect(parseEnvPresets('[{"name":"NAI","provider":"novelai"}]')[0].values.provider).toBe('novelai');
  });

  it('seeds NovelAI settings that sit inside the Opus free window on the first switch', () => {
    const values = providerSwitchValues(DEFAULT_IMAGE_ENDPOINT_VALUES, 'novelai');
    expect(values.provider).toBe('novelai');
    expect(values.model).toBe(NOVELAI_DEFAULTS.model);
    expect(values.steps).toBe(NOVELAI_DEFAULTS.steps);
    expect(values.portraitWidth * values.portraitHeight).toBeLessThanOrEqual(1_048_576);
    expect(values.landscapeWidth * values.landscapeHeight).toBeLessThanOrEqual(1_048_576);
  });

  it('leaves an already-configured NovelAI preset alone when switching back to it', () => {
    const tuned = { ...DEFAULT_IMAGE_ENDPOINT_VALUES, provider: 'a1111' as const, model: 'nai-diffusion-3', steps: 50 };
    const values = providerSwitchValues(tuned, 'novelai');
    expect(values.model).toBe('nai-diffusion-3');
    expect(values.steps).toBe(50);
  });

  it('keeps a NovelAI model this build does not list when switching back', () => {
    const future = {
      ...DEFAULT_IMAGE_ENDPOINT_VALUES, provider: 'a1111' as const,
      model: 'nai-diffusion-6-full', steps: 50, portraitWidth: 512,
    };
    const values = providerSwitchValues(future, 'novelai');
    expect(values.model).toBe('nai-diffusion-6-full');
    expect(values.steps).toBe(50);
    expect(values.portraitWidth).toBe(512);
  });

  it('clears an endpoint carried over from another provider on the first switch', () => {
    const local = { ...DEFAULT_IMAGE_ENDPOINT_VALUES, provider: 'a1111' as const, endpoint: 'http://127.0.0.1:7860' };
    expect(providerSwitchValues(local, 'novelai').endpoint).toBe('');
  });

  it('keeps a deliberate proxy endpoint on an already-configured NovelAI preset', () => {
    const proxied = {
      ...DEFAULT_IMAGE_ENDPOINT_VALUES, provider: 'a1111' as const,
      model: 'nai-diffusion-3', endpoint: 'https://nai.example.test',
    };
    expect(providerSwitchValues(proxied, 'novelai').endpoint).toBe('https://nai.example.test');
  });

  it('touches nothing but the provider for a provider with no seed of its own', () => {
    const values = providerSwitchValues({ ...DEFAULT_IMAGE_ENDPOINT_VALUES, steps: 33 }, 'comfyui');
    expect(values).toEqual({ ...DEFAULT_IMAGE_ENDPOINT_VALUES, steps: 33, provider: 'comfyui' });
  });

  it('applies the switch to the active preset only', () => {
    const store = makeDefaultStore();
    const two = { ...store, presets: [...store.presets, { id: 'other', name: 'Other', overrides: {} }] };
    const switched = setProvider(two, 'novelai', []);
    expect(activeValues(switched, []).model).toBe(NOVELAI_DEFAULTS.model);
    expect(switched.presets.find((p) => p.id === 'other')?.overrides).toEqual({});
  });
});
