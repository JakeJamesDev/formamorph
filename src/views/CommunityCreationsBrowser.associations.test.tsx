import { useState } from 'react';
import { render, screen, cleanup, act, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { toast } from 'react-toastify';
import CommunityCreationsBrowser from './CommunityCreationsBrowser';
import type { WorldRecord } from '@/components/WorldDetails';
import type { CommunityListing } from './CommunityCreationsBrowser';

vi.mock('react-toastify', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));

vi.mock('@/services/AuthService', () => ({
  default: { token: 'test-token', getCurrentUser: () => ({ username: 'reader' }) },
}));

vi.mock('@/services/WorldStorageService', () => ({
  default: { API_URL: 'https://example.test/api' },
}));

const sync = vi.hoisted(() => ({
  initial: { worlds: [] as Record<string, unknown>[], settled: true },
}));

/** The two download paths, so a press can be traced to the one it took. */
const downloads = vi.hoisted(() => ({
  world: vi.fn(),
  library: vi.fn(),
}));

vi.mock('@/lib/useDownloadCoordinator', () => ({
  useDownloadCoordinator: () => ({
    downloadProgress: {},
    contextualAction: null, setContextualAction: vi.fn(),
    overwriteSelectedId: '', setOverwriteSelectedId: vi.fn(),
    showOverwriteSelect: false, setShowOverwriteSelect: vi.fn(),
    localCopiesBySource: new Map(), copiesForWorld: () => [],
    downloadStateForWorld: () => 'none',
    handleContextualDownload: downloads.world,
    handleChooseOverwrite: vi.fn(), handleConfirmOverwrite: vi.fn(),
    handleDownloadWorld: vi.fn(),
    pendingDownload: null, retryDownload: vi.fn(), dismissPendingDownload: vi.fn(),
    worldUpdateReview: null, applyWorldUpdate: vi.fn(), cancelWorldUpdate: vi.fn(),
  }),
}));

vi.mock('@/lib/useLibraryDownload', () => ({
  useLibraryDownload: () => ({
    downloadProgress: {},
    copyBySource: new Map(),
    downloadStateFor: () => 'none',
    startDownload: downloads.library,
    dirtyConfirm: null,
    confirmDirtyDownload: vi.fn(),
    cancelDirtyDownload: vi.fn(),
  }),
}));

vi.mock('@/lib/useCatalogSync', () => ({
  useCatalogSync: () => {
    const [state] = useState(sync.initial);
    return {
      remoteWorlds: state.worlds,
      setRemoteWorlds: () => {},
      isLoadingRemoteWorlds: false,
      isSyncingCatalog: false,
      catalogSettled: state.settled,
      loadCatalog: vi.fn(),
    };
  },
}));

/**
 * The modal reduced to the one thing under test: which listing is open, and a way to ask the browser to
 * swap in another. The real section that presses this button has its own tests.
 */
vi.mock('@/components/community/RemoteWorldDetailsModal', () => ({
  RemoteWorldDetailsModal: ({ open, world, onOpenListing, onContextualDownload }: {
    open: boolean;
    world: Record<string, unknown> | null;
    onOpenListing?: (listing: { id: string; kind: string }) => void;
    onContextualDownload?: (world: Record<string, unknown>, state: string) => void;
  }) => (open && world ? (
    <div data-testid="details-modal">
      {String(world.name)}
      <button onClick={() => onOpenListing?.({ id: 'w1', kind: 'world' })}>open world w1</button>
      <button onClick={() => onOpenListing?.({ id: 'gone', kind: 'world' })}>open world gone</button>
      <button onClick={() => onContextualDownload?.(world, 'none')}>download this</button>
    </div>
  ) : null),
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

const component = () => listing({ _id: 'e1', id: 'e1', kind: 'entity', name: 'Wren Hallow' });

const reader = { id: 'u1', username: 'reader', accountType: 'normal' } as unknown as WorldRecord;

const renderBrowser = (opened: CommunityListing = { id: 'e1', kind: 'entity' }) =>
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
      listing={opened}
    />,
  );

beforeEach(() => {
  window.matchMedia = ((query: string) => ({
    matches: false, media: query, onchange: null,
    addEventListener: () => {}, removeEventListener: () => {},
    addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;

  sync.initial = { worlds: [component(), listing()], settled: true };
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ success: true }) } as unknown as Response)));
  downloads.world.mockClear();
  downloads.library.mockClear();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('a world named by the component listing on screen', () => {
  it('swaps the open listing for that world', () => {
    renderBrowser();
    expect(screen.getByTestId('details-modal')).toHaveTextContent('Wren Hallow');

    act(() => { fireEvent.click(screen.getByText('open world w1')); });

    expect(screen.getByTestId('details-modal')).toHaveTextContent('Sedge Landing');
  });

  it('says so rather than blanking the window when that world has since gone', () => {
    renderBrowser();

    act(() => { fireEvent.click(screen.getByText('open world gone')); });

    expect(toast.info).toHaveBeenCalledWith('That listing is no longer in Community Creations');
    expect(screen.getByTestId('details-modal')).toHaveTextContent('Wren Hallow');
  });
});

describe('downloading a component that names worlds', () => {
  it('takes the component alone, never the worlds it is offered for', () => {
    renderBrowser();

    act(() => { fireEvent.click(screen.getByText('download this')); });

    expect(downloads.library).toHaveBeenCalledTimes(1);
    // The world coordinator is the only path that installs a world and what it requires. A component
    // press reaching it would download a world the player never asked for.
    expect(downloads.world).not.toHaveBeenCalled();
  });

  it('still sends a world press to the world coordinator', () => {
    // The guard above must be about the kind, not about the button being inert.
    renderBrowser({ id: 'w1', kind: 'world' });

    act(() => { fireEvent.click(screen.getByText('download this')); });

    expect(downloads.world).toHaveBeenCalledTimes(1);
    expect(downloads.library).not.toHaveBeenCalled();
  });
});

describe('a direct link to an unlisted component', () => {
  it('reads as not found for a player the server keeps it from', () => {
    // The server answers browse without an unlisted listing for anybody but its author and staff, so
    // the catalog this reader holds simply does not contain it.
    sync.initial = { worlds: [listing()], settled: true };

    renderBrowser({ id: 'unlisted-1', kind: 'entity' });

    expect(toast.info).toHaveBeenCalledWith('That listing is no longer in Community Creations');
    expect(screen.queryByTestId('details-modal')).toBeNull();
  });

  it('opens with its standalone download for the author the server sends it to', () => {
    sync.initial = {
      worlds: [listing({ _id: 'unlisted-1', id: 'unlisted-1', kind: 'entity', name: 'Hidden Hallow', visibility: 'unlisted' })],
      settled: true,
    };

    renderBrowser({ id: 'unlisted-1', kind: 'entity' });

    expect(screen.getByTestId('details-modal')).toHaveTextContent('Hidden Hallow');
    expect(toast.info).not.toHaveBeenCalled();

    act(() => { fireEvent.click(screen.getByText('download this')); });

    expect(downloads.library).toHaveBeenCalledTimes(1);
  });
});
