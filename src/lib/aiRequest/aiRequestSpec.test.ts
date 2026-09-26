import { describe, it, expect } from 'vitest';
import {
  buildAiRequestSpec, buildRequestBody,
  type AiCall, type AiEndpointTarget, type AiRequestBody, type AiSettingsSnapshot,
} from './aiRequestSpec';
import type { ReasoningDialect } from '@/lib/reasoningDialect';
import { defaultEndpointSamplerOverrides } from '@/lib/endpointSamplers';
import {
  reasoningCapabilityFromLevels, UNKNOWN_REASONING_CAPABILITY,
  type ReasoningCapability, type ReasoningEffortField,
} from '@/lib/reasoningEffort';
import { resolvePromptEndpoint, type ActiveEndpointState } from '@/lib/promptEndpoints';
import { DEFAULT_TEXT_ENDPOINT_VALUES, type TextEndpointPresetStore } from '@/lib/textEndpointPresets';
import { toolSchema } from '@/lib/tools/toolSchema';
import type { Tool } from '@/types';

/** A capability record answering the levels question only, as a probe leaves it. */
const accepts = (...levels: ReasoningEffortField[]): ReasoningCapability => reasoningCapabilityFromLevels(levels, 'probe');

/** The engine kinds the body splits on. LM Studio differs from a generic OpenAI-compatible endpoint only in
 *  what its capability record says — two targets, not two code paths. */
const localEngine = (over: Partial<AiEndpointTarget> = {}): AiEndpointTarget => ({
  endpointId: 'builtin-engine',
  url: 'http://127.0.0.1:8080/v1/chat/completions',
  apiToken: 'engine-token',
  model: 'bundled.gguf',
  maxTokens: 1000,
  localEngine: true,
  samplerOverrides: defaultEndpointSamplerOverrides(),
  // The bundled engine always takes a token budget and names its own dialect; nothing has answered the rest.
  reasoning: { ...UNKNOWN_REASONING_CAPABILITY, budget: true, dialect: 'engine', sources: { budget: 'engine', dialect: 'engine' } },
  ...over,
});

const external = (over: Partial<AiEndpointTarget> = {}): AiEndpointTarget => ({
  endpointId: 'cloud',
  url: 'https://api.example.com/v1/chat/completions',
  apiToken: 'cloud-token',
  model: 'big-24b',
  maxTokens: 800,
  localEngine: false,
  samplerOverrides: defaultEndpointSamplerOverrides(),
  reasoning: accepts('none', 'low', 'medium', 'high'),
  ...over,
});

/** LM Studio: reachable, resolved conclusively as non-reasoning, so it accepts no effort literal at all. */
const lmStudio = (over: Partial<AiEndpointTarget> = {}): AiEndpointTarget =>
  external({ url: 'http://127.0.0.1:1234/v1/chat/completions', model: 'cydonia-24b', reasoning: accepts(), ...over });

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

describe('engine split — the sampler trio', () => {
  it('sends top_p/top_k/min_p on the built-in engine', () => {
    expect(buildRequestBody(snapshot(localEngine()), call())).toMatchObject({ top_p: 0.95, top_k: 40, min_p: 0.05 });
  });

  it.each([
    ['external', external()],
    ['LM Studio', lmStudio()],
  ])('omits top_p/top_k/min_p on %s, leaving the endpoint its own', (_name, target) => {
    const body = buildRequestBody(snapshot(target), call());
    expect(body).not.toHaveProperty('top_p');
    expect(body).not.toHaveProperty('top_k');
    expect(body).not.toHaveProperty('min_p');
  });
});

