import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EMBEDDING_MODEL_FILES, embeddingCacheKey } from './embeddingWorkerClient';

/** A worker that answers every request with success, as the real one does once the model is loaded. */
class FakeWorker {
  static made: FakeWorker[] = [];
  posted: { cmd: string; id: string }[] = [];
  private listeners: ((event: { data: unknown }) => void)[] = [];
  constructor() { FakeWorker.made.push(this); }
  addEventListener(type: string, listener: (event: { data: unknown }) => void) {
    if (type === 'message') this.listeners.push(listener);
  }
  postMessage(message: { cmd: string; id: string }) {
    this.posted.push(message);
    queueMicrotask(() => this.listeners.forEach((listener) => listener({ data: { type: 'success', id: message.id, result: true } })));
  }
  terminate() {}
}

/** The browser's cache storage, holding these keys in the transformers.js cache. */
function stubCaches(held: readonly string[]) {
  const open = vi.fn(async (_name: string) => ({ match: async (key: string) => (held.includes(key) ? new Response('file') : undefined) }));
  vi.stubGlobal('caches', { open });
  return open;
}

const ALL_FILES = EMBEDDING_MODEL_FILES.map(embeddingCacheKey);

/** The client with fresh module state: no worker, no loaded model. */
const freshClient = () => import('./embeddingWorkerClient');

beforeEach(() => {
  vi.resetModules();
  FakeWorker.made = [];
  vi.stubGlobal('Worker', FakeWorker);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('openCachedEmbeddingModel', () => {
  it('opens the model from the browser cache when every file is there', async () => {
    const open = stubCaches(ALL_FILES);
    const client = await freshClient();

    expect(await client.openCachedEmbeddingModel()).toBe(true);
    expect(open).toHaveBeenCalledWith('transformers-cache');
    expect(FakeWorker.made).toHaveLength(1);
    expect(FakeWorker.made[0].posted.map((message) => message.cmd)).toEqual(['load']);
    expect(client.isEmbeddingModelReady()).toBe(true);
  });

  it.each(ALL_FILES)('starts no worker, so no download, when the cache lacks %s', async (missing) => {
    stubCaches(ALL_FILES.filter((key) => key !== missing));
    const client = await freshClient();

    expect(await client.openCachedEmbeddingModel()).toBe(false);
    expect(FakeWorker.made).toHaveLength(0);
    expect(client.isEmbeddingModelReady()).toBe(false);
  });

  it('starts no worker where the browser has no cache storage', async () => {
    const client = await freshClient();
    expect(typeof caches).toBe('undefined');
    expect(await client.openCachedEmbeddingModel()).toBe(false);
    expect(FakeWorker.made).toHaveLength(0);
  });

  it('starts no worker when the cache storage refuses to open', async () => {
    vi.stubGlobal('caches', { open: async () => { throw new DOMException('denied', 'SecurityError'); } });
    const client = await freshClient();
    expect(await client.openCachedEmbeddingModel()).toBe(false);
    expect(FakeWorker.made).toHaveLength(0);
  });

  it('does not read the cache again once the model is loaded', async () => {
    const open = stubCaches(ALL_FILES);
    const client = await freshClient();
    await client.openCachedEmbeddingModel();
    expect(await client.openCachedEmbeddingModel()).toBe(true);
    expect(open).toHaveBeenCalledTimes(1);
    expect(FakeWorker.made[0].posted).toHaveLength(1);
  });
});
