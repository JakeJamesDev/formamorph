import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { toEpoch } from './thumbnailCache';

describe('toEpoch', () => {
  it('parses ISO 8601 (…T…Z) timestamps', () => {
    expect(toEpoch('2026-01-02T03:04:05Z')).toBe(Date.parse('2026-01-02T03:04:05Z'));
  });

  it('parses the server space-separated format identically to ISO', () => {
    expect(toEpoch('2026-01-02 03:04:05')).toBe(toEpoch('2026-01-02T03:04:05'));
  });

  it('returns 0 for null / undefined', () => {
    expect(toEpoch(null)).toBe(0);
    expect(toEpoch(undefined)).toBe(0);
  });

  it('returns 0 for an unparseable string', () => {
    expect(toEpoch('not a date')).toBe(0);
  });

  it('passes a numeric epoch through unchanged', () => {
    expect(toEpoch(1700000000000)).toBe(1700000000000);
    expect(toEpoch(0)).toBe(0);
    expect(toEpoch(NaN)).toBe(0);
  });
});

describe('thumbnail store (IndexedDB)', () => {
  // Reset modules + global IndexedDB per test so the module's cached connection starts clean.
  let cache: typeof import('./thumbnailCache');
  beforeEach(async () => {
    vi.resetModules();
    vi.stubGlobal('indexedDB', new IDBFactory());
    cache = await import('./thumbnailCache');
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  const blob = () => new Blob(['img'], { type: 'image/png' });

  it('returns null for a cache miss', async () => {
    expect(await cache.getThumb('missing')).toBeNull();
  });

  it('stores and reads back a thumbnail record', async () => {
    await cache.putThumb('file-1', blob(), 1700000000000);
    const rec = await cache.getThumb('file-1');
    expect(rec).not.toBeNull();
    expect(rec!.file).toBe('file-1');
    expect(rec!.updatedAt).toBe(1700000000000);
    // fake-indexeddb doesn't faithfully clone a jsdom Blob (round-trips as a plain object),
    // so assert the payload is stored rather than its instance type.
    expect(rec!.blob).toBeDefined();
  });

  it('overwrites an existing entry on re-put', async () => {
    await cache.putThumb('file-1', blob(), 1);
    await cache.putThumb('file-1', blob(), 2);
    expect((await cache.getThumb('file-1'))!.updatedAt).toBe(2);
  });

  it('pruneThumbs(0) clears all entries', async () => {
    await cache.putThumb('a', blob(), 1);
    await cache.putThumb('b', blob(), 1);
    await cache.pruneThumbs(0);
    expect(await cache.getThumb('a')).toBeNull();
    expect(await cache.getThumb('b')).toBeNull();
  });

  it('evicts the least-recently cached entries beyond the cap', async () => {
    let now = 0;
    vi.spyOn(Date, 'now').mockImplementation(() => now);
    now = 1; await cache.putThumb('a', blob(), 10);
    now = 2; await cache.putThumb('b', blob(), 10);
    now = 3; await cache.putThumb('c', blob(), 10);
    await cache.pruneThumbs(2);
    expect(await cache.getThumb('a')).toBeNull(); // oldest cachedAt -> evicted
    expect(await cache.getThumb('b')).not.toBeNull();
    expect(await cache.getThumb('c')).not.toBeNull();
  });
});
