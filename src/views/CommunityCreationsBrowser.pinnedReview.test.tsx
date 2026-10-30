import { useState } from 'react';
import { render, screen, fireEvent, cleanup, within, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import CommunityCreationsBrowser from './CommunityCreationsBrowser';
import type { WorldRecord } from '@/components/WorldDetails';
import { PENDING_REVIEW_HINT, UPDATE_PENDING_HINT } from '@/lib/listingModeration';

vi.mock('react-toastify', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));

vi.mock('@/services/AuthService', () => ({
  default: { token: 'test-token', getCurrentUser: () => null },
}));

const audit = vi.hoisted(() => ({
  fetchLikersAudit: vi.fn(async () => ({
    total: 0, rows: [], anonymous: 0, anonymousRows: [],
    summary: { windowDays: 90, flagged: 0, total: 0, share: null, bursts: [], reasons: [] },
  })),
}));

vi.mock('@/services/WorldStorageService', () => ({
  default: {
    API_URL: 'https://example.test/api',
    fetchLikers: vi.fn(async () => ({ total: 0, rows: [], anonymous: 0 })),
    ...audit,
  },
}));

// The catalog list is the fixture; the real hook fetches and caches through IndexedDB.
const catalog = vi.hoisted(() => ({ items: [] as Record<string, unknown>[] }));

vi.mock('@/lib/useCatalogSync', () => ({
  useCatalogSync: () => {
    const [remoteWorlds, setRemoteWorlds] = useState(catalog.items);
    return { remoteWorlds, setRemoteWorlds, isLoadingRemoteWorlds: false, isSyncingCatalog: false, loadCatalog: vi.fn() };
  },
}));

vi.mock('@/components/community/RemoteWorldDetailsModal', () => ({ RemoteWorldDetailsModal: () => null }));

const day = (n: number) => new Date(Date.UTC(2026, 9, n)).toISOString();

const listing = (id: string, name: string, over: Record<string, unknown> = {}) => ({
  _id: id, id, kind: 'world', name, description: '', tags: [], downloads: 0,
  author: { id: 'author-1', username: 'alice' },
  updated_at: day(1),
  ...over,
});

// Queue times run opposite to `updated_at`, so the browser's newest-first sort would reverse them.
const fresh = (id: string, name: string, queued: number, over: Record<string, unknown> = {}) =>
  listing(id, name, { moderation_state: 'pending', moderation_queued_at: day(queued), updated_at: day(30 - queued), ...over });
const resubmitted = (id: string, name: string, queued: number) =>
  fresh(id, name, queued, { quarantined_at: day(1), quarantine_expires_at: day(28) });
const update = (id: string, name: string, queued: number, over: Record<string, unknown> = {}) => listing(id, name, {
  moderation_state: 'approved', moderation_queued_at: day(1), has_pending_update: true,
  pending_preview: { name: `${name} Draft`, queued_at: day(queued) }, updated_at: day(30 - queued), ...over,
});

const admin = { id: 'admin-1', username: 'root-admin', accountType: 'admin' } as unknown as WorldRecord;
const player = { id: 'player-1', username: 'bob', accountType: 'normal' } as unknown as WorldRecord;

const renderBrowser = (currentUser: WorldRecord | null = admin) =>
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
      currentUser={currentUser}
      openImageViewer={() => {}}
    />,
  );

const pinnedGroup = () => screen.queryByRole('region', { name: 'Awaiting Review' });

/** The listing names a container shows, in DOM order. */
const namesIn = (container: HTMLElement, names: string[]) =>
  within(container).queryAllByText((text) => names.includes(text)).map((el) => el.textContent);

/** The names on the page outside the pinned group. */
const gridNames = (names: string[]) => {
  const pinned = pinnedGroup();
  return screen.queryAllByText((text) => names.includes(text))
    .filter((el) => !pinned?.contains(el))
    .map((el) => el.textContent);
};

/** A Moderation popover control of the given role, opening the popover first when it is closed. */
const control = async (role: 'checkbox' | 'radio', name: string | RegExp) => {
  if (!screen.queryByRole(role, { name })) fireEvent.click(await screen.findByRole('button', { name: /^Moderation/ }));
  return screen.getByRole(role, { name });
};
/** The Pin Pending checkbox. */
const option = (name: string | RegExp) => control('checkbox', name);
/** A choice in the Show radio group. */
const view = (name: string | RegExp) => control('radio', name);