describe('temperature and penalty — pinned, global, custom, omitted', () => {
  it('sends the global values on the built-in engine when the prompt is unpinned', () => {
    expect(buildRequestBody(snapshot(localEngine()), call())).toMatchObject({
      temperature: 0.9, repetition_penalty: 1.1, repeat_penalty: 1.1,
    });
  });

  it('omits both on an external endpoint when the prompt is unpinned', () => {
    const body = buildRequestBody(snapshot(external()), call());
    expect(body).not.toHaveProperty('temperature');
    expect(body).not.toHaveProperty('repetition_penalty');
    expect(body).not.toHaveProperty('repeat_penalty');
  });

  it('sends only the enabled sampler overrides from its external target', () => {
    const target = external({
      samplerOverrides: {
        temperature: { enabled: true, value: 0 },
        repetitionPenalty: { enabled: true, value: 1.18 },
        topP: { enabled: false, value: 0.91 },
        topK: { enabled: true, value: 64 },
        minP: { enabled: true, value: 0 },
      },
    });

    const body = buildRequestBody(snapshot(target), call());

    expect(body).toMatchObject({
      temperature: 0,
      repetition_penalty: 1.18,
      repeat_penalty: 1.18,
      top_k: 64,
      min_p: 0,
    });
    expect(body).not.toHaveProperty('top_p');
  });

  it('uses the routed endpoint sampler rather than the globally active endpoint', () => {
    const routedValues = {
      ...DEFAULT_TEXT_ENDPOINT_VALUES,
      endpoint: 'https://routed.example/v1',
      apiToken: 'routed-token',
      model: 'routed-model',
      samplerOverrides: { ...defaultEndpointSamplerOverrides(), temperature: { enabled: true, value: 0 } },
    };
    const store: TextEndpointPresetStore = {
      activeId: 'active',
      presets: [
        { id: 'active', name: 'Active', values: { ...DEFAULT_TEXT_ENDPOINT_VALUES, samplerOverrides: defaultEndpointSamplerOverrides() } },
        { id: 'routed', name: 'Routed', values: routedValues },
      ],
    };
    const active: ActiveEndpointState = {
      activeId: 'active', values: store.presets[0].values, isBuiltIn: false, localEngine: false,
      maxTokens: 800, engineMaxTokens: 512, engineModelId: '',
    };
    const resolved = resolvePromptEndpoint('narration', { narration: 'routed' }, store, active);
    const target = external({
      endpointId: resolved.endpointId,
      url: `${resolved.endpoint}/chat/completions`,
      apiToken: resolved.apiToken,
      model: resolved.model,
      maxTokens: resolved.maxTokens,
      samplerOverrides: resolved.samplerOverrides,
    });

    const spec = buildAiRequestSpec(snapshot(target), call());

    expect(spec.target.endpointId).toBe('routed');
    expect(spec.body.temperature).toBe(0);
    expect(spec.samplerSources.temperature).toBe('endpoint');
  });

  it.each([
    ['summary', 0],
    ['statUpdates', 0.2],
    ['locationChange', 0.15],
    ['sceneTags', 0.3],
    ['thinking', 0.4],
  ] as const)('sends %s its pinned temperature even on an external endpoint', (kind, temperature) => {
    expect(buildRequestBody(snapshot(external()), call({ requestType: kind }))).toMatchObject({ temperature });
  });

  it('sends the planning prompt its pinned penalty of 1 to every endpoint', () => {
    expect(buildRequestBody(snapshot(external()), call({ requestType: 'thinking' })))
      .toMatchObject({ repetition_penalty: 1, repeat_penalty: 1 });
  });

  it('ships the penalty under both spellings so LM Studio and vLLM each see one they accept', () => {
    const body = buildRequestBody(snapshot(lmStudio()), call({ requestType: 'thinking' }));
    expect(body.repeat_penalty).toBe(body.repetition_penalty);
    expect(body.repeat_penalty).toBe(1);
  });

  it('lets a custom per-prompt value beat the pin and reach an external endpoint', () => {
    const snap = snapshot(external(), { promptSamplers: { summary: { temperature: { custom: true, value: 0.77 } } } });
    expect(buildRequestBody(snap, call({ requestType: 'summary' }))).toMatchObject({ temperature: 0.77 });
  });

  it('falls back to the pin when custom is stored but switched off', () => {
    const snap = snapshot(external(), { promptSamplers: { summary: { temperature: { custom: false, value: 0.77 } } } });
    expect(buildRequestBody(snap, call({ requestType: 'summary' }))).toMatchObject({ temperature: 0 });
  });

  it('keeps a built-in prompt pin ahead of an enabled endpoint override', () => {
    const target = external({ samplerOverrides: {
      ...defaultEndpointSamplerOverrides(),
      temperature: { enabled: true, value: 1.4 },
    } });

    expect(buildRequestBody(snapshot(target), call({ requestType: 'summary' })).temperature).toBe(0);
  });

  it('keeps a custom prompt sampler ahead of an enabled endpoint override', () => {
    const target = external({ samplerOverrides: {
      ...defaultEndpointSamplerOverrides(),
      repetitionPenalty: { enabled: true, value: 1.35 },
    } });
    const snap = snapshot(target, { promptSamplers: { narration: { repetitionPenalty: { custom: true, value: 1.02 } } } });

    expect(buildAiRequestSpec(snap, call()).samplerSources.repetitionPenalty).toBe('prompt');
    expect(buildRequestBody(snap, call()).repetition_penalty).toBe(1.02);
  });
});

/** LM Studio on a reasoning model: its native list answers the reasons and budget questions, and the probe
 *  narrows the levels. Both the cap and the hint go out. */
const lmStudioReasoning = (over: Partial<AiEndpointTarget> = {}): AiEndpointTarget =>
  lmStudio({
    model: 'meromero-31b',
    reasoning: { ...accepts('none', 'low', 'medium', 'high'), reasons: true, budget: true },
    ...over,
  });

