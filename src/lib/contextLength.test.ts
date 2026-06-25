import { describe, it, expect } from 'vitest';
import { deriveModelsUrls, parseContextLength } from './contextLength';

describe('deriveModelsUrls', () => {
  it('swaps /chat/completions for /models and derives the LM Studio path', () => {
    expect(deriveModelsUrls('https://api.lyonade.net/v1/chat/completions')).toEqual({
      openai: 'https://api.lyonade.net/v1/models',
      lmstudio: 'https://api.lyonade.net/api/v0/models',
    });
  });

  it('handles a localhost endpoint', () => {
    expect(deriveModelsUrls('http://localhost:1234/v1/chat/completions')).toEqual({
      openai: 'http://localhost:1234/v1/models',
      lmstudio: 'http://localhost:1234/api/v0/models',
    });
  });

  it('falls back to {origin}/v1/models when the suffix is unexpected', () => {
    expect(deriveModelsUrls('https://example.com/custom')).toEqual({
      openai: 'https://example.com/v1/models',
      lmstudio: 'https://example.com/api/v0/models',
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
