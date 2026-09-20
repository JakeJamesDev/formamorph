import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useCatalogSync } from './useCatalogSync';
import { acceptAgeGate } from './ageGate';
import { installId } from './anonymousLikes';

/** Who a signed-out reader is: their Install, because their liked marks are addressed by it. */
const guest = () => `install:${installId()}`;

vi.mock('react-toastify', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));
vi.mock('@/lib/featureFlags', () => ({ COMMUNITY_ENABLED: true }));

const cache = vi.hoisted(() => ({
  items: [] as Record<string, unknown>[],
  tag: null as { tag: string; reader: string } | null,
  anonymousLikes: false,
  replace: null as null | ReturnType<typeof vi.fn>,
}));
vi.mock('@/lib/worldCatalog', () => ({
  getCatalog: async () => cache.items,
  getCatalogTag: async () => cache.tag,
  getCatalogAnonymousLikes: async () => cache.anonymousLikes,
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
  cache.anonymousLikes = false;
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

/** A Claim with nothing in the air and nothing moved, which is what most of these cases want. */
const idleClaim = {
  settled: () => Promise.resolve(),
  subscribe: () => () => {},
  moved: () => 0,
};

/** A Claim whose marks the test moves by hand, so the reader hears about it the way the real one would. */
const movingClaim = () => {
  const listeners = new Set<() => void>();
  let moves = 0;
  return {
    watch: {
      settled: () => Promise.resolve(),
      subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
      moved: () => moves,
    },
    move: () => { moves += 1; listeners.forEach((l) => l()); },
  };
};

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
    cache.tag = { tag: 'W/"abc"', reader: guest() };
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
    cache.tag = { tag: 'W/"abc"', reader: guest() };

    renderHook(() => useCatalogSync(true));

    await waitFor(() => expect(server.calls).toBe(1));
    expect(server.sentTag).toBe('W/"abc"');
  });

  it('keeps the rendered rows and writes nothing when the server says nothing changed', async () => {
    cache.items = [world];
    cache.tag = { tag: 'W/"abc"', reader: guest() };
    const { result } = renderHook(() => useCatalogSync(true));
    await waitFor(() => expect(server.resolve).not.toBeNull());

    await act(async () => server.resolve?.({ status: 'unchanged' }));

    expect(result.current.remoteWorlds).toEqual([world]);
    expect(cache.replace).not.toHaveBeenCalled();
  });

  it('replaces rows and tag together when the server answers fresh', async () => {
    cache.items = [world];
    cache.tag = { tag: 'W/"old"', reader: guest() };
    const fresh = { id: 'w2', name: 'Somewhere newer' };
    renderHook(() => useCatalogSync(true));
    await waitFor(() => expect(server.resolve).not.toBeNull());

    await act(async () => server.resolve?.({ status: 'fresh', data: [fresh], tag: 'W/"new"', anonymousLikes: false }));

    expect(cache.replace).toHaveBeenCalledWith([fresh], { tag: 'W/"new"', reader: guest() }, false);
  });

  it('stores no tag when the server answers none, so an older server behaves as it always did', async () => {
    renderHook(() => useCatalogSync(true));
    await waitFor(() => expect(server.resolve).not.toBeNull());

    await act(async () => server.resolve?.({ status: 'fresh', data: [world], tag: null, anonymousLikes: false }));

    expect(cache.replace).toHaveBeenCalledWith([world], null, false);
  });

  it('names the Install in a guest\'s tag, so two guests on one machine never share hearts', async () => {
    cache.items = [world];
    cache.tag = { tag: 'W/"other-install"', reader: 'install:11111111-2222-4333-8444-555555555555' };

    renderHook(() => useCatalogSync(true));

    await waitFor(() => expect(server.calls).toBe(1));
    expect(server.sentTag).toBeNull();
  });

  it('sends no tag when the cached catalog has none', async () => {
    cache.items = [world];
    cache.tag = null;

    renderHook(() => useCatalogSync(true));

    await waitFor(() => expect(server.calls).toBe(1));
    expect(server.sentTag).toBeNull();
  });

  it('sends no tag when nothing is cached, since there is no copy for one to describe', async () => {
    cache.tag = { tag: 'W/"orphan"', reader: guest() };

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
    cache.tag = { tag: 'W/"abc"', reader: guest() };
    const { result } = renderHook(() => useCatalogSync(false));

    await act(async () => { void result.current.loadCatalog(true); });

    await waitFor(() => expect(server.calls).toBe(1));
    expect(server.sentTag).toBeNull();
  });

  it('clears the previous reader\'s liked marks and force-refreshes when the account changes', async () => {
    const stale = { ...world, liked: true };
    cache.items = [stale];
    cache.tag = { tag: 'W/"first"', reader: 'first' };
    auth.user = { id: 'first' };
    const { result, rerender } = renderHook(
      ({ readerKey }) => useCatalogSync(true, readerKey),
      { initialProps: { readerKey: 'first' } },
    );
    await waitFor(() => expect(server.resolve).not.toBeNull());
    await act(async () => server.resolve?.({ status: 'fresh', data: [stale], tag: 'W/"first"' }));
    expect(result.current.remoteWorlds).toEqual([stale]);

    auth.user = { id: 'second' };
    rerender({ readerKey: 'second' });

    await waitFor(() => expect(server.calls).toBe(2));
    expect(result.current.remoteWorlds).toEqual([]);
    expect(server.sentTag).toBeNull();

    await act(async () => server.resolve?.({ status: 'fresh', data: [{ ...world, liked: false }], tag: 'W/"second"' }));
    expect(result.current.remoteWorlds).toEqual([{ ...world, liked: false }]);
  });

  it('ignores a previous reader\'s response after the next reader has started loading', async () => {
    auth.user = { id: 'first' };
    const { result, rerender } = renderHook(
      ({ readerKey }) => useCatalogSync(true, readerKey),
      { initialProps: { readerKey: 'first' } },
    );
    await waitFor(() => expect(server.resolve).not.toBeNull());
    const resolveFirst = server.resolve!;

    auth.user = { id: 'second' };
    rerender({ readerKey: 'second' });

    await waitFor(() => expect(server.calls).toBe(2));
    const resolveSecond = server.resolve!;
    await act(async () => resolveFirst({ status: 'fresh', data: [{ ...world, liked: true }], tag: 'W/"first"' }));

    expect(result.current.remoteWorlds).toEqual([]);
    expect(cache.replace).not.toHaveBeenCalled();

    await act(async () => resolveSecond({ status: 'fresh', data: [{ ...world, liked: false }], tag: 'W/"second"' }));
    expect(result.current.remoteWorlds).toEqual([{ ...world, liked: false }]);
  });
});

