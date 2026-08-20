import { useState } from 'react';
import { render, screen, cleanup, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import CommunityCreationsBrowser from './CommunityCreationsBrowser';
import type { WorldRecord } from '@/components/WorldDetails';
import type { ServerEvent } from '@/types';

vi.mock('react-toastify', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));

vi.mock('@/services/AuthService', () => ({
  default: { token: 'test-token', getCurrentUser: () => ({ username: 'reader' }) },
}));

vi.mock('@/services/WorldStorageService', () => ({
  default: { API_URL: 'https://example.test/api' },
}));

const server = vi.hoisted(() => ({ events: [] as unknown[] }));

vi.mock('@/services/EventService', () => ({
  default: {
    fetchActive: vi.fn(async () => []),
    fetchList: vi.fn(async () => server.events),
  },
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

const day = 86_400_000;
const at = (offsetDays: number) => new Date(Date.now() + offsetDays * day).toISOString();

const contest = (over: Partial<ServerEvent> = {}): ServerEvent => ({
  id: 'e1',
  type: 'contest',
  title: 'Winter World-Building Contest',
  bannerText: 'Build a world around a single season.',
  body: 'The long version.',
  rulesText: 'One entry per creator.',
  startsAt: at(-4),
  endsAt: at(12),
  cancelledAt: null,
  startMessageId: 'm-start',
  endMessageId: null,
  winnerMessageId: null,
  winnerWorldId: null,
  winnerName: null,
  winnerAuthorName: null,
  ...over,
});

const listing = (name: string, over: Record<string, unknown> = {}) => ({
  _id: name, id: name, name, kind: 'world', description: `${name} description`,
  thumbnail_file: `${name}.webp`, tags: [], downloads: 0, likes: 0, comment_count: 0,
  updated_at: at(-1), created_at: at(-2), author: { id: 'u2', username: 'sedgewright' },
  ...over,
});

const renderBrowser = (props: Record<string, unknown> = {}) =>
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
      currentUser={reader}
      openImageViewer={() => {}}
      {...props}
    />
  );

/** Land on the Contest tab the way a reader does — by pressing its trigger. */
const openContestTab = async () => {
  const trigger = await screen.findByRole('tab', { name: 'Contest' });
  await userEvent.click(trigger);
  // Asserted here rather than in each case: a click that quietly failed to switch would otherwise leave
  // every grid assertion below reading the Worlds tab, which shows most of the same listings.
  expect(trigger).toHaveAttribute('data-state', 'active');
};

/** The listing names the grid is showing, in the order it is showing them. */
const gridNames = () => screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent);

beforeEach(() => {
  localStorage.clear();
  window.matchMedia = ((query: string) => ({
    matches: false, media: query, onchange: null,
    addEventListener: () => {}, removeEventListener: () => {},
    addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;

  catalog.items = [];
  server.events = [];
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ success: true }) } as unknown as Response)));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('whether the Contest tab is there at all', () => {
  it('stays away on a server running no contests, where it could only ever be empty', async () => {
    renderBrowser();

    expect(await screen.findByRole('tab', { name: 'Worlds' })).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Contest' })).not.toBeInTheDocument();
  });

  it('appears while a contest is running', async () => {
    server.events = [contest()];
    renderBrowser();

    expect(await screen.findByRole('tab', { name: 'Contest' })).toBeInTheDocument();
  });

  it('stays for the archives once every contest has ended', async () => {
    server.events = [contest({ startsAt: at(-40), endsAt: at(-30), winnerName: 'The Long Thaw' })];
    renderBrowser();

    expect(await screen.findByRole('tab', { name: 'Contest' })).toBeInTheDocument();
  });

  it('drops an announcement, which has no entries to browse', async () => {
    server.events = [contest({ type: 'announcement' })];
    renderBrowser();

    await waitFor(() => expect(screen.getByRole('tab', { name: 'Worlds' })).toBeInTheDocument());
    expect(screen.queryByRole('tab', { name: 'Contest' })).not.toBeInTheDocument();
  });

  it('lands the reader back on the catalog when the tab it was aimed at has nothing behind it', async () => {
    renderBrowser({ initialTab: 'contest' });

    await waitFor(() => expect(screen.getByRole('tab', { name: 'Worlds' })).toHaveAttribute('data-state', 'active'));
  });

  it('opens straight onto the contest when an event banner sent the reader here', async () => {
    server.events = [contest()];
    renderBrowser({ initialTab: 'contest' });

    expect(await screen.findByRole('tab', { name: 'Contest' })).toHaveAttribute('data-state', 'active');
  });
});

