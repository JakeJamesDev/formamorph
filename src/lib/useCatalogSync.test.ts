import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useCatalogSync } from './useCatalogSync';
import { acceptAgeGate } from './ageGate';

vi.mock('react-toastify', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));
vi.mock('@/lib/featureFlags', () => ({ COMMUNITY_ENABLED: true }));

const cache = vi.hoisted(() => ({ items: [] as Record<string, unknown>[] }));
vi.mock('@/lib/worldCatalog', () => ({
  getCatalog: async () => cache.items,
  replaceCatalog: async () => {},
}));

/** The server fetch, resolvable by hand so the settling moment is the test's to pick. */
const server = vi.hoisted(() => ({
  resolve: null as null | ((result: { success: boolean; data?: unknown[]; error?: string }) => void),
}));
vi.mock('@/services/WorldStorageService', () => ({
  default: {
    fetchRemoteWorlds: () => new Promise((res) => { server.resolve = res; }),
  },
}));

beforeEach(() => {
  cache.items = [];
  server.resolve = null;
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

    await act(async () => server.resolve?.({ success: true, data: [world] }));

    expect(result.current.catalogSettled).toBe(true);
    expect(result.current.remoteWorlds).toEqual([world]);
  });

  it('settles on a failed refresh too, so a waiting request is not held forever', async () => {
    const { result } = renderHook(() => useCatalogSync(true));
    await waitFor(() => expect(server.resolve).not.toBeNull());

    await act(async () => server.resolve?.({ success: false, error: 'down' }));

    expect(result.current.catalogSettled).toBe(true);
  });

  it('unsettles on close, so the next open waits for its own refresh', async () => {
    const { result, rerender } = renderHook(({ open }) => useCatalogSync(open), {
      initialProps: { open: true },
    });
    await waitFor(() => expect(server.resolve).not.toBeNull());
    await act(async () => server.resolve?.({ success: true, data: [world] }));
    expect(result.current.catalogSettled).toBe(true);

    rerender({ open: false });

    expect(result.current.catalogSettled).toBe(false);
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
