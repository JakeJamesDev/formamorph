// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { buildRequestBody, type AiCall, type AiEndpointTarget, type AiSettingsSnapshot } from './aiRequest/aiRequestSpec';
import { resolvePromptEndpoint, type ActiveEndpointState } from './promptEndpoints';
import {
  DEFAULT_TEXT_ENDPOINT_VALUES, DEFAULT_TEXT_PRESET_ID, FORMAMORPH_AI_PRESET_ID, emptyStore, editPreset, resetPreset,
  textEndpointPresetCodec, updateMaxOutputOverride, updateSamplerOverride, valuesForId, type TextEndpointPresetStore,
} from './textEndpointPresets';
import { UNKNOWN_REASONING_CAPABILITY } from './reasoningEffort';
import { DEFAULT_MAX_TOKENS } from '@/contexts/settingsDefaults';

const HOSTED = FORMAMORPH_AI_PRESET_ID;
const store: TextEndpointPresetStore = { ...emptyStore, activeId: HOSTED };

/** The active state with Formamorph AI selected and the server's cap as given. */
const active = (cap: number): ActiveEndpointState => ({
  activeId: HOSTED,
  values: DEFAULT_TEXT_ENDPOINT_VALUES,
  isBuiltIn: true,
  localEngine: false,
  maxTokens: undefined,
  engineMaxTokens: 512,
  engineModelId: '',
  hosted: { cap, modelId: 'served-model' },
});

/** The target the request builder receives, resolved from the store the way the app resolves it. */
function targetFor(s: TextEndpointPresetStore, state: ActiveEndpointState, extraParams?: string): AiEndpointTarget {
  const resolved = resolvePromptEndpoint('narration', {}, s, state);
  return {
    ...resolved,
    url: resolved.endpoint,
    ...(extraParams !== undefined && { extraParams }),
    reasoning: UNKNOWN_REASONING_CAPABILITY,
  };
}

const snapshot = (target: AiEndpointTarget, over: Partial<AiSettingsSnapshot> = {}): AiSettingsSnapshot => ({
  resolveTarget: () => target,
  thinkingMode: 'off',
  reasoningEffort: 'auto',
  reasoningEngaged: false,
  promptReasoning: {},
  promptReasoningBudget: {},
  promptSamplers: {},
  promptMaxOutput: {},
  genTemperature: 0.9,
  genRepetitionPenalty: 1.1,
  genTopP: 0.95,
  genTopK: 40,
  genMinP: 0.05,
  paragraphLimit: 'none',
  disableThinking: false,
  ...over,
});

const call = (over: Partial<AiCall> = {}): AiCall => ({
  systemPrompt: 'You narrate.',
  messages: [{ role: 'user', content: 'go north' }],
  requestType: 'narration',
  ...over,
});

const bodyFor = (s: TextEndpointPresetStore, cap: number, over: Partial<AiCall> = {}, snap: Partial<AiSettingsSnapshot> = {}) =>
  buildRequestBody(snapshot(targetFor(s, active(cap)), snap), call(over));

describe('Formamorph AI sampler tuning', () => {
  it('starts a new device on the published values, with Repetition Penalty and Min-p off', () => {
    const { samplerOverrides } = valuesForId(store, HOSTED);
    expect(samplerOverrides.temperature).toEqual({ enabled: true, value: 1 });
    expect(samplerOverrides.topP).toEqual({ enabled: true, value: 0.95 });
    expect(samplerOverrides.topK).toEqual({ enabled: true, value: 64 });
    expect(samplerOverrides.repetitionPenalty.enabled).toBe(false);
    expect(samplerOverrides.minP.enabled).toBe(false);
  });

  it('sends those values from an unpinned prompt', () => {
    const body = bodyFor(store, 4096);
    expect(body).toMatchObject({ temperature: 1, top_p: 0.95, top_k: 64 });
    expect(body).not.toHaveProperty('min_p');
    expect(body).not.toHaveProperty('repetition_penalty');
  });

  it('lets a prompt pin win over the tuned temperature', () => {
    const tuned = updateSamplerOverride(store, HOSTED, 'temperature', { enabled: true, value: 1.4 });
    expect(bodyFor(tuned, 4096, { requestType: 'help' }).temperature).toBe(0.2);
  });

  it('lets a prompt Custom value win over the tuned temperature', () => {
    const tuned = updateSamplerOverride(store, HOSTED, 'temperature', { enabled: true, value: 1.4 });
    const body = bodyFor(tuned, 4096, {}, { promptSamplers: { narration: { temperature: { custom: true, value: 0.3 } } } });
    expect(body.temperature).toBe(0.3);
  });

  it('sends a tuned value and omits a sampler the player turned off', () => {
    let tuned = updateSamplerOverride(store, HOSTED, 'topK', { enabled: false, value: 64 });
    tuned = updateSamplerOverride(tuned, HOSTED, 'minP', { enabled: true, value: 0.05 });
    const body = bodyFor(tuned, 4096);
    expect(body).not.toHaveProperty('top_k');
    expect(body).toMatchObject({ min_p: 0.05 });
  });

  it('keeps the changes through a reload and returns the published values on reset', () => {
    let tuned = updateSamplerOverride(store, HOSTED, 'temperature', { enabled: true, value: 0.6 });
    tuned = updateMaxOutputOverride(tuned, HOSTED, { enabled: true, value: 700 });
    const reloaded = textEndpointPresetCodec.parse(textEndpointPresetCodec.serialize(tuned));
    expect(valuesForId(reloaded, HOSTED).samplerOverrides.temperature).toEqual({ enabled: true, value: 0.6 });
    expect(valuesForId(reloaded, HOSTED).maxOutputOverride.value).toBe(700);

    const reset = resetPreset(reloaded, HOSTED);
    expect(valuesForId(reset, HOSTED).samplerOverrides.temperature).toEqual({ enabled: true, value: 1 });
    expect(valuesForId(reset, HOSTED).maxOutputOverride.value).toBe(DEFAULT_MAX_TOKENS);
  });

  it('leaves the Demo AI as it was: no sampler on, the shipped cap', () => {
    const demo: TextEndpointPresetStore = { ...emptyStore, activeId: DEFAULT_TEXT_PRESET_ID };
    const target = resolvePromptEndpoint('narration', {}, demo, {
      ...active(4096), activeId: DEFAULT_TEXT_PRESET_ID, hosted: undefined,
      values: valuesForId(demo, DEFAULT_TEXT_PRESET_ID), maxTokens: DEFAULT_MAX_TOKENS,
    });
    expect(Object.values(target.samplerOverrides).every((o) => !o.enabled)).toBe(true);
    expect(target.maxTokens).toBe(DEFAULT_MAX_TOKENS);
    const tuned = updateSamplerOverride(demo, HOSTED, 'temperature', { enabled: true, value: 0.1 });
    expect(valuesForId(tuned, DEFAULT_TEXT_PRESET_ID).samplerOverrides.temperature.enabled).toBe(false);
  });
});

