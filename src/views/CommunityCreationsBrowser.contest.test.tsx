import { useState } from 'react';
import { render, screen, cleanup, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import CommunityCreationsBrowser from './CommunityCreationsBrowser';
import WorldStorageService from '@/services/WorldStorageService';
import EventService from '@/services/EventService';
import { toast } from 'react-toastify';
import { daysFrom, serverEvent, stubMatchMedia, withoutProse } from '@/test/serverEvents';
import type { WorldRecord } from '@/components/WorldDetails';
import type { ServerEvent } from '@/types';

vi.mock('react-toastify', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));

vi.mock('@/services/AuthService', () => ({
  default: { token: 'test-token', getCurrentUser: () => ({ username: 'reader' }) },
}));

vi.mock('@/services/WorldStorageService', () => ({
  default: {
    API_URL: 'https://example.test/api',
    withdrawFromContest: vi.fn(async () => {}),
    fetchComments: vi.fn(async () => ({ data: [], total: 0, pagination: {} })),
  },
  CONTEST_WINNER: 'CONTEST_WINNER',
}));

// The catalog's IndexedDB store. What a withdrawal corrects in it is not what this file is about; that
// the entry leaves the grid is.
vi.mock('@/lib/worldCatalog', () => ({ replaceCatalog: vi.fn(async () => {}) }));

const server = vi.hoisted(() => ({ events: [] as unknown[], detail: {} as Record<string, unknown> }));

