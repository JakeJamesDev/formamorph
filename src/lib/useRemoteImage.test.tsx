import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

const getCachedImage = vi.fn();
const putCachedImage = vi.fn();
vi.mock('./remoteImageCache', () => ({
  getCachedImage: (...a: unknown[]) => getCachedImage(...a),
  putCachedImage: (...a: unknown[]) => putCachedImage(...a),
}));

const { useRemoteImage } = await import('./useRemoteImage');

const revokeObjectURL = vi.fn();

// Defined on the real URL rather than stubbed over the global: testing-library's auto-cleanup unmounts
// AFTER afterEach, and an unstubbed URL would leave the hook's revoke call throwing during teardown.
URL.createObjectURL = () => 'blob:cached';
URL.revokeObjectURL = revokeObjectURL;

beforeEach(() => {
  getCachedImage.mockReset().mockResolvedValue(null);
  putCachedImage.mockReset().mockResolvedValue(undefined);
  revokeObjectURL.mockReset();
});
afterEach(() => { vi.unstubAllGlobals(); });

describe('useRemoteImage', () => {
  it('passes an embedded value straight through without touching the cache', async () => {
    const { result } = renderHook(() => useRemoteImage('data:image/webp;base64,AAAA'));

    expect(result.current.src).toBe('data:image/webp;base64,AAAA');
    expect(getCachedImage).not.toHaveBeenCalled();
  });

  it('serves a cached copy when there is one', async () => {
    getCachedImage.mockResolvedValue({ url: 'https://host/a.png', blob: new Blob(['x']), bytes: 1, cachedAt: 1 });
    vi.stubGlobal('fetch', vi.fn());

    const { result } = renderHook(() => useRemoteImage('https://host/a.png'));

    await waitFor(() => expect(result.current.src).toBe('blob:cached'));
    expect(fetch).not.toHaveBeenCalled();
  });

  it('downloads and caches on a miss', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, blob: async () => new Blob(['x']) })));

    const { result } = renderHook(() => useRemoteImage('https://host/a.png'));

    await waitFor(() => expect(putCachedImage).toHaveBeenCalledWith('https://host/a.png', expect.anything()));
    expect(result.current.src).toBe('blob:cached');
  });

  it('renders the live link when caching is impossible, so a CORS-blocked host still shows', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch'); }));

    const { result } = renderHook(() => useRemoteImage('https://blocked.host/a.png'));

    // Set synchronously before the fetch is attempted, and left standing when it fails.
    expect(result.current.src).toBe('https://blocked.host/a.png');
    await waitFor(() => expect(putCachedImage).not.toHaveBeenCalled());
    expect(result.current.src).toBe('https://blocked.host/a.png');
  });

  it('revokes its object URL on unmount', async () => {
    getCachedImage.mockResolvedValue({ url: 'https://host/a.png', blob: new Blob(['x']), bytes: 1, cachedAt: 1 });
    vi.stubGlobal('fetch', vi.fn());

    const { result, unmount } = renderHook(() => useRemoteImage('https://host/a.png'));
    await waitFor(() => expect(result.current.src).toBe('blob:cached'));
    unmount();

    expect(revokeObjectURL).toHaveBeenCalledWith('blob:cached');
  });
});

// Both directions: a status that never reports 'unreadable' would pass a one-sided test trivially, and
// 'unreadable' is the whole signal the editor's warning badge reads.
describe('useRemoteImage status', () => {
  it('reports embedded for a value that carries its own bytes', () => {
    const { result } = renderHook(() => useRemoteImage('data:image/webp;base64,AAAA'));

    expect(result.current.status).toBe('embedded');
  });

  it('reports cached once the bytes are ours', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, blob: async () => new Blob(['x']) })));

    const { result } = renderHook(() => useRemoteImage('https://host/ok.png'));

    await waitFor(() => expect(result.current.status).toBe('cached'));
  });

  it('reports unreadable when the host refuses, while the picture still shows', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch'); }));

    const { result } = renderHook(() => useRemoteImage('https://blocked.host/a.png'));

    await waitFor(() => expect(result.current.status).toBe('unreadable'));
    expect(result.current.src).toBe('https://blocked.host/a.png');
  });

  it('reports unreadable on a non-2xx too, not just a thrown fetch', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 404, blob: async () => new Blob([]) })));

    const { result } = renderHook(() => useRemoteImage('https://host/gone.png'));

    await waitFor(() => expect(result.current.status).toBe('unreadable'));
  });
});
