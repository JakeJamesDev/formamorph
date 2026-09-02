import { render, screen, cleanup, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { toast } from 'react-toastify';
import { UserProfileDialog } from './UserProfileDialog';
import { UserProfileContext } from '@/contexts/userProfileStore';
import UserService from '@/services/UserService';
import AuthService from '@/services/AuthService';
import type { LikeGiven } from '@/types';

vi.mock('@/services/WorldStorageService', () => ({ default: { API_URL: 'https://server.test/api' } }));
vi.mock('react-toastify', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));

/** Sign in as somebody with a role, so the staff gate has a reader to judge. */
const signedInAs = (accountType: string, id = 'me') =>
  vi.spyOn(AuthService, 'getCurrentUser').mockReturnValue({ id, username: 'reader', accountType });

const profile = (over: Record<string, unknown> = {}) => ({
  id: 'u1',
  username: 'wren_hallow',
  avatarUrl: null,
  createdAt: '2026-03-14T00:00:00.000Z',
  followers: 0,
  likes: 0,
  downloads: 0,
  ...over,
});

const like = (over: Partial<LikeGiven> = {}): LikeGiven => ({
  id: 'w1',
  name: 'Sedge Landing',
  authorId: 'author-1',
  authorUsername: 'tam_reads',
  quarantined: false,
  likedAt: '2026-08-30 12:00:00',
  ...over,
});

const openProfile = vi.fn();

const show = (props: Record<string, unknown> = {}) =>
  render(
    <UserProfileContext.Provider value={{ openProfile, setListingOpener: () => {} }}>
      <UserProfileDialog userId="u1" onOpenChange={() => {}} {...props} />
    </UserProfileContext.Provider>
  );

