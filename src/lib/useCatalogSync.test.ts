import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useCatalogSync } from './useCatalogSync';
import { acceptAgeGate } from './ageGate';

vi.mock('react-toastify', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));
vi.mock('@/lib/featureFlags', () => ({ COMMUNITY_ENABLED: true }));

const cache = vi.hoisted(() => ({
  items: [] as Record<string, unknown>[],
  tag: null as { tag: string; reader: string } | null,
  replace: null as null | ReturnType<typeof vi.fn>,
}));
vi.mock('@/lib/worldCatalog', () => ({
  getCatalog: async () => cache.items,
  getCatalogTag: async () => cache.tag,
  replaceCatalog: (...args: unknown[]) => { cache.replace?.(...args); return Promise.resolve(); },
}));

/** The signed-in reader, so the tag's owner is the test's to choose. */
const auth = vi.hoisted(() => ({ user: null as { id: string } | null }));
vi.mock('@/services/AuthService', () => ({
  default: {
    get currentUser() { return auth.user; },
    isAuthenticated: () => auth.user !== null,
  },
}));

/** The server fetch, resolvable by hand so the settling moment is the test's to pick. */
const server = vi.hoisted(() => ({
  resolve: null as null | ((result: unknown) => void),
  sentTag: undefined as string | null | undefined,
  calls: 0,
}));
vi.mock('@/services/WorldStorageService', () => ({
  default: {
    fetchCatalog: (tag?: string | null) => {
      server.calls += 1;
      server.sentTag = tag;
      return new Promise((res) => { server.resolve = res; });
    },
  },
}));

beforeEach(() => {
  cache.items = [];
  cache.tag = null;
  cache.replace = vi.fn();
  auth.user = null;
  server.resolve = null;
  server.sentTag = undefined;
  server.calls = 0;
  // The catalog is a listing of what other players published, so the hook waits on the age attestation.
  // Every case below is about what happens after that, so they arrive holding one.
  localStorage.clear();
  acceptAgeGate();
});

afterEach(() => {
  vi.restoreAllMocks();
});

const world = { id: 'w1', name: 'Sedge Landing' };

describe('catalogSettled', () => {
  it('stays false while the refresh is in flight, even with a cached snapshot showing', async () => {
    cache.items = [world];
    const { result } = renderHook(() => useCatalogSync(true));

    // The cached copy renders first — the exact window where a lookup miss must not be trusted.
    await waitFor(() => expect(result.current.remoteWorlds).toEqual([world]));

    expect(result.current.catalogSettled).toBe(false);
  });

  it('settles once the refresh lands', async () => {
    const { result } = renderHook(() => useCatalogSync(true));
    await waitFor(() => expect(server.resolve).not.toBeNull());

    await act(async () => server.resolve?.({ status: 'fresh', data: [world], tag: null }));

    expect(result.current.catalogSettled).toBe(true);
    expect(result.current.remoteWorlds).toEqual([world]);
  });

  it('settles on a failed refresh too, so a waiting request is not held forever', async () => {
    const { result } = renderHook(() => useCatalogSync(true));
    await waitFor(() => expect(server.resolve).not.toBeNull());

    await act(async () => server.resolve?.({ status: 'error', error: 'down' }));

    expect(result.current.catalogSettled).toBe(true);
  });

  it('settles on an unchanged refresh, which is an answer like any other', async () => {
    cache.items = [world];
    cache.tag = { tag: 'W/"abc"', reader: '' };
    const { result } = renderHook(() => useCatalogSync(true));
    await waitFor(() => expect(server.resolve).not.toBeNull());

    await act(async () => server.resolve?.({ status: 'unchanged' }));

    expect(result.current.catalogSettled).toBe(true);
  });

  it('unsettles on close, so the next open waits for its own refresh', async () => {
    const { result, rerender } = renderHook(({ open }) => useCatalogSync(open), {
      initialProps: { open: true },
    });
    await waitFor(() => expect(server.resolve).not.toBeNull());
    await act(async () => server.resolve?.({ status: 'fresh', data: [world], tag: null }));
    expect(result.current.catalogSettled).toBe(true);

    rerender({ open: false });

    expect(result.current.catalogSettled).toBe(false);
  });
});