describe('reasoning budget on LM Studio — the cap and the hint travel together', () => {
  it('sends the token budget and the effort level in the same body', () => {
    const snap = snapshot(lmStudioReasoning(), {
      reasoningEngaged: true, reasoningEffort: 'high', promptReasoningBudget: { narration: 25 },
    });
    expect(buildRequestBody(snap, call())).toMatchObject({
      thinking_budget_tokens: 200, reasoning_effort: 'high',
    });
  });

  it('keeps the budget on a record whose reasons question is still open, as the engine record leaves it', () => {
    // The bundled engine's record is budget-yes with reasons unanswered, so an unknown answer must not
    // withhold the cap — only a record that rules reasoning out does.
    const unknownReasons = external({ reasoning: { ...UNKNOWN_REASONING_CAPABILITY, budget: true } });
    const snap = snapshot(unknownReasons, { promptReasoningBudget: { narration: 25 } });
    expect(buildRequestBody(snap, call())).toMatchObject({ thinking_budget_tokens: 200 });
  });

  it('sends neither field to a model the record says does not reason, budget flag or not', () => {
    const snap = snapshot(lmStudio({ reasoning: { ...accepts(), budget: true } }), {
      reasoningEngaged: true, reasoningEffort: 'high', promptReasoningBudget: { narration: 25 },
    });
    const body = buildRequestBody(snap, call());
    expect(body).not.toHaveProperty('thinking_budget_tokens');
    expect(body).not.toHaveProperty('reasoning_effort');
  });

  it('zeroes the budget for a switched-off prompt, and says none beside it', () => {
    const snap = snapshot(lmStudioReasoning(), {
      reasoningEngaged: true, reasoningEffort: 'high',
      promptReasoning: { narration: 'none' }, promptReasoningBudget: { narration: 40 },
    });
    expect(buildRequestBody(snap, call())).toMatchObject({
      thinking_budget_tokens: 0, reasoning_effort: 'none',
    });
  });

  it('zeroes the budget for a Global prompt under a switched-off Output row', () => {
    const snap = snapshot(lmStudioReasoning(), {
      reasoningEngaged: true, reasoningEffort: 'none',
      promptReasoning: { narration: 'global' }, promptReasoningBudget: { narration: 40 },
    });
    expect(buildRequestBody(snap, call())).toMatchObject({
      thinking_budget_tokens: 0, reasoning_effort: 'none',
    });
  });

  it('zeroes the budget for Inline narration, which writes its own <think> block', () => {
    const snap = snapshot(lmStudioReasoning(), {
      thinkingMode: 'inline', reasoningEngaged: true, reasoningEffort: 'high',
      promptReasoningBudget: { narration: 40 },
    });
    expect(buildRequestBody(snap, call())).toMatchObject({ thinking_budget_tokens: 0 });
  });

  it('caps each prompt from its own stored value or shipped tier', () => {
    const snap = snapshot(lmStudioReasoning(), {
      reasoningEngaged: true, promptReasoningBudget: { summary: 10 },
    });
    expect(buildRequestBody(snap, call({ requestType: 'summary' }))).toMatchObject({ thinking_budget_tokens: 80 });
    expect(buildRequestBody(snap, call({ requestType: 'director' }))).toMatchObject({ thinking_budget_tokens: 200 });
    expect(buildRequestBody(snap, call({ requestType: 'statUpdates' }))).toMatchObject({ thinking_budget_tokens: 0 });
  });
});

