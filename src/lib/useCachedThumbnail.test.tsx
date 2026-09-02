import { render, renderHook, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';

/**
 * What the reader feels is when the picture appears, so every case here watches the src the hook
 * answers with and counts what it cost — reads of the blob store, and requests to the server.
 */

// Both modules hold state for the life of the tab by design, so each case starts by emptying it
// rather than by re-importing: a fresh module instance would not be the one the hook is bound to.
globalThis.indexedDB = new IDBFactory();

const counts = vi.hoisted(() => ({ disk: 0 }));
vi.mock('./thumbnailCache', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./thumbnailCache')>();
  return {
    ...actual,
    getThumb: (file: string) => { counts.disk += 1; return actual.getThumb(file); },
  };
});

const hook = await import('./useCachedThumbnail');
const cache = await import('./thumbnailCache');
let fetchSpy: ReturnType<typeof vi.fn>;
let revoked: string[];

const png = () => new Blob(['img'], { type: 'image/png' });
const URL_FOR = (file: string) => `https://server.test/thumbnails/${file}`;

beforeEach(async () => {
  await cache.clearThumbs();
  counts.disk = 0;
  revoked = [];
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation((url: string) => { revoked.push(url); });
  fetchSpy = vi.fn(async () => new Response(png(), { status: 200 }));
  vi.stubGlobal('fetch', fetchSpy);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

/** Mount the hook for one file and wait until it has resolved to something to show. */
const mountResolved = async (file: string, updatedAt: number) => {
  const view = renderHook(() => hook.useCachedThumbnail(file, URL_FOR(file), updatedAt));
  await waitFor(() => expect(view.result.current.src).not.toBe(''));
  return view;
};

describe('useCachedThumbnail', () => {
  it('reads the blob store on a first mount and shows what it finds', async () => {
    await cache.putThumb('a', png(), 10);

    const { result } = await mountResolved('a', 10);

    expect(counts.disk).toBe(1);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result.current.src).toMatch(/^blob:/);
  });

  it('answers on the first render of a second mount, with no read at all', async () => {
    await cache.putThumb('a', png(), 10);
    const first = await mountResolved('a', 10);
    const shown = first.result.current.src;
    first.unmount();
    counts.disk = 0;

    // No waitFor: the assertion is that the very first render already has the picture.
    const { result } = renderHook(() => hook.useCachedThumbnail('a', URL_FOR('a'), 10));

    expect(result.current.src).toBe(shown);
    expect(counts.disk).toBe(0);
  });

  it('reads again for a newer listing and revokes the picture it replaces', async () => {
    await cache.putThumb('a', png(), 10);
    const first = await mountResolved('a', 10);
    const stale = first.result.current.src;
    first.unmount();
    counts.disk = 0;

    // The same filename, re-uploaded: the server's copy is newer than the one in hand.
    const { result } = await mountResolved('a', 20);

    expect(counts.disk).toBe(1);
    expect(result.current.src).not.toBe(stale);
    expect(revoked).toContain(stale);
  });

  it('reads again for a name the session has evicted', async () => {
    await cache.putThumb('a', png(), 10);
    await mountResolved('a', 10);
    // Everything else the reader browsed since, pushing 'a' past the cap.
    for (let i = 0; i <= cache.MAX_SESSION_ENTRIES; i += 1) cache.rememberThumb(`other-${i}`, png(), 1);
    counts.disk = 0;

    await mountResolved('a', 10);

    expect(counts.disk).toBe(1);
  });

  it('fetches and stores once when the blob store has nothing', async () => {
    const { result } = await mountResolved('a', 10);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(result.current.src).toMatch(/^blob:/);
    const stored = await cache.getThumb('a');
    expect(stored!.updatedAt).toBe(10);
  });

  it('resolves to nothing when the fetch fails, so the card keeps its placeholder', async () => {
    fetchSpy.mockResolvedValue(new Response('', { status: 404 }));

    const { result } = renderHook(() => hook.useCachedThumbnail('a', URL_FOR('a'), 10));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.src).toBe('');
  });

  it('waits for a batch read already covering its file rather than opening its own', async () => {
    await cache.putThumb('a', png(), 10);
    void cache.preloadThumbs([{ file: 'a', updatedAt: 10 }]);
    counts.disk = 0;

    const { result } = await mountResolved('a', 10);

    expect(counts.disk).toBe(0);
    expect(result.current.src).toMatch(/^blob:/);
  });

  it('stops reporting a load once the file it was fetching is off the card', async () => {
    await cache.putThumb('b', png(), 10);
    let answer: (res: Response) => void = () => {};
    fetchSpy.mockImplementation(() => new Promise<Response>((res) => { answer = res; }));

    // 'a' has to be fetched; the card switches to 'b', which is already in hand, before it lands.
    const { result, rerender } = renderHook(
      ({ file }) => hook.useCachedThumbnail(file, URL_FOR(file), 10),
      { initialProps: { file: 'a' } },
    );
    await waitFor(() => expect(result.current.loading).toBe(true));
    await mountResolved('b', 10); // 'b' is now remembered, so the switch is a session hit
    rerender({ file: 'b' });

    expect(result.current.loading).toBe(false);
    answer(new Response(png(), { status: 200 }));
  });

  it('sets no state after an unmount mid-fetch', async () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    let answer: (res: Response) => void = () => {};
    fetchSpy.mockImplementation(() => new Promise<Response>((res) => { answer = res; }));

    const { unmount } = renderHook(() => hook.useCachedThumbnail('a', URL_FOR('a'), 10));
    await waitFor(() => expect(fetchSpy).toHaveBeenCalled());
    unmount();
    answer(new Response(png(), { status: 200 }));
    await new Promise((res) => setTimeout(res, 0));

    // React warns about updating an unmounted component; nothing reached the console.
    expect(errors).not.toHaveBeenCalled();
  });
});

