import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NotificationsTab } from './NotificationsTab';
import UserService from '@/services/UserService';
import type { FeedItem, FollowedUser } from '@/types';

vi.mock('react-toastify', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));
vi.mock('@/lib/apiBase', () => ({ API_BASE_URL: 'https://server.test/api' }));

const item = (over: Partial<FeedItem> = {}): FeedItem => ({
  id: 'w1',
  name: 'Sedge Landing',
  kind: 'world',
  event: 'published',
  at: '2026-08-01T00:00:00.000Z',
  author: { id: 'u1', username: 'wren_hallow', avatarUrl: null },
  ...over,
});

const followed = (over: Partial<FollowedUser> = {}): FollowedUser => ({
  id: 'u1',
  username: 'wren_hallow',
  avatarUrl: null,
  followedAt: '2026-07-01T00:00:00.000Z',
  ...over,
});

const stub = (items: FeedItem[] = [], following: FollowedUser[] = []) => {
  vi.spyOn(UserService, 'fetchNotifications').mockResolvedValue({ items, unread: items.length });
  vi.spyOn(UserService, 'fetchFollowing').mockResolvedValue(following);
};

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('the feed', () => {
  it('says what somebody did and to what', async () => {
    stub([item()], [followed()]);

    render(<NotificationsTab active />);

    expect(await screen.findByText(/published a new world/)).toBeTruthy();
    expect(screen.getByText(/Sedge Landing/)).toBeTruthy();
  });

  it('tells an update apart from something new', async () => {
    stub([item({ event: 'updated' })], [followed()]);

    render(<NotificationsTab active />);

    expect(await screen.findByText(/updated their world/)).toBeTruthy();
  });

  it('names the kind, since following covers all three', async () => {
    stub([item({ kind: 'entity', name: 'Ilsa of the Weir' })], [followed()]);

    render(<NotificationsTab active />);

    expect(await screen.findByText(/published a new entity/)).toBeTruthy();
  });

  it('fetches nothing until the tab is opened', () => {
    stub();

    render(<NotificationsTab active={false} />);

    expect(UserService.fetchNotifications).not.toHaveBeenCalled();
  });

  it('fetches once, however often the host re-renders', async () => {
    // Found live: the host passed an inline arrow, so `onRead` changed identity every render. Reading
    // the feed bumps the host's badge state, which re-rendered it, which handed back a new callback,
    // which refetched — a loop that ran until the server fell over.
    stub([item()], [followed()]);
    const { rerender } = render(<NotificationsTab active onRead={() => {}} />);
    await waitFor(() => expect(UserService.fetchNotifications).toHaveBeenCalledTimes(1));

    for (let i = 0; i < 5; i++) {
      rerender(<NotificationsTab active onRead={() => {}} />);
    }

    await waitFor(() => expect(UserService.fetchNotifications).toHaveBeenCalledTimes(1));
  });

  it('reports the read, since reading the feed is what clears the badge', async () => {
    stub([item()], [followed()]);
    const onRead = vi.fn();

    render(<NotificationsTab active onRead={onRead} />);

    await waitFor(() => expect(onRead).toHaveBeenCalled());
  });
});

describe('when there is nothing', () => {
  it('points somebody who follows nobody at what to do', async () => {
    stub([], []);

    render(<NotificationsTab active />);

    expect(await screen.findByText(/Follow someone and their new work/)).toBeTruthy();
  });

  it('says something different to somebody who already follows people', async () => {
    // "Follow someone" would be wrong advice for a reader who has.
    stub([], [followed()]);

    render(<NotificationsTab active />);

    expect(await screen.findByText(/Nothing new from anyone you follow/)).toBeTruthy();
  });
});

