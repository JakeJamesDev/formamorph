import { useEffect, useState } from 'react';
import { render, screen, cleanup, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import CommunityCreationsBrowser from './CommunityCreationsBrowser';
import type { CommunityListing } from './CommunityCreationsBrowser';
import type { WorldRecord } from '@/components/WorldDetails';

vi.mock('react-toastify', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));

vi.mock('@/services/AuthService', () => ({
  default: { token: 'test-token', getCurrentUser: () => ({ username: 'reader' }) },
}));

vi.mock('@/services/WorldStorageService', () => ({
  default: { API_URL: 'https://example.test/api' },
}));

const catalog = vi.hoisted(() => ({ worlds: [] as Record<string, unknown>[] }));

vi.mock('@/lib/useCatalogSync', () => ({
  useCatalogSync: () => ({
    remoteWorlds: catalog.worlds,
    setRemoteWorlds: () => {},
    isLoadingRemoteWorlds: false,
    isSyncingCatalog: false,
    catalogSettled: true,
    loadCatalog: vi.fn(),
  }),
}));

/**
 * Every `open` the details modal was handed, in render order. The flicker this file guards against is
 * two openings with a close between them, which settles open — so the end state proves nothing and the
 * sequence is what the test reads.
 */
const opens = vi.hoisted(() => ({ log: [] as boolean[] }));

vi.mock('@/components/community/RemoteWorldDetailsModal', () => ({
  RemoteWorldDetailsModal: ({ open, world }: { open: boolean; world: { name?: string } | null }) => {
    opens.log.push(open);
    return open && world ? <div data-testid="details-modal">{world.name}</div> : null;
  },
}));

const world = {
  _id: 'w1', id: 'w1', kind: 'world', name: 'Sedge Landing', description: 'A blurb.',
  author: { id: 'author-1', username: 'alice' }, tags: [],
};

const reader = { id: 'u1', username: 'reader', accountType: 'normal' } as unknown as WorldRecord;

/**
 * A controlled surface whose router lags, exactly as the website's does.
 *
 * A click reports the listing, which moves the path; the controlled listing is only derived from that
 * path an effect later. So there is one render where the click has opened the details and the caller is
 * still saying no listing — the render the browser must not read as a request to close.
 *
 * The callbacks are written inline for the same reason the page writes them that way: a new identity
 * each render is what re-runs the browser's listing effect on that in-between render.
 */
/** The mounted router's own path setter, so a test can stand in for browser Back. */
const router = vi.hoisted(() => ({ setPath: null as null | ((path: string | null) => void) }));

function LaggingRouter() {
  const [path, setPath] = useState<string | null>(null);
  const [listing, setListing] = useState<CommunityListing | null>(null);
  router.setPath = setPath;

  useEffect(() => {
    setListing(path ? { id: path, kind: 'world' } : null);
  }, [path]);

  // The page's own guard: a report of the listing already shown is not a move, so it never re-navigates.
  const reportListing = (next: CommunityListing | null) => {
    if (next && listing && listing.id === next.id && listing.kind === next.kind) return;
    if (!next && listing === null) return;
    setPath(next ? next.id : null);
  };

  return (
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
      listing={listing}
      onListingChange={reportListing}
      onListingUnavailable={() => {}}
    />
  );
}

beforeEach(() => {
  window.matchMedia = ((query: string) => ({
    matches: false, media: query, onchange: null,
    addEventListener: () => {}, removeEventListener: () => {},
    addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;

  catalog.worlds = [world];
  opens.log = [];
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ success: true }) } as unknown as Response)));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('a card click on a surface whose router reports the listing a render late', () => {
  it('opens the details once, with no close between the click and the listing landing', async () => {
    const user = userEvent.setup();
    render(<LaggingRouter />);

    await user.click(screen.getByText('Sedge Landing'));

    expect(screen.getByTestId('details-modal')).toHaveTextContent('Sedge Landing');
    // Read from the first opening on: a close after it is the second fade the reader sees.
    expect(opens.log.slice(opens.log.indexOf(true))).not.toContain(false);
  });

  it('still closes the details when the caller moves to no listing', async () => {
    const user = userEvent.setup();
    render(<LaggingRouter />);

    await user.click(screen.getByText('Sedge Landing'));
    expect(screen.getByTestId('details-modal')).toBeInTheDocument();

    // Browser Back on the website: the caller drops the listing and the details must follow.
    act(() => router.setPath?.(null));

    expect(screen.queryByTestId('details-modal')).toBeNull();
  });
});