describe('the freshness tag', () => {
  it('sends the tag stored beside a cached catalog', async () => {
    cache.items = [world];
    cache.tag = { tag: 'W/"abc"', reader: '' };

    renderHook(() => useCatalogSync(true));

    await waitFor(() => expect(server.calls).toBe(1));
    expect(server.sentTag).toBe('W/"abc"');
  });

  it('keeps the rendered rows and writes nothing when the server says nothing changed', async () => {
    cache.items = [world];
    cache.tag = { tag: 'W/"abc"', reader: '' };
    const { result } = renderHook(() => useCatalogSync(true));
    await waitFor(() => expect(server.resolve).not.toBeNull());

    await act(async () => server.resolve?.({ status: 'unchanged' }));

    expect(result.current.remoteWorlds).toEqual([world]);
    expect(cache.replace).not.toHaveBeenCalled();
  });

  it('replaces rows and tag together when the server answers fresh', async () => {
    cache.items = [world];
    cache.tag = { tag: 'W/"old"', reader: '' };
    const fresh = { id: 'w2', name: 'Somewhere newer' };
    renderHook(() => useCatalogSync(true));
    await waitFor(() => expect(server.resolve).not.toBeNull());

    await act(async () => server.resolve?.({ status: 'fresh', data: [fresh], tag: 'W/"new"' }));

    expect(cache.replace).toHaveBeenCalledWith([fresh], { tag: 'W/"new"', reader: '' });
  });

  it('stores no tag when the server answers none, so an older server behaves as it always did', async () => {
    renderHook(() => useCatalogSync(true));
    await waitFor(() => expect(server.resolve).not.toBeNull());

    await act(async () => server.resolve?.({ status: 'fresh', data: [world], tag: null }));

    expect(cache.replace).toHaveBeenCalledWith([world], null);
  });

  it('sends no tag when the cached catalog has none', async () => {
    cache.items = [world];
    cache.tag = null;

    renderHook(() => useCatalogSync(true));

    await waitFor(() => expect(server.calls).toBe(1));
    expect(server.sentTag).toBeNull();
  });

  it('sends no tag when nothing is cached, since there is no copy for one to describe', async () => {
    cache.tag = { tag: 'W/"orphan"', reader: '' };

    renderHook(() => useCatalogSync(true));

    await waitFor(() => expect(server.calls).toBe(1));
    expect(server.sentTag).toBeNull();
  });

  it('drops another reader\'s tag, so signing out never asks with the signed-in catalog\'s tag', async () => {
    cache.items = [world];
    cache.tag = { tag: 'W/"signed-in"', reader: '42' };
    auth.user = null; // signed out since that tag was stored

    renderHook(() => useCatalogSync(true));

    await waitFor(() => expect(server.calls).toBe(1));
    expect(server.sentTag).toBeNull();
  });

  it('sends the tag back to the reader it was stored for', async () => {
    cache.items = [world];
    cache.tag = { tag: 'W/"mine"', reader: '42' };
    auth.user = { id: '42' };

    renderHook(() => useCatalogSync(true));

    await waitFor(() => expect(server.calls).toBe(1));
    expect(server.sentTag).toBe('W/"mine"');
  });

  it('sends no tag on a forced refresh, which asks for the list again on purpose', async () => {
    cache.items = [world];
    cache.tag = { tag: 'W/"abc"', reader: '' };
    const { result } = renderHook(() => useCatalogSync(false));

    await act(async () => { void result.current.loadCatalog(true); });

    await waitFor(() => expect(server.calls).toBe(1));
    expect(server.sentTag).toBeNull();
  });
});

describe('the age gate', () => {
  it('asks the server for nothing until the player has attested', async () => {
    localStorage.clear();

    const { result } = renderHook(() => useCatalogSync(true));

    await waitFor(() => expect(result.current.isSyncingCatalog).toBe(false));
    expect(server.resolve).toBeNull();
    expect(result.current.remoteWorlds).toEqual([]);
  });

  it('syncs on the next open once they have', async () => {
    localStorage.clear();
    const { rerender } = renderHook(({ open }) => useCatalogSync(open), { initialProps: { open: true } });
    expect(server.resolve).toBeNull();

    acceptAgeGate();
    rerender({ open: false });
    rerender({ open: true });

    await waitFor(() => expect(server.resolve).not.toBeNull());
  });
});
