import { describe, it, expect } from 'vitest';
import { reasoningIdentityAnswer } from './reasoningIdentity';
import { buildRequestBody, type AiEndpointTarget, type AiSettingsSnapshot } from '@/lib/aiRequest/aiRequestSpec';
import { defaultEndpointSamplerOverrides } from '@/lib/endpointSamplers';
import {
  UNKNOWN_REASONING_CAPABILITY, reasoningRereadsPerSession, resolveReasoningCapability, storedAfterResolve,
  type KeptReasoningSettings, type ReasoningCapability,
} from '@/lib/reasoningEffort';

/**
 * Novita switches thinking with `enable_thinking`, default on. Source, read live on 2026-09-30: Novita's
 * chat-completions API reference, which lists DeepSeek V3.1 and later and GLM 4.5 for the field.
 */

const NOVITA = 'https://api.novita.ai/openai/v1/chat/completions';

describe('Novita model ids name the dialect', () => {
  it.each([
    'deepseek/deepseek-v4-flash', 'deepseek/deepseek-v3.1', 'deepseek/deepseek-v3.1-terminus',
    'deepseek/deepseek-v3.2-exp', 'zai-org/glm-4.5', 'zai-org/glm-4.6',
  ])('claims %s as a switchable reasoner', (model) => {
    expect(reasoningIdentityAnswer(NOVITA, model)).toEqual({ dialect: 'novita', reasons: true, levels: [], budget: false });
  });

  it.each(['deepseek/deepseek-v3-0324', 'deepseek/deepseek-r1-turbo', 'zai-org/glm-4.1v-9b-thinking', 'meta-llama/llama-3.3-70b-instruct'])(
    'leaves %s to the rest of the chain', (model) => {
      expect(reasoningIdentityAnswer(NOVITA, model)).toBeNull();
    },
  );

  // Novita's reference: "Models whose reasoning is always on, such as `zai-org/glm-5.3`, ignore this parameter."
  it.each(['zai-org/glm-5.3', 'zai-org/glm-5.3-flash', 'zai-org/glm-6'])('claims %s as an always-on reasoner', (model) => {
    expect(reasoningIdentityAnswer(NOVITA, model)).toEqual({ dialect: 'novita', reasons: true, levels: [], budget: false, offAllowed: false });
  });

  it('claims nothing for the same model served from another host', () => {
    expect(reasoningIdentityAnswer('https://openrouter.ai/api/v1/chat/completions', 'deepseek/deepseek-v4-flash')).toBeNull();
  });
});

describe('a switched-off pass on Novita', () => {
  const record = (): ReasoningCapability => {
    const answer = reasoningIdentityAnswer(NOVITA, 'deepseek/deepseek-v4-flash');
    if (!answer) throw new Error('Novita row claimed nothing');
    return { ...UNKNOWN_REASONING_CAPABILITY, ...answer, offAllowed: null };
  };
  const target: AiEndpointTarget = {
    endpointId: 'novita', url: NOVITA, apiToken: 't', model: 'deepseek/deepseek-v4-flash', maxTokens: 700,
    localEngine: false, samplerOverrides: defaultEndpointSamplerOverrides(), reasoning: record(),
  };
  const snapshot: AiSettingsSnapshot = {
    resolveTarget: () => target, thinkingMode: 'off', reasoningEffort: 'auto', reasoningEngaged: true,
    promptReasoning: {}, promptReasoningBudget: {}, promptSamplers: {}, promptMaxOutput: {}, genTemperature: 0.9,
    genRepetitionPenalty: 1.1, genTopP: 0.95, genTopK: 40, genMinP: 0.05, paragraphLimit: 'none', disableThinking: false,
  };

  // The reported failure: a 13-token Location Change reasoned through its whole cap because nothing said off.
  it.each(['locationChange', 'timePassed', 'openingTime'] as const)('tells the model not to think on %s', (requestType) => {
    const body = buildRequestBody(snapshot, {
      systemPrompt: 's', messages: [{ role: 'user', content: 'x' }], requestType, maxTokensOverride: 13,
    });
    expect(body).toMatchObject({ enable_thinking: false, max_tokens: 13 });
  });

  it('leaves narration, which ships on, to the model default', () => {
    const body = buildRequestBody(snapshot, { systemPrompt: 's', messages: [{ role: 'user', content: 'x' }], requestType: 'narration' });
    expect(body).not.toHaveProperty('enable_thinking');
  });
});

describe('GLM-5.3 on Novita', () => {
  const MODEL = 'zai-org/glm-5.3-flash';
  /** The record the row wrote before it knew GLM-5.3 ignores the switch, with a tools answer since probed. */
  const stale: ReasoningCapability = {
    ...UNKNOWN_REASONING_CAPABILITY, dialect: 'novita', reasons: true, levels: [], budget: false, tools: true,
    sources: { reasons: 'identity', budget: 'identity', dialect: 'identity', levels: 'identity', tools: 'probe' },
  };
  const noFetch = (() => { throw new Error('the reread sent a request'); }) as unknown as typeof fetch;

  it('rereads a cached record once per session, with no request, and keeps its tools answer', async () => {
    expect(reasoningRereadsPerSession(stale)).toBe(true);
    const fresh = await resolveReasoningCapability({ url: NOVITA, token: 't', model: MODEL }, noFetch, { stored: stale });
    if (!fresh) throw new Error('the reread answered nothing');
    expect(storedAfterResolve(stale, fresh)).toMatchObject({ offAllowed: false, tools: true });
  });

  // GLM-5.3 ignores `enable_thinking: false`, so an 11-token Location Change needs the kept strength's room.
  describe('a switched-off Location Change with Max Output off', () => {
    const answer = reasoningIdentityAnswer(NOVITA, MODEL);
    if (!answer) throw new Error('Novita row claimed nothing');
    const target: AiEndpointTarget = {
      endpointId: 'novita', url: NOVITA, apiToken: 't', model: MODEL, maxTokens: undefined, localEngine: false,
      samplerOverrides: defaultEndpointSamplerOverrides(),
      reasoning: { ...UNKNOWN_REASONING_CAPABILITY, ...answer, offAllowed: answer.offAllowed ?? null },
    };
    const snapshot = (kept?: KeptReasoningSettings): AiSettingsSnapshot => ({
      resolveTarget: () => target, thinkingMode: 'off', reasoningEffort: 'auto', reasoningEngaged: true,
      promptReasoning: {}, keptReasoning: kept, promptReasoningBudget: {}, promptSamplers: {}, promptMaxOutput: {}, genTemperature: 0.9,
      genRepetitionPenalty: 1.1, genTopP: 0.95, genTopK: 40, genMinP: 0.05, paragraphLimit: 'none', disableThinking: false,
    });
    const locationChange = {
      systemPrompt: 's', messages: [{ role: 'user' as const, content: 'x' }], requestType: 'locationChange' as const, maxTokensOverride: 11,
    };

    it('sends no switch the model ignores, and the shipped kept strength’s room on top of the answer', () => {
      const body = buildRequestBody(snapshot(), locationChange);
      expect(body).not.toHaveProperty('enable_thinking');
      // Shipped: Location Change keeps Global, and Global keeps Model Default, which reads as Medium.
      expect(body.max_tokens).toBe(11 + 2048);
    });

    it('sizes the room from the strength the switch keeps', () => {
      const kept: KeptReasoningSettings = { prompts: { locationChange: { enabled: false, level: 'low' } } };
      expect(buildRequestBody(snapshot(kept), locationChange).max_tokens).toBe(11 + 1024);
    });
  });
});
