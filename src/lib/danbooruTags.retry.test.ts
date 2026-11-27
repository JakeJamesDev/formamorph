import { describe, it, expect, vi } from 'vitest';

let fetches = 0;
vi.mock('@/data/danbooruTags.json', () => {
  fetches += 1;
  if (fetches === 1) throw new TypeError('Failed to fetch dynamically imported module');
  return { default: ['solo'] };
});

describe('loadDanbooruTags after a failed fetch', () => {
  it('fetches again on the next use instead of keeping the failure', async () => {
    const { loadDanbooruTags } = await import('./danbooruTags');
    await expect(loadDanbooruTags()).rejects.toThrow();
    expect(await loadDanbooruTags()).toEqual(['solo']);
  });
});
