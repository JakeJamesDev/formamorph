import { describe, expect, it } from 'vitest';
import { streamAiRequest } from './aiStream';
import type { AiRequestSpec } from './aiRequestSpec';
import { rejectedEndpointOverride } from './rejectedOverride';
import { defaultEndpointSamplerOverrides } from '@/lib/endpointSamplers';

function specFor(parameter: string, source: 'endpoint' | 'prompt' = 'endpoint'): AiRequestSpec {
  const samplerOverrides = defaultEndpointSamplerOverrides();
  const body: AiRequestSpec['body'] = {
    model: 'test-model', messages: [{ role: 'user', content: 'hi' }], stream: true,
  };
  const samplerSources: AiRequestSpec['samplerSources'] = {};
  let maxTokensSource: AiRequestSpec['maxTokensSource'];
  switch (parameter) {
    case 'temperature': body.temperature = 0.7; samplerSources.temperature = source; break;
    case 'repetition_penalty':
    case 'repeat_penalty': body.repetition_penalty = 1.1; body.repeat_penalty = 1.1; samplerSources.repetitionPenalty = source; break;
    case 'top_p': body.top_p = 0.9; samplerSources.topP = source; break;
    case 'top_k': body.top_k = 40; samplerSources.topK = source; break;
    case 'min_p': body.min_p = 0.05; samplerSources.minP = source; break;
    case 'max_tokens': body.max_tokens = 400; maxTokensSource = source === 'endpoint' ? 'endpoint' : 'internal'; break;
  }
  return {
    url: 'https://example.test/v1/chat/completions',
    headers: {},
    body,
    target: {
      endpointId: 'failed-target', url: 'https://example.test/v1/chat/completions', apiToken: '', model: 'test-model',
      maxTokens: 400, localEngine: false, samplerOverrides, supportedReasoningEfforts: null,
    },
    requestType: 'narration',
    samplerSources,
    maxTokensSource,
  };
}

async function errorFrom(parameter: string): Promise<unknown> {
  const response = new Response(JSON.stringify({
    error: { message: `${parameter} is not supported`, type: 'invalid_request_error', param: parameter },
  }), { status: 400 });
  try {
    for await (const _event of streamAiRequest(specFor(parameter), { fetchImpl: (() => Promise.resolve(response)) as typeof fetch })) {
      // A rejection cannot yield events.
    }
  } catch (error) {
    return error;
  }
  throw new Error('Expected the controlled endpoint rejection to throw');
}

describe('rejectedEndpointOverride', () => {
  it.each([
    ['temperature', 'temperature'],
    ['repetition_penalty', 'repetitionPenalty'],
    ['repeat_penalty', 'repetitionPenalty'],
    ['top_p', 'topP'],
    ['top_k', 'topK'],
    ['min_p', 'minP'],
    ['max_tokens', 'maxOutput'],
  ] as const)('attributes a structured rejection of %s to its supplied endpoint override', async (parameter, expected) => {
    expect(rejectedEndpointOverride(await errorFrom(parameter), specFor(parameter))).toBe(expected);
  });

  it('leaves an enabled override alone when a prompt or internal cap supplied the rejected value', async () => {
    expect(rejectedEndpointOverride(await errorFrom('temperature'), specFor('temperature', 'prompt'))).toBeNull();
    expect(rejectedEndpointOverride(await errorFrom('max_tokens'), specFor('max_tokens', 'prompt'))).toBeNull();
  });

  it('does not infer a rejection from a parameter name in unstructured error text', () => {
    const error = new Error('top_p failed unexpectedly');
    expect(rejectedEndpointOverride(error, specFor('top_p'))).toBeNull();
  });

  it('does not replay a rejected request', async () => {
    let requests = 0;
    const response = new Response(JSON.stringify({
      error: { message: 'top_p is not supported', type: 'invalid_request_error', param: 'top_p' },
    }), { status: 400 });
    const fetchImpl = (() => {
      requests += 1;
      return Promise.resolve(response);
    }) as typeof fetch;

    await expect((async () => {
      for await (const _event of streamAiRequest(specFor('top_p'), { fetchImpl })) {
        // A rejection cannot yield events.
      }
    })()).rejects.toThrow('HTTP 400');
    expect(requests).toBe(1);
  });
});
