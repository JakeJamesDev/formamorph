import { useState } from 'react';
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import CommunityCreationsBrowser from './CommunityCreationsBrowser';
import type { WorldRecord } from '@/components/WorldDetails';
import { PENDING_REVIEW_HINT, UPDATE_PENDING_HINT } from '@/lib/listingModeration';

vi.mock('react-toastify', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));

vi.mock('@/services/AuthService', () => ({
  default: { token: 'test-token', getCurrentUser: () => null },
}));

vi.mock('@/services/WorldStorageService', () => ({
  default: { API_URL: 'https://example.test/api' },
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

const showPendingToggle = () => screen.queryByRole('button', { name: 'Show Pending' });

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
    expect(showPendingToggle()).toBeNull();
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

  it('does not match the pending name once Show Pending is off', async () => {
    renderBrowser();
    fireEvent.click(await screen.findByRole('button', { name: 'Show Pending' }));

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

    fireEvent.click(screen.getByRole('button', { name: /Quarantined/ }));

    expect(pinnedGroup()).toBeNull();
    expect(gridNames(ALL)).toEqual(['Resubmitted Three']);
    expect(showPendingToggle()).toBeNull();
  });
});

describe('Show Pending', () => {
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

    expect((await screen.findByRole('button', { name: 'Show Pending' })).getAttribute('aria-pressed')).toBe('true');
    expect(pinnedGroup()).not.toBeNull();
  });

  it('shows for staff with nothing pending', async () => {
    catalog.items = [listing('live', 'Live One')];
    renderBrowser();

    expect(await screen.findByRole('button', { name: 'Show Pending' })).toBeTruthy();
    expect(pinnedGroup()).toBeNull();
  });

  it('turned on from a later page returns to page 1, where the group shows', async () => {
    catalog.items = [
      ...Array.from({ length: 13 }, (_, i) => listing(`l${i}`, `Live ${i}`, { updated_at: day(28 - i) })),
      fresh('new', 'New Two', 3),
    ];
    renderBrowser();
    fireEvent.click(await screen.findByRole('button', { name: 'Show Pending' }));
    fireEvent.click(screen.getByLabelText('Go to next page'));
    expect(pinnedGroup()).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Show Pending' }));

    expect(pinnedGroup()).not.toBeNull();
  });

  it('off gives the player view: new listings hidden, updates and own listings in their slot', async () => {
    renderBrowser();
    fireEvent.click(await screen.findByRole('button', { name: 'Show Pending' }));

    expect(pinnedGroup()).toBeNull();
    expect(gridNames(ALL)).toEqual(['Live One', 'Update Four', 'Mine Five']);
    expect(screen.getByText(PENDING_REVIEW_HINT)).toBeTruthy();
    expect(screen.getByText(UPDATE_PENDING_HINT)).toBeTruthy();
  });

  it('stays off across a remount', async () => {
    const first = renderBrowser();
    fireEvent.click(await screen.findByRole('button', { name: 'Show Pending' }));
    first.unmount();

    renderBrowser();

    expect((await screen.findByRole('button', { name: 'Show Pending' })).getAttribute('aria-pressed')).toBe('false');
    expect(pinnedGroup()).toBeNull();
  });
});