describe('Formamorph AI max output', () => {
  const sent = (s: TextEndpointPresetStore, cap: number) => bodyFor(s, cap).max_tokens;

  it('starts at the shipped value', () => {
    expect(sent(store, 8192)).toBe(DEFAULT_MAX_TOKENS);
  });

  it('sends the number the player set, above the shipped value, up to the cap', () => {
    const set = updateMaxOutputOverride(store, HOSTED, { enabled: true, value: DEFAULT_MAX_TOKENS + 500 });
    expect(sent(set, DEFAULT_MAX_TOKENS + 1000)).toBe(DEFAULT_MAX_TOKENS + 500);
  });

  it('sends a lower bound of 1', () => {
    expect(sent(updateMaxOutputOverride(store, HOSTED, { enabled: true, value: 1 }), 4096)).toBe(1);
  });

  it('holds the sent value to the cap, including a cap that dropped after the player set a higher value', () => {
    const set = updateMaxOutputOverride(store, HOSTED, { enabled: true, value: 3000 });
    expect(sent(set, 3000)).toBe(3000);
    expect(sent(set, 1200)).toBe(1200);
  });

  it('holds the shipped value to a cap below it', () => {
    expect(sent(store, 300)).toBe(300);
  });

  it('has no off switch: disabling it changes nothing, and a request always carries max_tokens', () => {
    const off = updateMaxOutputOverride(store, HOSTED, { enabled: false, value: 900 });
    expect(valuesForId(off, HOSTED).maxOutputOverride.enabled).toBe(true);
    expect(sent(off, 4096)).toBe(900);
  });

  it('ignores a stored value that is not a positive whole number', () => {
    const bad = textEndpointPresetCodec.parse(JSON.stringify({ activeId: HOSTED, presets: [], hostedMaxTokens: 0 }));
    expect(valuesForId(bad, HOSTED).maxOutputOverride.value).toBe(DEFAULT_MAX_TOKENS);
  });
});

describe('Formamorph AI keeps its connection', () => {
  const extra = '{"top_a": 0.3}';

  it('keeps Extra Parameters out of its request', () => {
    const body = buildRequestBody(snapshot(targetFor(store, active(4096), extra)), call());
    expect(body).not.toHaveProperty('top_a');
  });

  it('still sends them on another endpoint', () => {
    const target = { ...targetFor(store, active(4096), extra), hosted: false };
    expect(buildRequestBody(snapshot(target), call())).toHaveProperty('top_a', 0.3);
  });

  it('refuses an edit to the endpoint, model, window or Extra Parameters', () => {
    const edited = editPreset(store, HOSTED, () => ({
      endpoint: 'http://elsewhere.test/v1', model: 'other', contextWindowOverride: 99, extraParams: extra,
    }));
    expect(edited).toEqual(store);
    expect(valuesForId(edited, HOSTED).extraParams).toBeUndefined();
  });

  it('takes sampler and max output edits through the shared editor path', () => {
    const edited = editPreset(store, HOSTED, (v) => ({
      samplerOverrides: { ...v.samplerOverrides, topP: { enabled: false, value: 0.95 } },
      maxOutputOverride: { enabled: true, value: 640 },
    }));
    expect(valuesForId(edited, HOSTED).samplerOverrides.topP.enabled).toBe(false);
    expect(valuesForId(edited, HOSTED).maxOutputOverride.value).toBe(640);
  });
});
