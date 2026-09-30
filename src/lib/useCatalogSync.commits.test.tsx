import { Profiler } from 'react';
import { render, act, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useCatalogSync } from './useCatalogSync';
import { acceptAgeGate } from './ageGate';
import { installId } from './anonymousLikes';
import type { WorldRecord } from '@/components/WorldDetails';

vi.mock('react-toastify', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));
vi.mock('@/lib/featureFlags', () => ({ COMMUNITY_ENABLED: true }));

/** The cache, with a write that lands when the test says: a real IndexedDB write spans tasks. */
const cache = vi.hoisted(() => ({
  items: [] as Record<string, unknown>[],
  anonymousLikes: false,
  tag: null as { tag: string; reader: string } | null,
  finishWrite: null as null | (() => void),
}));
vi.mock('@/lib/worldCatalog', () => ({
  getCatalog: async () => cache.items,
  getCatalogTag: async () => cache.tag,
  getCatalogAnonymousLikes: async () => cache.anonymousLikes,
  replaceCatalog: () => new Promise<void>((resolve) => { cache.finishWrite = resolve; }),
}));

const auth = vi.hoisted(() => ({ user: null as { id: string } | null }));
vi.mock('@/services/AuthService', () => ({
  default: {
    get currentUser() { return auth.user; },
    isAuthenticated: () => auth.user !== null,
  },
}));

const server = vi.hoisted(() => ({ resolve: null as null | ((result: unknown) => void), calls: 0 }));
vi.mock('@/services/WorldStorageService', () => ({
  default: {
    fetchCatalog: () => {
      server.calls += 1;
      return new Promise((res) => { server.resolve = res; });
    },
  },
}));

const idleClaim = { settled: () => Promise.resolve(), subscribe: () => () => {}, moved: () => 0 };

type Sync = ReturnType<typeof useCatalogSync>;

/** Every state the hook committed, in order: what a reader could have seen on screen. */
function mountSync(reader = 'install:a') {
  const commits: Sync[] = [];
  let rendered: Sync | null = null;
  function Probe({ readerKey }: { readerKey: string }) {
    rendered = useCatalogSync(true, readerKey, idleClaim);
    return null;
  }
  const onRender = () => { if (rendered) commits.push(rendered); };
  const view = render(<Profiler id="sync" onRender={onRender}><Probe readerKey={reader} /></Profiler>);
  const rerender = (next: string) => view.rerender(
    <Profiler id="sync" onRender={onRender}><Probe readerKey={next} /></Profiler>,
  );
  return { commits, rerender, latest: () => commits[commits.length - 1] };
}

const row = (id: string, extra: Record<string, unknown> = {}): WorldRecord => ({
  id, name: `Listing ${id}`, likes: 2, liked: false, tags: ['a', 'b'], author: { id: 'u1', username: 'maker' }, ...extra,
});

beforeEach(() => {
  cache.items = [];
  cache.anonymousLikes = false;
  cache.finishWrite = null;
  auth.user = null;
  server.resolve = null;
  server.calls = 0;
  localStorage.clear();
  acceptAgeGate();
  // Cached rows show only to the reader their tag names: here, the signed-out reader's Install.
  cache.tag = { tag: 'W/"cached"', reader: `install:${installId()}` };
});

describe('one commit per catalog step', () => {
  it('shows cached rows, the cached guest-like flag, and the syncing flag together', async () => {
    cache.items = [row('w1')];
    cache.anonymousLikes = true;
    const { commits } = mountSync();
    await waitFor(() => expect(server.resolve).not.toBeNull());

    // The mount, then the cached step. No frame shows the rows with the heart still off.
    expect(commits).toHaveLength(2);
    expect(commits[1].remoteWorlds).toHaveLength(1);
    expect(commits[1].anonymousLikes).toBe(true);
    expect(commits[1].isSyncingCatalog).toBe(true);
  });

  it('lands the fresh answer and the settled flags in one commit, before the cache write finishes', async () => {
    cache.items = [row('w1')];
    const { commits, latest } = mountSync();
    await waitFor(() => expect(server.resolve).not.toBeNull());
    const before = commits.length;

    await act(async () => server.resolve?.({ status: 'fresh', data: [row('w1', { likes: 3 })], tag: null, anonymousLikes: true }));

    expect(cache.finishWrite).not.toBeNull();
    expect(commits).toHaveLength(before + 1);
    expect(latest().remoteWorlds[0].likes).toBe(3);
    expect(latest().anonymousLikes).toBe(true);
    expect(latest().isSyncingCatalog).toBe(false);
    expect(latest().isLoadingRemoteWorlds).toBe(false);
    expect(latest().catalogSettled).toBe(true);

    // The write finishing is not news to the screen.
    await act(async () => cache.finishWrite?.());
    expect(commits).toHaveLength(before + 1);
  });
});

