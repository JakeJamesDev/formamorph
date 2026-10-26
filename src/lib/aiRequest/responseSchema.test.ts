import { describe, expect, it, vi } from 'vitest';
import { streamAiRequest } from './aiStream';
import type { AiRequestSpec } from './aiRequestSpec';
import { followsResponseSchema, SchemaRefused, schemaRejected, withTextFallback, type ResponseSchema, type ResponseSchemaNode } from './responseSchema';
import { defaultEndpointSamplerOverrides } from '@/lib/endpointSamplers';
import { UNKNOWN_REASONING_CAPABILITY } from '@/lib/reasoningEffort';

const spec: AiRequestSpec = {
  url: 'https://example.test/v1/chat/completions',
  headers: {},
  body: { model: 'test-model', messages: [{ role: 'user', content: 'hi' }], stream: true },
  target: {
    endpointId: 'schema-target', url: 'https://example.test/v1/chat/completions', apiToken: '', model: 'test-model',
    maxTokens: 400, localEngine: false, samplerOverrides: defaultEndpointSamplerOverrides(), reasoning: UNKNOWN_REASONING_CAPABILITY,
  },
  requestType: 'statUpdates',
  samplerSources: {},
};

/** The error the stream raises for one server reply. */
async function errorFrom(status: number, param?: string): Promise<unknown> {
  const response = new Response(JSON.stringify({
    error: { message: 'Bad request', type: 'BadRequestError', ...(param !== undefined && { param }) },
  }), { status });
  try {
    for await (const _event of streamAiRequest(spec, { fetchImpl: (() => Promise.resolve(response)) as typeof fetch })) {
      // A rejection cannot yield events.
    }
  } catch (error) {
    return error;
  }
  throw new Error('Expected the controlled endpoint rejection to throw');
}

describe('withTextFallback', () => {
  interface Call {
    systemPrompt: string;
    responseSchema?: ResponseSchema;
    textFallback?: { systemPrompt: string };
    signal?: AbortSignal;
  }
  const schema: ResponseSchema = { name: 's', schema: { type: 'integer', minimum: 0, maximum: 1 } };
  const target = { url: 'https://example.test/v1/chat/completions', model: 'm' };
  const call: Call = { systemPrompt: 'JSON', responseSchema: schema, textFallback: { systemPrompt: 'TEXT' } };

  /** A send that refuses the schema request, as the request layer reports it, and answers the rest. */
  const refusing = (retry: (args: Call) => Promise<string> = async () => 'Health: -5') => vi.fn(async (args: Call) => {
    if (args.responseSchema) throw new SchemaRefused(target, new Error('400'));
    return retry(args);
  });

  it('answers a refused schema request with its text fallback, and marks the endpoint', async () => {
    const send = refusing();
    const onRefused = vi.fn();
    expect(await withTextFallback(call, send, onRefused)).toBe('Health: -5');
    expect(send.mock.calls[1][0]).toEqual({ systemPrompt: 'TEXT', responseSchema: undefined, textFallback: undefined });
    expect(onRefused).toHaveBeenCalledWith(target);
  });

  it('marks nothing when the retry fails or is stopped', async () => {
    const onRefused = vi.fn();
    await expect(withTextFallback(call, refusing(async () => { throw new Error('offline'); }), onRefused)).rejects.toThrow('offline');
    const stop = new AbortController();
    await withTextFallback({ ...call, signal: stop.signal }, refusing(async () => { stop.abort(); return ''; }), onRefused);
    expect(onRefused).not.toHaveBeenCalled();
  });

  it('passes any other failure through without a retry', async () => {
    const send = vi.fn(async () => { throw new Error('500'); });
    const onRefused = vi.fn();
    await expect(withTextFallback(call, send, onRefused)).rejects.toThrow('500');
    expect(send).toHaveBeenCalledTimes(1);
    expect(onRefused).not.toHaveBeenCalled();
  });
});

describe('schemaRejected', () => {
  it.each([
    [400, undefined],
    [422, undefined],
    [400, 'response_format'],
    [400, 'response_format.json_schema'],
    [400, 'guided_json'],
  ])('reads a %i naming %s as a possible schema refusal', async (status, param) => {
    expect(schemaRejected(await errorFrom(status, param))).toBe(true);
  });

  it.each([
    [400, 'temperature'],
    [400, 'max_tokens'],
    [401, undefined],
    [500, undefined],
  ])('reads a %i naming %s as some other failure', async (status, param) => {
    expect(schemaRejected(await errorFrom(status, param))).toBe(false);
  });

  it('reads a network failure or a plain error as some other failure', () => {
    expect(schemaRejected(new Error('offline'))).toBe(false);
    expect(schemaRejected(null)).toBe(false);
  });
});

describe('followsResponseSchema', () => {
  const schema: ResponseSchemaNode = {
    type: 'object', additionalProperties: false, required: ['Hero'],
    properties: { Hero: { type: 'object', additionalProperties: false, required: ['Health'], properties: { Health: { type: 'integer', minimum: -10, maximum: 10 } } } },
  };

  it('accepts a reply that follows the schema, fenced or not', () => {
    expect(followsResponseSchema('{"Hero": {"Health": -2}}', schema)).toBe(true);
    expect(followsResponseSchema('```json\n{"Hero": {"Health": 3}}\n```', schema)).toBe(true);
  });

  it.each([
    ['prose', 'Health: -2'],
    ['a missing key', '{"Hero": {}}'],
    ['an extra key', '{"Hero": {"Health": 1}, "Villain": {}}'],
    ['a fraction', '{"Hero": {"Health": 1.5}}'],
    ['a value past its bound', '{"Hero": {"Health": 11}}'],
    ['an array for an object', '{"Hero": []}'],
  ])('refuses %s', (_label, text) => {
    expect(followsResponseSchema(text, schema)).toBe(false);
  });
});
