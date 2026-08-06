import { describe, it, expect, vi, beforeEach } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';

// A real (in-memory) IndexedDB rather than a stubbed store: warming is mostly about what does and doesn't
// get written, which a mocked store would assert against itself instead of against the code. The module
// holds one shared connection, so the store is set up once and each test uses its own URLs.
globalThis.indexedDB = new IDBFactory();
const { warmCachedImages, getCachedImage } = await import('./remoteImageCache');

const okFetch = () => vi.fn(async () => ({ ok: true, blob: async () => new Blob(['x']) }));

beforeEach(() => { vi.unstubAllGlobals(); });

describe('warmCachedImages', () => {
  it('downloads and stores every image it does not already have', async () => {
    vi.stubGlobal('fetch', okFetch());

    const result = await warmCachedImages(['https://h/a1.png', 'https://h/a2.png']);

    expect(result).toEqual({ cached: 2, failed: 0 });
    expect(await getCachedImage('https://h/a1.png')).not.toBeNull();
  });

  it('skips what it already has, so running it twice is cheap', async () => {
    const fetchSpy = okFetch();
    vi.stubGlobal('fetch', fetchSpy);
    await warmCachedImages(['https://h/b1.png']);
    fetchSpy.mockClear();

    const result = await warmCachedImages(['https://h/b1.png']);

    expect(result).toEqual({ cached: 1, failed: 0 });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('counts a host that refuses as failed and keeps going', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url.includes('blocked')) throw new TypeError('Failed to fetch');
      return { ok: true, blob: async () => new Blob(['x']) };
    }));

    const result = await warmCachedImages([
      'https://blocked/c1.png', 'https://ok/c2.png', 'https://blocked/c3.png',
    ]);

    // The reachable image is still saved — one refusing host must not abandon the world.
    expect(result).toEqual({ cached: 1, failed: 2 });
    expect(await getCachedImage('https://ok/c2.png')).not.toBeNull();
    expect(await getCachedImage('https://blocked/c1.png')).toBeNull();
  });

  it('treats a non-2xx as a failure rather than caching an error page', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 404, blob: async () => new Blob([]) })));

    expect(await warmCachedImages(['https://h/gone.png'])).toEqual({ cached: 0, failed: 1 });
    expect(await getCachedImage('https://h/gone.png')).toBeNull();
  });

  it('reports progress once per image', async () => {
    vi.stubGlobal('fetch', okFetch());
    const seen: string[] = [];

    await warmCachedImages(['https://h/e1.png', 'https://h/e2.png'], (d, t) => seen.push(`${d}/${t}`));

    expect(seen).toEqual(['0/2', '1/2', '2/2']);
  });

  it('stops when canceled', async () => {
    const fetchSpy = okFetch();
    vi.stubGlobal('fetch', fetchSpy);
    const controller = new AbortController();
    controller.abort();

    await expect(warmCachedImages(['https://h/f1.png'], undefined, controller.signal)).rejects.toThrow(/canceled/i);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
