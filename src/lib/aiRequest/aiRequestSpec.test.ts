import { describe, it, expect } from 'vitest';
import {
  buildAiRequestSpec, buildRequestBody,
  type AiCall, type AiEndpointTarget, type AiSettingsSnapshot,
} from './aiRequestSpec';

/** The engine kinds the body splits on. LM Studio differs from a generic OpenAI-compatible endpoint only in
 *  what it accepts, which the spec expresses as the probed effort list — two targets, not two code paths. */
const localEngine = (over: Partial<AiEndpointTarget> = {}): AiEndpointTarget => ({
  url: 'http://127.0.0.1:8080/v1/chat/completions',
  apiToken: 'engine-token',
  model: 'bundled.gguf',
  maxTokens: 1000,
  localEngine: true,
  supportedReasoningEfforts: null,
  ...over,
});

const external = (over: Partial<AiEndpointTarget> = {}): AiEndpointTarget => ({
  url: 'https://api.example.com/v1/chat/completions',
  apiToken: 'cloud-token',
  model: 'big-24b',
  maxTokens: 800,
  localEngine: false,
  supportedReasoningEfforts: ['none', 'low', 'medium', 'high'],
  ...over,
});

/** LM Studio: reachable, probed conclusively as non-reasoning, so it accepts no effort literal at all. */
const lmStudio = (over: Partial<AiEndpointTarget> = {}): AiEndpointTarget =>
  external({ url: 'http://127.0.0.1:1234/v1/chat/completions', model: 'cydonia-24b', supportedReasoningEfforts: [], ...over });

const snapshot = (target: AiEndpointTarget, over: Partial<AiSettingsSnapshot> = {}): AiSettingsSnapshot => ({
  resolveTarget: () => target,
  thinkingMode: 'off',
  reasoningEffort: 'auto',
  reasoningEngaged: false,
  promptReasoning: {},
  promptReasoningBudget: {},
  promptSamplers: {},
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
});

describe('reasoning split — budget on the engine, effort outside it', () => {
  it('sends a token budget, never an effort, on the built-in engine', () => {
    const snap = snapshot(localEngine(), {
      reasoningEngaged: true, reasoningEffort: 'high', promptReasoningBudget: { narration: 40 },
    });
    const body = buildRequestBody(snap, call());
    expect(body).toMatchObject({ thinking_budget_tokens: 400 });
    expect(body).not.toHaveProperty('reasoning_effort');
  });

  it('scales the budget off a max-token override rather than the target cap', () => {
    const snap = snapshot(localEngine(), { promptReasoningBudget: { narration: 50 } });
    expect(buildRequestBody(snap, call({ maxTokensOverride: 200 }))).toMatchObject({ thinking_budget_tokens: 100 });
  });

  it.each([
    ['inline', 'inline'],
    ['precall', 'precall'],
    ['staged', 'staged'],
  ] as const)('zeroes the engine budget under the guided %s mode, which drives its own thinking', (_n, thinkingMode) => {
    const snap = snapshot(localEngine(), { thinkingMode, promptReasoningBudget: { narration: 40 } });
    expect(buildRequestBody(snap, call())).toMatchObject({ thinking_budget_tokens: 0 });
  });

  it('zeroes the budget for an uncontrolled prompt', () => {
    const snap = snapshot(localEngine(), { promptReasoningBudget: { narration: 40 } });
    expect(buildRequestBody(snap, call({ requestType: 'summary' }))).toMatchObject({ thinking_budget_tokens: 0 });
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

  // A stored level for a prompt with no reasoning control (only narration and choices have one) is ignored
  // rather than followed — otherwise a stale preference would quietly turn reasoning on for an extraction.
  it('hardwires an uncontrolled prompt to none even when a level is stored for it', () => {
    const snap = snapshot(external(), {
      reasoningEngaged: true, reasoningEffort: 'high', promptReasoning: { summary: 'high' },
    });
    expect(buildRequestBody(snap, call({ requestType: 'summary' }))).toMatchObject({ reasoning_effort: 'none' });
  });

  it('omits the effort entirely when reasoning is engaged nowhere', () => {
    const snap = snapshot(external(), { reasoningEngaged: false, reasoningEffort: 'high' });
    expect(buildRequestBody(snap, call())).not.toHaveProperty('reasoning_effort');
  });

  it('omits the effort on LM Studio, probed as accepting no level at all', () => {
    const snap = snapshot(lmStudio(), { reasoningEngaged: true, reasoningEffort: 'high' });
    expect(buildRequestBody(snap, call())).not.toHaveProperty('reasoning_effort');
  });

  it('omits the effort on an unprobed endpoint rather than guessing it is accepted', () => {
    const snap = snapshot(external({ supportedReasoningEfforts: null }), { reasoningEngaged: true, reasoningEffort: 'high' });
    expect(buildRequestBody(snap, call())).not.toHaveProperty('reasoning_effort');
  });

  it('omits the effort for a level the routed target does not accept', () => {
    const snap = snapshot(external({ supportedReasoningEfforts: ['none', 'low'] }), { reasoningEngaged: true, reasoningEffort: 'high' });
    expect(buildRequestBody(snap, call())).not.toHaveProperty('reasoning_effort');
  });

  it('forces none under a guided mode so a native model does not fight the guided step', () => {
    const snap = snapshot(external(), { thinkingMode: 'precall', reasoningEngaged: true, reasoningEffort: 'high' });
    expect(buildRequestBody(snap, call())).toMatchObject({ reasoning_effort: 'none' });
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
    expect(buildAiRequestSpec(snapshot(external()), call({ maxTokensOverride: 120 })).body.max_tokens).toBe(120);
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
