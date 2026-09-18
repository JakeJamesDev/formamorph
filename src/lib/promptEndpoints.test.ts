import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  resolvePromptEndpoint, routedPresetId, isRoutableId, setPromptEndpoint,
  endpointSignature, toDebugEndpoint,
  type PromptEndpointMap, type ActiveEndpointState,
} from './promptEndpoints';
import {
  DEFAULT_TEXT_PRESET_ID, DEFAULT_TEXT_ENDPOINT_VALUES,
  BUILTIN_ENGINE_PRESET_ID, BUILTIN_ENGINE_VALUES,
  type TextEndpointPresetStore,
} from './textEndpointPresets';
import { defaultEndpointSamplerOverrides } from './endpointSamplers';
import { HOSTED_ENDPOINT } from '../contexts/settingsDefaults';

const userPreset = {
  id: 'p1',
  name: 'Cydonia',
  values: { endpoint: 'http://localhost:1234/v1', apiToken: 'tok', model: 'cydonia', contextWindowOverride: 8192, maxOutputOverride: { enabled: true, value: 700 }, samplerOverrides: defaultEndpointSamplerOverrides() },
};

const store: TextEndpointPresetStore = { activeId: 'p1', presets: [userPreset] };

/** Active state standing in for "a user preset is globally selected on the web build". */
const active: ActiveEndpointState = {
  activeId: 'p1',
  values: userPreset.values,
  isBuiltIn: false,
  localEngine: false,
  maxTokens: 700,
  engineMaxTokens: 512,
  engineModelId: 'my-loaded.gguf',
};

describe('routing lookup', () => {
  it('treats an absent entry as Use Active Endpoint', () => {
    expect(routedPresetId('narration', {}, store)).toBeNull();
  });

  it('treats an id with no surviving preset as Use Active Endpoint', () => {
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
      activeId: DEFAULT_TEXT_PRESET_ID,
      values: DEFAULT_TEXT_ENDPOINT_VALUES, isBuiltIn: true, localEngine: false,
      maxTokens: DEFAULT_TEXT_ENDPOINT_VALUES.maxOutputOverride.value, engineMaxTokens: 512, engineModelId: 'my-loaded.gguf',
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
    expect(r.maxTokens).toBe(DEFAULT_TEXT_ENDPOINT_VALUES.maxOutputOverride.value);
  });

  // `localEngine` is a property of the resolved target, not a global mode — that is the whole reason one
  // prompt can run on the bundled engine while the rest go outward.
  describe('the bundled engine as a target (desktop)', () => {
    const engineActive: ActiveEndpointState = {
      activeId: BUILTIN_ENGINE_PRESET_ID,
      values: BUILTIN_ENGINE_VALUES, isBuiltIn: true, localEngine: true,
      maxTokens: 512, engineMaxTokens: 512, engineModelId: 'my-loaded.gguf',
    };

    beforeEach(() => { (window as unknown as { formamorphDesktop?: unknown }).formamorphDesktop = {}; });
    afterEach(() => { delete (window as unknown as { formamorphDesktop?: unknown }).formamorphDesktop; });

    it('sends an unpinned prompt to the engine when the engine is the active endpoint', () => {
      const r = resolvePromptEndpoint('narration', {}, store, engineActive);
      expect(r.localEngine).toBe(true);
      expect(r.endpoint).toBe(BUILTIN_ENGINE_VALUES.endpoint);
      expect(r.maxTokens).toBe(512);
    });

    it('runs a prompt pinned to the engine on it while the rest go to the active endpoint', () => {
      const r = resolvePromptEndpoint('summary', { summary: BUILTIN_ENGINE_PRESET_ID }, store, active);
      expect(r.localEngine).toBe(true);
      expect(r.endpoint).toBe(BUILTIN_ENGINE_VALUES.endpoint);
      expect(r.maxTokens).toBe(512); // the engine's own cap, not the active preset's 700
      // ...and the unpinned one is untouched.
      expect(resolvePromptEndpoint('narration', { summary: BUILTIN_ENGINE_PRESET_ID }, store, active).localEngine).toBe(false);
    });

    it('sends a prompt pinned away from the engine outward, even while the engine is selected', () => {
      const r = resolvePromptEndpoint('narration', { narration: 'p1' }, store, engineActive);
      expect(r.localEngine).toBe(false);
      expect(r.endpoint).toBe(userPreset.values.endpoint);
    });

    // Default used to BE the engine on desktop; it is the hosted endpoint on both platforms now, so a
    // Default-pinned prompt must leave the machine rather than quietly hitting localhost.
    // A request naming a placeholder made /models probes report "reachable, but no such model" even with a
    // GGUF loaded, because the engine lists it under its real id.
    it('names the GGUF the engine actually has loaded', () => {
      expect(resolvePromptEndpoint('narration', {}, store, engineActive).model).toBe('my-loaded.gguf');
      expect(resolvePromptEndpoint('summary', { summary: BUILTIN_ENGINE_PRESET_ID }, store, active).model).toBe('my-loaded.gguf');
    });

    it('falls back to the nominal name while the engine has nothing loaded', () => {
      const stopped: ActiveEndpointState = { ...engineActive, engineModelId: '' };
      expect(resolvePromptEndpoint('narration', {}, store, stopped).model).toBe(BUILTIN_ENGINE_VALUES.model);
    });

    it('treats Default as the hosted endpoint, not the engine', () => {
      const r = resolvePromptEndpoint('narration', { narration: DEFAULT_TEXT_PRESET_ID }, store, engineActive);
      expect(r.localEngine).toBe(false);
      expect(r.endpoint).toBe(DEFAULT_TEXT_ENDPOINT_VALUES.endpoint);
      expect(r.endpoint).not.toBe(BUILTIN_ENGINE_VALUES.endpoint);
    });
  });
});

