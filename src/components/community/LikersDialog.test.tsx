import { render, screen, cleanup, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { toast } from 'react-toastify';
import { LikersDialog } from './LikersDialog';
import { UserProfileContext } from '@/contexts/userProfileStore';
import WorldStorageService from '@/services/WorldStorageService';
import type { WorldRecord } from '@/components/WorldDetails';
import type { AnonymousLikeRow, LikerAuditRow, LikerRow } from '@/types';

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
    vi.spyOn(WorldStorageService, 'fetchLikers').mockResolvedValue({ anonymous: 0, total: 3, rows: [liker()] });

    show();

    expect(await screen.findByText(/Who liked/)).toHaveTextContent('Sedge Landing');
    // The total, not the row count: the server caps the list, and a capped list is the interesting one.
    expect(screen.getByText(/3 likes/)).toBeTruthy();
    expect(screen.getByText(/showing the newest 1/)).toBeTruthy();
  });

  it('says nothing about a cap when the whole list came back', async () => {
    vi.spyOn(WorldStorageService, 'fetchLikers').mockResolvedValue({ anonymous: 0, total: 1, rows: [liker()] });

    show();

    expect(await screen.findByText('1 like')).toBeTruthy();
  });

  it('carries every field a row is meant to show', async () => {
    vi.spyOn(WorldStorageService, 'fetchLikers').mockResolvedValue({ anonymous: 0, total: 1,
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
    vi.spyOn(WorldStorageService, 'fetchLikers').mockResolvedValue({ anonymous: 0, total: 2,
      rows: [liker({ id: 'u1', username: 'newest' }), liker({ id: 'u2', username: 'oldest' })],
    });

    show();

    await screen.findByText('newest');
    expect(rowEls().map((el) => el.textContent?.includes('newest'))).toEqual([true, false]);
  });

  it('opens a liker’s profile from their name', async () => {
    vi.spyOn(WorldStorageService, 'fetchLikers').mockResolvedValue({ anonymous: 0, total: 1, rows: [liker()] });

    show();

    fireEvent.click(await screen.findByRole('button', { name: /View wren_hallow's profile/ }));
    expect(openProfile).toHaveBeenCalledWith('u1', 'wren_hallow');
  });

  it('shows skeletons while the list is in flight, and rows after', async () => {
    let land: (value: { total: number; rows: LikerRow[]; anonymous: number }) => void = () => {};
    vi.spyOn(WorldStorageService, 'fetchLikers').mockReturnValue(
      new Promise((resolve) => { land = resolve; })
    );

    show();

    // The dialog is portaled, so the skeletons are in the body rather than under the render container.
    expect(document.body.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
    expect(screen.queryAllByRole('listitem')).toHaveLength(0);

    land({ total: 1, rows: [liker()], anonymous: 0 });
    expect(await screen.findByText('wren_hallow')).toBeTruthy();
  });

  it('says so plainly when nobody has liked it', async () => {
    vi.spyOn(WorldStorageService, 'fetchLikers').mockResolvedValue({ anonymous: 0, total: 0, rows: [] });

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
      .mockResolvedValue({ anonymous: 0, total: 0, rows: [] });

    show({ open: false });

    expect(fetchLikers).not.toHaveBeenCalled();
  });
});

describe('marking accounts made for the like', () => {
  it('tints a row whose account was under a day old, and leaves an older one alone', async () => {
    vi.spyOn(WorldStorageService, 'fetchLikers').mockResolvedValue({ anonymous: 0, total: 2,
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
    vi.spyOn(WorldStorageService, 'fetchLikers').mockResolvedValue({ anonymous: 0, total: 1,
      rows: [liker({ accountAgeAtLikeSeconds: DAY })],
    });

    show();

    await screen.findByText('wren_hallow');
    expect(rowEls()[0].getAttribute('data-fresh')).toBeNull();
  });
});

describe('removing one like', () => {
  const withRows = (rows: LikerRow[], total = rows.length) =>
    vi.spyOn(WorldStorageService, 'fetchLikers').mockResolvedValue({ anonymous: 0, total, rows });

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
    fireEvent.click(await screen.findByRole('button', { name: 'Confirm' }));

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
    fireEvent.click(await screen.findByRole('button', { name: 'Confirm' }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('You cannot moderate them'));
    expect(screen.getByText('wren_hallow')).toBeTruthy();
    expect(screen.getByText(/^1 like/)).toBeTruthy();
  });
});

describe('the staff ladder on a row', () => {
  it('offers the removal on an ordinary account', async () => {
    vi.spyOn(WorldStorageService, 'fetchLikers').mockResolvedValue({ anonymous: 0, total: 1, rows: [liker()] });

    show({ currentUser: moderator });

    expect(await screen.findByRole('button', { name: 'Remove the like by wren_hallow' })).toBeTruthy();
  });

  it('hides it from a moderator on a row the server says is staff', async () => {
    // A mod reaches the room, not the team. The row carries a role only once the server sends one.
    vi.spyOn(WorldStorageService, 'fetchLikers').mockResolvedValue({ anonymous: 0, total: 1,
      rows: [liker({ role: 'dev' })],
    });

    show({ currentUser: moderator });

    await screen.findByText('wren_hallow');
    expect(screen.queryByRole('button', { name: 'Remove the like by wren_hallow' })).toBeNull();
  });

  it('offers it to an admin on that same row', async () => {
    vi.spyOn(WorldStorageService, 'fetchLikers').mockResolvedValue({ anonymous: 0, total: 1,
      rows: [liker({ role: 'dev' })],
    });

    show({ currentUser: admin });

    expect(await screen.findByRole('button', { name: 'Remove the like by wren_hallow' })).toBeTruthy();
  });

  it('hides it from everybody on an admin row', async () => {
    vi.spyOn(WorldStorageService, 'fetchLikers').mockResolvedValue({ anonymous: 0, total: 1,
      rows: [liker({ role: 'admin' })],
    });

    show({ currentUser: admin });

    await screen.findByText('wren_hallow');
    expect(screen.queryByRole('button', { name: 'Remove the like by wren_hallow' })).toBeNull();
  });
});

describe('auditing the network record behind the likes', () => {
  const auditRow = (over: Partial<LikerAuditRow> = {}): LikerAuditRow => ({
    ...liker(),
    groupId: null,
    linkedToAuthor: false,
    ...over,
  });

  /** The plain list first, since the audit is only ever reached from a list that is already open. */
  const withList = (rows: LikerRow[], total = rows.length) =>
    vi.spyOn(WorldStorageService, 'fetchLikers').mockResolvedValue({ anonymous: 0, total, rows });

  const withAudit = (rows: LikerAuditRow[], total = rows.length) =>
    vi.spyOn(WorldStorageService, 'fetchLikersAudit').mockResolvedValue({ anonymous: 0, anonymousRows: [], total, rows });

  const pressAudit = async () =>
    fireEvent.click(await screen.findByRole('button', { name: /Audit the likes/ }));

  /** The case this screen was built for: four accounts, one address, one contest entry. */
  const ring = [
    auditRow({ id: 'r1', username: 'ring_1', groupId: 1 }),
    auditRow({ id: 'r2', username: 'ring_2', groupId: 1 }),
    auditRow({ id: 'r3', username: 'ring_3', groupId: 1 }),
    auditRow({ id: 'r4', username: 'ring_4', groupId: 1 }),
  ];

  it('asks for nothing until somebody presses it', async () => {
    withList([liker()]);
    const fetchAudit = withAudit([]);

    show();

    // Every call writes an audit row, so opening a like list must not file a look at the people in it.
    await screen.findByText('wren_hallow');
    expect(fetchAudit).not.toHaveBeenCalled();
  });

  it('draws four accounts that share an address as one group, and says how many', async () => {
    withList(ring);
    withAudit([...ring, auditRow({ id: 'x', username: 'unrelated' })], 5);

    show();
    await pressAudit();

    expect(await screen.findByText('4 accounts share a network address')).toBeTruthy();
    // The group is one box, and the account outside it is not in that box.
    const group = screen.getByText('4 accounts share a network address').parentElement as HTMLElement;
    expect(within(group).getAllByRole('listitem')).toHaveLength(4);
    expect(within(group).queryByText('unrelated')).toBeNull();
  });

  it('keeps two separate groups apart', async () => {
    withList([liker()]);
    withAudit([
      auditRow({ id: 'a', username: 'pair_a1', groupId: 1 }),
      auditRow({ id: 'b', username: 'pair_a2', groupId: 1 }),
      auditRow({ id: 'c', username: 'pair_b1', groupId: 2 }),
      auditRow({ id: 'd', username: 'pair_b2', groupId: 2 }),
    ]);

    show();
    await pressAudit();

    const headings = await screen.findAllByText('2 accounts share a network address');
    expect(headings).toHaveLength(2);
    expect(within(headings[0].parentElement as HTMLElement).getByText('pair_a1')).toBeTruthy();
    expect(within(headings[1].parentElement as HTMLElement).getByText('pair_b1')).toBeTruthy();
  });

  it('marks the liker who shares an address with the author, and leaves the rest alone', async () => {
    withList([liker()]);
    withAudit([
      auditRow({ id: 'sock', username: 'sock_puppet', linkedToAuthor: true }),
      auditRow({ id: 'fan', username: 'real_fan' }),
    ]);

    show();
    await pressAudit();

    await screen.findByText('sock_puppet');
    const [sock, fan] = screen.getAllByRole('listitem');
    expect(within(sock).getByText('Linked to author')).toBeTruthy();
    expect(sock.getAttribute('data-linked-to-author')).toBe('true');
    expect(within(fan).queryByText('Linked to author')).toBeNull();
  });

  it('sums up what it found beside the button', async () => {
    withList([liker()]);
    withAudit([
      auditRow({ id: 'a', username: 'pair_1', groupId: 1 }),
      auditRow({ id: 'b', username: 'pair_2', groupId: 1, linkedToAuthor: true }),
    ]);

    show();
    await pressAudit();

    expect(await screen.findByText(/1 group shares an address/)).toBeTruthy();
    expect(screen.getByText(/1 like shares one with the author/)).toBeTruthy();
  });

  it('counts more than one of each in the summary', async () => {
    withList([liker()]);
    withAudit([
      auditRow({ id: 'a', username: 'a1', groupId: 1, linkedToAuthor: true }),
      auditRow({ id: 'b', username: 'a2', groupId: 1, linkedToAuthor: true }),
      auditRow({ id: 'c', username: 'b1', groupId: 2 }),
      auditRow({ id: 'd', username: 'b2', groupId: 2 }),
    ]);

    show();
    await pressAudit();

    expect(await screen.findByText(/2 groups share an address/)).toBeTruthy();
    expect(screen.getByText(/2 likes share one with the author/)).toBeTruthy();
  });

  it('throws away an audit that lands after the dialog moved to another listing', async () => {
    withList([liker()]);
    let land: (value: {
      total: number; rows: LikerAuditRow[]; anonymous: number; anonymousRows: AnonymousLikeRow[];
    }) => void = () => {};
    vi.spyOn(WorldStorageService, 'fetchLikersAudit').mockReturnValue(
      new Promise((resolve) => { land = resolve; })
    );

    const view = show();
    await pressAudit();

    view.rerender(
      <UserProfileContext.Provider value={{ openProfile, setListingOpener: () => {} }}>
        <LikersDialog
          open
          onOpenChange={() => {}}
          listingId="w2"
          listingName="Another Listing"
          currentUser={admin}
        />
      </UserProfileContext.Provider>
    );
    await screen.findByText('wren_hallow');

    land({ total: 2, anonymous: 0, anonymousRows: [], rows: [
      auditRow({ id: 'a', username: 'ghost_1', groupId: 1 }),
      auditRow({ id: 'b', username: 'ghost_2', groupId: 1 }),
    ] });

    // The second listing was never audited, so nothing about the first one may be said over it.
    await waitFor(() => expect(screen.queryByText('ghost_1')).toBeNull());
    expect(screen.queryByText(/share a network address/)).toBeNull();
    // And the control is ready again rather than stuck mid-audit on a listing it never ran for.
    expect(screen.getByRole('button', { name: /Audit the likes/ })).toBeTruthy();
  });

  it('says plainly when nothing links these accounts', async () => {
    withList([liker()]);
    withAudit([auditRow({ id: 'a', username: 'one' }), auditRow({ id: 'b', username: 'two' })]);

    show();
    await pressAudit();

    expect(await screen.findByText('No two of these likes share a network address.')).toBeTruthy();
    expect(screen.queryByText(/accounts share a network address$/)).toBeNull();
  });

  it('removes a like from the audit and updates the list where it stands', async () => {
    withList([liker()]);
    const fetchAudit = withAudit(ring, 4);
    const removeLike = vi.spyOn(WorldStorageService, 'removeLike').mockResolvedValue(3);

    show();
    await pressAudit();
    await screen.findByText('ring_1');

    fireEvent.click(screen.getByRole('button', { name: 'Remove the like by ring_1' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Confirm' }));

    await waitFor(() => expect(removeLike).toHaveBeenCalledWith('w1', 'r1'));
    // The row leaves, the group counts itself again, and none of it costs another look at the record.
    await waitFor(() => expect(screen.queryByText('ring_1')).toBeNull());
    expect(screen.getByText('3 accounts share a network address')).toBeTruthy();
    expect(screen.getByText(/^3 likes/)).toBeTruthy();
    expect(fetchAudit).toHaveBeenCalledTimes(1);
  });

  it('stops calling a pair a group once one of the two is gone', async () => {
    withList([liker()]);
    withAudit([
      auditRow({ id: 'a', username: 'pair_1', groupId: 1 }),
      auditRow({ id: 'b', username: 'pair_2', groupId: 1 }),
    ]);
    vi.spyOn(WorldStorageService, 'removeLike').mockResolvedValue(1);

    show();
    await pressAudit();
    await screen.findByText('2 accounts share a network address');

    fireEvent.click(screen.getByRole('button', { name: 'Remove the like by pair_1' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Confirm' }));

    // One account cannot share an address with anybody, so the box it was in is no longer a finding.
    await waitFor(() => expect(screen.queryByText('2 accounts share a network address')).toBeNull());
    expect(screen.getByText('No two of these likes share a network address.')).toBeTruthy();
    expect(screen.getByText('pair_2')).toBeTruthy();
  });

  it('reports the server’s wording when the audit is refused, and keeps the list', async () => {
    withList([liker()]);
    vi.spyOn(WorldStorageService, 'fetchLikersAudit').mockRejectedValue(new Error('Staff only'));

    show();
    await pressAudit();

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Staff only'));
    expect(screen.getByText('wren_hallow')).toBeTruthy();
  });

  it('asks again on a second press, so a second look is a second look', async () => {
    withList([liker()]);
    const fetchAudit = withAudit([auditRow({ id: 'a', username: 'one' })]);

    show();
    await pressAudit();

    fireEvent.click(await screen.findByRole('button', { name: /Audit again/ }));

    await waitFor(() => expect(fetchAudit).toHaveBeenCalledTimes(2));
  });

  it('offers nothing to audit while the list is empty', async () => {
    withList([], 0);

    show();

    await screen.findByText('Nobody has liked this yet.');
    expect(screen.queryByRole('button', { name: /Audit/ })).toBeNull();
  });
});

describe('the Anonymous Likes on a listing', () => {
  const mark = (over: Partial<AnonymousLikeRow> = {}): AnonymousLikeRow => ({
    likedAt: '2026-08-30 12:00:00',
    browserFamily: 'Chrome',
    groupId: null,
    linkedToAuthor: false,
    addressKey: 'key-a',
    ...over,
  });

  const auditRow = (over: Partial<LikerAuditRow> = {}): LikerAuditRow => ({
    ...liker(),
    groupId: null,
    linkedToAuthor: false,
    ...over,
  });

  const withList = (rows: LikerRow[], anonymous = 0, total = rows.length) =>
    vi.spyOn(WorldStorageService, 'fetchLikers').mockResolvedValue({ total, rows, anonymous });

  const withAudit = (
    rows: LikerAuditRow[],
    anonymousRows: AnonymousLikeRow[],
    anonymous = anonymousRows.length,
    total = rows.length
  ) => vi.spyOn(WorldStorageService, 'fetchLikersAudit')
    .mockResolvedValue({ total, rows, anonymous, anonymousRows });

  const pressAudit = async () =>
    fireEvent.click(await screen.findByRole('button', { name: /Audit the likes/ }));

  const confirm = async () =>
    fireEvent.click(await screen.findByRole('button', { name: 'Confirm' }));

  /** The anonymous rows on screen, which carry no name to find them by. */
  const markEls = () => screen.queryAllByRole('listitem').filter((el) => el.dataset.anonymous === 'true');

  it('says how many anonymous likes there are beside the account total', async () => {
    withList([liker()], 7, 2);

    show();

    // The room's number is the two added together, so neither alone explains what a card shows.
    expect(await screen.findByText(/2 likes.*7 anonymous/)).toBeTruthy();
  });

  it('says nothing about anonymous likes on a listing that has none', async () => {
    withList([liker()], 0);

    show();

    await screen.findByText('wren_hallow');
    expect(screen.queryByText(/anonymous/)).toBeNull();
  });

  it('offers the audit on a listing that only anonymous likes reached', async () => {
    withList([], 4, 0);

    show();

    // Four likes is not "nobody", even with no account behind any of them.
    expect(await screen.findByRole('button', { name: /Audit the likes/ })).toBeTruthy();
    expect(screen.queryByText('Nobody has liked this yet.')).toBeNull();
  });

  it('draws anonymous likes inside the group their address put them in', async () => {
    withList([liker()], 3);
    withAudit(
      [auditRow({ id: 'r1', username: 'ring_1', groupId: 1 })],
      [mark({ groupId: 1 }), mark({ groupId: 1 }), mark({ groupId: null, addressKey: 'key-b' })]
    );

    show();
    await pressAudit();

    const heading = await screen.findByText('1 account and 2 Anonymous Likes share a network address');
    const group = heading.parentElement as HTMLElement;
    expect(within(group).getByText('ring_1')).toBeTruthy();
    expect(within(group).getAllByRole('listitem')).toHaveLength(3);
    // The third one shares an address with nobody, so the group box is not where it belongs.
    expect(markEls()).toHaveLength(3);
  });

  it('calls a box of anonymous likes alone what it is', async () => {
    withList([], 2, 0);
    withAudit([], [mark({ groupId: 1 }), mark({ groupId: 1 })]);

    show();
    await pressAudit();

    expect(await screen.findByText('2 Anonymous Likes share a network address')).toBeTruthy();
  });

  it('lists a row whose address the sweep has emptied, and offers no removal for it', async () => {
    withList([], 1, 0);
    withAudit([], [mark({ groupId: null, addressKey: null })]);

    show();
    await pressAudit();

    expect(await screen.findByText(/too old to name an address for/)).toBeTruthy();
    expect(markEls()).toHaveLength(1);
    expect(screen.queryByRole('button', { name: /from this address/ })).toBeNull();
  });

  it('flags an anonymous like that came from the author’s address', async () => {
    withList([], 2, 0);
    withAudit([], [mark({ linkedToAuthor: true }), mark({ addressKey: 'key-b' })]);

    show();
    await pressAudit();

    await screen.findByText('Linked to author');
    const [flagged, plain] = markEls();
    expect(within(flagged).getByText('Linked to author')).toBeTruthy();
    expect(flagged.getAttribute('data-linked-to-author')).toBe('true');
    expect(within(plain).queryByText('Linked to author')).toBeNull();
  });

  it('says the list is cut short when the server sent fewer rows than it counted', async () => {
    withList([], 640, 0);
    withAudit([], [mark(), mark()], 640);

    show();
    await pressAudit();

    expect(await screen.findByText('Showing the newest 2 of 640 Anonymous Likes.')).toBeTruthy();
  });

  it('says nothing about a cap when every row came back', async () => {
    withList([], 2, 0);
    withAudit([], [mark(), mark()], 2);

    show();
    await pressAudit();

    await screen.findByText(/share a network address/);
    expect(screen.queryByText(/Showing the newest/)).toBeNull();
  });

  it('shows one removal per address in a group the audit drew across two', async () => {
    withList([], 3, 0);
    withAudit([], [
      mark({ groupId: 1, addressKey: 'key-a' }),
      mark({ groupId: 1, addressKey: 'key-b' }),
      mark({ groupId: 1, addressKey: 'key-b' }),
    ]);

    show();
    await pressAudit();

    // The group is a drawing; an address is what a removal can act on.
    await screen.findByText('3 Anonymous Likes share a network address');
    expect(screen.getAllByRole('button', { name: /from this address/ })).toHaveLength(2);
  });

  it('asks first, and removes nothing when the answer is no', async () => {
    withList([], 2, 0);
    withAudit([], [mark({ groupId: 1 }), mark({ groupId: 1 })]);
    const removeGroup = vi.spyOn(WorldStorageService, 'removeAnonymousLikeGroup')
      .mockResolvedValue({ removed: 2, likes: 5, anonymous: 0 });

    show();
    await pressAudit();

    fireEvent.click(await screen.findByRole('button', { name: /from this address/ }));
    expect(await screen.findByText('Remove these Anonymous Likes?')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(removeGroup).not.toHaveBeenCalled();
    expect(markEls()).toHaveLength(2);
  });

  it('sends the address rather than the group, drops those rows, and takes both numbers from the answer', async () => {
    withList([], 3, 0);
    withAudit([], [
      mark({ groupId: 1, addressKey: 'key-a' }),
      mark({ groupId: 1, addressKey: 'key-a' }),
      mark({ groupId: 1, addressKey: 'key-b' }),
    ]);
    const removeGroup = vi.spyOn(WorldStorageService, 'removeAnonymousLikeGroup')
      .mockResolvedValue({ removed: 2, likes: 9, anonymous: 1 });
    const onLikesChanged = vi.fn();

    show({ onLikesChanged });
    await pressAudit();

    fireEvent.click((await screen.findAllByRole('button', { name: /from this address/ }))[0]);
    await confirm();

    // The group number is assigned by scan order and would point elsewhere by the time this lands.
    await waitFor(() => expect(removeGroup).toHaveBeenCalledWith('w1', 'key-a'));
    expect(removeGroup.mock.calls[0]).toHaveLength(2);
    await waitFor(() => expect(markEls()).toHaveLength(1));
    // The dialog's count and the card's count both come from the response, not from arithmetic here.
    expect(screen.getByText(/1 anonymous/)).toBeTruthy();
    expect(onLikesChanged).toHaveBeenCalledWith(9);
  });

  it('clears every anonymous like from the button beside the audit', async () => {
    withList([], 3, 0);
    withAudit([], [mark({ groupId: 1 }), mark({ groupId: 1 }), mark({ addressKey: null })]);
    const removeAll = vi.spyOn(WorldStorageService, 'removeAnonymousLikes')
      .mockResolvedValue({ removed: 3, likes: 4, anonymous: 0 });
    const onLikesChanged = vi.fn();

    show({ onLikesChanged });
    await pressAudit();
    await screen.findByText(/share a network address/);

    fireEvent.click(screen.getByRole('button', { name: 'Remove all Anonymous Likes' }));
    expect(await screen.findByText('Remove every Anonymous Like?')).toBeTruthy();
    await confirm();

    await waitFor(() => expect(removeAll).toHaveBeenCalledWith('w1'));
    // Including the one no address can name, which is the whole point of the blunt half.
    await waitFor(() => expect(markEls()).toHaveLength(0));
    expect(onLikesChanged).toHaveBeenCalledWith(4);
    expect(screen.queryByRole('button', { name: 'Remove all Anonymous Likes' })).toBeNull();
  });

  it('offers no clear-all on a listing with no anonymous likes', async () => {
    withList([liker()], 0);

    show();

    await screen.findByText('wren_hallow');
    expect(screen.queryByRole('button', { name: 'Remove all Anonymous Likes' })).toBeNull();
  });

  it('reads the list again without complaint when another moderator got there first', async () => {
    withList([], 2, 0);
    const fetchAudit = withAudit([], [mark({ groupId: 1 }), mark({ groupId: 1 })]);
    vi.spyOn(WorldStorageService, 'removeAnonymousLikeGroup')
      .mockResolvedValue({ removed: 0, likes: 4, anonymous: 0 });

    show();
    await pressAudit();
    await screen.findByText(/share a network address/);

    // What a fresh read would say now: the other moderator's removal already landed.
    fetchAudit.mockResolvedValue({ total: 0, rows: [], anonymous: 0, anonymousRows: [] });

    fireEvent.click(screen.getByRole('button', { name: /from this address/ }));
    await confirm();

    // Nothing removed is a race, not a failure: the rows were already gone.
    await waitFor(() => expect(fetchAudit).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryAllByRole('listitem')).toHaveLength(0));
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('keeps the rows and toasts the server’s wording when a removal is refused', async () => {
    withList([], 2, 0);
    withAudit([], [mark({ groupId: 1 }), mark({ groupId: 1 })]);
    vi.spyOn(WorldStorageService, 'removeAnonymousLikeGroup')
      .mockRejectedValue(new Error('You cannot moderate them'));

    show();
    await pressAudit();

    fireEvent.click(await screen.findByRole('button', { name: /from this address/ }));
    await confirm();

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('You cannot moderate them'));
    expect(markEls()).toHaveLength(2);
  });

  it('marks a claimed like and keeps the original press beside it', async () => {
    withList([
      liker({ id: 'u1', username: 'claimer', claimedAt: '2026-09-02 08:30:00' }),
      liker({ id: 'u2', username: 'plain_liker' }),
    ], 0);

    show();

    await screen.findByText('claimer');
    const [claimed, plain] = rowEls();
    expect(claimed.getAttribute('data-claimed')).toBe('true');
    expect(within(claimed).getByText('Claimed')).toBeTruthy();
    // The press stays the first one; the claim is when it arrived on the account.
    expect(within(claimed).getByText(/^Liked/)).toBeTruthy();
    expect(within(claimed).getByText(/^Claimed \w/)).toBeTruthy();
    expect(within(plain).queryByText('Claimed')).toBeNull();
  });
});

describe('what the audit summary counts, and what a race re-reads', () => {
  const anonRow = (over: Partial<AnonymousLikeRow> = {}): AnonymousLikeRow => ({
    likedAt: '2026-08-30 12:00:00',
    browserFamily: 'Chrome',
    groupId: null,
    linkedToAuthor: false,
    addressKey: 'key-a',
    ...over,
  });

  const withList = (rows: LikerRow[], anonymous = 0, total = rows.length) =>
    vi.spyOn(WorldStorageService, 'fetchLikers').mockResolvedValue({ total, rows, anonymous });

  const withAudit = (anonymousRows: AnonymousLikeRow[], anonymous = anonymousRows.length) =>
    vi.spyOn(WorldStorageService, 'fetchLikersAudit')
      .mockResolvedValue({ total: 0, rows: [], anonymous, anonymousRows });

  it('counts an anonymous like that came from the author’s address in the summary', async () => {
    withList([], 1, 0);
    withAudit([anonRow({ linkedToAuthor: true })]);

    show();
    fireEvent.click(await screen.findByRole('button', { name: /Audit the likes/ }));

    // With no account in the list, an author match lives entirely on the anonymous side. A summary
    // reading only the accounts would report nothing found while a flagged row sits under it.
    expect(await screen.findByText(/1 like shares one with the author/)).toBeTruthy();
    expect(screen.queryByText('No two of these likes share a network address.')).toBeNull();
  });

  it('adds the two kinds together in that count', async () => {
    vi.spyOn(WorldStorageService, 'fetchLikers')
      .mockResolvedValue({ total: 1, rows: [liker()], anonymous: 1 });
    vi.spyOn(WorldStorageService, 'fetchLikersAudit').mockResolvedValue({
      total: 1,
      rows: [{ ...liker(), groupId: null, linkedToAuthor: true }],
      anonymous: 1,
      anonymousRows: [anonRow({ linkedToAuthor: true })],
    });

    show();
    fireEvent.click(await screen.findByRole('button', { name: /Audit the likes/ }));

    expect(await screen.findByText(/2 likes share one with the author/)).toBeTruthy();
  });

  it('re-reads the plain list, not the audit, when a race hits before anybody audited', async () => {
    const fetchLikers = withList([], 2, 0);
    const fetchAudit = withAudit([anonRow(), anonRow()]);
    vi.spyOn(WorldStorageService, 'removeAnonymousLikes')
      .mockResolvedValue({ removed: 0, likes: 0, anonymous: 0 });

    show();

    // Clearing them all is reachable without ever pressing Audit, so the quiet re-read on a race must
    // not file a look at the people in the list.
    fireEvent.click(await screen.findByRole('button', { name: 'Remove all Anonymous Likes' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Confirm' }));

    await waitFor(() => expect(fetchLikers).toHaveBeenCalledTimes(2));
    expect(fetchAudit).not.toHaveBeenCalled();
  });
});
