import { describe, it, expect } from 'vitest';
import {
  resolvePromptEndpoint, routedPresetId, isRoutableId, dropPreset, setPromptEndpoint,
  promptEndpointMapCodec, endpointSignature, toDebugEndpoint,
  type PromptEndpointMap, type ActiveEndpointState,
} from './promptEndpoints';
import { DEFAULT_TEXT_PRESET_ID, DEFAULT_TEXT_ENDPOINT_VALUES, type TextEndpointPresetStore } from './textEndpointPresets';

const userPreset = {
  id: 'p1',
  name: 'Cydonia',
  values: { endpoint: 'http://localhost:1234/v1', apiToken: 'tok', model: 'cydonia', contextWindowOverride: 8192, maxTokens: 700 },
};

const store: TextEndpointPresetStore = { activeId: 'p1', presets: [userPreset] };

/** Active state standing in for "a user preset is globally selected on the web build". */
const active: ActiveEndpointState = {
  values: userPreset.values,
  isBuiltIn: false,
  localEngine: false,
  maxTokens: 700,
};

describe('routing lookup', () => {
  it('treats an absent entry as Follow Active', () => {
    expect(routedPresetId('narration', {}, store)).toBeNull();
  });

  it('treats an id with no surviving preset as Follow Active', () => {
    expect(routedPresetId('narration', { narration: 'deleted-id' }, store)).toBeNull();
  });

  it('routes to the built-in Default even though it is never stored in presets', () => {
    expect(isRoutableId(store, DEFAULT_TEXT_PRESET_ID)).toBe(true);
    expect(routedPresetId('summary', { summary: DEFAULT_TEXT_PRESET_ID }, store)).toBe(DEFAULT_TEXT_PRESET_ID);
  });
});

describe('resolvePromptEndpoint', () => {
  it('returns the active state untouched for an unpinned kind', () => {
    const r = resolvePromptEndpoint('narration', {}, store, active);
    expect(r.presetId).toBeNull();
    expect(r.endpoint).toBe(userPreset.values.endpoint);
    expect(r.model).toBe('cydonia');
    expect(r.maxTokens).toBe(700);
    expect(r.isBuiltIn).toBe(false);
  });

  it('falls back to the active state when the pinned preset was deleted', () => {
    const ghost = resolvePromptEndpoint('narration', { narration: 'gone' }, store, active);
    expect(ghost).toEqual(resolvePromptEndpoint('narration', {}, store, active));
  });

  it('sends a pinned kind to its own preset while others follow the active one', () => {
    const map: PromptEndpointMap = { summary: DEFAULT_TEXT_PRESET_ID };
    const summary = resolvePromptEndpoint('summary', map, store, active);
    const narration = resolvePromptEndpoint('narration', map, store, active);
    expect(summary.endpoint).toBe(DEFAULT_TEXT_ENDPOINT_VALUES.endpoint);
    expect(summary.isBuiltIn).toBe(true);
    expect(narration.endpoint).toBe(userPreset.values.endpoint);
    expect(narration.isBuiltIn).toBe(false);
  });

  it('pins to a user preset even when the built-in Default is globally active', () => {
    const builtInActive: ActiveEndpointState = {
      values: DEFAULT_TEXT_ENDPOINT_VALUES, isBuiltIn: true, localEngine: false, maxTokens: DEFAULT_TEXT_ENDPOINT_VALUES.maxTokens,
    };
    const r = resolvePromptEndpoint('statUpdates', { statUpdates: 'p1' }, store, builtInActive);
    expect(r.endpoint).toBe(userPreset.values.endpoint);
    expect(r.apiToken).toBe('tok');
    expect(r.maxTokens).toBe(700);
    expect(r.contextWindowOverride).toBe(8192);
    expect(r.isBuiltIn).toBe(false);
  });

  it('layers a preset stored without a newer field over the shipped defaults', () => {
    const sparse: TextEndpointPresetStore = {
      activeId: DEFAULT_TEXT_PRESET_ID,
      // A preset written before `maxTokens` existed in the shape.
      presets: [{ id: 'old', name: 'Legacy', values: { endpoint: 'http://x/v1' } as never }],
    };
    const r = resolvePromptEndpoint('choices', { choices: 'old' }, sparse, active);
    expect(r.endpoint).toBe('http://x/v1');
    expect(r.maxTokens).toBe(DEFAULT_TEXT_ENDPOINT_VALUES.maxTokens);
  });

  it('keeps the local engine flag off for a user preset even while the bundled engine runs', () => {
    const desktop: ActiveEndpointState = {
      values: DEFAULT_TEXT_ENDPOINT_VALUES, isBuiltIn: true, localEngine: true, maxTokens: 512,
    };
    expect(resolvePromptEndpoint('narration', { narration: 'p1' }, store, desktop).localEngine).toBe(false);
    // Default-pinned still addresses the bundled engine, so it keeps the flag and the engine's own cap.
    const def = resolvePromptEndpoint('narration', { narration: DEFAULT_TEXT_PRESET_ID }, store, desktop);
    expect(def.localEngine).toBe(true);
    expect(def.maxTokens).toBe(512);
  });
});

describe('map edits', () => {
  it('clears every kind that pointed at a deleted preset and leaves the rest', () => {
    const map: PromptEndpointMap = { narration: 'p1', summary: 'p2', choices: 'p1' };
    expect(dropPreset(map, 'p1')).toEqual({ summary: 'p2' });
  });

  it('pins and unpins a kind', () => {
    const pinned = setPromptEndpoint({}, 'diary', 'p1');
    expect(pinned.diary).toBe('p1');
    expect(setPromptEndpoint(pinned, 'diary', null)).toEqual({});
  });
});

describe('codec', () => {
  it('round-trips a map', () => {
    const map: PromptEndpointMap = { narration: 'p1', summary: DEFAULT_TEXT_PRESET_ID };
    expect(promptEndpointMapCodec.parse(promptEndpointMapCodec.serialize(map))).toEqual(map);
  });

  it('falls back to an empty map on malformed or wrongly-typed storage', () => {
    expect(promptEndpointMapCodec.parse('not json')).toEqual({});
    expect(promptEndpointMapCodec.parse('[1,2]')).toEqual({});
    expect(promptEndpointMapCodec.parse('{"narration":42}')).toEqual({});
  });
});

describe('toDebugEndpoint', () => {
  const target = {
    presetId: 'p1',
    presetName: 'Cydonia 24B',
    model: 'cydonia',
    url: 'http://localhost:1234/v1/chat/completions',
    apiToken: 'sk-super-secret-value',
  };

  it('never carries the API token into the exported debug shape', () => {
    const debug = toDebugEndpoint(target);
    expect(JSON.stringify(debug)).not.toContain('sk-super-secret-value');
    expect(Object.keys(debug).sort()).toEqual(['model', 'preset', 'routed', 'url']);
  });

  it('marks a pinned prompt as routed and an unpinned one as not', () => {
    expect(toDebugEndpoint(target).routed).toBe(true);
    expect(toDebugEndpoint({ ...target, presetId: null }).routed).toBe(false);
  });

  it('records the preset name and model the request actually used', () => {
    const debug = toDebugEndpoint(target);
    expect(debug.preset).toBe('Cydonia 24B');
    expect(debug.model).toBe('cydonia');
    expect(debug.url).toBe(target.url);
  });
});

describe('endpointSignature', () => {
  it('matches the endpoint|model shape the capability caches key on', () => {
    expect(endpointSignature('http://x/v1', 'm')).toBe('http://x/v1|m');
  });
});
