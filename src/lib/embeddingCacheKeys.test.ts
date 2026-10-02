import { afterEach, describe, expect, it, vi } from 'vitest';
import { env, pipeline } from '@huggingface/transformers';
import { EMBEDDING_MODEL_FILES, embeddingCacheKey } from './embeddingWorkerClient';
import { EMBEDDING_MODEL_ID } from './memoryRelevance';

const saved = { useCustomCache: env.useCustomCache, customCache: env.customCache, useFSCache: env.useFSCache };

afterEach(() => {
  Object.assign(env, saved);
});

describe('the browser cache keys of the embedding model', () => {
  it('are the keys transformers.js asks its cache for when it loads the model', async () => {
    // The real loader runs against a cache that holds a stand-in config under this app's keys and nothing
    // else. `local_files_only` keeps it off the network, so the load stops at the weights file.
    const asked: string[] = [];
    const held = new Map([
      [embeddingCacheKey('config.json'), '{"model_type":"bert"}'],
      [embeddingCacheKey('tokenizer_config.json'), '{}'],
      [embeddingCacheKey('tokenizer.json'), '{}'],
    ]);
    env.useFSCache = false;
    env.useCustomCache = true;
    env.customCache = {
      match: async (key: string) => {
        asked.push(key);
        const text = held.get(key);
        return text === undefined ? undefined : new Response(text);
      },
      put: async () => {},
    };
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await expect(pipeline('feature-extraction', EMBEDDING_MODEL_ID, { dtype: 'q8', local_files_only: true })).rejects.toThrow();
    warn.mockRestore();

    const remote = [...new Set(asked.filter((key) => key.startsWith('https://')))].sort();
    expect(remote).toEqual(EMBEDDING_MODEL_FILES.map(embeddingCacheKey).sort());
  });
});