describe('the following list', () => {
  it('says how many without being opened', async () => {
    stub([], [followed(), followed({ id: 'u2', username: 'osk_tinder' })]);

    render(<NotificationsTab active />);

    expect(await screen.findByRole('button', { name: /Following \(2\)/ })).toBeTruthy();
  });

  it('stays shut until asked', async () => {
    stub([], [followed()]);

    render(<NotificationsTab active />);
    await screen.findByRole('button', { name: /Following/ });

    expect(screen.queryByLabelText('Unfollow wren_hallow')).toBeNull();
  });

  it('opens to show who they are', async () => {
    stub([], [followed()]);

    render(<NotificationsTab active />);
    fireEvent.click(await screen.findByRole('button', { name: /Following/ }));

    expect(screen.getByLabelText('Unfollow wren_hallow')).toBeTruthy();
  });

  it('takes their rows out of the feed when they are unfollowed', async () => {
    // The feed is a view over who you follow, not a stored list — leaving the rows would be a lie.
    vi.spyOn(UserService, 'setFollowing').mockResolvedValue({ following: false, followers: 0 });
    stub([item()], [followed()]);

    render(<NotificationsTab active />);
    fireEvent.click(await screen.findByRole('button', { name: /Following/ }));
    fireEvent.click(screen.getByLabelText('Unfollow wren_hallow'));

    await waitFor(() => expect(screen.queryByText(/published a new world/)).toBeNull());
    expect(screen.getByRole('button', { name: /Following \(0\)/ })).toBeTruthy();
  });

  it('keeps them when the unfollow is refused', async () => {
    vi.spyOn(UserService, 'setFollowing').mockRejectedValue(new Error('nope'));
    stub([item()], [followed()]);

    render(<NotificationsTab active />);
    fireEvent.click(await screen.findByRole('button', { name: /Following/ }));
    fireEvent.click(screen.getByLabelText('Unfollow wren_hallow'));

    await waitFor(() => expect(screen.getByRole('button', { name: /Following \(1\)/ })).toBeTruthy());
    expect(screen.getByText(/published a new world/)).toBeTruthy();
  });
});

describe('opening what a row is about', () => {
  it('offers the listing as a control, naming where it goes', async () => {
    stub([item()], [followed()]);

    render(<NotificationsTab active onOpenListing={() => {}} />);

    expect(await screen.findByRole('button', { name: 'Open Sedge Landing in Community Creations' })).toBeTruthy();
  });

  it('hands back the whole row, since the browser needs its kind as well as its id', async () => {
    const onOpenListing = vi.fn();
    stub([item({ kind: 'entity' })], [followed()]);

    render(<NotificationsTab active onOpenListing={onOpenListing} />);
    fireEvent.click(await screen.findByRole('button', { name: /Open Sedge Landing/ }));

    expect(onOpenListing).toHaveBeenCalledWith(expect.objectContaining({ id: 'w1', kind: 'entity' }));
  });

  it('leaves the name as plain text when there is nowhere to go', async () => {
    // A control that opens nothing reads as broken.
    stub([item()], [followed()]);

    render(<NotificationsTab active />);
    await screen.findByText(/published a new world/);

    expect(screen.queryByRole('button', { name: /Open Sedge Landing/ })).toBeNull();
  });

  it('keeps the author’s name its own control', async () => {
    // Two different destinations in one sentence; nesting them would swallow the inner click.
    stub([item()], [followed()]);

    render(<NotificationsTab active onOpenListing={() => {}} />);

    expect(await screen.findByRole('button', { name: "View wren_hallow's profile" })).toBeTruthy();
  });
});

describe('the staff badge', () => {
  it('marks a row published by somebody on the team', async () => {
    stub([item({ author: { id: 'u1', username: 'wren_hallow', avatarUrl: null, role: 'dev' } })], [followed()]);

    render(<NotificationsTab active />);

    expect(await screen.findByText('Dev')).toBeTruthy();
  });

  it('marks them in the list of who you follow', async () => {
    stub([], [followed({ role: 'admin' })]);

    render(<NotificationsTab active />);
    fireEvent.click(await screen.findByRole('button', { name: /Following/ }));

    expect(screen.getByText('Admin')).toBeTruthy();
  });

  it('leaves an ordinary author unmarked', async () => {
    stub([item()], [followed()]);

    render(<NotificationsTab active />);
    await screen.findByText(/published a new world/);

    expect(screen.queryByText(/^(Mod|Dev|Admin)$/)).toBeNull();
  });

  it('keeps the unfollow button at the end of the row', async () => {
    // The badge is wrapped in with the name, so the row's stretch has to sit outside both — otherwise
    // the name grows and pushes the control off the end.
    stub([], [followed({ role: 'mod' })]);

    render(<NotificationsTab active />);
    fireEvent.click(await screen.findByRole('button', { name: /Following/ }));

    // Whatever takes up the slack has to hold the badge as well as the name. Stretching the name alone
    // leaves the badge outside it, competing with the unfollow button for the end of the row.
    const stretched = screen.getByLabelText('Unfollow wren_hallow').parentElement?.querySelector('.flex-1');
    expect(stretched).toBeTruthy();
    expect(stretched?.contains(screen.getByText('Mod'))).toBe(true);
  });
});
