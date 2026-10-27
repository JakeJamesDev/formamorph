import { useState } from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import CommunityCreationsBrowser from './CommunityCreationsBrowser';
import { stubMatchMedia } from '@/test/serverEvents';
import type { WorldRecord } from '@/components/WorldDetails';
import type { MascotLibrary } from '@/lib/mascotDownload';

/** The Mascots section: listings browse like any kind, and Download goes through the host's Mascot library. */

vi.mock('react-toastify', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));

vi.mock('@/services/AuthService', () => ({
  default: { token: 'test-token', isAuthenticated: () => true, getCurrentUser: () => ({ username: 'reader' }) },
}));

vi.mock('@/services/WorldStorageService', () => ({
  default: {
    API_URL: 'https://example.test/api',
    readListingDetails: vi.fn(async () => ({ status: 'unreachable' })),
    fetchComments: vi.fn(async () => ({ data: [], total: 0, pagination: {} })),
  },
}));

vi.mock('@/services/EventService', () => ({
  default: { fetchActive: vi.fn(async () => []), fetchList: vi.fn(async () => []) },
}));

const catalog = vi.hoisted(() => ({ items: [] as Record<string, unknown>[] }));

vi.mock('@/lib/useCatalogSync', () => ({
  useCatalogSync: () => {
    const [remoteWorlds, setRemoteWorlds] = useState(catalog.items);
    return { remoteWorlds, setRemoteWorlds, isLoadingRemoteWorlds: false, isSyncingCatalog: false, loadCatalog: vi.fn() };
  },
}));

vi.mock('@/lib/fetchCatalogContent', () => ({ fetchCatalogContent: vi.fn(async () => ({ formamorphKind: 'mascot' })) }));

vi.mock('@/components/community/RemoteWorldDetailsModal', () => ({ RemoteWorldDetailsModal: () => null }));

const reader = { id: 'u1', username: 'reader', accountType: 'normal' } as unknown as WorldRecord;

const mascot = {
  _id: 'm-1', id: 'm-1', name: 'Captain Wren', kind: 'mascot', description: 'A dry little guide.', tags: ['guide'],
  author: { id: 'a1', username: 'wren_hallow' }, updated_at: '2026-10-27T00:00:00.000Z', downloads: 0, likes: 0,
};

const library = (store = vi.fn(async () => {}), records: MascotLibrary['target']['records'] = []): MascotLibrary => ({
  target: { kind: 'mascot', records, store, refresh: vi.fn() },
});

const renderBrowser = (mascotLibrary?: MascotLibrary) =>
  render(
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
      isAuthenticated
      currentUser={reader}
      openImageViewer={() => {}}
      mascotLibrary={mascotLibrary}
    />,
  );

beforeEach(() => {
  localStorage.clear();
  catalog.items = [mascot, { ...mascot, _id: 'e-1', id: 'e-1', name: 'An Entity', kind: 'entity' }];
  stubMatchMedia(false);
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ success: true }) } as unknown as Response)));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('the Mascots section', () => {
  it('lists Mascot listings only, as cards', async () => {
    renderBrowser(library());

    await userEvent.click(await screen.findByRole('tab', { name: 'Mascots' }));

    expect(await screen.findByText('Captain Wren')).toBeInTheDocument();
    expect(screen.queryByText('An Entity')).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText(/^Search mascots/)).toBeInTheDocument();
  });

  it('keeps Mascots out of the Worlds section', async () => {
    renderBrowser(library());

    await screen.findByRole('tab', { name: 'Worlds' });
    expect(screen.queryByText('Captain Wren')).not.toBeInTheDocument();
  });

  it('downloads through the host\'s Mascot library', async () => {
    const store = vi.fn(async () => {});
    renderBrowser(library(store));

    await userEvent.click(await screen.findByRole('tab', { name: 'Mascots' }));
    await userEvent.click(await screen.findByRole('button', { name: /download this mascot/i }));

    await vi.waitFor(() => expect(store).toHaveBeenCalled());
    expect(store.mock.calls[0]).toMatchObject([expect.any(String), { formamorphKind: 'mascot' }, { sourceId: 'm-1' }, 'Captain Wren']);
  });

  it('shows Downloaded on a card whose listing the store follows, and Update Available once it is newer', async () => {
    const copy = { id: 'dl', name: 'Captain Wren', sourceId: 'm-1', sourceUpdatedAt: '2026-10-27T00:00:00.000Z' };
    const { unmount } = renderBrowser(library(undefined, [copy]));
    await userEvent.click(await screen.findByRole('tab', { name: 'Mascots' }));
    expect(await screen.findByRole('button', { name: /re-download this mascot/i })).toBeInTheDocument();
    unmount();

    renderBrowser(library(undefined, [{ ...copy, sourceUpdatedAt: '2026-10-01T00:00:00.000Z' }]));
    await userEvent.click(await screen.findByRole('tab', { name: 'Mascots' }));
    expect(await screen.findByRole('button', { name: /update available/i })).toBeInTheDocument();
  });

  it('offers no download on a host with no Mascot library', async () => {
    renderBrowser();

    await userEvent.click(await screen.findByRole('tab', { name: 'Mascots' }));

    expect(await screen.findByText('Captain Wren')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /mascot/i })).not.toBeInTheDocument();
  });
});