/** Open the Likes tab, which is what makes it fetch. Radix tabs switch on mousedown, not click. */
const openLikes = async () => {
  fireEvent.mouseDown(await screen.findByRole('tab', { name: 'Likes' }));
};

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(UserService, 'fetchCreations').mockResolvedValue([]);
  vi.spyOn(UserService, 'fetchProfile').mockResolvedValue(profile());
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('who gets a Likes tab', () => {
  it('shows no tab strip at all to an ordinary reader', async () => {
    signedInAs('normal');
    const fetchLikes = vi.spyOn(UserService, 'fetchLikesGiven')
      .mockResolvedValue({ total: 0, rows: [] });

    show();

    await screen.findByText(/Member since/);
    expect(screen.queryByRole('tab', { name: 'Likes' })).toBeNull();
    expect(fetchLikes).not.toHaveBeenCalled();
  });

  it('shows none to a signed-out visitor', async () => {
    vi.spyOn(AuthService, 'getCurrentUser').mockReturnValue(null);

    show();

    await screen.findByText(/Member since/);
    expect(screen.queryByRole('tab', { name: 'Likes' })).toBeNull();
  });

  it('shows one to a moderator, beside Creations', async () => {
    signedInAs('mod');

    show();

    expect(await screen.findByRole('tab', { name: 'Creations' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Likes' })).toBeTruthy();
  });
});

describe('reading what an account has liked', () => {
  it('fetches on the first activation, and not before or again', async () => {
    signedInAs('admin');
    const fetchLikes = vi.spyOn(UserService, 'fetchLikesGiven')
      .mockResolvedValue({ total: 1, rows: [like()] });

    show();

    await screen.findByRole('tab', { name: 'Likes' });
    expect(fetchLikes).not.toHaveBeenCalled();

    await openLikes();
    await waitFor(() => expect(fetchLikes).toHaveBeenCalledWith('u1'));

    // Back and forth again: the list is already in hand, so nothing is re-read.
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Creations' }));
    await openLikes();
    expect(fetchLikes).toHaveBeenCalledTimes(1);
  });

  it('carries the listing, its author, the like time and a hidden marker', async () => {
    signedInAs('admin');
    vi.spyOn(UserService, 'fetchLikesGiven').mockResolvedValue({
      total: 1,
      rows: [like({ quarantined: true })],
    });

    show();
    await openLikes();

    const row = (await screen.findAllByRole('listitem'))[0];
    expect(within(row).getByText('Sedge Landing')).toBeTruthy();
    expect(within(row).getByText('tam_reads')).toBeTruthy();
    expect(within(row).getByText('Hidden')).toBeTruthy();
    expect(within(row).getByText(/2026/)).toBeTruthy();
  });

  it('opens the listing through the opener it was lent', async () => {
    signedInAs('admin');
    vi.spyOn(UserService, 'fetchLikesGiven').mockResolvedValue({ total: 1, rows: [like()] });
    const onOpenListing = vi.fn();

    show({ onOpenListing });
    await openLikes();

    fireEvent.click(await screen.findByRole('button', { name: /Open Sedge Landing/ }));
    expect(onOpenListing).toHaveBeenCalledWith(expect.objectContaining({ id: 'w1' }));
  });

  it('opens the author’s profile from their name', async () => {
    signedInAs('admin');
    vi.spyOn(UserService, 'fetchLikesGiven').mockResolvedValue({ total: 1, rows: [like()] });

    show();
    await openLikes();

    fireEvent.click(await screen.findByRole('button', { name: /View tam_reads's profile/ }));
    expect(openProfile).toHaveBeenCalledWith('author-1', 'tam_reads');
  });

  it('says so when the account has liked nothing', async () => {
    signedInAs('admin');
    vi.spyOn(UserService, 'fetchLikesGiven').mockResolvedValue({ total: 0, rows: [] });

    show();
    await openLikes();

    expect(await screen.findByText(/hasn’t liked anything|hasn't liked anything/)).toBeTruthy();
  });

  it('shows the server’s wording when the list is refused', async () => {
    signedInAs('admin');
    vi.spyOn(UserService, 'fetchLikesGiven').mockRejectedValue(new Error('Staff only'));

    show();
    await openLikes();

    expect(await screen.findByText('Staff only')).toBeTruthy();
  });
});

describe('clearing an account’s likes', () => {
  it('is hidden when there is nothing to clear', async () => {
    signedInAs('admin');
    vi.spyOn(UserService, 'fetchLikesGiven').mockResolvedValue({ total: 0, rows: [] });

    show();
    await openLikes();

    await screen.findByText(/liked anything/);
    expect(screen.queryByRole('button', { name: /Clear all/ })).toBeNull();
  });

  it('is hidden on an account the reader cannot moderate', async () => {
    // A mod reaches the room, not the team. The profile carries the role, so this is honest up front.
    signedInAs('mod');
    vi.spyOn(UserService, 'fetchProfile').mockResolvedValue(profile({ role: 'dev' }));
    vi.spyOn(UserService, 'fetchLikesGiven').mockResolvedValue({ total: 1, rows: [like()] });

    show();
    await openLikes();

    await screen.findByText('Sedge Landing');
    expect(screen.queryByRole('button', { name: /Clear all/ })).toBeNull();
  });

  it('is offered to an admin on that same account', async () => {
    signedInAs('admin');
    vi.spyOn(UserService, 'fetchProfile').mockResolvedValue(profile({ role: 'dev' }));
    vi.spyOn(UserService, 'fetchLikesGiven').mockResolvedValue({ total: 1, rows: [like()] });

    show();
    await openLikes();

    expect(await screen.findByRole('button', { name: /Clear all/ })).toBeTruthy();
  });

  it('says how many it will remove, and does nothing when the answer is no', async () => {
    signedInAs('admin');
    vi.spyOn(UserService, 'fetchLikesGiven').mockResolvedValue({
      total: 4,
      rows: [like({ id: 'w1' }), like({ id: 'w2', name: 'Harrow Court' })],
    });
    const clearLikes = vi.spyOn(UserService, 'clearLikesGiven').mockResolvedValue(4);

    show();
    await openLikes();

    fireEvent.click(await screen.findByRole('button', { name: /Clear all/ }));
    // The full count, not the rows on screen — the list is capped and the action is not.
    expect(await screen.findByText('Remove 4 likes?')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(clearLikes).not.toHaveBeenCalled();
    expect(screen.getByText('Sedge Landing')).toBeTruthy();
  });

  it('empties the list, says so, and toasts how many went', async () => {
    signedInAs('admin');
    vi.spyOn(UserService, 'fetchLikesGiven').mockResolvedValue({ total: 2, rows: [like()] });
    const clearLikes = vi.spyOn(UserService, 'clearLikesGiven').mockResolvedValue(2);

    show();
    await openLikes();

    fireEvent.click(await screen.findByRole('button', { name: /Clear all/ }));
    fireEvent.click(await screen.findByRole('button', { name: /continue|confirm|^ok$/i }));

    await waitFor(() => expect(clearLikes).toHaveBeenCalledWith('u1'));
    expect(await screen.findByText(/liked anything/)).toBeTruthy();
    expect(toast.success).toHaveBeenCalledWith('Removed 2 likes');
    expect(screen.queryByRole('button', { name: /Clear all/ })).toBeNull();
  });

  it('keeps the list and toasts the server’s wording when the clear is refused', async () => {
    signedInAs('admin');
    vi.spyOn(UserService, 'fetchLikesGiven').mockResolvedValue({ total: 1, rows: [like()] });
    vi.spyOn(UserService, 'clearLikesGiven').mockRejectedValue(new Error('You cannot moderate them'));

    show();
    await openLikes();

    fireEvent.click(await screen.findByRole('button', { name: /Clear all/ }));
    fireEvent.click(await screen.findByRole('button', { name: /continue|confirm|^ok$/i }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('You cannot moderate them'));
    expect(screen.getByText('Sedge Landing')).toBeTruthy();
  });
});
