import { useState } from 'react';
import { render, screen, cleanup, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { toast } from 'react-toastify';
import CommunityCreationsBrowser from './CommunityCreationsBrowser';
import type { WorldRecord } from '@/components/WorldDetails';

vi.mock('react-toastify', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));

vi.mock('@/services/AuthService', () => ({
  default: { token: 'test-token', getCurrentUser: () => ({ username: 'reader' }) },
}));

vi.mock('@/services/WorldStorageService', () => ({
  default: { API_URL: 'https://example.test/api' },
}));

/**
 * The catalog as the effect under test sees it: the list in hand plus whether a refresh has settled
 * this open. The test drives both through `set`, standing in for the cache render and the sync landing.
 */
const sync = vi.hoisted(() => ({
  initial: { worlds: [] as Record<string, unknown>[], settled: false },
  set: null as null | ((s: { worlds: Record<string, unknown>[]; settled: boolean }) => void),
}));

vi.mock('@/lib/useCatalogSync', () => ({
  useCatalogSync: () => {
    const [state, setState] = useState(sync.initial);
    sync.set = setState;
    return {
      remoteWorlds: state.worlds,
      setRemoteWorlds: () => {},
      isLoadingRemoteWorlds: false,
      isSyncingCatalog: !state.settled,
      catalogSettled: state.settled,
      loadCatalog: vi.fn(),
    };
  },
}));

// Just enough modal to observe which world the browser opened.
vi.mock('@/components/community/RemoteWorldDetailsModal', () => ({
  RemoteWorldDetailsModal: ({ open, world }: { open: boolean; world: { name?: string } | null }) =>
    open && world ? <div data-testid="details-modal">{world.name}</div> : null,
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

const reader = { id: 'u1', username: 'reader', accountType: 'normal' } as unknown as WorldRecord;

const renderBrowser = (over: { open?: boolean; onListingOpened?: () => void } = {}) => {
  const onListingOpened = over.onListingOpened ?? vi.fn();
  const view = (open: boolean) => (
    <CommunityCreationsBrowser
      open={open}
      onOpenChange={() => {}}
      worlds={[]}
      setWorlds={() => {}}
      entities={[]}
      dictionaries={[]}
      refreshEntities={() => {}}
      refreshDictionaries={() => {}}
      isAuthenticated
      currentUser={reader}
      openImageViewer={() => {}}
      openListing={{ id: 'w1', kind: 'world' }}
      onListingOpened={onListingOpened}
    />
  );
  const utils = render(view(over.open ?? true));
  return { onListingOpened, setOpen: (open: boolean) => utils.rerender(view(open)) };
};

beforeEach(() => {
  window.matchMedia = ((query: string) => ({
    matches: false, media: query, onchange: null,
    addEventListener: () => {}, removeEventListener: () => {},
    addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;

  sync.initial = { worlds: [], settled: false };
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ success: true }) } as unknown as Response)));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('a listing named from outside, against a catalog still refreshing', () => {
  it('holds the request instead of calling the listing deleted', () => {
    const { onListingOpened } = renderBrowser();

    expect(toast.info).not.toHaveBeenCalled();
    expect(onListingOpened).not.toHaveBeenCalled();
    expect(screen.queryByTestId('details-modal')).toBeNull();
  });

  it('opens the listing when the refresh brings it', () => {
    const { onListingOpened } = renderBrowser();

    act(() => sync.set?.({ worlds: [listing()], settled: true }));

    expect(screen.getByTestId('details-modal').textContent).toBe('Sedge Landing');
    expect(toast.info).not.toHaveBeenCalled();
    expect(onListingOpened).toHaveBeenCalled();
  });

  it('reports the listing gone only once the refresh has settled without it', () => {
    const { onListingOpened } = renderBrowser();

    act(() => sync.set?.({ worlds: [listing({ _id: 'other', id: 'other' })], settled: true }));

    expect(toast.info).toHaveBeenCalledWith('That listing is no longer in Community Creations');
    expect(onListingOpened).toHaveBeenCalled();
    expect(screen.queryByTestId('details-modal')).toBeNull();
  });

  it('opens straight from the snapshot when the listing is already in it', () => {
    // The hold is for misses only; a hit must not wait out the network round-trip.
    sync.initial = { worlds: [listing()], settled: false };

    renderBrowser();

    expect(screen.getByTestId('details-modal').textContent).toBe('Sedge Landing');
  });

  it('drops a request the browser was closed on, rather than replaying it next visit', () => {
    const { onListingOpened, setOpen } = renderBrowser();

    setOpen(false);

    // Cleared on close: without this, the listing would pop its modal on a later, unrelated open.
    expect(onListingOpened).toHaveBeenCalled();
    expect(screen.queryByTestId('details-modal')).toBeNull();
  });
});
