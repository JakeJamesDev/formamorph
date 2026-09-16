import { describe, it, expect, beforeEach } from 'vitest';
import { resolveReasoningCapability } from './reasoningEffort';
import { resetProbeMemo } from './probeMemo';
import { reasoningBackend as backend } from '@/test/reasoningBackend';
import { buildRequestBody, type AiEndpointTarget, type AiRequestBody } from './aiRequest/aiRequestSpec';
import { defaultEndpointSamplerOverrides } from '@/lib/endpointSamplers';

beforeEach(() => resetProbeMemo());

const ANTHROPIC = { url: 'https://api.anthropic.com/v1/chat/completions', token: 't', model: 'claude-opus-5' };
const GOOGLE = {
  url: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
  token: 't',
  model: 'gemini-2.5-flash',
};

/** Nothing answers any URL, so only a source that needs no request can produce a record here. */
const silent = () => backend({});

describe('the endpoint identity source', () => {
  it('names the Anthropic dialect from the host and the model generation alone', async () => {
    const { doFetch, calls } = silent();
    const record = await resolveReasoningCapability(ANTHROPIC, doFetch);
    expect(record).toMatchObject({ dialect: 'anthropic-adaptive', reasons: true, budget: false, levels: [] });
    expect(record?.sources.dialect).toBe('identity');
    expect(record?.sources.reasons).toBe('identity');
    // The whole point of identity: it beats every source that costs a request, so none is sent.
    expect(calls).toHaveLength(0);
  });

  it('names the budget row for a Claude model that still takes a manual budget', async () => {
    const { doFetch } = silent();
    const record = await resolveReasoningCapability({ ...ANTHROPIC, model: 'claude-sonnet-4-6' }, doFetch);
    expect(record).toMatchObject({ dialect: 'anthropic-budget', budget: true });
  });

  it('names the Google dialect by generation, budget on 2.5 and level on 3.x', async () => {
    const { doFetch, calls } = silent();
    const record = await resolveReasoningCapability(GOOGLE, doFetch);
    expect(record).toMatchObject({
      dialect: 'google-2.5', reasons: true, budget: true, levels: ['minimal', 'low', 'medium', 'high'],
    });
    expect(record?.sources.levels).toBe('identity');
    expect(calls).toHaveLength(0);

    const three = silent();
    const record3 = await resolveReasoningCapability({ ...GOOGLE, model: 'gemini-3-pro-preview' }, three.doFetch);
    expect(record3).toMatchObject({ dialect: 'google-3', budget: false, levels: ['low', 'medium', 'high'] });
  });

  it('leaves an endpoint on no claimed host to the rest of the chain', async () => {
    const { doFetch, calls } = backend({
      'http://host.example/v1/models': { status: 200, body: { data: [{ id: 'm', max_model_len: 4096 }] } },
    });
    const record = await resolveReasoningCapability(
      { url: 'http://host.example/v1/chat/completions', token: 't', model: 'm' },
      doFetch,
    );
    // The models-list source still answers, so identity has not swallowed the chain.
    expect(record?.dialect).toBe('vllm');
    expect(calls.length).toBeGreaterThan(0);
  });

  it('leaves the identity answer unset when the host is claimed but the model is not its own', async () => {
    const { doFetch } = backend({
      'https://api.anthropic.com/v1/models': {
        status: 200, body: { data: [{ id: 'gpt-5', max_model_len: 4096 }] },
      },
    });
    const record = await resolveReasoningCapability({ ...ANTHROPIC, model: 'gpt-5' }, doFetch);
    expect(record?.sources.dialect).not.toBe('identity');
  });

  it('rules a pre-thinking Claude model out rather than offering controls that fail the turn', async () => {
    const { doFetch } = silent();
    const record = await resolveReasoningCapability({ ...ANTHROPIC, model: 'claude-3-5-haiku-20241022' }, doFetch);
    expect(record).toMatchObject({ reasons: false, levels: [] });
  });
});

/**
 * The join the two suites above each miss. `reasoningIdentity.ts` is tested on the answers it returns, and
 * the request-spec suite is tested on hand-written records, so a wrong `budget` or `levels` in an identity
 * row would show up in neither. These cases carry one real endpoint and model all the way to the wire body.
 */
describe('a resolved target reaches the wire in its own dialect', () => {
  /** The reasoning slice of a built body, so a case asserts the whole slice rather than one key of it. */
  const reasoningSlice = (body: AiRequestBody): Record<string, unknown> => {
    const { model: _m, messages: _msg, stream: _s, max_tokens: _mt, stop: _stop, ...rest } = body;
    return rest;
  };

  /** Resolves one endpoint-and-model pair, then builds a narration body against the record it produced. */
  const wire = async (url: string, model: string, maxTokens: number) => {
    const { doFetch } = backend({});
    const reasoning = await resolveReasoningCapability({ url, token: 't', model }, doFetch);
    expect(reasoning).not.toBeNull();
    const target: AiEndpointTarget = {
      endpointId: 'cloud', url, apiToken: 't', model, maxTokens, localEngine: false,
      samplerOverrides: defaultEndpointSamplerOverrides(), reasoning: reasoning!,
    };
    return reasoningSlice(buildRequestBody({
      resolveTarget: () => target,
      thinkingMode: 'off', reasoningEffort: 'high', reasoningEngaged: true,
      promptReasoning: {}, promptReasoningBudget: { narration: 40 }, promptSamplers: {}, promptMaxOutput: {},
      genTemperature: 0.9, genRepetitionPenalty: 1.1, genTopP: 0.95, genTopK: 40, genMinP: 0.05,
      paragraphLimit: 'none', disableThinking: false,
    }, { systemPrompt: 'You narrate.', messages: [{ role: 'user', content: 'go north' }], requestType: 'narration' }));
  };

  // The endpoint documents `reasoning_effort` as ignored, so it must never appear on either Anthropic row.
  it('sends a Claude 4.6 model a thinking budget and no effort literal', async () => {
    expect(await wire(ANTHROPIC.url, 'claude-sonnet-4-6', 8000))
      .toEqual({ thinking: { budget_tokens: 3200, type: 'enabled' } });
  });

  it('sends a Claude 5 model the adaptive switch alone, with no budget and no effort literal', async () => {
    expect(await wire(ANTHROPIC.url, 'claude-opus-5', 8000)).toEqual({ thinking: { type: 'adaptive' } });
  });

  it('sends a Gemini 2.5 model its thinking budget', async () => {
    expect(await wire(GOOGLE.url, 'gemini-2.5-flash', 8000))
      .toEqual({ google: { thinking_config: { thinking_budget: 3200 } } });
  });

  it('sends a Gemini 3 model its thinking level and no budget', async () => {
    expect(await wire(GOOGLE.url, 'gemini-3-pro-preview', 8000))
      .toEqual({ google: { thinking_config: { thinking_level: 'high' } } });
  });

  // A model its vendor gives no thinking parameter must reach the wire carrying nothing at all.
  it('sends a pre-thinking model no reasoning field of any kind', async () => {
    expect(await wire(GOOGLE.url, 'gemini-2.0-flash', 8000)).toEqual({});
  });
});