describe('row reuse', () => {
  it('keeps the cached object for a fresh row that says the same thing', async () => {
    cache.items = [row('w1'), row('w2')];
    const { latest } = mountSync();
    await waitFor(() => expect(server.resolve).not.toBeNull());
    const [first, second] = latest().remoteWorlds;

    // Keys in another order are the same row.
    const { name, id, ...rest } = row('w1');
    await act(async () => server.resolve?.({
      status: 'fresh', data: [{ ...rest, name, id }, row('w2', { liked: true, likes: 3 })], tag: null, anonymousLikes: false,
    }));

    expect(latest().remoteWorlds[0]).toBe(first);
    expect(latest().remoteWorlds[1]).not.toBe(second);
    expect(latest().remoteWorlds[1]).toMatchObject({ liked: true, likes: 3 });
  });

  it('replaces a row whose nested data changed', async () => {
    cache.items = [row('w1')];
    const { latest } = mountSync();
    await waitFor(() => expect(server.resolve).not.toBeNull());
    const cached = latest().remoteWorlds[0];

    await act(async () => server.resolve?.({
      status: 'fresh', data: [row('w1', { tags: ['a', 'c'] })], tag: null, anonymousLikes: false,
    }));

    expect(latest().remoteWorlds[0]).not.toBe(cached);
    expect(latest().remoteWorlds[0].tags).toEqual(['a', 'c']);
  });

  it('keeps the whole list when every row is unchanged', async () => {
    cache.items = [row('w1'), row('w2')];
    const { latest } = mountSync();
    await waitFor(() => expect(server.resolve).not.toBeNull());
    const cached = latest().remoteWorlds;

    await act(async () => server.resolve?.({ status: 'fresh', data: [row('w1'), row('w2')], tag: null, anonymousLikes: false }));

    expect(latest().remoteWorlds).toBe(cached);
  });

  it('drops a row the server no longer lists', async () => {
    cache.items = [row('w1'), row('w2')];
    const { latest } = mountSync();
    await waitFor(() => expect(server.resolve).not.toBeNull());

    await act(async () => server.resolve?.({ status: 'fresh', data: [row('w2')], tag: null, anonymousLikes: false }));

    expect(latest().remoteWorlds.map((w) => w.id)).toEqual(['w2']);
  });
});

describe('a change of reader', () => {
  it('clears the old reader\'s rows before the forced request, and reuses none of them', async () => {
    cache.items = [row('w1')];
    const { rerender, latest } = mountSync('install:a');
    await waitFor(() => expect(server.resolve).not.toBeNull());
    await act(async () => server.resolve?.({ status: 'fresh', data: [row('w1')], tag: null, anonymousLikes: false }));
    await act(async () => cache.finishWrite?.());
    const oldRow = latest().remoteWorlds[0];
    server.resolve = null;

    auth.user = { id: 'u2' };
    await act(async () => rerender('user:u2'));
    await waitFor(() => expect(server.calls).toBe(2));

    expect(latest().remoteWorlds).toEqual([]);

    await act(async () => server.resolve?.({ status: 'fresh', data: [row('w1')], tag: null, anonymousLikes: false }));
    expect(latest().remoteWorlds[0]).toEqual(oldRow);
    expect(latest().remoteWorlds[0]).not.toBe(oldRow);
  });
});
