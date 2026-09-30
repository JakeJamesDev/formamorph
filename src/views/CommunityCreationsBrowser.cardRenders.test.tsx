import { render, screen, cleanup, act, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import CommunityCreationsBrowser from './CommunityCreationsBrowser';
import { stubMatchMedia } from '@/test/serverEvents';
import { acceptAgeGate } from '@/lib/ageGate';
import type { WorldRecord } from '@/components/WorldDetails';

/**
 * A fresh catalog answer redraws only the cards whose rows changed. The real catalog hook runs against a
 * mocked cache and server; the card shell counts each card's renders by name.
 */

vi.mock('react-toastify', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));

const auth = vi.hoisted(() => ({ user: null as { id: string; username: string } | null }));
vi.mock('@/services/AuthService', () => ({
  default: {
    token: 'test-token',
    get currentUser() { return auth.user; },
    isAuthenticated: () => auth.user !== null,
    getCurrentUser: () => auth.user,
  },
}));

const server = vi.hoisted(() => ({ resolve: null as null | ((result: unknown) => void) }));
vi.mock('@/services/WorldStorageService', () => ({
  default: {
    API_URL: 'https://example.test/api',
    fetchCatalog: () => new Promise((res) => { server.resolve = res; }),
  },
}));

const cache = vi.hoisted(() => ({ items: [] as Record<string, unknown>[], anonymousLikes: false }));
vi.mock('@/lib/worldCatalog', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/worldCatalog')>()),
  getCatalog: async () => cache.items,
  // Cached rows show only to the reader their tag names, so the tag names whoever is reading.
  getCatalogTag: async () => ({ tag: 'W/"cached"', reader: (await import('@/lib/currentReader')).currentReader() }),
  getCatalogAnonymousLikes: async () => cache.anonymousLikes,
  replaceCatalog: async () => {},
}));

vi.mock('@/services/EventService', () => ({
  default: { fetchActive: vi.fn(async () => []), fetchList: vi.fn(async () => []) },
}));

const renders = vi.hoisted(() => ({ byName: {} as Record<string, number> }));
vi.mock('@/components/WorldCardShell', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/components/WorldCardShell')>()),
  WorldCardShell: ({ name, loading, children }: { name: string; loading?: boolean; children?: React.ReactNode }) => {
    if (!loading) renders.byName[name] = (renders.byName[name] ?? 0) + 1;
    return <div data-testid="card">{name}{children}</div>;
  },
}));

vi.mock('@/components/community/RemoteWorldDetailsModal', () => ({ RemoteWorldDetailsModal: () => null }));

const listed = (n: number, extra: Record<string, unknown> = {}) => ({
  _id: `w-${n}`, id: `w-${n}`, name: `World ${n}`, kind: 'world', description: '', tags: ['cozy'],
  author: { id: 'a1', username: 'wren_hallow' }, downloads: 0, likes: 1, liked: false, ...extra,
});

const rows = (count: number) => Array.from({ length: count }, (_, i) => listed(i));

const Harness = () => (
  <CommunityCreationsBrowser
    open
    onOpenChange={() => {}}
    worlds={[]}
    setWorlds={() => {}}
    entities={[]}
    dictionaries={[]}
    models={[]}
    refreshEntities={() => {}}
    refreshDictionaries={() => {}}
    refreshModels={() => {}}
    isAuthenticated={auth.user !== null}
    currentUser={auth.user as WorldRecord | null}
    openImageViewer={() => {}}
  />
);

/** Opens on the cached rows and waits until their cards are up and the refresh is in the air. */
const openOnCache = async () => {
  render(<Harness />);
  await waitFor(() => expect(screen.getAllByTestId('card')).toHaveLength(cache.items.length));
  await waitFor(() => expect(server.resolve).not.toBeNull());
  await act(async () => {});
  renders.byName = {};
};

const answer = (data: Record<string, unknown>[], anonymousLikes = false) =>
  act(async () => server.resolve?.({ status: 'fresh', data, tag: null, anonymousLikes }));

beforeEach(() => {
  stubMatchMedia(false);
  localStorage.clear();
  acceptAgeGate();
  auth.user = { id: 'u1', username: 'reader' };
  server.resolve = null;
  cache.items = [];
  cache.anonymousLikes = false;
  renders.byName = {};
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ success: true }) } as unknown as Response)));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('when the fresh catalog lands', () => {
  it('redraws only the card whose row changed, and shows its new count', async () => {
    cache.items = rows(3);
    await openOnCache();

    await answer([listed(0), listed(1, { likes: 5, liked: true }), listed(2)]);

    expect(Object.keys(renders.byName)).toEqual(['World 1']);
    expect(renders.byName['World 1']).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Unlike — 5 likes' })).toBeInTheDocument();
  });

  it('redraws no card when nothing changed', async () => {
    cache.items = rows(3);
    await openOnCache();

    await answer(rows(3));

    expect(renders.byName).toEqual({});
  });

  it('turns a guest\'s hearts into controls when the server starts taking their likes', async () => {
    auth.user = null;
    cache.items = rows(2);
    await openOnCache();
    expect(screen.queryByRole('button', { name: /^Like — / })).toBeNull();

    await answer(rows(2), true);

    expect(screen.getAllByRole('button', { name: 'Like — 1 like' })).toHaveLength(2);
  });
});
