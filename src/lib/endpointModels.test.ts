import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  cleanModelId, loadEndpointModels, modelIdsFromBody, resetEndpointModelCache, suggestedModelNames,
} from './endpointModels';
import { resetProbeMemo } from './probeMemo';

describe('modelIdsFromBody', () => {
  it('reads the OpenAI shape', () => {
    expect(modelIdsFromBody({ object: 'list', data: [{ id: 'a' }, { id: 'b' }] })).toEqual(['a', 'b']);
  });

  it('reads the LM Studio native shape', () => {
    expect(modelIdsFromBody({ models: [{ type: 'llm', key: 'a' }, { type: 'vlm', key: 'b' }] })).toEqual(['a', 'b']);
  });

  it('drops rows the server types as embedding models', () => {
    expect(modelIdsFromBody({ data: [{ id: 'a', type: 'llm' }, { id: 'nomic', type: 'embeddings' }] })).toEqual(['a']);
    expect(modelIdsFromBody({ models: [{ key: 'a', type: 'llm' }, { key: 'nomic', type: 'embedding' }] })).toEqual(['a']);
  });

  it.each([
    ['null', null],
    ['a string', 'models'],
    ['an object without a list', { error: 'nope' }],
    ['a list of non-objects', { data: ['a', 3, null] }],
    ['rows without a string id', { data: [{ id: 7 }, { name: 'x' }] }],
  ])('gives an empty list for %s', (_label, body) => {
    expect(modelIdsFromBody(body)).toEqual([]);
  });
});

describe('cleanModelId', () => {
  it.each([
    ['Cydonia-24B-v4.3-Q4_K_M.gguf', 'Cydonia-24B-v4.3'],
    ['model.safetensors', 'model'],
    ['impish_llama_4b_gguf', 'impish_llama_4b'],
    ['Cydonia-24B-v4.1-GGUF', 'Cydonia-24B-v4.1'],
    ['cydonia-24b-v4.3@q4_k_m', 'cydonia-24b-v4.3'],
    ['cydonia:24b-q5_K_S', 'cydonia:24b'],
    ['Mistral-Small.IQ4_XS.gguf', 'Mistral-Small'],
    ['gemma-3-12b-it-q8_0', 'gemma-3-12b-it'],
    ['qwen3-8b-bf16', 'qwen3-8b'],
    ['llama-3-8b-f16', 'llama-3-8b'],
    ['qwen3-8b-fp16', 'qwen3-8b'],
  ])('cleans %s to %s', (raw, clean) => {
    expect(cleanModelId(raw)).toBe(clean);
  });

  it.each([
    'g4-meromero-31b',
    'org/model-name',
    'llama-3.1-8b-stheno-v3.4',
    'gpt-4o',
    'q4',
  ])('leaves %s alone', (id) => {
    expect(cleanModelId(id)).toBe(id);
  });
});

describe('suggestedModelNames', () => {
  it('cleans and de-duplicates, keeping the first spelling', () => {
    const body = { data: [
      { id: 'cydonia-24b-v4.3@q4_k_m' },
      { id: 'cydonia-24b-v4.3@q6_k' },
      { id: 'Cydonia-24B-v4.3' },
      { id: 'g4-meromero-31b' },
    ] };
    expect(suggestedModelNames(body)).toEqual(['cydonia-24b-v4.3', 'g4-meromero-31b']);
  });

  it('gives an empty list for a malformed body', () => {
    expect(suggestedModelNames({ data: 'x' })).toEqual([]);
  });
});

describe('loadEndpointModels', () => {
  beforeEach(() => {
    resetEndpointModelCache();
    resetProbeMemo();
  });

  const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });

  it('fetches once per endpoint per session', async () => {
    const doFetch = vi.fn(async (url: string) =>
      url.includes('/api/v0/') ? new Response('', { status: 404 }) : ok({ data: [{ id: 'm@q4_k_m' }] }));
    const target = { url: 'http://localhost:1234/v1/chat/completions', token: '' };

    expect(await loadEndpointModels(target, { doFetch })).toEqual(['m']);
    expect(await loadEndpointModels(target, { doFetch })).toEqual(['m']);
    const calls = doFetch.mock.calls.length;
    expect(calls).toBe(2); // the LM Studio list 404s once, then the OpenAI list answers

    await loadEndpointModels({ url: 'http://localhost:11434/v1/chat/completions', token: '' }, { doFetch });
    expect(doFetch.mock.calls.length).toBe(calls + 2);
  });

  it('shares one request between concurrent callers', async () => {
    const doFetch = vi.fn(async () => ok({ data: [{ id: 'a' }] }));
    const target = { url: 'http://localhost:1234/v1/chat/completions', token: '' };
    await Promise.all([loadEndpointModels(target, { doFetch }), loadEndpointModels(target, { doFetch })]);
    expect(doFetch).toHaveBeenCalledTimes(1);
  });

  it('uses the LM Studio list when it answers', async () => {
    const doFetch = vi.fn(async () => ok({ data: [{ id: 'a', type: 'llm' }, { id: 'e', type: 'embeddings' }] }));
    expect(await loadEndpointModels({ url: 'http://localhost:1234/v1/chat/completions', token: 't' }, { doFetch })).toEqual(['a']);
    expect(doFetch).toHaveBeenCalledWith('http://localhost:1234/api/v0/models', { headers: { Authorization: 'Bearer t' } });
  });

  it('gives an empty list when the endpoint is unreachable', async () => {
    const doFetch = vi.fn(async () => { throw new TypeError('Failed to fetch'); });
    expect(await loadEndpointModels({ url: 'http://localhost:9/v1/chat/completions', token: '' }, { doFetch })).toEqual([]);
  });

  it('asks again after a failure, so a server started later is found', async () => {
    const target = { url: 'http://localhost:1234/v1/chat/completions', token: '' };
    const down = vi.fn(async () => { throw new TypeError('Failed to fetch'); });
    expect(await loadEndpointModels(target, { doFetch: down })).toEqual([]);
    const up = vi.fn(async () => ok({ data: [{ id: 'a' }] }));
    expect(await loadEndpointModels(target, { doFetch: up })).toEqual(['a']);
  });

  it('gives an empty list for an invalid endpoint URL without fetching', async () => {
    const doFetch = vi.fn();
    expect(await loadEndpointModels({ url: 'not a url', token: '' }, { doFetch })).toEqual([]);
    expect(doFetch).not.toHaveBeenCalled();
  });

  it('reads the desktop engine list instead of fetching', async () => {
    const doFetch = vi.fn();
    const listEngine = vi.fn(async () => ['Cydonia-24B-v4.3-Q4_K_M.gguf', 'Cydonia-24B-v4.3-Q6_K.gguf']);
    const target = { url: 'http://localhost:8977/v1/chat/completions', token: '', localEngine: true };
    expect(await loadEndpointModels(target, { doFetch, listEngine })).toEqual(['Cydonia-24B-v4.3']);
    await loadEndpointModels(target, { doFetch, listEngine });
    expect(listEngine).toHaveBeenCalledTimes(1);
    expect(doFetch).not.toHaveBeenCalled();
  });

  it('gives an empty list when the engine list fails', async () => {
    const listEngine = vi.fn(async () => { throw new Error('no bridge'); });
    expect(await loadEndpointModels({ url: 'x', token: '', localEngine: true }, { doFetch: vi.fn(), listEngine })).toEqual([]);
  });
});
