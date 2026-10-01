import { afterEach, describe, it, expect, vi } from 'vitest';
import {
  deriveModelsUrls, parseContextLength, parsePropsContextLength, fetchContextLength, detectedContextCodec,
} from './contextLength';
import { resetProbeMemo } from './probeMemo';

describe('deriveModelsUrls', () => {
  it('swaps /chat/completions for /models and derives the LM Studio path', () => {
    expect(deriveModelsUrls('https://api.lyonade.net/v1/chat/completions')).toEqual({
      openai: 'https://api.lyonade.net/v1/models',
      lmstudio: 'https://api.lyonade.net/api/v0/models',
      props: 'https://api.lyonade.net/props',
    });
  });

  it('handles a localhost endpoint', () => {
    expect(deriveModelsUrls('http://localhost:1234/v1/chat/completions')).toEqual({
      openai: 'http://localhost:1234/v1/models',
      lmstudio: 'http://localhost:1234/api/v0/models',
      props: 'http://localhost:1234/props',
    });
  });

  it('falls back to {origin}/v1/models when the suffix is unexpected', () => {
    expect(deriveModelsUrls('https://example.com/custom')).toEqual({
      openai: 'https://example.com/v1/models',
      lmstudio: 'https://example.com/api/v0/models',
      props: 'https://example.com/props',
    });
  });

  it('returns null for an invalid URL', () => {
    expect(deriveModelsUrls('not a url')).toBeNull();
  });
});

describe('parseContextLength', () => {
  it('prefers the entry matching the model name', () => {
    const json = { data: [{ id: 'a', context_length: 4096 }, { id: 'cydonia', context_length: 32768 }] };
    expect(parseContextLength(json, 'cydonia')).toBe(32768);
  });

  it('prefers loaded_context_length over max', () => {
    const json = { data: [{ id: 'm', loaded_context_length: 20000, max_context_length: 32768 }] };
    expect(parseContextLength(json, 'm')).toBe(20000);
  });

  it('treats max_context_length as a last resort, below the effective length', () => {
    const json = { data: [{ id: 'm', context_length: 20000, max_context_length: 32768 }] };
    expect(parseContextLength(json, 'm')).toBe(20000);
    expect(parseContextLength({ data: [{ id: 'm', max_context_length: 32768 }] }, 'm')).toBe(32768);
  });

  it('reads vLLM / Aphrodite max_model_len', () => {
    const json = { data: [{ id: 'default', object: 'model', owned_by: 'aphrodite', max_model_len: 10750 }] };
    expect(parseContextLength(json, 'default')).toBe(10750);
  });

  it('falls back to the first entry carrying a value when no id matches', () => {
    const json = { data: [{ id: 'x' }, { id: 'y', context_length: 8192 }] };
    expect(parseContextLength(json, 'default')).toBe(8192);
  });

  it('returns null when no entry reports a context length (plain OpenAI list)', () => {
    const json = { data: [{ id: 'gpt-4', object: 'model', owned_by: 'openai' }] };
    expect(parseContextLength(json, 'gpt-4')).toBeNull();
  });

  it('ignores non-positive or non-numeric values and malformed payloads', () => {
    expect(parseContextLength({ data: [{ id: 'm', context_length: 0 }] }, 'm')).toBeNull();
    expect(parseContextLength({ data: [{ id: 'm', context_length: 'big' }] }, 'm')).toBeNull();
    expect(parseContextLength({}, 'm')).toBeNull();
    expect(parseContextLength(null, 'm')).toBeNull();
  });
});

// llama-server's `/v1/models` entry: the context values sit under `meta`.
const llamaModels = (meta: Record<string, number>) => ({
  object: 'list',
  data: [{ id: 'gemma.gguf', object: 'model', owned_by: 'llamacpp', meta: { n_vocab: 262144, ...meta } }],
});

describe('llama.cpp context length', () => {
  it('reads the per-slot meta.n_ctx from the model list', () => {
    expect(parseContextLength(llamaModels({ n_ctx: 16384, n_ctx_train: 131072 }), 'anything')).toBe(16384);
  });

  it('never reads meta.n_ctx_train, the training max', () => {
    expect(parseContextLength(llamaModels({ n_ctx_train: 131072 }), 'gemma.gguf')).toBeNull();
  });

  it('reads default_generation_settings.n_ctx from /props', () => {
    expect(parsePropsContextLength({ default_generation_settings: { n_ctx: 8192, params: {} } })).toBe(8192);
    expect(parsePropsContextLength({ error: { message: 'Unexpected endpoint' } })).toBeNull();
    expect(parsePropsContextLength(null)).toBeNull();
  });
});

describe('fetchContextLength', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    resetProbeMemo();
  });

  function stubServer(routes: Record<string, unknown>): string[] {
    const asked: string[] = [];
    vi.stubGlobal('fetch', vi.fn((url: string) => {
      asked.push(url);
      const body = routes[url];
      return Promise.resolve(body === undefined
        ? new Response('not found', { status: 404 })
        : new Response(JSON.stringify(body), { status: 200 }));
    }));
    return asked;
  }

  it('reads a llama-server model list', async () => {
    stubServer({ 'http://localhost:8080/v1/models': llamaModels({ n_ctx: 16384, n_ctx_train: 131072 }) });
    expect(await fetchContextLength('http://localhost:8080/v1/chat/completions', '', 'local')).toBe(16384);
  });

  it('falls back to /props when the model list has no meta.n_ctx', async () => {
    const asked = stubServer({
      'http://localhost:8080/v1/models': llamaModels({ n_ctx_train: 131072 }),
      'http://localhost:8080/props': { default_generation_settings: { n_ctx: 4096 } },
    });
    expect(await fetchContextLength('http://localhost:8080/v1/chat/completions', '', 'local')).toBe(4096);
    expect(asked.at(-1)).toBe('http://localhost:8080/props');
  });

  it('skips /props once the model list answers', async () => {
    const asked = stubServer({ 'https://example.test/v1/models': { data: [{ id: 'm', max_model_len: 10750 }] } });
    expect(await fetchContextLength('https://example.test/v1/chat/completions', '', 'm')).toBe(10750);
    expect(asked).not.toContain('https://example.test/props');
  });
});

describe('detectedContextCodec', () => {
  it('round-trips an entry and reads an empty string as nothing detected', () => {
    const entry = { sig: 'http://localhost:8080/v1/chat/completions|local', tokens: 16384 };
    expect(detectedContextCodec.parse(detectedContextCodec.serialize(entry))).toEqual(entry);
    expect(detectedContextCodec.parse(detectedContextCodec.serialize(null))).toBeNull();
  });

  it('rejects a bare number, which carries no endpoint', () => {
    expect(() => detectedContextCodec.parse('32768')).toThrow();
    expect(() => detectedContextCodec.parse('{"sig":"a|b","tokens":0}')).toThrow();
  });
});