describe('what the contest grid shows in each of its three states', () => {
  it('shows every entry while the contest runs, and no winner', async () => {
    server.events = [contest()];
    catalog.items = [
      listing('Saltmarsh', { contest_event_id: 'e1', likes: 2 }),
      listing('Thawline', { contest_event_id: 'e1', likes: 9 }),
      listing('Unentered', {}),
    ];
    renderBrowser();
    await openContestTab();

    await waitFor(() => expect(gridNames().sort()).toEqual(['Saltmarsh', 'Thawline']));
    expect(screen.getByText(/left to enter/)).toBeInTheDocument();
    expect(screen.queryByText(/Winner/)).not.toBeInTheDocument();
  });

  it('stands the entries by likes once the window closes for judging', async () => {
    server.events = [contest({ startsAt: at(-20), endsAt: at(-2) })];
    catalog.items = [
      listing('Saltmarsh', { contest_event_id: 'e1', likes: 2 }),
      listing('Thawline', { contest_event_id: 'e1', likes: 9 }),
      listing('Coldkeep', { contest_event_id: 'e1', likes: 5 }),
    ];
    renderBrowser();
    await openContestTab();

    await waitFor(() => expect(gridNames()).toEqual(['Thawline', 'Coldkeep', 'Saltmarsh']));
    expect(screen.getByText(/being judged/)).toBeInTheDocument();
  });

  it('pins the winner first and badges it once one is picked', async () => {
    server.events = [contest({
      startsAt: at(-20), endsAt: at(-2),
      winnerWorldId: 'Saltmarsh', winnerName: 'Saltmarsh', winnerAuthorName: 'sedgewright',
    })];
    // The winner is last by likes and last in the catalog, so nothing but the pin can put it first.
    catalog.items = [
      listing('Thawline', { contest_event_id: 'e1', likes: 9 }),
      listing('Coldkeep', { contest_event_id: 'e1', likes: 5 }),
      listing('Saltmarsh', { contest_event_id: 'e1', likes: 2 }),
    ];
    renderBrowser();
    await openContestTab();

    await waitFor(() => expect(gridNames()).toEqual(['Saltmarsh', 'Thawline', 'Coldkeep']));
    expect(screen.getAllByText(/Winner —/).length).toBeGreaterThan(0);
  });

  it('carries the winner badge into the ordinary catalog, where the world also lives', async () => {
    server.events = [contest({
      startsAt: at(-20), endsAt: at(-2), winnerWorldId: 'Saltmarsh', winnerName: 'Saltmarsh',
    })];
    catalog.items = [listing('Saltmarsh', { contest_event_id: 'e1', likes: 2 })];
    renderBrowser();

    // Still on the ordinary catalog: the trophy is on the card, not on the tab it was won in.
    expect(screen.getByRole('tab', { name: 'Worlds' })).toHaveAttribute('data-state', 'active');
    const badge = await screen.findByTitle('Winter World-Building Contest');
    expect(badge).toHaveTextContent('Winner — Winter World-Building Contest');
  });

  it('says a running contest is still waiting for its first entry', async () => {
    server.events = [contest()];
    renderBrowser();
    await openContestTab();

    expect(await screen.findByText(/Publish a world with the contest switch on/)).toBeInTheDocument();
  });
});