describe('reasoning split — budget where the record says, effort everywhere else', () => {
  it('sends a token budget, never an effort, on the built-in engine', () => {
    const snap = snapshot(localEngine(), {
      reasoningEngaged: true, reasoningEffort: 'high', promptReasoningBudget: { narration: 40 },
    });
    const body = buildRequestBody(snap, call());
    expect(body).toMatchObject({ thinking_budget_tokens: 400 });
    expect(body).not.toHaveProperty('reasoning_effort');
  });

  it('never sends the engine an effort hint, even when its record lists accepted levels', () => {
    // The engine shares the active endpoint's record, so a probe against that endpoint can fill in levels.
    // The engine ignores the hint and caps by tokens, so the levels must not put one on the wire.
    const engineWithLevels = localEngine({
      reasoning: { ...accepts('none', 'low', 'high'), reasons: true, budget: true, dialect: 'engine' },
    });
    const snap = snapshot(engineWithLevels, {
      reasoningEngaged: true, reasoningEffort: 'high', promptReasoningBudget: { narration: 40 },
    });
    const body = buildRequestBody(snap, call());
    expect(body).toMatchObject({ thinking_budget_tokens: 400 });
    expect(body).not.toHaveProperty('reasoning_effort');
  });

  it('sends the budget to any target whose record takes one, engine flag or not', () => {
    const takesBudget = external({ reasoning: { ...accepts('none', 'low', 'high'), budget: true } });
    const snap = snapshot(takesBudget, {
      reasoningEngaged: true, reasoningEffort: 'high', promptReasoningBudget: { narration: 25 },
    });
    expect(buildRequestBody(snap, call())).toMatchObject({ thinking_budget_tokens: 200 });
  });

  it('sends the effort, not a budget, to a target whose record leaves the budget question open', () => {
    const snap = snapshot(external(), { reasoningEngaged: true, reasoningEffort: 'high' });
    const body = buildRequestBody(snap, call());
    expect(body).toMatchObject({ reasoning_effort: 'high' });
    expect(body).not.toHaveProperty('thinking_budget_tokens');
  });

  it('scales the budget off a max-token override rather than the target cap', () => {
    const snap = snapshot(localEngine(), { promptReasoningBudget: { narration: 50 } });
    expect(buildRequestBody(snap, call({ maxTokensOverride: 200 }))).toMatchObject({ thinking_budget_tokens: 100 });
  });

  it('zeroes the engine budget for a Global prompt when the endpoint-wide switch is off', () => {
    const snap = snapshot(localEngine(), { reasoningEffort: 'none', promptReasoning: { narration: 'global' }, promptReasoningBudget: { narration: 40 } });
    expect(buildRequestBody(snap, call())).toMatchObject({ thinking_budget_tokens: 0 });
  });

  it('zeroes the engine budget for Inline narration, which writes its own <think> block', () => {
    const snap = snapshot(localEngine(), { thinkingMode: 'inline', promptReasoningBudget: { narration: 40 } });
    expect(buildRequestBody(snap, call())).toMatchObject({ thinking_budget_tokens: 0 });
  });

  it.each([['precall'], ['staged']] as const)('keeps narration its budget under the %s mode', (thinkingMode) => {
    const snap = snapshot(localEngine(), { thinkingMode, promptReasoningBudget: { narration: 40 } });
    expect(buildRequestBody(snap, call())).toMatchObject({ thinking_budget_tokens: 400 });
  });

  it('budgets every prompt from its stored value or shipped tier', () => {
    const snap = snapshot(localEngine(), { promptReasoningBudget: { narration: 40, summary: 10 } });
    expect(buildRequestBody(snap, call({ requestType: 'summary' }))).toMatchObject({ thinking_budget_tokens: 100 });
    expect(buildRequestBody(snap, call({ requestType: 'director' }))).toMatchObject({ thinking_budget_tokens: 250 });
    expect(buildRequestBody(snap, call({ requestType: 'statUpdates' }))).toMatchObject({ thinking_budget_tokens: 0 });
  });

  it('sends the global effort on an external endpoint that accepts it', () => {
    const snap = snapshot(external(), { reasoningEngaged: true, reasoningEffort: 'high' });
    const body = buildRequestBody(snap, call());
    expect(body).toMatchObject({ reasoning_effort: 'high' });
    expect(body).not.toHaveProperty('thinking_budget_tokens');
  });

  it('lets a per-prompt level override the global one', () => {
    const snap = snapshot(external(), {
      reasoningEngaged: true, reasoningEffort: 'high', promptReasoning: { narration: 'low' },
    });
    expect(buildRequestBody(snap, call())).toMatchObject({ reasoning_effort: 'low' });
  });

  it('omits the effort at the Default level, which means let the endpoint decide', () => {
    const snap = snapshot(external(), { reasoningEngaged: true, reasoningEffort: 'auto', promptReasoning: { narration: 'global' } });
    expect(buildRequestBody(snap, call())).not.toHaveProperty('reasoning_effort');
  });

  it('sends none when a prompt actively suppresses reasoning while the global level is high', () => {
    const snap = snapshot(external(), {
      reasoningEngaged: true, reasoningEffort: 'high', promptReasoning: { narration: 'none' },
    });
    expect(buildRequestBody(snap, call())).toMatchObject({ reasoning_effort: 'none' });
  });

  it('follows a stored level on any prompt, and the shipped tier where none is stored', () => {
    const snap = snapshot(external(), {
      reasoningEngaged: true, reasoningEffort: 'high', promptReasoning: { summary: 'medium' },
    });
    expect(buildRequestBody(snap, call({ requestType: 'summary' }))).toMatchObject({ reasoning_effort: 'medium' });
    expect(buildRequestBody(snap, call({ requestType: 'director' }))).toMatchObject({ reasoning_effort: 'low' });
    expect(buildRequestBody(snap, call({ requestType: 'statUpdates' }))).toMatchObject({ reasoning_effort: 'none' });
  });

  it('omits the effort entirely when reasoning is engaged nowhere', () => {
    const snap = snapshot(external(), { reasoningEngaged: false, reasoningEffort: 'high' });
    expect(buildRequestBody(snap, call())).not.toHaveProperty('reasoning_effort');
  });

  it('omits the effort on LM Studio, resolved as accepting no level at all', () => {
    const snap = snapshot(lmStudio(), { reasoningEngaged: true, reasoningEffort: 'high' });
    expect(buildRequestBody(snap, call())).not.toHaveProperty('reasoning_effort');
  });

  it('omits the effort on an unresolved endpoint rather than guessing it is accepted', () => {
    const snap = snapshot(external({ reasoning: UNKNOWN_REASONING_CAPABILITY }), { reasoningEngaged: true, reasoningEffort: 'high' });
    expect(buildRequestBody(snap, call())).not.toHaveProperty('reasoning_effort');
  });

  it('omits the effort for a level the routed target does not accept', () => {
    const snap = snapshot(external({ reasoning: accepts('none', 'low') }), { reasoningEngaged: true, reasoningEffort: 'high' });
    expect(buildRequestBody(snap, call())).not.toHaveProperty('reasoning_effort');
  });

  it('omits the effort on a model the record says does not reason, even where levels are listed', () => {
    const nonReasoning: ReasoningCapability = {
      reasons: false, levels: ['none', 'low', 'high'], budget: null, dialect: 'unknown', offAllowed: null, tools: null,
      sources: { reasons: 'native' },
    };
    const snap = snapshot(external({ reasoning: nonReasoning }), { reasoningEngaged: true, reasoningEffort: 'high' });
    expect(buildRequestBody(snap, call())).not.toHaveProperty('reasoning_effort');
  });

  it('forces none on Inline narration so the native scratchpad does not double the inline <think> block', () => {
    const snap = snapshot(external(), { thinkingMode: 'inline', reasoningEngaged: true, reasoningEffort: 'high' });
    expect(buildRequestBody(snap, call())).toMatchObject({ reasoning_effort: 'none' });
  });

  it('keeps narration its level under the planning modes, which run separate passes', () => {
    for (const thinkingMode of ['precall', 'staged'] as const) {
      const snap = snapshot(external(), { thinkingMode, reasoningEngaged: true, reasoningEffort: 'high' });
      expect(buildRequestBody(snap, call())).toMatchObject({ reasoning_effort: 'high' });
    }
  });
});

describe('stop sequences', () => {
  it('stops narration at one paragraph under the single-paragraph limit', () => {
    const snap = snapshot(external(), { paragraphLimit: 'single' });
    expect(buildRequestBody(snap, call())).toMatchObject({ stop: ['\n'] });
  });

  it('keeps newlines in inline-thinking mode, where the <think> block needs them', () => {
    const snap = snapshot(external(), { paragraphLimit: 'single', thinkingMode: 'inline' });
    expect(buildRequestBody(snap, call())).not.toHaveProperty('stop');
  });

  it('never stops a non-narration prompt', () => {
    const snap = snapshot(external(), { paragraphLimit: 'single' });
    expect(buildRequestBody(snap, call({ requestType: 'summary' }))).not.toHaveProperty('stop');
  });

  it('does not stop when the paragraph limit is none', () => {
    expect(buildRequestBody(snapshot(external()), call())).not.toHaveProperty('stop');
  });
});

