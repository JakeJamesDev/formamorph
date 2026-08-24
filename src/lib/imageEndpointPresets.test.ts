import { describe, it, expect } from 'vitest';
import {
  presetStoreFromEnv, DEFAULT_IMAGE_ENDPOINT_VALUES, makeDefaultStore, activeValues,
  setProvider, providerSwitchValues,
} from './imageEndpointPresets';
import { NOVELAI_DEFAULTS } from './imageGen/novelai';

describe('presetStoreFromEnv', () => {
  it('returns null when unset or malformed', () => {
    // Pass explicit values rather than undefined — undefined triggers the param default, which reads the
    // real VITE_DEFAULT_IMAGE_PRESETS (present in .env.local under Vitest). '' covers the unset/falsy path.
    expect(presetStoreFromEnv('')).toBeNull();
    expect(presetStoreFromEnv('not json')).toBeNull();
    expect(presetStoreFromEnv('{"name":"x"}')).toBeNull(); // not an array
    expect(presetStoreFromEnv('[]')).toBeNull();
    expect(presetStoreFromEnv('[{"model":"x"}]')).toBeNull(); // no name → skipped → empty
  });

  it('seeds a preset per entry and activates the first', () => {
    const store = presetStoreFromEnv('[{"name":"2D","steps":35},{"name":"Realism","steps":27}]');
    expect(store?.presets.map((p) => p.name)).toEqual(['2D', 'Realism']);
    expect(store?.activeId).toBe(store?.presets[0].id);
    expect(store?.presets[0].id).not.toBe(store?.presets[1].id);
  });

  it('layers each entry over the built-in defaults, coercing per-field types', () => {
    const store = presetStoreFromEnv('[{"name":"2D","model":"a.safetensors","cfg":4,"adetailer":true,"steps":"nope"}]');
    const v = store!.presets[0].values;
    expect(v.model).toBe('a.safetensors');
    expect(v.cfg).toBe(4);
    expect(v.adetailer).toBe(true);
    expect(v.steps).toBe(DEFAULT_IMAGE_ENDPOINT_VALUES.steps); // wrong type falls back to default
    expect(v.negativePrompt).toBe(DEFAULT_IMAGE_ENDPOINT_VALUES.negativePrompt); // unspecified → default
    expect(v.portraitWidth).toBe(DEFAULT_IMAGE_ENDPOINT_VALUES.portraitWidth); // shared dims inherited
  });
});

describe('provider switching', () => {
  it('keeps a novelai preset from the env var rather than coercing it away', () => {
    const store = presetStoreFromEnv('[{"name":"NAI","provider":"novelai"}]');
    expect(store?.presets[0].values.provider).toBe('novelai');
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
    const two = { ...store, presets: [...store.presets, { id: 'other', name: 'Other', values: { ...DEFAULT_IMAGE_ENDPOINT_VALUES } }] };
    const switched = setProvider(two, 'novelai');
    expect(activeValues(switched).model).toBe(NOVELAI_DEFAULTS.model);
    expect(switched.presets.find((p) => p.id === 'other')?.values.model).toBe(DEFAULT_IMAGE_ENDPOINT_VALUES.model);
  });
});
