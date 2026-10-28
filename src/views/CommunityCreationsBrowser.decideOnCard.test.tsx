import { useState } from 'react';
import { render, screen, fireEvent, cleanup, within, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { toast } from 'react-toastify';
import CommunityCreationsBrowser from './CommunityCreationsBrowser';
import type { WorldRecord } from '@/components/WorldDetails';
import ReviewService, { CONTEST_LOCKED, ReviewConflictError, type ReviewRejection } from '@/services/ReviewService';

vi.mock('react-toastify', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));

vi.mock('@/services/AuthService', () => ({
  default: { token: 'test-token', getCurrentUser: () => null },
}));

vi.mock('@/services/WorldStorageService', () => ({
  default: { API_URL: 'https://example.test/api' },
}));

// The catalog list is the fixture; the real hook fetches and caches through IndexedDB.
const catalog = vi.hoisted(() => ({ items: [] as Record<string, unknown>[], resync: (() => {}) as () => void }));

vi.mock('@/lib/useCatalogSync', () => ({
  useCatalogSync: () => {
    const [remoteWorlds, setRemoteWorlds] = useState(catalog.items);
    return {
      remoteWorlds, setRemoteWorlds, isLoadingRemoteWorlds: false, isSyncingCatalog: false,
      loadCatalog: vi.fn(), resyncCatalog: catalog.resync,
    };
  },
}));

vi.mock('@/components/community/RemoteWorldDetailsModal', () => ({ RemoteWorldDetailsModal: () => null }));

// The composer has its own tests; here it only has to say what it was opened with.
vi.mock('@/components/menu/MessageComposerDialog', () => ({
  MessageComposerDialog: ({ initialSubject }: { initialSubject: string }) => (
    <div data-testid="composer">{initialSubject}</div>
  ),
}));

const day = (n: number) => new Date(Date.UTC(2026, 9, n)).toISOString();

const listing = (id: string, name: string, over: Record<string, unknown> = {}) => ({
  _id: id, id, kind: 'world', name, description: '', tags: [], downloads: 0,
  author: { id: 'author-1', username: 'alice' },
  updated_at: day(1),
  ...over,
});

const fresh = (id: string, name: string, over: Record<string, unknown> = {}) =>
  listing(id, name, { moderation_state: 'pending', moderation_queued_at: day(3), ...over });
const update = (id: string, name: string) => listing(id, name, {
  moderation_state: 'approved', moderation_queued_at: day(1), has_pending_update: true,
  pending_preview: { name: `${name} Draft`, queued_at: day(4) },
});

const moderator = { id: 'mod-1', username: 'a-mod', accountType: 'mod' } as unknown as WorldRecord;

const renderBrowser = () => render(browser(true));

const browser = (open: boolean) => (
    <CommunityCreationsBrowser
      open={open}
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
      currentUser={moderator}
      openImageViewer={() => {}}
    />
);

const pinnedGroup = () => screen.queryByRole('region', { name: 'Awaiting Review' });
const inPinned = (name: string) => Boolean(pinnedGroup() && within(pinnedGroup()!).queryByText(name));
const onPage = (name: string) => screen.queryAllByText(name).length > 0;
const approveOf = (name: string) => screen.queryByRole('button', { name: `Approve ${name}` }) as HTMLButtonElement | null;
const rejectOf = (name: string) => screen.queryByRole('button', { name: `Reject ${name}` }) as HTMLButtonElement | null;

const rejection = (id: string): ReviewRejection => ({
  id,
  author: { id: 'author-1', username: 'alice' },
  quarantinedAt: day(5),
  quarantineExpiresAt: day(12),
  quarantineExtended: false,
});

let resync: ReturnType<typeof vi.fn>;