vi.mock('@/services/EventService', () => ({
  default: {
    fetchActive: vi.fn(async () => []),
    fetchList: vi.fn(async () => server.events),
    fetchOne: vi.fn(async (id: string) => server.detail[id]),
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

const reader = { id: 'u1', username: 'reader', accountType: 'normal' } as unknown as WorldRecord;

const at = (offsetDays: number) => daysFrom(offsetDays);

const contest = (over: Partial<ServerEvent> = {}): ServerEvent => serverEvent(over);


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
  stubMatchMedia();

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

  it('keeps the trophy in the details opened from a winning card', async () => {
    // One click away from where it was won is exactly where the honor used to evaporate.
    server.events = [contest({
      startsAt: at(-20), endsAt: at(-2), winnerWorldId: 'Saltmarsh', winnerName: 'Saltmarsh',
    })];
    catalog.items = [listing('Saltmarsh', { contest_event_id: 'e1' })];
    renderBrowser();

    await userEvent.click(await screen.findByRole('heading', { level: 3, name: 'Saltmarsh' }));

    const details = await screen.findByRole('dialog', { name: /Saltmarsh/ });
    expect(within(details).getByText('Winner —', { exact: false })).toBeInTheDocument();
    expect(within(details).getByTitle('Winter World-Building Contest')).toHaveTextContent(
      'Winner — Winter World-Building Contest',
    );
  });

  it('leaves the details bare for a listing that won nothing', async () => {
    server.events = [contest({
      startsAt: at(-20), endsAt: at(-2), winnerWorldId: 'Saltmarsh', winnerName: 'Saltmarsh',
    })];
    catalog.items = [listing('Thawline', { contest_event_id: 'e1' })];
    renderBrowser();

    await userEvent.click(await screen.findByRole('heading', { level: 3, name: 'Thawline' }));

    const details = await screen.findByRole('dialog', { name: /Thawline/ });
    expect(within(details).queryByText('Winner —', { exact: false })).not.toBeInTheDocument();
  });

  it('names every contest one world has won, in the details as on the card', async () => {
    server.events = [
      contest({ id: 'e1', startsAt: at(-20), endsAt: at(-2), winnerWorldId: 'Saltmarsh', winnerName: 'Saltmarsh' }),
      contest({
        id: 'e0', title: 'Autumn Ruins Contest', startsAt: at(-400), endsAt: at(-380),
        winnerWorldId: 'Saltmarsh', winnerName: 'Saltmarsh',
      }),
    ];
    catalog.items = [listing('Saltmarsh', { contest_event_id: 'e1' })];
    renderBrowser();

    await userEvent.click(await screen.findByRole('heading', { level: 3, name: 'Saltmarsh' }));

    const details = await screen.findByRole('dialog', { name: /Saltmarsh/ });
    expect(within(details).getByTitle('Winter World-Building Contest')).toBeInTheDocument();
    expect(within(details).getByTitle('Autumn Ruins Contest')).toBeInTheDocument();
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

  it('files the archive under year headings, with what is still going on pinned above them', async () => {
    // Sixty of these after five years, so the dropdown has to read as a calendar. The running contest
    // and one still being judged lead; a decided one is filed under the year it ran.
    server.events = [
      contest({ id: 'won', title: 'Autumn Ruins Contest', startsAt: '2025-10-01T12:00:00.000Z', endsAt: '2025-11-01T12:00:00.000Z', winnerWorldId: 'w9', winnerName: 'Ruinsong' }),
      contest({ id: 'judging', title: 'Summer Depths Contest', startsAt: at(-40), endsAt: at(-30) }),
      contest(),
    ];
    renderBrowser();
    await openContestTab();

    await userEvent.click(await screen.findByRole('combobox', { name: 'Contest' }));

    const current = await screen.findByRole('group', { name: 'Current' });
    expect(within(current).getByRole('option', { name: 'Winter World-Building Contest' })).toBeInTheDocument();
    expect(within(current).getByRole('option', { name: 'Summer Depths Contest' })).toBeInTheDocument();

    const archived = screen.getByRole('group', { name: '2025' });
    expect(within(archived).getByRole('option', { name: 'Autumn Ruins Contest' })).toBeInTheDocument();
  });

  it('still switches the grid when the pick comes from a year section', async () => {
    server.events = [
      contest({ id: 'won', title: 'Autumn Ruins Contest', startsAt: '2025-10-01T12:00:00.000Z', endsAt: '2025-11-01T12:00:00.000Z', winnerWorldId: 'Ruinsong', winnerName: 'Ruinsong' }),
      contest(),
    ];
    catalog.items = [
      listing('Saltmarsh', { contest_event_id: 'e1', likes: 2 }),
      listing('Ruinsong', { contest_event_id: 'won', likes: 4 }),
    ];
    renderBrowser();
    await openContestTab();

    await userEvent.click(await screen.findByRole('combobox', { name: 'Contest' }));
    const archived = await screen.findByRole('group', { name: '2025' });
    await userEvent.click(within(archived).getByRole('option', { name: 'Autumn Ruins Contest' }));

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

describe('withdrawing an entry from the contest tab', () => {
  /** An entry the signed-in reader published, so the card is one they own. */
  const mine = (name: string, over: Record<string, unknown> = {}) =>
    listing(name, { contest_event_id: 'e1', author: { id: 'u1', username: 'reader' }, ...over });

  const openWithdraw = async (name: string) => {
    await userEvent.click(await screen.findByRole('button', { name: `Withdraw ${name} from the contest` }));
  };

  it('offers the control on your own entry and on nobody else’s', async () => {
    server.events = [contest()];
    catalog.items = [mine('Saltmarsh'), listing('Thawline', { contest_event_id: 'e1' })];
    renderBrowser();
    await openContestTab();

    await waitFor(() => expect(gridNames().sort()).toEqual(['Saltmarsh', 'Thawline']));
    expect(screen.getByRole('button', { name: 'Withdraw Saltmarsh from the contest' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Withdraw Thawline from the contest' })).toBeNull();
  });

  it('is not offered to a moderator on somebody else’s entry, whose contest this is not', async () => {
    // A moderator's own row is already there — Delete and Quarantine — so this is the one place the
    // ownership check has to hold on its own rather than being carried by the row not rendering.
    const moderator = { id: 'u9', username: 'a-mod', accountType: 'mod' } as unknown as WorldRecord;
    server.events = [contest()];
    catalog.items = [listing('Thawline', { contest_event_id: 'e1' })];
    renderBrowser({ currentUser: moderator });
    await openContestTab();

    await waitFor(() => expect(gridNames()).toEqual(['Thawline']));
    expect(screen.getByRole('button', { name: 'Delete world' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Withdraw Thawline/ })).toBeNull();
  });

  it('is not offered on the catalog tab, where the listing is not an entry being browsed', async () => {
    server.events = [contest()];
    catalog.items = [mine('Saltmarsh')];
    renderBrowser();

    await waitFor(() => expect(gridNames()).toEqual(['Saltmarsh']));
    expect(screen.queryByRole('button', { name: /Withdraw Saltmarsh/ })).toBeNull();
  });

  it('is not offered once the contest has been decided — the server refuses to release a winner', async () => {
    server.events = [contest({
      startsAt: at(-20), endsAt: at(-2), winnerWorldId: 'Saltmarsh', winnerName: 'Saltmarsh',
    })];
    catalog.items = [mine('Saltmarsh')];
    renderBrowser();
    await openContestTab();

    await waitFor(() => expect(gridNames()).toEqual(['Saltmarsh']));
    expect(screen.queryByRole('button', { name: /Withdraw Saltmarsh/ })).toBeNull();
  });

  it('confirms first, then drops the entry out of the grid', async () => {
    server.events = [contest()];
    catalog.items = [mine('Saltmarsh'), listing('Thawline', { contest_event_id: 'e1' })];
    renderBrowser();
    await openContestTab();
    await waitFor(() => expect(gridNames().sort()).toEqual(['Saltmarsh', 'Thawline']));

    await openWithdraw('Saltmarsh');
    expect(await screen.findByText(/It stays published with its likes and comments/)).toBeInTheDocument();
    expect(WorldStorageService.withdrawFromContest).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: 'Withdraw It' }));

    await waitFor(() => expect(WorldStorageService.withdrawFromContest).toHaveBeenCalledWith('Saltmarsh'));
    await waitFor(() => expect(gridNames()).toEqual(['Thawline']));
  });

  it('leaves the entry where it is when the server refuses', async () => {
    vi.mocked(WorldStorageService.withdrawFromContest).mockRejectedValueOnce(
      Object.assign(new Error('A contest winner cannot be withdrawn.'), { code: 'CONTEST_WINNER' }),
    );
    server.events = [contest()];
    catalog.items = [mine('Saltmarsh')];
    renderBrowser();
    await openContestTab();
    await waitFor(() => expect(gridNames()).toEqual(['Saltmarsh']));

    await openWithdraw('Saltmarsh');
    await userEvent.click(screen.getByRole('button', { name: 'Withdraw It' }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(
      'A contest winner cannot be withdrawn. Delete the listing if you want it gone.',
    ));
    expect(gridNames()).toEqual(['Saltmarsh']);
  });
});

describe('the banner stack on the contest tab', () => {
  const announcement = () =>
    contest({ id: 'a1', type: 'announcement', title: 'Server Maintenance', bannerText: 'Down for an hour.' });

  it('drops the contest card, whose action goes where the reader already is', async () => {
    server.events = [contest()];
    renderBrowser({ events: [contest()], onOpenEvent: vi.fn() });

    // On the catalog it is there, advertising the way in.
    expect(await screen.findByRole('button', { name: 'View Entries' })).toBeInTheDocument();

    await openContestTab();

    expect(screen.queryByRole('button', { name: 'View Entries' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Dismiss' })).not.toBeInTheDocument();
  });

  it('keeps announcement cards, which are unrelated news', async () => {
    server.events = [contest()];
    renderBrowser({ events: [contest(), announcement()], onOpenEvent: vi.fn() });

    await openContestTab();

    expect(screen.getByText('Server Maintenance')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'View Entries' })).not.toBeInTheDocument();
  });

  it('brings the contest card back on any other tab', async () => {
    server.events = [contest()];
    renderBrowser({ events: [contest()], onOpenEvent: vi.fn() });

    await openContestTab();
    await userEvent.click(screen.getByRole('tab', { name: 'Worlds' }));

    expect(await screen.findByRole('button', { name: 'View Entries' })).toBeInTheDocument();
  });
});

describe('the rules dialog', () => {
  const openRules = async (event: ServerEvent) => {
    server.events = [event];
    renderBrowser();
    await openContestTab();
    await userEvent.click(await screen.findByRole('button', { name: 'Rules' }));
    return screen.findByRole('dialog');
  };

  it('opens under the poster header band, so it reads as the same event', async () => {
    const dialog = await openRules(contest({ posterColor: '#1e3a8a' }));

    const band = within(dialog).getByText('Contest Rules').parentElement as HTMLElement;
    expect(band.style.backgroundColor).toBe('rgb(30, 58, 138)');
    expect(band.style.color).toBe('rgb(255, 255, 255)');
  });

  it('keeps the default band when the organizer styled nothing', async () => {
    const dialog = await openRules(contest());

    const band = within(dialog).getByText('Contest Rules').parentElement as HTMLElement;
    expect(band.className).toContain('bg-info');
  });

  it('reads the rules as markdown rather than as the symbols they were typed with', async () => {
    await openRules(contest({ rulesText: 'One entry **per creator**.' }));

    expect(await screen.findByText('per creator')).toHaveAttribute('data-streamdown', 'strong');
  });

  it('reads the rules back out of the server when the archive row came without them', async () => {
    // The list is served without its prose, so the rules arrive on the press that asks for them.
    const full = contest({ rulesText: 'One entry per creator, no exceptions.' });
    server.detail = { e1: full };

    await openRules(withoutProse(full));

    expect(await screen.findByText(/no exceptions/)).toBeInTheDocument();
  });

  it('asks for nothing further when the row already carries its rules', async () => {
    await openRules(contest({ rulesText: 'One entry per creator.' }));

    expect(await screen.findByText('One entry per creator.')).toBeInTheDocument();
    expect(EventService.fetchOne).not.toHaveBeenCalled();
  });
});