describe('CachedThumbnail', () => {
  it('renders no image at all when nothing resolves', async () => {
    fetchSpy.mockResolvedValue(new Response('', { status: 404 }));

    render(<hook.CachedThumbnail file="a" url={URL_FOR('a')} updatedAt={10} alt="Sedge Landing" />);

    await waitFor(() => expect(fetchSpy).toHaveBeenCalled());
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('declares its intrinsic size and asynchronous decoding, so a grid of them does not shift', async () => {
    await cache.putThumb('a', png(), 10);

    render(<hook.CachedThumbnail file="a" url={URL_FOR('a')} updatedAt={10} alt="Sedge Landing" aspect="portrait" />);

    const img = await screen.findByRole('img');
    expect(img).toHaveAttribute('decoding', 'async');
    expect(img).toHaveAttribute('width', '480');
    expect(img).toHaveAttribute('height', '720');
  });
});

describe('useThumbnailPreload', () => {
  it('remembers the whole page, so its cards answer on their first render', async () => {
    await cache.putThumb('a', png(), 10);
    await cache.putThumb('b', png(), 10);

    const { result } = renderHook(() => {
      hook.useThumbnailPreload([{ file: 'a', updatedAt: 10 }, { file: 'b', updatedAt: 10 }]);
      return null;
    });
    expect(result.current).toBeNull();
    await waitFor(() => expect(cache.peekThumb('a', 10)).not.toBeNull());

    expect(cache.peekThumb('b', 10)).not.toBeNull();
    counts.disk = 0;
    const card = renderHook(() => hook.useCachedThumbnail('b', URL_FOR('b'), 10));
    expect(card.result.current.src).toMatch(/^blob:/);
    expect(counts.disk).toBe(0);
  });

  it('ignores listings with no thumbnail rather than reading for a blank name', async () => {
    const open = vi.spyOn(indexedDB, 'open');

    renderHook(() => hook.useThumbnailPreload([{ file: null, updatedAt: 10 }]));

    expect(open).not.toHaveBeenCalled();
  });
});
