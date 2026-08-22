import { useState } from 'react';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import CommunityCreationsBrowser from './CommunityCreationsBrowser';
import { serverEvent, stubMatchMedia } from '@/test/serverEvents';
import { markEventBannerDismissed } from '@/lib/eventSeenStore';
import type { BrowseTab } from '@/lib/browseTabs';
import type { WorldRecord } from '@/components/WorldDetails';
import type { ServerEvent } from '@/types';

vi.mock('react-toastify', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));

// The contest feed behind the Contest tab: without one the tab never appears, and there is nowhere for
// View Entries to land.
const server = vi.hoisted(() => ({ contests: [] as unknown[] }));

vi.mock('@/services/EventService', () => ({
  default: {
    fetchActive: vi.fn(async () => []),
    fetchList: vi.fn(async () => server.contests),
  },
}));

vi.mock('@/services/AuthService', () => ({
  default: { token: 'test-token', getCurrentUser: () => ({ username: 'reader' }) },
}));

vi.mock('@/services/WorldStorageService', () => ({
  default: { API_URL: 'https://example.test/api' },
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
      loadCatalog: vi.fn(),
    };
  },
}));

vi.mock('@/components/community/RemoteWorldDetailsModal', () => ({ RemoteWorldDetailsModal: () => null }));

const reader = { id: 'u1', username: 'reader', accountType: 'normal' } as unknown as WorldRecord;

const contest: ServerEvent = serverEvent();

const renderBrowser = (props: Partial<{ events: ServerEvent[]; onOpenEvent: (e: ServerEvent) => void }> = {}) =>
  render(renderBrowserProps(props));

/**
 * The host the browser really has: a tab request set when an event asks to be opened, the way the main
 * menu's does. Set rather than nudged — a second request for the tab it is already asking for is the
 * identity write React bails on, which is what left the in-browser banner dead after one use.
 */
function Host({ events }: { events: ServerEvent[] }) {
  const [tab, setTab] = useState<BrowseTab | undefined>(undefined);
  return renderBrowserProps({ events, initialTab: tab, onOpenEvent: () => setTab('contest') });
}

const renderBrowserProps = (props: Record<string, unknown>) => (
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
    currentUser={reader}
    openImageViewer={() => {}}
    {...props}
  />
);

const contestTab = () => screen.getByRole('tab', { name: 'Contest' });

beforeEach(() => {
  localStorage.clear();
  stubMatchMedia();

  server.contests = [contest];
  catalog.items = [];
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ success: true }) } as unknown as Response)));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('the event banner in the Community Creations header', () => {
  it('announces the running contest where the content lives', async () => {
    renderBrowser({ events: [contest], onOpenEvent: vi.fn() });

    expect(await screen.findByText('Winter World-Building Contest')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'View Entries' })).toBeInTheDocument();
  });

  it('is absent when nothing is running, so the header keeps its own height', async () => {
    renderBrowser();

    await waitFor(() => expect(screen.getByText('Community Creations')).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: 'Dismiss' })).not.toBeInTheDocument();
  });

  it('collapses to the chip here too, sharing the device-wide dismissal', async () => {
    const { unmount } = renderBrowser({ events: [contest], onOpenEvent: vi.fn() });

    fireEvent.click(await screen.findByRole('button', { name: 'Dismiss' }));
    expect(screen.getByRole('button', { name: /Winter World-Building Contest/ })).toHaveTextContent('12d');

    unmount();
    renderBrowser({ events: [contest], onOpenEvent: vi.fn() });

    expect(await screen.findByRole('button', { name: /Winter World-Building Contest/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Dismiss' })).not.toBeInTheDocument();
  });
});

describe('reaching the entries from the banner in the header', () => {
  it('lands on the contest tab every time View Entries is pressed, not only the first', async () => {
    render(<Host events={[contest]} />);

    await userEvent.click(await screen.findByRole('button', { name: 'View Entries' }));
    expect(contestTab()).toHaveAttribute('data-state', 'active');

    // Away and back: the banner returns, since the contest hides itself only on its own tab.
    await userEvent.click(screen.getByRole('tab', { name: 'Worlds' }));
    await userEvent.click(await screen.findByRole('button', { name: 'View Entries' }));

    expect(contestTab()).toHaveAttribute('data-state', 'active');
  });

  it('lands there every time from the dismissed chip too', async () => {
    markEventBannerDismissed('e1', 'start');
    render(<Host events={[contest]} />);

    const chip = async () => await screen.findByRole('button', { name: /Winter World-Building Contest/ });

    await userEvent.click(await chip());
    expect(contestTab()).toHaveAttribute('data-state', 'active');

    await userEvent.click(screen.getByRole('tab', { name: 'Worlds' }));
    await userEvent.click(await chip());

    expect(contestTab()).toHaveAttribute('data-state', 'active');
  });
});