beforeEach(() => {
  // jsdom has no `matchMedia`; the browser reads it for the mobile layout switch.
  window.matchMedia = ((query: string) => ({
    matches: false, media: query, onchange: null,
    addEventListener: () => {}, removeEventListener: () => {},
    addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
  localStorage.clear();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('the pinned review group', () => {
  const ALL = ['Live One', 'New Two', 'Resubmitted Three', 'Update Four Draft'];

  beforeEach(() => {
    catalog.items = [
      listing('live', 'Live One', { updated_at: day(29) }),
      fresh('new', 'New Two', 10),
      resubmitted('resub', 'Resubmitted Three', 5),
      update('upd', 'Update Four', 7),
    ];
  });

  it('pins new, resubmitted and update listings for staff, oldest-queued first', async () => {
    renderBrowser();

    const group = await screen.findByRole('region', { name: 'Awaiting Review' });
    expect(namesIn(group, ALL)).toEqual(['Resubmitted Three', 'Update Four Draft', 'New Two']);
    expect(gridNames(ALL)).toEqual(['Live One']);
  });

  it('orders an update by its own queue time, not its first submission', async () => {
    catalog.items = [fresh('new', 'New Two', 3), update('upd', 'Update Four', 8, { moderation_queued_at: day(1) })];
    renderBrowser();

    expect(namesIn(await screen.findByRole('region', { name: 'Awaiting Review' }), ALL)).toEqual(['New Two', 'Update Four Draft']);
  });

  it('shows an update listing once, in the group', async () => {
    renderBrowser();
    await screen.findByRole('region', { name: 'Awaiting Review' });

    expect(screen.getAllByText('Update Four Draft')).toHaveLength(1);
    expect(namesIn(pinnedGroup()!, ['Update Four Draft'])).toEqual(['Update Four Draft']);
  });

  it('shows no group and no toggle to a player, and keeps their own pending listing in the grid', async () => {
    catalog.items = [listing('live', 'Live One'), fresh('mine', 'New Two', 3, { author: { id: 'player-1', username: 'bob' } })];
    renderBrowser(player);
    await screen.findByText('Live One');

    expect(pinnedGroup()).toBeNull();
    expect(screen.queryByRole('button', { name: /^Moderation/ })).toBeNull();
    expect(gridNames(ALL)).toContain('New Two');
  });

  it('follows the search', async () => {
    renderBrowser();
    await screen.findByRole('region', { name: 'Awaiting Review' });

    fireEvent.change(screen.getByPlaceholderText(/^Search worlds/), { target: { value: 'resubmitted' } });

    expect(namesIn(pinnedGroup()!, ALL)).toEqual(['Resubmitted Three']);
  });

  it('finds an update by the pending name its card shows, and by its live name', async () => {
    renderBrowser();
    await screen.findByRole('region', { name: 'Awaiting Review' });
    const search = screen.getByPlaceholderText(/^Search worlds/);

    fireEvent.change(search, { target: { value: 'four draft' } });
    expect(namesIn(pinnedGroup()!, ['Update Four Draft'])).toEqual(['Update Four Draft']);

    fireEvent.change(search, { target: { value: 'update four' } });
    expect(namesIn(pinnedGroup()!, ['Update Four Draft'])).toEqual(['Update Four Draft']);
  });

  it('does not match the pending name once Pin Pending is off', async () => {
    renderBrowser();
    fireEvent.click(await option('Pin Pending'));

    fireEvent.change(screen.getByPlaceholderText(/^Search worlds/), { target: { value: 'four draft' } });

    expect(screen.queryByText('Update Four')).toBeNull();
  });

  it('follows a tag filter', async () => {
    catalog.items = [
      listing('live', 'Live One'),
      fresh('new', 'New Two', 3, { tags: ['marsh'] }),
      update('upd', 'Update Four', 5, { tags: ['fen'] }),
    ];
    renderBrowser();
    await screen.findByRole('region', { name: 'Awaiting Review' });

    fireEvent.change(screen.getByPlaceholderText(/^Search worlds/), { target: { value: 'tag:fen ' } });

    expect(namesIn(pinnedGroup()!, ALL)).toEqual(['Update Four Draft']);
  });

  it('follows the kind', async () => {
    catalog.items = [listing('live', 'Live One'), fresh('ent', 'New Two', 3, { kind: 'entity' })];
    renderBrowser();
    await screen.findByText('Live One');

    expect(pinnedGroup()).toBeNull();
  });

  it('follows the hide preferences', async () => {
    localStorage.setItem('FORMAMORPH_hiddenAuthors', JSON.stringify(['carol']));
    catalog.items = [listing('live', 'Live One'), fresh('new', 'New Two', 3, { author: { id: 'c', username: 'carol' } })];
    renderBrowser();
    await screen.findByText('Live One');

    expect(pinnedGroup()).toBeNull();
  });

  it('shows on page 1 only and leaves the page full', async () => {
    // jsdom is 1024 wide: four columns, three rows, twelve to a page.
    catalog.items = [
      ...Array.from({ length: 13 }, (_, i) => listing(`l${i}`, `Live ${i}`, { updated_at: day(28 - i) })),
      fresh('new', 'New Two', 3),
    ];
    const live = Array.from({ length: 13 }, (_, i) => `Live ${i}`);
    renderBrowser();
    await screen.findByRole('region', { name: 'Awaiting Review' });

    expect(gridNames(live)).toHaveLength(12);

    fireEvent.click(screen.getByLabelText('Go to next page'));

    expect(pinnedGroup()).toBeNull();
    expect(gridNames(live)).toEqual(['Live 12']);
  });

  it('gives pinned cards the badge title without its hint', async () => {
    renderBrowser();
    const group = await screen.findByRole('region', { name: 'Awaiting Review' });

    expect(within(group).getByText('Pending Review')).toBeTruthy();
    expect(within(group).getByText('Update Pending')).toBeTruthy();
    expect(within(group).queryByText(PENDING_REVIEW_HINT)).toBeNull();
    expect(within(group).queryByText(UPDATE_PENDING_HINT)).toBeNull();
  });

  it('shows no group in the Quarantined view', async () => {
    renderBrowser();
    await screen.findByRole('region', { name: 'Awaiting Review' });

    fireEvent.click(await view(/^Quarantined/));

    expect(pinnedGroup()).toBeNull();
    expect(gridNames(ALL)).toEqual(['Resubmitted Three']);
    expect(await option('Pin Pending')).toBeDisabled();
  });
});

describe('Pin Pending', () => {
  const ALL = ['Live One', 'New Two', 'Update Four', 'Mine Five'];

  beforeEach(() => {
    catalog.items = [
      listing('live', 'Live One', { updated_at: day(29) }),
      fresh('new', 'New Two', 10),
      update('upd', 'Update Four', 7, { updated_at: day(20) }),
      fresh('mine', 'Mine Five', 4, { author: { id: 'admin-1', username: 'root-admin' }, updated_at: day(10) }),
    ];
  });

  it('is on by default', async () => {
    renderBrowser();

    expect((await option('Pin Pending')).getAttribute('aria-checked')).toBe('true');
    expect(pinnedGroup()).not.toBeNull();
  });

  it('shows for staff with nothing pending', async () => {
    catalog.items = [listing('live', 'Live One')];
    renderBrowser();

    expect(await option('Pin Pending')).toBeTruthy();
    expect(pinnedGroup()).toBeNull();
  });

  it('turned on from a later page returns to page 1, where the group shows', async () => {
    catalog.items = [
      ...Array.from({ length: 13 }, (_, i) => listing(`l${i}`, `Live ${i}`, { updated_at: day(28 - i) })),
      fresh('new', 'New Two', 3),
    ];
    renderBrowser();
    fireEvent.click(await option('Pin Pending'));
    fireEvent.click(screen.getByLabelText('Go to next page'));
    expect(pinnedGroup()).toBeNull();

    fireEvent.click(await option('Pin Pending'));

    expect(pinnedGroup()).not.toBeNull();
  });

  it('off gives the player view: new listings hidden, updates and own listings in their slot', async () => {
    renderBrowser();
    fireEvent.click(await option('Pin Pending'));

    expect(pinnedGroup()).toBeNull();
    expect(gridNames(ALL)).toEqual(['Live One', 'Update Four', 'Mine Five']);
    expect(screen.getByText(PENDING_REVIEW_HINT)).toBeTruthy();
    expect(screen.getByText(UPDATE_PENDING_HINT)).toBeTruthy();
  });

  it('stays off across a remount', async () => {
    const first = renderBrowser();
    fireEvent.click(await option('Pin Pending'));
    first.unmount();

    renderBrowser();

    expect((await option('Pin Pending')).getAttribute('aria-checked')).toBe('false');
    expect(pinnedGroup()).toBeNull();
  });
});

describe('the Moderation button', () => {
  beforeEach(() => {
    catalog.items = [
      listing('live', 'Live One'),
      fresh('new', 'New Two', 3),
      resubmitted('resub', 'Resubmitted Three', 5),
    ];
  });

  const trigger = () => screen.queryByRole('button', { name: /^Moderation/ });

  it('replaces the two toggles for staff', async () => {
    renderBrowser();
    await screen.findByRole('region', { name: 'Awaiting Review' });

    expect(trigger()).not.toBeNull();
    expect(screen.queryByRole('button', { name: 'Pin Pending' })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Quarantined/ })).toBeNull();
  });

  it('shows nothing to a player or a guest', async () => {
    const view = renderBrowser(player);
    await screen.findByText('Live One');
    expect(trigger()).toBeNull();
    view.unmount();

    renderBrowser(null);
    await screen.findByText('Live One');
    expect(trigger()).toBeNull();
  });

  it('shows the Quarantined count', async () => {
    renderBrowser();

    expect(await view('Quarantined (1)')).toBeEnabled();
  });

  it('disables Quarantined at zero rather than hiding it', async () => {
    catalog.items = [listing('live', 'Live One')];
    renderBrowser();

    expect(await view('Quarantined (0)')).toBeDisabled();
  });

  it('carries no badge in the default view', async () => {
    renderBrowser();

    expect(await screen.findByRole('button', { name: 'Moderation' })).toBeTruthy();
  });

  it('badges Pin Pending off and a view other than All Listings, one each', async () => {
    renderBrowser();
    fireEvent.click(await option('Pin Pending'));
    expect(screen.getByRole('button', { name: 'Moderation, 1 changed' })).toBeTruthy();

    fireEvent.click(await view(/^Quarantined/));
    expect(screen.getByRole('button', { name: 'Moderation, 2 changed' })).toBeTruthy();

    fireEvent.click(await view('All Listings'));
    expect(screen.getByRole('button', { name: 'Moderation, 1 changed' })).toBeTruthy();
  });

  it('lists the Show group and keeps Pin Pending apart from it', async () => {
    renderBrowser();

    expect((await view('All Listings')).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByRole('radiogroup')).not.toContainElement(await option('Pin Pending'));
    expect(screen.queryByRole('radio', { name: 'Pin Pending' })).toBeNull();
  });
});

describe('Flagged Likes', () => {
  const ALL = ['Live One', 'Marked Two', 'Marked Quarantined Three', 'Quarantined Four'];

  beforeEach(() => {
    audit.fetchLikersAudit.mockClear();
    catalog.items = [
      listing('live', 'Live One'),
      listing('marked', 'Marked Two', { likes_marker: ['burst'] }),
      listing('both', 'Marked Quarantined Three', {
        likes_marker: ['burst', 'flagged_share'], quarantined_at: day(1), quarantine_expires_at: day(28),
      }),
      listing('quar', 'Quarantined Four', { quarantined_at: day(1), quarantine_expires_at: day(28) }),
    ];
  });

  it('counts the marked listings and shows only them', async () => {
    renderBrowser();

    fireEvent.click(await view('Flagged Likes (2)'));

    expect(gridNames(ALL).sort()).toEqual(['Marked Quarantined Three', 'Marked Two']);
  });

  it('swaps to Quarantined when it is picked, clearing Flagged Likes', async () => {
    renderBrowser();
    fireEvent.click(await view('Flagged Likes (2)'));
    fireEvent.click(await view(/^Quarantined/));

    expect(gridNames(ALL).sort()).toEqual(['Marked Quarantined Three', 'Quarantined Four']);
    expect((await view('Flagged Likes (2)')).getAttribute('aria-checked')).toBe('false');
  });

  it('swaps back to Flagged Likes from Quarantined, and All Listings clears both', async () => {
    renderBrowser();
    fireEvent.click(await view(/^Quarantined/));
    fireEvent.click(await view('Flagged Likes (2)'));
    expect(gridNames(ALL).sort()).toEqual(['Marked Quarantined Three', 'Marked Two']);

    fireEvent.click(await view('All Listings'));
    expect(gridNames(ALL).sort()).toEqual([...ALL].sort());
  });

  it('is disabled at zero rather than hidden', async () => {
    catalog.items = [listing('live', 'Live One')];
    renderBrowser();

    expect(await view('Flagged Likes (0)')).toBeDisabled();
  });

  it('shows no marker and no option to a player, whatever the row carries', async () => {
    renderBrowser(player);
    await screen.findByText('Marked Two');

    expect(document.querySelector('[data-likes-marker]')).toBeNull();
    expect(screen.queryByRole('button', { name: /^Moderation/ })).toBeNull();
  });

  it('names the reasons on the card and opens the audit for that listing when pressed', async () => {
    renderBrowser();
    await screen.findByText('Marked Two');

    expect(document.querySelector('[data-likes-marker="burst flagged_share"]')?.textContent).toContain('Burst and Flagged share');
    fireEvent.click(document.querySelector('[data-likes-marker="burst"]') as HTMLElement);

    await waitFor(() => expect(audit.fetchLikersAudit).toHaveBeenCalledWith('marked'));
  });
});