describe('the likes a sign-in is still moving', () => {
  it('asks for no catalog until the Claim has settled', async () => {
    // Signing in changes the reader and starts a Claim at the same moment, and this refresh is what the
    // change asked for. Ask too early and the answer is missing the hearts the Claim is turning into
    // Likes, so a person who just signed in sees their own likes as somebody else's.
    const held = { finish: null as null | (() => void) };
    const watch = { ...idleClaim, settled: () => new Promise<void>((res) => { held.finish = res; }) };
    renderHook(() => useCatalogSync(true, guest(), watch));

    // Waited on, and still waiting: the request has not gone out.
    await waitFor(() => expect(held.finish).not.toBe(null));
    expect(server.calls).toBe(0);

    await act(async () => { held.finish?.(); });

    await waitFor(() => expect(server.calls).toBe(1));
  });

  it('asks straight away when nothing is in the air, which is every other visit', async () => {
    renderHook(() => useCatalogSync(true));

    await waitFor(() => expect(server.calls).toBe(1));
  });

  it('asks again, and asks unconditionally, when a Claim moves marks under an unchanged reader', async () => {
    // The retry after a failed Claim runs on a session change that leaves the reader alone, so nothing
    // else asks for the catalog again. The held copy predates the marks that moved, so its tag would
    // have the server answer 'unchanged' and the moved hearts would stay wrong.
    cache.items = [world];
    cache.tag = { tag: 'W/"one"', reader: guest() };
    const claim = movingClaim();
    const { rerender } = renderHook(() => useCatalogSync(true, guest(), claim.watch));
    await waitFor(() => expect(server.calls).toBe(1));
    expect(server.sentTag).toBe('W/"one"');
    await act(async () => server.resolve?.({ status: 'unchanged' }));

    await act(async () => { claim.move(); });
    rerender();

    await waitFor(() => expect(server.calls).toBe(2));
    expect(server.sentTag).toBe(null);
  });

  it('asks again on the next open when the Claim landed while it was closed', async () => {
    cache.items = [world];
    cache.tag = { tag: 'W/"one"', reader: guest() };
    const claim = movingClaim();
    const { rerender } = renderHook(
      ({ open }) => useCatalogSync(open, guest(), claim.watch),
      { initialProps: { open: true } },
    );
    await waitFor(() => expect(server.calls).toBe(1));
    await act(async () => server.resolve?.({ status: 'unchanged' }));

    rerender({ open: false });
    await act(async () => { claim.move(); });
    rerender({ open: true });

    await waitFor(() => expect(server.calls).toBe(2));
    expect(server.sentTag).toBe(null);
  });

  it('leaves the catalog alone for a Claim that moved nothing, which is the ordinary sign-in', async () => {
    cache.items = [world];
    cache.tag = { tag: 'W/"one"', reader: guest() };
    const claim = movingClaim();
    const { rerender } = renderHook(() => useCatalogSync(true, guest(), claim.watch));
    await waitFor(() => expect(server.calls).toBe(1));
    await act(async () => server.resolve?.({ status: 'unchanged' }));

    // A Claim that moved nothing tells nobody, so nothing here changes.
    rerender();

    await waitFor(() => expect(server.calls).toBe(1));
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

describe('whether this server takes a guest\'s like', () => {
  it('answers from the cache before the refresh lands, so the heart is a control on the first frame', async () => {
    cache.items = [world];
    cache.anonymousLikes = true;

    const { result } = renderHook(() => useCatalogSync(true));

    await waitFor(() => expect(result.current.anonymousLikes).toBe(true));
    expect(server.resolve).not.toBeNull();
  });

  it('follows the fresh response and stores it beside the rows', async () => {
    const { result } = renderHook(() => useCatalogSync(true));
    await waitFor(() => expect(server.resolve).not.toBeNull());

    await act(async () => server.resolve?.({ status: 'fresh', data: [world], tag: null, anonymousLikes: true }));

    expect(result.current.anonymousLikes).toBe(true);
    expect(cache.replace).toHaveBeenCalledWith([world], null, true);
  });

  it('reads a server that says nothing as off', async () => {
    // An older server has no such setting, and neither has its route.
    cache.anonymousLikes = true;
    const { result } = renderHook(() => useCatalogSync(true));
    await waitFor(() => expect(server.resolve).not.toBeNull());

    await act(async () => server.resolve?.({ status: 'fresh', data: [world], tag: null, anonymousLikes: false }));

    expect(result.current.anonymousLikes).toBe(false);
  });
});