describe('messages and the /no_think soft switch', () => {
  it('leads with the system prompt and keeps the caller order', () => {
    const body = buildRequestBody(snapshot(external()), call());
    expect(body.messages).toEqual([
      { role: 'system', content: 'You narrate.' },
      { role: 'user', content: 'go north' },
    ]);
  });

  it('appends /no_think to the system prompt when thinking is disabled', () => {
    const body = buildRequestBody(snapshot(external(), { disableThinking: true }), call());
    expect(body.messages[0].content).toBe('You narrate.\n\n/no_think');
  });

  it('leaves the prompt untouched when thinking is not disabled', () => {
    const body = buildRequestBody(snapshot(external(), { disableThinking: false }), call());
    expect(body.messages[0].content).toBe('You narrate.');
  });
});

describe('the whole spec', () => {
  it('carries the target url, bearer token, model and cap', () => {
    const spec = buildAiRequestSpec(snapshot(external()), call());
    expect(spec.url).toBe('https://api.example.com/v1/chat/completions');
    expect(spec.headers).toEqual({ 'Content-Type': 'application/json', Authorization: 'Bearer cloud-token' });
    expect(spec.body).toMatchObject({ model: 'big-24b', max_tokens: 800, stream: true });
    expect(spec.requestType).toBe('narration');
  });

  it('prefers a max-token override to the target cap', () => {
    const spec = buildAiRequestSpec(snapshot(external()), call({ maxTokensOverride: 120 }));
    expect(spec.body.max_tokens).toBe(120);
    expect(spec.maxTokensSource).toBe('internal');
  });

  it('attributes an endpoint output cap to its resolved target', () => {
    expect(buildAiRequestSpec(snapshot(external()), call()).maxTokensSource).toBe('endpoint');
  });

  it('omits an inactive endpoint output cap but keeps an explicit internal cap', () => {
    const inactive = snapshot(external({ maxTokens: undefined }));

    expect(buildAiRequestSpec(inactive, call()).body).not.toHaveProperty('max_tokens');
    const internal = buildAiRequestSpec(inactive, call({ maxTokensOverride: 120 }));
    expect(internal.body.max_tokens).toBe(120);
    expect(internal.maxTokensSource).toBe('internal');
  });

  it('sends a prompt’s custom Max Output in place of the pass cap, labeled internal', () => {
    const snap = snapshot(external(), { promptMaxOutput: { summary: { custom: true, value: 480 } } });
    const spec = buildAiRequestSpec(snap, call({ requestType: 'summary', maxTokensOverride: 200 }));
    expect(spec.body.max_tokens).toBe(480);
    expect(spec.maxTokensSource).toBe('internal');
  });

  it('labels a custom Max Output internal even where the call carries no cap of its own', () => {
    const snap = snapshot(external({ maxTokens: undefined }), { promptMaxOutput: { diary: { custom: true, value: 64 } } });
    const spec = buildAiRequestSpec(snap, call({ requestType: 'diary' }));
    expect(spec.body.max_tokens).toBe(64);
    expect(spec.maxTokensSource).toBe('internal');
  });

  it('sends the pass cap while the Max Output row is off, whatever value it keeps', () => {
    const snap = snapshot(external(), { promptMaxOutput: { summary: { custom: false, value: 480 } } });
    expect(buildRequestBody(snap, call({ requestType: 'summary', maxTokensOverride: 200 })).max_tokens).toBe(200);
  });

  it('ignores a Max Output entry on a prompt that has no row', () => {
    const snap = snapshot(external(), { promptMaxOutput: { narration: { custom: true, value: 64 } } });
    const spec = buildAiRequestSpec(snap, call());
    expect(spec.body.max_tokens).toBe(800);
    expect(spec.maxTokensSource).toBe('endpoint');
  });

  it('scales the reasoning budget from the custom Max Output', () => {
    const snap = snapshot(lmStudioReasoning(), {
      promptReasoningBudget: { thinking: 50 },
      promptMaxOutput: { thinking: { custom: true, value: 1000 } },
    });
    expect(buildRequestBody(snap, call({ requestType: 'thinking', maxTokensOverride: 256 })))
      .toMatchObject({ max_tokens: 1000, thinking_budget_tokens: 500 });
  });

  it('gives Choices a budget from its shipped cap on an endpoint with no Max Output', () => {
    const snap = snapshot(lmStudioReasoning({ maxTokens: undefined }), {
      reasoningEngaged: true, promptReasoning: { choices: 'high' }, promptReasoningBudget: { choices: 25 },
    });
    expect(buildRequestBody(snap, call({ requestType: 'choices', maxTokensOverride: 256 })))
      .toMatchObject({ max_tokens: 256, thinking_budget_tokens: 64 });
  });

  it('routes each kind to its own resolved target', () => {
    const snap = snapshot(external(), {
      resolveTarget: (kind) => (kind === 'summary' ? external({ model: 'small-1b', url: 'https://small.example/v1/chat/completions' }) : external()),
    });
    expect(buildAiRequestSpec(snap, call({ requestType: 'summary' })).body.model).toBe('small-1b');
    expect(buildAiRequestSpec(snap, call()).body.model).toBe('big-24b');
  });

  it('resolves the endpoint once per spec, so a resolver with probe side effects is not fired twice', () => {
    let calls = 0;
    const snap = snapshot(external(), { resolveTarget: () => { calls += 1; return external(); } });
    buildAiRequestSpec(snap, call());
    expect(calls).toBe(1);
  });
});

/**
 * One row of the dialect table per case. The same resolved choice — the same percent, the same level, the
 * same switch — goes out under whichever keys the target's dialect names, so these read as "what would this
 * endpoint receive".
 */
