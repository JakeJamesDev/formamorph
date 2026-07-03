import { describe, it, expect } from 'vitest';
import { presetStoreFromEnv, DEFAULT_IMAGE_ENDPOINT_VALUES } from './imageEndpointPresets';

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
