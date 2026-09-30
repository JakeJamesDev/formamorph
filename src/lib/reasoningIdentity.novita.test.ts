import { describe, it, expect } from 'vitest';
import { reasoningIdentityAnswer } from './reasoningIdentity';
import { buildRequestBody, type AiEndpointTarget, type AiSettingsSnapshot } from '@/lib/aiRequest/aiRequestSpec';
import { defaultEndpointSamplerOverrides } from '@/lib/endpointSamplers';
import { UNKNOWN_REASONING_CAPABILITY, type ReasoningCapability } from '@/lib/reasoningEffort';

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