describe('dialects — one spelling per row', () => {
  /** The reasoning slice of a built body, so a case asserts the whole slice rather than one key of it. */
  const reasoningSlice = (body: AiRequestBody): Record<string, unknown> => {
    const { model: _m, messages: _msg, stream: _s, max_tokens: _mt, stop: _stop, ...rest } = body;
    return rest;
  };

  /** A target that reasons and takes a budget, differing from the next only in the dialect on its record. */
  const speaking = (dialect: ReasoningDialect, over: Partial<AiEndpointTarget> = {}): AiEndpointTarget =>
    external({
      maxTokens: 1000,
      reasoning: { ...accepts('none', 'low', 'medium', 'high'), reasons: true, budget: true, dialect },
      ...over,
    });

  const speaks = (target: AiEndpointTarget, over: Partial<AiSettingsSnapshot> = {}) =>
    reasoningSlice(buildRequestBody(
      snapshot(target, { reasoningEngaged: true, reasoningEffort: 'high', promptReasoningBudget: { narration: 40 }, ...over }),
      call(),
    ));

  it.each([
    ['unknown', { thinking_budget_tokens: 400, reasoning_effort: 'high' }],
    ['engine', { thinking_budget_tokens: 400 }],
    ['openai', { reasoning_effort: 'high' }],
    ['lmstudio', { thinking_budget_tokens: 400, reasoning_effort: 'high' }],
    ['vllm', { thinking_token_budget: 400, reasoning_effort: 'high' }],
    ['openrouter', { reasoning: { max_tokens: 400, effort: 'high' } }],
    // The adaptive row has no budget and no level to carry, so its whole message is that thinking is on.
    ['anthropic-adaptive', { thinking: { type: 'adaptive' } }],
    ['google-2.5', { google: { thinking_config: { thinking_budget: 400 } } }],
    ['google-3', { google: { thinking_config: { thinking_level: 'high' } } }],
    ['moonshot-k3', { reasoning_effort: 'high' }],
    ['moonshot-k2', {}],
  ] as const)('spells a 40%% budget at High the %s way', (dialect, expected) => {
    expect(speaks(speaking(dialect))).toEqual(expected);
  });

  it.each([
    ['unknown', { thinking_budget_tokens: 0, reasoning_effort: 'none' }],
    ['engine', { thinking_budget_tokens: 0 }],
    ['openai', { reasoning_effort: 'none' }],
    ['lmstudio', { thinking_budget_tokens: 0, reasoning_effort: 'none' }],
    ['vllm', { reasoning_effort: 'none' }],
    ['openrouter', { reasoning: { effort: 'none' } }],
    ['anthropic-budget', { thinking: { type: 'disabled' } }],
    ['anthropic-adaptive', { thinking: { type: 'disabled' } }],
    ['google-2.5', { reasoning_effort: 'none' }],
    ['google-3', {}],
    ['moonshot-k3', {}],
    ['moonshot-k2', { thinking: { type: 'disabled' } }],
  ] as const)('spells a switched-off prompt the %s way', (dialect, expected) => {
    expect(speaks(speaking(dialect), { promptReasoning: { narration: 'none' } })).toEqual(expected);
  });

  /**
   * A dialect names the spelling; the record still says whether the field may be sent at all. A vLLM server
   * is marked from its model list before anything has answered the levels question, and the hosted Default
   * is one of those, so a switched-off prompt there must stay silent rather than post `reasoning_effort`.
   */
  it('stays silent on a dialect whose record has not cleared the none literal', () => {
    const unanswered = speaking('vllm', { reasoning: { ...UNKNOWN_REASONING_CAPABILITY, dialect: 'vllm' } });
    expect(speaks(unanswered, { promptReasoning: { narration: 'none' } })).toEqual({});
    expect(speaks(unanswered)).toEqual({});
  });

  /**
   * The two records a vLLM target actually reaches the builder with, as the resolver writes them. Before a
   * reply proves the server separates its reasoning the record is bare, and nothing goes out. The reply that
   * proves it answers the budget and fills the safe levels at once, and both halves then go out together.
   */
  it('sends a vLLM server nothing until a reply proved it separates its reasoning, then both halves', () => {
    const unproven = speaking('vllm', { reasoning: { ...UNKNOWN_REASONING_CAPABILITY, dialect: 'vllm' } });
    expect(speaks(unproven)).toEqual({});

    const proven = speaking('vllm', {
      reasoning: {
        reasons: true, levels: ['none', 'low', 'medium', 'high'], budget: true, dialect: 'vllm',
        offAllowed: null, tools: null, sources: { reasons: 'observed', levels: 'observed', budget: 'observed', dialect: 'native' },
      },
    });
    expect(speaks(proven)).toEqual({ thinking_token_budget: 400, reasoning_effort: 'high' });
  });

  it('stays silent on a model the record rules out, off spelling or not', () => {
    for (const dialect of ['vllm', 'anthropic-budget', 'anthropic-adaptive', 'moonshot-k2', 'unknown'] as const) {
      const ruledOut = speaking(dialect, {
        reasoning: { reasons: false, levels: [], budget: true, dialect, offAllowed: null, tools: null, sources: { reasons: 'native' } },
      });
      expect(speaks(ruledOut, { promptReasoning: { narration: 'none' } })).toEqual({});
    }
  });

  it('sends nothing at all where the dialect rejects off, rather than a field the model refuses', () => {
    for (const dialect of ['google-3', 'moonshot-k3'] as const) {
      expect(speaks(speaking(dialect), { promptReasoning: { narration: 'none' } })).toEqual({});
    }
  });

  it('spells a 40% budget the anthropic-budget way, between the two bounds the API sets', () => {
    expect(speaks(speaking('anthropic-budget', { maxTokens: 8000 })))
      .toEqual({ thinking: { budget_tokens: 3200, type: 'enabled' } });
  });

  it('keeps the Anthropic budget one token under the output cap it would otherwise exceed', () => {
    const tight = speaking('anthropic-budget', { maxTokens: 4000 });
    // 100% of 4,000 would be the whole cap, which the endpoint rejects.
    expect(speaks(tight, { promptReasoningBudget: { narration: 100 } }))
      .toEqual({ thinking: { budget_tokens: 3999, type: 'enabled' } });
    // A budget already between the bounds is sent as it stands.
    expect(speaks(tight, { promptReasoningBudget: { narration: 50 } }))
      .toEqual({ thinking: { budget_tokens: 2000, type: 'enabled' } });
  });

  /**
   * The API rejects a thinking budget under 1,024 tokens as well as one that is not under the cap, so the
   * slider's own percent is raised to that floor. A cap too small to hold the floor leaves no budget the
   * endpoint would accept, and a request with no thinking object beats one that comes back 400.
   */
  it('raises a small Anthropic budget to the API floor, and sends none where the cap has no room', () => {
    const roomy = speaking('anthropic-budget', { maxTokens: 8000 });
    // 5% of 8,000 is 400, under the floor.
    expect(speaks(roomy, { promptReasoningBudget: { narration: 5 } }))
      .toEqual({ thinking: { budget_tokens: 1024, type: 'enabled' } });

    // A 1,000-token cap cannot hold a 1,024-token floor plus a reply, so nothing goes out.
    expect(speaks(speaking('anthropic-budget', { maxTokens: 1000 }), { promptReasoningBudget: { narration: 100 } }))
      .toEqual({});
  });

  it('leaves every other dialect free to spend the whole cap', () => {
    expect(speaks(speaking('lmstudio', { maxTokens: 300 }), { promptReasoningBudget: { narration: 100 } }))
      .toEqual({ thinking_budget_tokens: 300, reasoning_effort: 'high' });
  });

  it('maps a Google 2.5 level onto the documented thinking budget where no budget of the player\'s went out', () => {
    const noBudget = speaking('google-2.5', {
      reasoning: { ...accepts('none', 'low', 'medium', 'high'), reasons: true, budget: null, dialect: 'google-2.5' },
    });
    expect(speaks(noBudget, { reasoningEffort: 'low' })).toEqual({ google: { thinking_config: { thinking_budget: 1024 } } });
    expect(speaks(noBudget, { reasoningEffort: 'medium' })).toEqual({ google: { thinking_config: { thinking_budget: 8192 } } });
    expect(speaks(noBudget)).toEqual({ google: { thinking_config: { thinking_budget: 24576 } } });
  });

  it.each([
    ['openai', { reasoning_effort: 'high' }],
    ['google-3', { google: { thinking_config: { thinking_level: 'high' } } }],
    ['moonshot-k3', { reasoning_effort: 'high' }],
    ['moonshot-k2', {}],
  ] as const)('sends %s no budget at all, since its row names no field for one', (dialect, expected) => {
    expect(speaks(speaking(dialect))).toEqual(expected);
  });

  /**
   * The compatibility contract. Every case outside this block builds its target from `external()`, whose
   * record names no dialect, so the whole suite already pins the unknown row's body; this states its keys
   * outright so the row is never edited by accident.
   */
  it('keeps the unknown row spelling the plain fields, which is what every unnamed endpoint receives', () => {
    expect(speaks(speaking('unknown'))).toEqual({ thinking_budget_tokens: 400, reasoning_effort: 'high' });
    expect(speaks(speaking('unknown'), { promptReasoning: { narration: 'none' } }))
      .toEqual({ thinking_budget_tokens: 0, reasoning_effort: 'none' });
    expect(external().reasoning.dialect).toBe('unknown');
  });

  /**
   * OpenRouter answers four questions per model, so two targets on the same gateway take different fields.
   * Each case here states one of those answers and reads the body the model would receive.
   */
  describe('openrouter — the model list decides which fields go out', () => {
    const onOpenRouter = (record: Partial<ReasoningCapability>, over: Partial<AiEndpointTarget> = {}) =>
      speaking('openrouter', {
        reasoning: {
          ...UNKNOWN_REASONING_CAPABILITY, reasons: true, dialect: 'openrouter', offAllowed: true, ...record,
        },
        ...over,
      });

    // supports_max_tokens true with no efforts listed: the budget is the only control the model exposes.
    it('sends the budget alone where the model takes one and lists no effort', () => {
      expect(speaks(onOpenRouter({ levels: [], budget: true }))).toEqual({ reasoning: { max_tokens: 400 } });
    });

    // Efforts listed and supports_max_tokens omitted: the strength is the only control.
    it('sends the effort alone where the model lists efforts and takes no budget', () => {
      expect(speaks(onOpenRouter({ levels: ['none', 'low', 'high'], budget: false })))
        .toEqual({ reasoning: { effort: 'high' } });
    });

    // The docs allow both in one request, and a model that advertises both gets both.
    it('sends both where the model advertises both', () => {
      expect(speaks(onOpenRouter({ levels: ['none', 'low', 'high'], budget: true })))
        .toEqual({ reasoning: { max_tokens: 400, effort: 'high' } });
    });

    it('spells a switched-off prompt as the none effort, and drops the budget beside it', () => {
      expect(speaks(onOpenRouter({ levels: ['none', 'low', 'high'], budget: true }), { promptReasoning: { narration: 'none' } }))
        .toEqual({ reasoning: { effort: 'none' } });
    });

    /**
     * A mandatory model rejects `none`, so its switch renders checked and locked and the request carries the
     * strength that switch reads rather than an off field the model refuses.
     */
    it('sends the kept strength instead of an off field on a mandatory model', () => {
      const mandatory = onOpenRouter({ levels: ['low', 'high'], budget: true, offAllowed: false });
      const body = speaks(mandatory, {
        promptReasoning: { narration: 'none' },
        keptReasoning: { prompts: { narration: { enabled: false, level: 'low' } } },
      });
      expect(body).toEqual({ reasoning: { max_tokens: 400, effort: 'low' } });
    });

    it('sends no off field on a mandatory model even with no kept strength to fall back on', () => {
      const mandatory = onOpenRouter({ levels: ['low', 'high'], budget: true, offAllowed: false });
      // Model Default is what an unset prompt keeps, so the budget goes out and no effort does.
      expect(speaks(mandatory, { promptReasoning: { narration: 'none' } })).toEqual({ reasoning: { max_tokens: 400 } });
    });

    // The record's answer overrides the dialect row in both directions, so a model OpenRouter calls optional
    // may be switched off even though another model on the same dialect may not.
    it('lets a model the list calls optional switch off', () => {
      const optional = onOpenRouter({ levels: ['none', 'low', 'high'], budget: false, offAllowed: true });
      expect(speaks(optional, { promptReasoning: { narration: 'none' } })).toEqual({ reasoning: { effort: 'none' } });
    });
  });

  /**
   * Moonshot spells thinking two ways, and the model id picks which. These cases build the records the
   * identity source produces, so they read as what a player on each Kimi model would actually send.
   */
  describe('moonshot — the model id decides the spelling and the switch', () => {
    const onKimi = (record: Partial<ReasoningCapability>, dialect: ReasoningDialect) =>
      speaking(dialect, {
        reasoning: { ...UNKNOWN_REASONING_CAPABILITY, reasons: true, budget: false, dialect, ...record },
      });

    /** k3: three rungs, no `none`, and no budget field to put a cap in. */
    const k3 = () => onKimi({ levels: ['low', 'high', 'max'] }, 'moonshot-k3');
    /** A k2 model, which takes no effort field at all. `offAllowed` is what separates k2.6 from the rest. */
    const k2 = (offAllowed: boolean) => onKimi({ levels: [], offAllowed }, 'moonshot-k2');

    it('sends the strength alone on k3, since the endpoint takes no budget', () => {
      expect(speaks(k3())).toEqual({ reasoning_effort: 'high' });
    });

    // k3 always reasons, so there is no off field to send and a zero budget would be refused too.
    it('sends nothing at all when a prompt is switched off on k3', () => {
      expect(speaks(k3(), { promptReasoning: { narration: 'none' } })).toEqual({});
    });

    it('switches k2.6 off through the thinking object, which is the only spelling it takes', () => {
      expect(speaks(k2(true), { promptReasoning: { narration: 'none' } }))
        .toEqual({ thinking: { type: 'disabled' } });
    });

    /**
     * The case the record answers and the dialect row cannot: k2-thinking and k2.7-code share k2.6's
     * spelling but error on `disabled`. A switched-off prompt there must send no thinking object at all,
     * even though the row beside it names one.
     */
    it('sends no thinking object on a k2 model that errors on disabled', () => {
      expect(speaks(k2(false), { promptReasoning: { narration: 'none' } })).toEqual({});
    });

    // The locked switch reads as on, and a kept strength must not leak out as an effort field either: no k2
    // model takes one.
    it('sends no effort field on a refuse-off k2 model even with a strength kept', () => {
      expect(speaks(k2(false), {
        promptReasoning: { narration: 'none' },
        keptReasoning: { prompts: { narration: { enabled: false, level: 'low' } } },
      })).toEqual({});
    });
  });
});