describe('reaching the rules and the archives', () => {
  it('puts the rules a button away rather than above every visit', async () => {
    server.events = [contest()];
    renderBrowser();
    await openContestTab();

    await userEvent.click(await screen.findByRole('button', { name: 'Rules' }));

    expect(await screen.findByText('One entry per creator.')).toBeInTheDocument();
  });

  it('names the contest plainly while it is the only one', async () => {
    server.events = [contest()];
    renderBrowser();
    await openContestTab();

    await waitFor(() => expect(screen.getByRole('button', { name: 'Rules' })).toBeInTheDocument());
    expect(screen.queryByRole('combobox', { name: 'Contest' })).not.toBeInTheDocument();
  });

  it('offers a selector once there is more than one, defaulting to the running contest', async () => {
    server.events = [
      contest({ id: 'old', title: 'Autumn Ruins Contest', startsAt: at(-40), endsAt: at(-30) }),
      contest(),
    ];
    catalog.items = [
      listing('Saltmarsh', { contest_event_id: 'e1', likes: 2 }),
      listing('Ruinsong', { contest_event_id: 'old', likes: 4 }),
    ];
    renderBrowser();
    await openContestTab();

    const selector = await screen.findByRole('combobox', { name: 'Contest' });
    expect(within(selector).getByText('Winter World-Building Contest')).toBeInTheDocument();
    await waitFor(() => expect(gridNames()).toEqual(['Saltmarsh']));
  });

  it('switches the grid to the archive the reader picks', async () => {
    server.events = [
      contest({ id: 'old', title: 'Autumn Ruins Contest', startsAt: at(-40), endsAt: at(-30) }),
      contest(),
    ];
    catalog.items = [
      listing('Saltmarsh', { contest_event_id: 'e1', likes: 2 }),
      listing('Ruinsong', { contest_event_id: 'old', likes: 4 }),
    ];
    renderBrowser();
    await openContestTab();

    await userEvent.click(await screen.findByRole('combobox', { name: 'Contest' }));
    await userEvent.click(await screen.findByRole('option', { name: 'Autumn Ruins Contest' }));

    await waitFor(() => expect(gridNames()).toEqual(['Ruinsong']));
  });

  it('opens the next visit on the running contest, not the archive last read', async () => {
    server.events = [
      contest({ id: 'old', title: 'Autumn Ruins Contest', startsAt: at(-40), endsAt: at(-30) }),
      contest(),
    ];
    catalog.items = [
      listing('Saltmarsh', { contest_event_id: 'e1', likes: 2 }),
      listing('Ruinsong', { contest_event_id: 'old', likes: 4 }),
    ];
    const { rerender } = renderBrowser({ initialTab: 'contest' });
    await openContestTab();

    await userEvent.click(await screen.findByRole('combobox', { name: 'Contest' }));
    await userEvent.click(await screen.findByRole('option', { name: 'Autumn Ruins Contest' }));
    await waitFor(() => expect(gridNames()).toEqual(['Ruinsong']));

    rerender(
      <CommunityCreationsBrowser
        open={false}
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
        initialTab="contest"
      />
    );
    rerender(
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
        initialTab="contest"
      />
    );

    await waitFor(() => expect(gridNames()).toEqual(['Saltmarsh']));
  });

  it('counts the contest\'s entries, not what a search has left of them', async () => {
    server.events = [contest()];
    catalog.items = [
      listing('Saltmarsh', { contest_event_id: 'e1', likes: 2 }),
      listing('Thawline', { contest_event_id: 'e1', likes: 9 }),
    ];
    renderBrowser();
    await openContestTab();

    await waitFor(() => expect(screen.getByText('2 entries')).toBeInTheDocument());
    await userEvent.type(screen.getByPlaceholderText(/Search entries…/), 'Saltmarsh');

    await waitFor(() => expect(gridNames()).toEqual(['Saltmarsh']));
    expect(screen.getByText('2 entries')).toBeInTheDocument();
  });
});

describe('the kind labels the browser reaches for', () => {
  it('names a tab that is not a catalog kind without throwing', async () => {
    server.events = [contest()];
    catalog.items = [listing('Saltmarsh', { contest_event_id: 'e1' })];
    renderBrowser();
    await openContestTab();

    // The lookups the browser makes on the tab value — the search placeholder, the empty-state copy, the
    // delete dialog's title — used to index the server's kinds, which a contest tab is none of.
    expect(await screen.findByPlaceholderText(/Search entries…/)).toBeInTheDocument();
  });
});
