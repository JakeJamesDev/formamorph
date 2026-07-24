import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';

describe('embedding vector store (IndexedDB)', () => {
  // Reset modules + global IndexedDB per test so the module's cached connection starts clean.
  let cache: typeof import('./embeddingCache');
  beforeEach(async () => {
    vi.resetModules();
    vi.stubGlobal('indexedDB', new IDBFactory());
    cache = await import('./embeddingCache');
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  const vec = (...vals: number[]) => new Float32Array(vals);

  it('omits missing keys from a batch read', async () => {
    expect((await cache.getVectors(['missing'])).size).toBe(0);
    expect((await cache.getVectors([])).size).toBe(0);
  });

  it('round-trips vector values exactly', async () => {
    await cache.putVector('k1', vec(0.25, -1, 0.5));
    const out = await cache.getVectors(['k1']);
    expect(Array.from(out.get('k1')!)).toEqual([0.25, -1, 0.5]);
  });

  it('stores a subarray view faithfully, not its whole backing buffer', async () => {
    const backing = vec(9, 1, 2, 9);
    await cache.putVector('view', backing.subarray(1, 3));
    expect(Array.from((await cache.getVectors(['view'])).get('view')!)).toEqual([1, 2]);
  });

  it('batch-reads only the found subset', async () => {
    await cache.putVector('a', vec(1));
    await cache.putVector('c', vec(3));
    const out = await cache.getVectors(['a', 'b', 'c']);
    expect([...out.keys()].sort()).toEqual(['a', 'c']);
  });

  it('evicts the least-recently cached vectors beyond the cap', async () => {
    let now = 0;
    vi.spyOn(Date, 'now').mockImplementation(() => now);
    now = 1; await cache.putVector('old', vec(1));
    now = 2; await cache.putVector('new', vec(2));
    await cache.pruneVectors(1);
    const out = await cache.getVectors(['old', 'new']);
    expect(out.has('old')).toBe(false);
    expect(out.has('new')).toBe(true);
  });
});
