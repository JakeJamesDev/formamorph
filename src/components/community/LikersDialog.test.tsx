import { render, screen, cleanup, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { toast } from 'react-toastify';
import { LikersDialog } from './LikersDialog';
import { UserProfileContext } from '@/contexts/userProfileStore';
import WorldStorageService from '@/services/WorldStorageService';
import type { WorldRecord } from '@/components/WorldDetails';
import type { LikerRow } from '@/types';

vi.mock('react-toastify', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));

const DAY = 86_400;

const liker = (over: Partial<LikerRow> = {}): LikerRow => ({
  id: 'u1',
  username: 'wren_hallow',
  avatarUrl: null,
  status: 'active',
  createdAt: '2026-03-14 00:00:00',
  likedAt: '2026-08-30 12:00:00',
  accountAgeAtLikeSeconds: 400 * DAY,
  ...over,
});

const admin = { id: 'a1', username: 'root-admin', accountType: 'admin' } as unknown as WorldRecord;
const moderator = { id: 'm1', username: 'a-mod', accountType: 'mod' } as unknown as WorldRecord;

/** The rows on screen, in the order they are rendered. */
const rowEls = () => screen.getAllByRole('listitem');

const openProfile = vi.fn();

const show = (props: Record<string, unknown> = {}) =>
  render(
    <UserProfileContext.Provider value={{ openProfile, setListingOpener: () => {} }}>
      <LikersDialog
        open
        onOpenChange={() => {}}
        listingId="w1"
        listingName="Sedge Landing"
        currentUser={admin}
        {...props}
      />
    </UserProfileContext.Provider>
  );

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('reading who liked a listing', () => {
  it('names the listing and says how many likes there are in total', async () => {
    vi.spyOn(WorldStorageService, 'fetchLikers').mockResolvedValue({ total: 3, rows: [liker()] });

    show();

    expect(await screen.findByText(/Who liked/)).toHaveTextContent('Sedge Landing');
    // The total, not the row count: the server caps the list, and a capped list is the interesting one.
    expect(screen.getByText(/3 likes/)).toBeTruthy();
    expect(screen.getByText(/showing the newest 1/)).toBeTruthy();
  });

  it('says nothing about a cap when the whole list came back', async () => {
    vi.spyOn(WorldStorageService, 'fetchLikers').mockResolvedValue({ total: 1, rows: [liker()] });

    show();

    expect(await screen.findByText('1 like')).toBeTruthy();
  });

  it('carries every field a row is meant to show', async () => {
    vi.spyOn(WorldStorageService, 'fetchLikers').mockResolvedValue({
      total: 1,
      rows: [liker({ status: 'suspended', accountAgeAtLikeSeconds: 4 * 60 })],
    });

    show();

    const row = (await screen.findAllByRole('listitem'))[0];
    expect(within(row).getByText('wren_hallow')).toBeTruthy();
    expect(within(row).getByText('suspended')).toBeTruthy();
    expect(within(row).getByText(/Member since/)).toBeTruthy();
    expect(within(row).getByText(/^Liked/)).toBeTruthy();
    // The phrase, not two dates to compare — the whole reason the field exists.
    expect(within(row).getByText(/account was 4 minutes/)).toBeTruthy();
  });

  it('keeps the server’s order, newest like first', async () => {
    vi.spyOn(WorldStorageService, 'fetchLikers').mockResolvedValue({
      total: 2,
      rows: [liker({ id: 'u1', username: 'newest' }), liker({ id: 'u2', username: 'oldest' })],
    });

    show();

    await screen.findByText('newest');
    expect(rowEls().map((el) => el.textContent?.includes('newest'))).toEqual([true, false]);
  });

  it('opens a liker’s profile from their name', async () => {
    vi.spyOn(WorldStorageService, 'fetchLikers').mockResolvedValue({ total: 1, rows: [liker()] });

    show();

    fireEvent.click(await screen.findByRole('button', { name: /View wren_hallow's profile/ }));
    expect(openProfile).toHaveBeenCalledWith('u1', 'wren_hallow');
  });

  it('shows skeletons while the list is in flight, and rows after', async () => {
    let land: (value: { total: number; rows: LikerRow[] }) => void = () => {};
    vi.spyOn(WorldStorageService, 'fetchLikers').mockReturnValue(
      new Promise((resolve) => { land = resolve; })
    );

    show();

    // The dialog is portaled, so the skeletons are in the body rather than under the render container.
    expect(document.body.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
    expect(screen.queryAllByRole('listitem')).toHaveLength(0);

    land({ total: 1, rows: [liker()] });
    expect(await screen.findByText('wren_hallow')).toBeTruthy();
  });

  it('says so plainly when nobody has liked it', async () => {
    vi.spyOn(WorldStorageService, 'fetchLikers').mockResolvedValue({ total: 0, rows: [] });

    show();

    expect(await screen.findByText('Nobody has liked this yet.')).toBeTruthy();
  });

  it('shows the server’s wording when the list is refused', async () => {
    vi.spyOn(WorldStorageService, 'fetchLikers').mockRejectedValue(new Error('Staff only'));

    show();

    expect(await screen.findByText('Staff only')).toBeTruthy();
  });

  it('fetches nothing while it is closed', () => {
    const fetchLikers = vi.spyOn(WorldStorageService, 'fetchLikers')
      .mockResolvedValue({ total: 0, rows: [] });

    show({ open: false });

    expect(fetchLikers).not.toHaveBeenCalled();
  });
});

describe('marking accounts made for the like', () => {
  it('tints a row whose account was under a day old, and leaves an older one alone', async () => {
    vi.spyOn(WorldStorageService, 'fetchLikers').mockResolvedValue({
      total: 2,
      rows: [
        liker({ id: 'fresh', username: 'fresh_one', accountAgeAtLikeSeconds: 4 * 60 }),
        liker({ id: 'old', username: 'old_hand', accountAgeAtLikeSeconds: 400 * DAY }),
      ],
    });

    show();

    await screen.findByText('fresh_one');
    const [fresh, old] = rowEls();
    expect(fresh.getAttribute('data-fresh')).toBe('true');
    expect(old.getAttribute('data-fresh')).toBeNull();
  });

  it('leaves the row unmarked on the exact day boundary', async () => {
    // A day old is a day old; the mark is for accounts made the same day they liked.
    vi.spyOn(WorldStorageService, 'fetchLikers').mockResolvedValue({
      total: 1,
      rows: [liker({ accountAgeAtLikeSeconds: DAY })],
    });

    show();

    await screen.findByText('wren_hallow');
    expect(rowEls()[0].getAttribute('data-fresh')).toBeNull();
  });
});

describe('removing one like', () => {
  const withRows = (rows: LikerRow[], total = rows.length) =>
    vi.spyOn(WorldStorageService, 'fetchLikers').mockResolvedValue({ total, rows });

  it('asks first, and leaves the row alone when the answer is no', async () => {
    withRows([liker()]);
    const removeLike = vi.spyOn(WorldStorageService, 'removeLike').mockResolvedValue(2);

    show();

    fireEvent.click(await screen.findByRole('button', { name: 'Remove the like by wren_hallow' }));
    expect(await screen.findByText('Remove this like?')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(removeLike).not.toHaveBeenCalled();
    expect(screen.getByText('wren_hallow')).toBeTruthy();
  });

  it('calls the service with the listing and the account, drops the row and reports the new count', async () => {
    withRows([liker({ id: 'u1' }), liker({ id: 'u2', username: 'other_one' })], 3);
    const removeLike = vi.spyOn(WorldStorageService, 'removeLike').mockResolvedValue(2);
    const onLikesChanged = vi.fn();

    show({ onLikesChanged });

    fireEvent.click(await screen.findByRole('button', { name: 'Remove the like by wren_hallow' }));
    fireEvent.click(await screen.findByRole('button', { name: /continue|confirm|^ok$/i }));

    await waitFor(() => expect(removeLike).toHaveBeenCalledWith('w1', 'u1'));
    // The row leaves, the header total drops with it, and the parent gets the server's own count.
    await waitFor(() => expect(screen.queryByText('wren_hallow')).toBeNull());
    expect(screen.getByText('other_one')).toBeTruthy();
    expect(screen.getByText(/^2 likes/)).toBeTruthy();
    expect(onLikesChanged).toHaveBeenCalledWith(2);
  });

  it('keeps the row and toasts the server’s wording when the removal is refused', async () => {
    withRows([liker()]);
    vi.spyOn(WorldStorageService, 'removeLike').mockRejectedValue(new Error('You cannot moderate them'));

    show();

    fireEvent.click(await screen.findByRole('button', { name: 'Remove the like by wren_hallow' }));
    fireEvent.click(await screen.findByRole('button', { name: /continue|confirm|^ok$/i }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('You cannot moderate them'));
    expect(screen.getByText('wren_hallow')).toBeTruthy();
    expect(screen.getByText(/^1 like/)).toBeTruthy();
  });
});

describe('the staff ladder on a row', () => {
  it('offers the removal on an ordinary account', async () => {
    vi.spyOn(WorldStorageService, 'fetchLikers').mockResolvedValue({ total: 1, rows: [liker()] });

    show({ currentUser: moderator });

    expect(await screen.findByRole('button', { name: 'Remove the like by wren_hallow' })).toBeTruthy();
  });

  it('hides it from a moderator on a row the server says is staff', async () => {
    // A mod reaches the room, not the team. The row carries a role only once the server sends one.
    vi.spyOn(WorldStorageService, 'fetchLikers').mockResolvedValue({
      total: 1,
      rows: [liker({ role: 'dev' })],
    });

    show({ currentUser: moderator });

    await screen.findByText('wren_hallow');
    expect(screen.queryByRole('button', { name: 'Remove the like by wren_hallow' })).toBeNull();
  });

  it('offers it to an admin on that same row', async () => {
    vi.spyOn(WorldStorageService, 'fetchLikers').mockResolvedValue({
      total: 1,
      rows: [liker({ role: 'dev' })],
    });

    show({ currentUser: admin });

    expect(await screen.findByRole('button', { name: 'Remove the like by wren_hallow' })).toBeTruthy();
  });

  it('hides it from everybody on an admin row', async () => {
    vi.spyOn(WorldStorageService, 'fetchLikers').mockResolvedValue({
      total: 1,
      rows: [liker({ role: 'admin' })],
    });

    show({ currentUser: admin });

    await screen.findByText('wren_hallow');
    expect(screen.queryByRole('button', { name: 'Remove the like by wren_hallow' })).toBeNull();
  });
});