describe('tools — sent only where the record says the target takes them', () => {
  const peek: Tool = {
    id: 't', name: 'peek', description: 'Purpose: look.', params: [], handler: { kind: 'template', body: 'x' },
    emptyResult: '{}', offeredTo: ['narration'],
  };
  const takesTools = (over: Partial<AiEndpointTarget> = {}) =>
    external({ reasoning: { ...accepts(), tools: true, sources: { tools: 'native' } }, ...over });

  it('sends every offered Tool as a function schema with automatic tool choice', () => {
    const spec = buildAiRequestSpec(snapshot(takesTools()), call({ tools: [peek] }));
    expect(spec.body.tools).toEqual([toolSchema(peek)]);
    expect(spec.body.tool_choice).toBe('auto');
    expect(spec.tools).toEqual([peek]);
  });

  it.each([
    ['unknown', null],
    ['unsupported', false],
  ])('sends no tools field when support is %s, and leaves the prompt text unchanged', (_name, tools) => {
    const target = external({ reasoning: { ...accepts(), tools, sources: {} } });
    const withTools = buildAiRequestSpec(snapshot(target), call({ tools: [peek] }));
    const without = buildAiRequestSpec(snapshot(target), call());
    expect(withTools.body).not.toHaveProperty('tools');
    expect(withTools.body).not.toHaveProperty('tool_choice');
    expect(withTools).not.toHaveProperty('tools');
    expect(withTools.body).toEqual(without.body);
  });

  it('sends no tools field when the call offers none, even on a target that takes them', () => {
    const spec = buildAiRequestSpec(snapshot(takesTools()), call({ tools: [] }));
    expect(spec.body).not.toHaveProperty('tools');
    expect(spec.body).not.toHaveProperty('tool_choice');
    expect(spec).not.toHaveProperty('tools');
  });
});
