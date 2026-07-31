import { useState } from 'react';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import CommunityCreationsBrowser from './CommunityCreationsBrowser';
import type { WorldRecord } from '@/components/WorldDetails';

vi.mock('react-toastify', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));

vi.mock('@/services/AuthService', () => ({
  default: { token: 'test-token', getCurrentUser: () => ({ username: 'root-admin' }) },
}));

vi.mock('@/services/WorldStorageService', () => ({
  default: { API_URL: 'https://example.test/api' },
}));

// The catalog list is the fixture; the real hook fetches and caches through IndexedDB.
const catalog = vi.hoisted(() => ({ items: [] as Record<string, unknown>[] }));

vi.mock('@/lib/useCatalogSync', () => ({
  useCatalogSync: () => {
    const [remoteWorlds, setRemoteWorlds] = useState(catalog.items);
    return {
      remoteWorlds,
      setRemoteWorlds,
      isLoadingRemoteWorlds: false,
      isSyncingCatalog: false,
      loadCatalog: vi.fn(),
    };
  },
}));

// The download hooks run for real: stubbing them means guessing their surface, and none of it is on
// the delete path anyway.
vi.mock('@/components/community/RemoteWorldDetailsModal', () => ({ RemoteWorldDetailsModal: () => null }));

/** Records the props the composer was opened with, so the prefill can be asserted. */
const composerProps = vi.hoisted(() => ({ last: null as Record<string, unknown> | null }));

vi.mock('@/components/menu/MessageComposerDialog', () => ({
  MessageComposerDialog: (props: Record<string, unknown>) => {
    composerProps.last = props;
    return <div data-testid="composer" />;
  },
}));

const listing = (over: Record<string, unknown> = {}) => ({
  _id: 'w1',
  id: 'w1',
  kind: 'world',
  name: 'Sedge Landing',
  description: 'A blurb.',
  author: { id: 'author-1', username: 'alice' },
  tags: [],
  ...over,
});

const admin = { id: 'admin-1', username: 'root-admin', accountType: 'admin' } as unknown as WorldRecord;

const renderBrowser = (currentUser: WorldRecord | null = admin) =>
  render(
    <CommunityCreationsBrowser
      open
      onOpenChange={() => {}}
      worlds={[]}
      setWorlds={() => {}}
      entities={[]}
      dictionaries={[]}
      refreshEntities={() => {}}
      refreshDictionaries={() => {}}
      isAuthenticated
      currentUser={currentUser}
      openImageViewer={() => {}}
    />
  );

/** Delete the one listing on screen and answer the delete confirmation. */
const deleteTheListing = async () => {
  fireEvent.click(await screen.findByLabelText('Delete world'));
  const confirm = await screen.findByRole('button', { name: 'Confirm' });
  fireEvent.click(confirm);
};

beforeEach(() => {
  // jsdom has no `matchMedia`; the browser reads it for the mobile layout switch.
  window.matchMedia = ((query: string) => ({
    matches: false, media: query, onchange: null,
    addEventListener: () => {}, removeEventListener: () => {},
    addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;

  catalog.items = [listing()];
  composerProps.last = null;
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ success: true }) } as unknown as Response)));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('deleting somebody else’s published item', () => {
  it('offers to tell the author why', async () => {
    renderBrowser();
    await deleteTheListing();

    expect(await screen.findByText(/has been removed. Send them a message/)).toBeTruthy();
  });

  it('names the author, the kind and the item in the offer', async () => {
    renderBrowser();
    await deleteTheListing();

    expect(await screen.findByText(/alice's world "Sedge Landing"/)).toBeTruthy();
  });

  it('opens the composer to that author, prefilled', async () => {
    renderBrowser();
    await deleteTheListing();
    fireEvent.click(await screen.findByRole('button', { name: 'Confirm' }));

    await screen.findByTestId('composer');
    expect(composerProps.last).toMatchObject({
      target: { broadcast: false, recipients: [{ id: 'author-1', username: 'alice' }] },
      initialSubject: 'Your world "Sedge Landing" was removed',
      initialSeverity: 'warning',
      initialScope: 'existing',
    });
    expect(String(composerProps.last!.initialBody)).toMatch(/\*\*Reason:\*\* $/);
  });

  it('leaves the item deleted when the notice is declined', async () => {
    // The takedown never depends on the message; declining just leaves it unexplained.
    renderBrowser();
    await deleteTheListing();
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel' }));

    await waitFor(() => expect(screen.queryByText(/Send them a message/)).toBeNull());
    expect(screen.queryByTestId('composer')).toBeNull();
    expect(screen.queryByText('Sedge Landing')).toBeNull();
  });
});

describe('deleting your own published item', () => {
  it('offers no notice', async () => {
    // There is nobody to explain it to but yourself.
    catalog.items = [listing({ author: { id: 'admin-1', username: 'root-admin' } })];

    renderBrowser();
    await deleteTheListing();

    await waitFor(() => expect(screen.queryByText('Sedge Landing')).toBeNull());
    expect(screen.queryByText(/Send them a message/)).toBeNull();
  });
});

describe('when the delete fails', () => {
  it('offers no notice for something still on the server', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => (
      { ok: false, json: async () => ({ message: 'Nope' }) } as unknown as Response
    )));

    renderBrowser();
    await deleteTheListing();

    await waitFor(() => expect(screen.queryByRole('button', { name: 'Confirm' })).toBeNull());
    expect(screen.queryByText(/Send them a message/)).toBeNull();
  });
});