describe('map edits', () => {
  it('pins and unpins a kind', () => {
    const pinned = setPromptEndpoint({}, 'diary', 'p1');
    expect(pinned.diary).toBe('p1');
    expect(setPromptEndpoint(pinned, 'diary', null)).toEqual({});
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
    const debug = toDebugEndpoint(target, { thinking_budget_tokens: 400, reasoning_effort: 'high' }, 'lmstudio');
    expect(JSON.stringify(debug)).not.toContain('sk-super-secret-value');
    expect(Object.keys(debug).sort())
      .toEqual(['model', 'preset', 'reasoningFields', 'routed', 'url']);
  });

  it('records the reasoning fields the request carried, so the viewer can show what was sent', () => {
    const debug = toDebugEndpoint(target, { thinking_budget_tokens: 400, reasoning_effort: 'high' }, 'lmstudio');
    expect(debug.reasoningFields).toEqual([
      { label: 'Effort', name: 'reasoning_effort', value: 'high' },
      { label: 'Budget', name: 'thinking_budget_tokens', value: 400 },
    ]);
  });

  it('keeps a zero budget, which is how a switched-off prompt reads', () => {
    const debug = toDebugEndpoint(target, { thinking_budget_tokens: 0, reasoning_effort: 'none' }, 'lmstudio');
    expect(debug.reasoningFields).toContainEqual({ label: 'Budget', name: 'thinking_budget_tokens', value: 0 });
  });

  it('leaves out a field the request did not carry', () => {
    const effortOnly = toDebugEndpoint(target, { reasoning_effort: 'low' }, 'lmstudio');
    expect(effortOnly.reasoningFields).toEqual([{ label: 'Effort', name: 'reasoning_effort', value: 'low' }]);
    expect(toDebugEndpoint(target, {}, 'lmstudio').reasoningFields).toEqual([]);
  });

  // One case per dialect: the viewer names the key the endpoint received, whichever key that is.
  it.each([
    ['unknown', { thinking_budget_tokens: 400, reasoning_effort: 'high' as const }, ['reasoning_effort', 'thinking_budget_tokens']],
    ['engine', { thinking_budget_tokens: 400 }, ['thinking_budget_tokens']],
    ['openai', { reasoning_effort: 'high' as const }, ['reasoning_effort']],
    ['lmstudio', { thinking_budget_tokens: 400, reasoning_effort: 'high' as const }, ['reasoning_effort', 'thinking_budget_tokens']],
    ['vllm', { thinking_token_budget: 400, reasoning_effort: 'high' as const }, ['reasoning_effort', 'thinking_token_budget']],
    ['openrouter', { reasoning: { effort: 'high' as const, max_tokens: 400 } }, ['reasoning.effort', 'reasoning.max_tokens']],
    ['anthropic-budget', { thinking: { type: 'enabled' as const, budget_tokens: 400 } }, ['thinking.budget_tokens', 'thinking.type']],
    ['anthropic-adaptive', { thinking: { type: 'adaptive' as const } }, ['thinking.type']],
    ['google-2.5', { google: { thinking_config: { thinking_budget: 8192 } } }, ['google.thinking_config.thinking_budget']],
    ['google-3', { google: { thinking_config: { thinking_level: 'high' } } }, ['google.thinking_config.thinking_level']],
    ['moonshot-k3', { reasoning_effort: 'max' as const }, ['reasoning_effort']],
    ['moonshot-k2', { thinking: { type: 'disabled' as const } }, ['thinking.type']],
  ] as const)('names the keys the %s dialect writes', (dialect, body, names) => {
    const debug = toDebugEndpoint(target, body, dialect);
    expect(debug.reasoningFields.map((f) => f.name)).toEqual(names);
  });

  it('marks a pinned prompt as routed and an unpinned one as not', () => {
    expect(toDebugEndpoint(target, {}, 'unknown').routed).toBe(true);
    expect(toDebugEndpoint({ ...target, presetId: null }, {}, 'unknown').routed).toBe(false);
  });

  it('records the preset name and model the request actually used', () => {
    const debug = toDebugEndpoint(target, {}, 'unknown');
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

// Each case rebuilds the modules under its own VITE_DEFAULT_ENDPOINT, because the Demo AI is a build fact.
describe('isDemoAI', () => {
  const load = async (defaultEndpoint: string) => {
    vi.resetModules();
    vi.stubEnv('VITE_DEFAULT_ENDPOINT', defaultEndpoint);
    return { ...(await import('./promptEndpoints')), ...(await import('./textEndpointPresets')) };
  };
  type Modules = Awaited<ReturnType<typeof load>>;
  const setDesktop = (on: boolean) => {
    const w = window as unknown as { formamorphDesktop?: unknown };
    if (on) w.formamorphDesktop = {};
    else delete w.formamorphDesktop;
  };
  afterEach(() => { vi.unstubAllEnvs(); setDesktop(false); });

  /** The active state the settings context builds for the store's selection. */
  const activeFor = (m: Modules, s: TextEndpointPresetStore): ActiveEndpointState => ({
    activeId: s.activeId,
    values: m.activeValues(s),
    isBuiltIn: m.isBuiltInActive(s),
    localEngine: m.isEngineActive(s),
    maxTokens: 512, engineMaxTokens: 512, engineModelId: '',
  });
  const narrationIsDemo = (m: Modules, s: TextEndpointPresetStore, map: PromptEndpointMap = {}) =>
    m.isDemoAI(m.resolvePromptEndpoint('narration', map, s, activeFor(m, s)));

  it('is true for the default preset on the hosted URL', async () => {
    const m = await load('');
    expect(narrationIsDemo(m, m.emptyStore)).toBe(true);
  });

  it('is false for the default preset when the build overrides the default endpoint', async () => {
    const m = await load('http://localhost:1234/v1');
    expect(narrationIsDemo(m, m.emptyStore)).toBe(false);
  });

  it('is false for a user preset, the hosted URL included', async () => {
    const m = await load('');
    const hostedCopy = { ...userPreset, id: 'hosted-copy', values: { ...userPreset.values, endpoint: HOSTED_ENDPOINT } };
    for (const preset of [userPreset, hostedCopy]) {
      expect(narrationIsDemo(m, { activeId: preset.id, presets: [userPreset, hostedCopy] })).toBe(false);
      // Pinned rather than active reads the same.
      expect(narrationIsDemo(m, { ...m.emptyStore, presets: [userPreset, hostedCopy] }, { narration: preset.id })).toBe(false);
    }
  });

  it('is false for the desktop engine', async () => {
    setDesktop(true);
    const m = await load('');
    expect(narrationIsDemo(m, { activeId: m.BUILTIN_ENGINE_PRESET_ID, presets: [] })).toBe(false);
    expect(narrationIsDemo(m, m.emptyStore, { narration: m.BUILTIN_ENGINE_PRESET_ID })).toBe(false);
  });

  it('is false for a ghost active id', async () => {
    const m = await load('');
    expect(narrationIsDemo(m, { activeId: 'deleted-id', presets: [] })).toBe(false);
  });

  it('follows the routing of the kind it is asked about', async () => {
    const m = await load('');
    // A user preset is active and narration is pinned to the default.
    const userActive: TextEndpointPresetStore = { activeId: userPreset.id, presets: [userPreset] };
    const toDefault: PromptEndpointMap = { narration: m.DEFAULT_TEXT_PRESET_ID };
    expect(narrationIsDemo(m, userActive, toDefault)).toBe(true);
    expect(m.isDemoAI(m.resolvePromptEndpoint('summary', toDefault, userActive, activeFor(m, userActive)))).toBe(false);
    // The default is active and narration is pinned to the user preset.
    const defaultActive: TextEndpointPresetStore = { ...m.emptyStore, presets: [userPreset] };
    const toUser: PromptEndpointMap = { narration: userPreset.id };
    expect(narrationIsDemo(m, defaultActive, toUser)).toBe(false);
    expect(m.isDemoAI(m.resolvePromptEndpoint('summary', toUser, defaultActive, activeFor(m, defaultActive)))).toBe(true);
  });

  it('keeps stored routing to the default preset id', async () => {
    const m = await load('');
    expect(m.routedPresetId('narration', { narration: 'default' }, m.emptyStore)).toBe('default');
  });
});
