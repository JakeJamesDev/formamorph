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

  describe('the batched read', () => {
    it('answers every stored record for a list of names', async () => {
      await cache.putThumb('a', blob(), 10);
      await cache.putThumb('b', blob(), 20);

      const records = await cache.getThumbs(['a', 'b']);

      expect(records.map((r) => r.file).sort()).toEqual(['a', 'b']);
      expect(records.find((r) => r.file === 'b')!.updatedAt).toBe(20);
    });

    it('omits the names with nothing stored rather than answering holes', async () => {
      await cache.putThumb('a', blob(), 10);

      const records = await cache.getThumbs(['a', 'never-seen']);

      expect(records.map((r) => r.file)).toEqual(['a']);
    });

    it('reads nothing at all for an empty list', async () => {
      const open = vi.spyOn(indexedDB, 'open');

      expect(await cache.getThumbs([])).toEqual([]);

      expect(open).not.toHaveBeenCalled();
    });
  });
});

describe('the session store', () => {
  let cache: typeof import('./thumbnailCache');
  let revoked: string[];
  beforeEach(async () => {
    vi.resetModules();
    vi.stubGlobal('indexedDB', new IDBFactory());
    revoked = [];
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation((url: string) => { revoked.push(url); });
    cache = await import('./thumbnailCache');
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  const blob = () => new Blob(['img'], { type: 'image/png' });

  it('answers a remembered url without touching the database', async () => {
    const url = cache.rememberThumb('a', blob(), 10);
    expect(cache.peekThumb('a', 10)).toBe(url);
  });

  it('answers nothing for a name it has never seen', () => {
    expect(cache.peekThumb('never-seen', 10)).toBeNull();
  });

  it('answers nothing once the listing is newer than what it holds', () => {
    cache.rememberThumb('a', blob(), 10);
    expect(cache.peekThumb('a', 20)).toBeNull();
  });

  it('revokes the url it replaces, so a re-upload leaves no stale picture behind', () => {
    const old = cache.rememberThumb('a', blob(), 10);
    const fresh = cache.rememberThumb('a', blob(), 20);

    expect(revoked).toEqual([old]);
    expect(cache.peekThumb('a', 20)).toBe(fresh);
  });

  it('evicts and revokes the coldest entry past the cap', () => {
    const first = cache.rememberThumb('file-0', blob(), 1);
    for (let i = 1; i < cache.MAX_SESSION_ENTRIES; i += 1) cache.rememberThumb(`file-${i}`, blob(), 1);
    expect(cache.peekThumb('file-0', 1)).toBe(first); // still held at exactly the cap

    cache.rememberThumb('one-too-many', blob(), 1);

    expect(cache.peekThumb('file-0', 1)).toBeNull();
    expect(revoked).toEqual([first]);
    expect(cache.peekThumb('file-1', 1)).not.toBeNull();
  });

  it('spares an entry that was looked at, evicting the one nobody asked for', () => {
    for (let i = 0; i < cache.MAX_SESSION_ENTRIES; i += 1) cache.rememberThumb(`file-${i}`, blob(), 1);

    cache.touchThumb('file-0'); // looked at again, so file-1 is now the coldest
    cache.rememberThumb('one-too-many', blob(), 1);

    expect(cache.peekThumb('file-0', 1)).not.toBeNull();
    expect(cache.peekThumb('file-1', 1)).toBeNull();
  });

  it('forgets and revokes everything when the thumbnail cache is emptied', async () => {
    const url = cache.rememberThumb('a', blob(), 10);

    await cache.clearThumbs();

    expect(cache.peekThumb('a', 10)).toBeNull();
    expect(revoked).toEqual([url]);
  });

  describe('preloading a page', () => {
    it('remembers every stored thumbnail in the list', async () => {
      await cache.putThumb('a', blob(), 10);
      await cache.putThumb('b', blob(), 10);

      await cache.preloadThumbs([{ file: 'a', updatedAt: 10 }, { file: 'b', updatedAt: 10 }]);

      expect(cache.peekThumb('a', 10)).not.toBeNull();
      expect(cache.peekThumb('b', 10)).not.toBeNull();
    });

    it('leaves a name with nothing stored unremembered, for the card to fetch', async () => {
      await cache.preloadThumbs([{ file: 'never-uploaded', updatedAt: 10 }]);

      expect(cache.peekThumb('never-uploaded', 10)).toBeNull();
    });

    it('skips a stored copy older than the listing, so a re-upload is not shown stale', async () => {
      await cache.putThumb('a', blob(), 10);

      await cache.preloadThumbs([{ file: 'a', updatedAt: 20 }]);

      expect(cache.peekThumb('a', 20)).toBeNull();
    });

    it('reads nothing when the page is already remembered', async () => {
      await cache.putThumb('a', blob(), 10);
      await cache.preloadThumbs([{ file: 'a', updatedAt: 10 }]);
      const open = vi.spyOn(indexedDB, 'open');

      await cache.preloadThumbs([{ file: 'a', updatedAt: 10 }]);

      expect(open).not.toHaveBeenCalled();
    });

    it('reports the read it has in flight, so a card can wait on it instead of opening its own', async () => {
      await cache.putThumb('a', blob(), 10);

      const batch = cache.preloadThumbs([{ file: 'a', updatedAt: 10 }]);
      expect(cache.pendingThumb('a')).toBeDefined();

      await batch;
      expect(cache.pendingThumb('a')).toBeUndefined();
    });
  });
});
