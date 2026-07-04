import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Stub both shipped sources so the test doesn't depend on the real ~10k-tag JSON.
vi.mock('@/data/danbooruTags.json', () => ({ default: ['1girl', 'solo', 'long hair'] }));
vi.mock('@/data/danbooruTagsSfw.json', () => ({ default: [] }));

beforeEach(() => { vi.resetModules(); }); // the loader caches its promise at module scope
afterEach(() => { vi.unstubAllEnvs(); });

describe('loadDanbooruTags', () => {
  it('returns the full popularity-ordered list and memoizes the promise', async () => {
    const { loadDanbooruTags } = await import('./danbooruTags');
    const p1 = loadDanbooruTags();
    const p2 = loadDanbooruTags();
    expect(p1).toBe(p2); // same cached promise, one fetch
    expect(await p1).toEqual(['1girl', 'solo', 'long hair']);
  });

  it('loads the empty SFW source when VITE_SFW_TAGS is set', async () => {
    vi.stubEnv('VITE_SFW_TAGS', 'true');
    const { loadDanbooruTags } = await import('./danbooruTags');
    expect(await loadDanbooruTags()).toEqual([]);
  });
});