beforeEach(() => {
  // jsdom has no `matchMedia`; the browser reads it for the mobile layout switch.
  window.matchMedia = ((query: string) => ({
    matches: false, media: query, onchange: null,
    addEventListener: () => {}, removeEventListener: () => {},
    addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
  localStorage.clear();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  resync = vi.fn();
  catalog.resync = resync as unknown as () => void;
  catalog.items = [
    listing('live', 'Live One'),
    fresh('new', 'New Two'),
    update('upd', 'Update Four'),
    fresh('own', 'Own Five', { author: { id: 'mod-1', username: 'a-mod' } }),
    fresh('peer', 'Peer Six', { author: { id: 'mod-2', username: 'b-mod', role: 'mod' } }),
  ];
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('deciding on a pinned card', () => {
  it('offers the check and X only on pinned cards the viewer may decide', async () => {
    renderBrowser();
    await screen.findByRole('region', { name: 'Awaiting Review' });

    expect(approveOf('New Two')).not.toBeNull();
    expect(rejectOf('Update Four Draft')).not.toBeNull();
    // Own work, and a peer mod's, stay pinned without the controls.
    expect(inPinned('Own Five')).toBe(true);
    expect(approveOf('Own Five')).toBeNull();
    expect(inPinned('Peer Six')).toBe(true);
    expect(approveOf('Peer Six')).toBeNull();
    expect(approveOf('Live One')).toBeNull();
  });

  it('approves at once and moves the card to the normal list', async () => {
    vi.spyOn(ReviewService, 'approve').mockResolvedValue(undefined);
    renderBrowser();
    await screen.findByRole('region', { name: 'Awaiting Review' });

    fireEvent.click(approveOf('New Two')!);

    await waitFor(() => expect(inPinned('New Two')).toBe(false));
    expect(onPage('New Two')).toBe(true);
    expect(ReviewService.approve).toHaveBeenCalledWith('new');
    expect(resync).toHaveBeenCalledTimes(1);
  });

  it('approves an update under its pending name, once, in the normal list', async () => {
    vi.spyOn(ReviewService, 'approve').mockResolvedValue(undefined);
    renderBrowser();
    await screen.findByRole('region', { name: 'Awaiting Review' });

    fireEvent.click(approveOf('Update Four Draft')!);

    await waitFor(() => expect(onPage('Update Four Draft')).toBe(true));
    expect(onPage('Update Four')).toBe(false);
    expect(inPinned('Update Four Draft')).toBe(false);
  });

  it('rejects a new listing through the quarantine length, then the composer, into Quarantined', async () => {
    vi.spyOn(ReviewService, 'reject').mockResolvedValue(rejection('new'));
    renderBrowser();
    await screen.findByRole('region', { name: 'Awaiting Review' });

    fireEvent.click(rejectOf('New Two')!);
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Quarantine' }));

    expect(await screen.findByTestId('composer')).toBeTruthy();
    expect(ReviewService.reject).toHaveBeenCalledWith('new', expect.any(Number));
    expect(inPinned('New Two')).toBe(false);
    expect(resync).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: /^Quarantined/ }));
    expect(onPage('New Two')).toBe(true);
  });

  it('rejects an update through the confirm and the update template, back to its live face', async () => {
    vi.spyOn(ReviewService, 'reject').mockResolvedValue({ id: 'upd', author: { id: 'author-1', username: 'alice' } });
    renderBrowser();
    await screen.findByRole('region', { name: 'Awaiting Review' });

    fireEvent.click(rejectOf('Update Four Draft')!);
    fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Reject' }));

    expect((await screen.findByTestId('composer')).textContent).toMatch(/update/i);
    expect(ReviewService.reject).toHaveBeenCalledWith('upd', undefined);
    expect(inPinned('Update Four')).toBe(false);
    expect(onPage('Update Four')).toBe(true);
    expect(onPage('Update Four Draft')).toBe(false);
  });

  it('disables the check and X while a decision is in flight', async () => {
    let finish: () => void = () => {};
    vi.spyOn(ReviewService, 'approve').mockImplementation(() => new Promise((resolve) => { finish = () => resolve(); }));
    renderBrowser();
    await screen.findByRole('region', { name: 'Awaiting Review' });

    fireEvent.click(approveOf('New Two')!);

    await waitFor(() => expect(approveOf('Update Four Draft')!.disabled).toBe(true));
    expect(rejectOf('New Two')!.disabled).toBe(true);
    finish();
    await waitFor(() => expect(approveOf('Update Four Draft')!.disabled).toBe(false));
  });

  it('drops the card with a toast when another mod decided first', async () => {
    vi.spyOn(ReviewService, 'approve').mockRejectedValue(new ReviewConflictError('Not pending', 'NOT_PENDING'));
    renderBrowser();
    await screen.findByRole('region', { name: 'Awaiting Review' });

    fireEvent.click(approveOf('New Two')!);

    await waitFor(() => expect(onPage('New Two')).toBe(false));
    expect(toast.info).toHaveBeenCalledWith('Another mod already handled this item');
    expect(resync).toHaveBeenCalledTimes(1);
  });

  it('leaves the re-sync to the next open when the decision lands after a close', async () => {
    let finish: () => void = () => {};
    vi.spyOn(ReviewService, 'approve').mockImplementation(() => new Promise((resolve) => { finish = () => resolve(); }));
    const { rerender } = renderBrowser();
    await screen.findByRole('region', { name: 'Awaiting Review' });

    fireEvent.click(approveOf('New Two')!);
    rerender(browser(false));
    finish();

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('World approved'));
    expect(resync).not.toHaveBeenCalled();
  });

  it('keeps a contest-locked update pinned with a toast', async () => {
    vi.spyOn(ReviewService, 'approve').mockRejectedValue(new ReviewConflictError('Locked', CONTEST_LOCKED));
    renderBrowser();
    await screen.findByRole('region', { name: 'Awaiting Review' });

    fireEvent.click(approveOf('Update Four Draft')!);

    await waitFor(() => expect(toast.info).toHaveBeenCalled());
    expect(inPinned('Update Four Draft')).toBe(true);
    expect(resync).toHaveBeenCalledTimes(1);
  });
});
