// Must load before the storage singletons, whose operations open IndexedDB.
import 'fake-indexeddb/auto';
import { useState } from 'react';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import CommunityBrowserHost from './CommunityBrowserHost';
import WorldStorageService from '@/services/WorldStorageService';
import EntityStorageService from '@/services/EntityStorageService';
import AuthService from '@/services/AuthService';
import type { World } from '@/types';

/**
 * The host's whole job is to be self-sufficient: given nothing but "open", it must find the local
 * libraries and the signed-in account itself. So these tests hand it nothing and let the real storage
 * services (over a fake IndexedDB) and the real auth singleton answer, then read the browser's own
 * surface back — a card that says "Re-download" is the host having found the local copy.
 *
 * The catalog is stubbed, because where the listings come from is not the host's business; every local
 * source it *is* responsible for is real.
 */

vi.mock('react-toastify', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));

// No events and no contests: both would only add fetches to answer, and neither is what is measured here.
vi.mock('@/services/EventService', () => ({
  default: { fetchActive: vi.fn(async () => []), fetchList: vi.fn(async () => []) },
}));

const catalog = vi.hoisted(() => ({ items: [] as Record<string, unknown>[] }));

vi.mock('@/lib/useCatalogSync', () => ({
  useCatalogSync: () => {
    const [remoteWorlds, setRemoteWorlds] = useState(catalog.items);
    return {
      remoteWorlds,
      setRemoteWorlds,
      isLoadingRemoteWorlds: false,
      isSyncingCatalog: false,
      catalogSettled: true,
      loadCatalog: vi.fn(),
    };
  },
}));

vi.mock('@/components/community/RemoteWorldDetailsModal', () => ({ RemoteWorldDetailsModal: () => null }));

/** The server's stamp on every listing below, and the one a stale local copy is compared against. */
const SERVER_UPDATED = '2026-02-01T00:00:00.000Z';

const listing = (over: Record<string, unknown> = {}) => ({
  _id: 'w1',
  id: 'w1',
  kind: 'world',
  name: 'Sedge Landing',
  description: 'A blurb.',
  updated_at: SERVER_UPDATED,
  author: { id: 'author-1', username: 'alice' },
  tags: [],
  ...over,
});

/** The smallest payload `storeWorld` accepts, which is also what the download route has to hand back. */
const worldData = (name: string): World => ({
  id: 'downloaded',
  worldOverview: {
    name, description: '', author: '', thumbnail: null, bgm: null,
    systemPrompt: '', use3DModel: true, tags: [],
  },
  stats: [], locations: [], entities: [], traits: [], statUpdates: [],
} as unknown as World);

/** Put a world in the local library, linked to the catalog entry `sourceId` as a download would leave it. */
const seedLocalWorld = async (sourceId: string, sourceUpdatedAt: string) => {
  await WorldStorageService.initialize();
  await WorldStorageService.storeWorld({
    id: `local-${sourceId}`,
    name: 'My copy',
    description: '',
    author: '',
    sourceId,
    sourceUpdatedAt,
    dirty: false,
    data: worldData('My copy'),
  } as unknown as Parameters<typeof WorldStorageService.storeWorld>[0]);
};

/** Sign the shared auth service in, the way `login` leaves it. */
const signIn = (accountType: string) => {
  AuthService.token = 'test-token';
  AuthService.currentUser = { id: 'u1', username: 'reader', accountType };
};

const signOut = () => {
  AuthService.token = null;
  AuthService.currentUser = null;
};

/** Answers `/auth/me` with whoever is signed in, and any download with `content`. */
const stubServer = (content: unknown = worldData('Sedge Landing')) => {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    if (String(url).includes('/auth/me')) {
      return { ok: true, status: 200, json: async () => ({ user: AuthService.currentUser }) } as unknown as Response;
    }
    return {
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: async () => ({ success: true, data: { contentData: content } }),
    } as unknown as Response;
  }));
};

const renderHost = (props: Record<string, unknown> = {}) =>
  render(<CommunityBrowserHost open onOpenChange={() => {}} {...props} />);

beforeEach(() => {
  localStorage.clear();
  catalog.items = [];
  signOut();
  stubServer();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(async () => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  // Each test starts on an empty library; the fake IndexedDB outlives the render otherwise.
  await WorldStorageService.initialize();
  for (const id of await WorldStorageService.getWorldIds()) await WorldStorageService.deleteWorld(id);
  await EntityStorageService.initialize();
  for (const e of await EntityStorageService.getEntityMetadata()) await EntityStorageService.deleteEntity(e.id);
});

describe('the community browser host', () => {
  it('reads the local world library itself, so a held copy is not offered as a fresh download', async () => {
    catalog.items = [listing()];
    // Downloaded before the server's newest version — the state the "Update available" button names.
    await seedLocalWorld('w1', '2026-01-01T00:00:00.000Z');

    renderHost();

    expect(await screen.findByRole('button', { name: 'Update available' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Download this world' })).not.toBeInTheDocument();
  });

  it('lands a download in the world library and follows it on the card', async () => {
    catalog.items = [listing()];

    renderHost();

    fireEvent.click(await screen.findByRole('button', { name: 'Download this world' }));

    // The library is where it really has to arrive; the card is how the reader is told it did.
    await waitFor(async () => {
      const held = await WorldStorageService.getWorldMetadata();
      expect(held.map((w) => w.sourceId)).toContain('w1');
    });
    expect(await screen.findByRole('button', { name: 'Re-download this world' })).toBeInTheDocument();
  });

  it('reads the entity library the same way, so every kind behaves alike', async () => {
    catalog.items = [listing({ _id: 'e1', id: 'e1', kind: 'entity', name: 'Sedge Warden' })];
    await EntityStorageService.initialize();
    await EntityStorageService.storeEntity({
      id: 'local-e1',
      name: 'Sedge Warden',
      sourceId: 'e1',
      sourceUpdatedAt: SERVER_UPDATED,
      dirty: false,
      data: { id: 'local-e1', name: 'Sedge Warden' },
    } as unknown as Parameters<typeof EntityStorageService.storeEntity>[0]);

    renderHost({ initialTab: 'entity' });

    expect(await screen.findByRole('button', { name: 'Re-download this entity' })).toBeInTheDocument();
  });

  it('re-reads the libraries each time it opens, so a download made elsewhere is not stale', async () => {
    catalog.items = [listing()];

    const { rerender } = render(<CommunityBrowserHost open={false} onOpenChange={() => {}} />);
    rerender(<CommunityBrowserHost open onOpenChange={() => {}} />);
    expect(await screen.findByRole('button', { name: 'Download this world' })).toBeInTheDocument();

    // Closed, the library gains a copy the host knows nothing about.
    rerender(<CommunityBrowserHost open={false} onOpenChange={() => {}} />);
    await seedLocalWorld('w1', SERVER_UPDATED);
    rerender(<CommunityBrowserHost open onOpenChange={() => {}} />);

    expect(await screen.findByRole('button', { name: 'Re-download this world' })).toBeInTheDocument();
  });

  it('takes the signed-in account from the auth service, so moderation follows the real role', async () => {
    catalog.items = [listing()];
    signIn('admin');

    renderHost();

    expect(await screen.findByRole('button', { name: 'Quarantine Sedge Landing' })).toBeInTheDocument();
  });

  it('lets the server’s answer overrule the role the token was stored with', async () => {
    catalog.items = [listing()];
    // A moderator promoted since the last sign-in: the held copy still says otherwise.
    signIn('normal');
    vi.stubGlobal('fetch', vi.fn(async (url: string) => (String(url).includes('/auth/me')
      ? { ok: true, status: 200, json: async () => ({ user: { id: 'u1', username: 'reader', accountType: 'admin' } }) }
      : { ok: true, status: 200, headers: { get: () => null }, json: async () => ({ success: true, data: {} }) }
    ) as unknown as Response));

    renderHost();

    expect(await screen.findByRole('button', { name: 'Quarantine Sedge Landing' })).toBeInTheDocument();
  });

  it('drops a session the server has stopped honoring', async () => {
    catalog.items = [listing()];
    // The stored token still claims an admin; the server disagrees, which is the only vote that counts.
    signIn('admin');
    vi.stubGlobal('fetch', vi.fn(async (url: string) => (String(url).includes('/auth/me')
      ? { ok: false, status: 401, json: async () => ({}) }
      : { ok: true, status: 200, headers: { get: () => null }, json: async () => ({ success: true, data: {} }) }
    ) as unknown as Response));

    renderHost();

    await screen.findByText('Sedge Landing');
    await waitFor(() => expect(AuthService.token).toBeNull());
    expect(screen.queryByRole('button', { name: 'Quarantine Sedge Landing' })).not.toBeInTheDocument();
  });

  it('offers no moderation to an ordinary account', async () => {
    catalog.items = [listing()];
    signIn('normal');

    renderHost();

    await screen.findByText('Sedge Landing');
    expect(screen.queryByRole('button', { name: 'Quarantine Sedge Landing' })).not.toBeInTheDocument();
  });

  it('reports closing to whoever opened it', async () => {
    catalog.items = [listing()];
    const onOpenChange = vi.fn();

    renderHost({ onOpenChange });

    fireEvent.click(await screen.findByRole('button', { name: 'Back' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});

describe('the page presentation', () => {
  it('renders the browser with no dialog around it', async () => {
    catalog.items = [listing()];

    renderHost({ presentation: 'page' });

    expect(await screen.findByText('Community Creations')).toBeInTheDocument();
    expect(await screen.findByText('Sedge Landing')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('is the difference from the dialog the app raises, which does have one', async () => {
    catalog.items = [listing()];

    renderHost();

    expect(await screen.findByText('Sedge Landing')).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('shows nothing while closed', () => {
    catalog.items = [listing()];

    render(<CommunityBrowserHost open={false} onOpenChange={() => {}} presentation="page" />);

    expect(screen.queryByText('Community Creations')).not.toBeInTheDocument();
  });
});
