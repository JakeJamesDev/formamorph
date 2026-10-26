import { render, screen, cleanup, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { toast } from 'react-toastify';
import { ReviewTab } from './ReviewTab';
import ReviewService, { ReviewConflictError, type ReviewQueueItem, type ReviewRejection } from '@/services/ReviewService';
import WorldStorageService from '@/services/WorldStorageService';
import AuthService from '@/services/AuthService';

vi.mock('react-toastify', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));

const downloads = vi.hoisted(() => ({ downloadBlob: vi.fn() }));
vi.mock('@/lib/downloadBlob', () => downloads);

// The composer has its own tests; here it only has to say what it was opened with.
vi.mock('./MessageComposerDialog', () => ({
  MessageComposerDialog: ({ target, initialSubject, initialBody }: {
    target: { recipients: { username: string }[] }; initialSubject: string; initialBody: string;
  }) => (
    <div data-testid="composer" data-to={target.recipients[0]?.username} data-subject={initialSubject}>
      {initialBody}
    </div>
  ),
}));

const item = (over: Partial<ReviewQueueItem> = {}): ReviewQueueItem => ({
  id: 'w1',
  kind: 'world',
  name: 'Sedge Landing',
  type: 'new',
  author: { id: 'a1', username: 'wren_hallow', role: null },
  contest: null,
  queuedAt: new Date(Date.now() - 3 * 86_400_000).toISOString(),
  createdAt: new Date(Date.now() - 3 * 86_400_000).toISOString(),
  quarantineExpiresAt: null,
  ...over,
});

const stubQueue = (items: ReviewQueueItem[]) => vi.spyOn(ReviewService, 'fetchQueue').mockResolvedValue(items);

const rejection = (over: Partial<ReviewRejection> = {}): ReviewRejection => ({
  id: 'w1',
  author: { id: 'a1', username: 'wren_hallow' },
  quarantinedAt: '2026-10-25T12:00:00.000Z',
  quarantineExpiresAt: '2026-11-01T12:00:00.000Z',
  quarantineExtended: false,
  ...over,
});

const signedInAs = (accountType: string) =>
  vi.spyOn(AuthService, 'getCurrentUser').mockReturnValue({ id: 'me', username: 'me', accountType });

/** Opens an item's dialog from its row. */
const openRow = async (name: string) => {
  fireEvent.click(await screen.findByRole('button', { name: new RegExp(name) }));
  return screen.findByRole('dialog');
};

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(WorldStorageService, 'readListingDetails').mockResolvedValue({
    status: 'ok',
    details: { changelog: null, anonymousLikes: false, description: 'A marsh town.', tags: ['marsh'] },
  });
  signedInAs('mod');
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe('reading the queue', () => {
  it('lists items in the order the server sent', async () => {
    // Contest entries first is the server's rule; the client never re-sorts.
    stubQueue([item({ id: 'b', name: 'Zeta' }), item({ id: 'a', name: 'Alpha' })]);

    render(<ReviewTab active />);

    const rows = within(await screen.findByRole('list', { name: 'Review Queue' })).getAllByRole('button');
    expect(rows.map((row) => row.textContent)).toEqual([
      expect.stringContaining('Zeta'),
      expect.stringContaining('Alpha'),
    ]);
  });

  it('shows kind, name, author, age and type on a row', async () => {
    stubQueue([item({ type: 'resubmitted' })]);

    render(<ReviewTab active />);

    const row = await screen.findByRole('button', { name: /Sedge Landing/ });
    expect(row.textContent).toContain('World: Sedge Landing');
    expect(row.textContent).toContain('by wren_hallow');
    expect(row.textContent).toContain('waiting 3 days');
    expect(row.textContent).toContain('Resubmitted');
  });

  it('marks a contest entry', async () => {
    stubQueue([item({ contest: { id: 'c1', title: 'Autumn Contest' } }), item({ id: 'w2', name: 'Plain' })]);

    render(<ReviewTab active />);

    expect((await screen.findByRole('button', { name: /Sedge Landing/ })).textContent).toContain('Contest entry: Autumn Contest');
    expect(screen.getByRole('button', { name: /Plain/ }).textContent).not.toContain('Contest');
  });

  it('says plainly when nothing waits', async () => {
    stubQueue([]);

    render(<ReviewTab active />);

    expect(await screen.findByText('Nothing waits for review')).toBeTruthy();
  });

  it('fetches nothing while the tab is hidden', () => {
    const fetchQueue = stubQueue([item()]);

    render(<ReviewTab active={false} />);

    expect(fetchQueue).not.toHaveBeenCalled();
  });

  it('opens the item the caller picks once the queue loads', async () => {
    stubQueue([item(), item({ id: 'w2', name: 'The Ferryman' })]);

    render(<ReviewTab active initialItemId="w2" />);

    expect(within(await screen.findByRole('dialog')).getByText('The Ferryman')).toBeTruthy();
  });
});

describe('the item dialog', () => {
  it('shows the listing as it stands', async () => {
    stubQueue([item()]);

    render(<ReviewTab active />);
    const dialog = await openRow('Sedge Landing');

    expect(await within(dialog).findByText('A marsh town.')).toBeTruthy();
    expect(within(dialog).getByText('marsh')).toBeTruthy();
  });

  it('shows an update as its changed fields, both thumbnails and its changelog operations', async () => {
    // jsdom has no object URLs; the browser's contract is a string the image can load.
    URL.createObjectURL = vi.fn(() => 'blob:pending-thumb');
    URL.revokeObjectURL = vi.fn();
    const thumb = vi.spyOn(ReviewService, 'fetchPendingThumbnail').mockResolvedValue(new Blob(['png']));
    vi.mocked(WorldStorageService.readListingDetails).mockImplementation(async (id) => (id === 'w1'
      ? {
        status: 'ok',
        details: {
          anonymousLikes: false, thumbnailFile: 'live.png',
          changelog: [{ id: 'e1', world_id: 'w1', title: 'Ferry Fixes', body: '', entry_date: '2026-09-01', created_at: '', updated_at: '' }],
        },
      }
      : id === 'dep-1' ? { status: 'ok', details: { changelog: null, anonymousLikes: false, name: 'Marsh Words' } }
        : id === 'dep-hidden' ? { status: 'gone', hidden: true } : { status: 'gone' }));
    stubQueue([item({
      type: 'update',
      pendingUpdate: {
        fields: {
          visibility: { approved: 'public', pending: 'unlisted' },
          spoiler: { approved: false, pending: true },
          required_dependencies: { approved: [], pending: ['dep-1', 'dep-gone', 'dep-hidden'] },
        },
        changelog: [
          { op: 'create', id: 'n1', title: 'The Drowned Bell', body: 'A bell tower.', date: '2026-10-20' },
          { op: 'delete', id: 'e1' },
        ],
        content_changed: true,
        thumbnail_url: '/api/reviews/w1/thumbnail',
      },
    })]);

    render(<ReviewTab active />);
    const dialog = await openRow('Sedge Landing');

    const table = await within(dialog).findByRole('table', { name: 'Changed Fields' });
    const row = (label: string) => within(table).getByRole('rowheader', { name: label }).closest('tr') as HTMLElement;
    expect(within(row('Visibility')).getAllByRole('cell').map((cell) => cell.textContent)).toEqual(['Public', 'Unlisted']);
    expect(within(row('Spoiler')).getAllByRole('cell').map((cell) => cell.textContent)).toEqual(['No', 'Yes']);
    expect(await within(row('Required Dependencies')).findByText('Marsh Words')).toBeTruthy();
    expect(await within(row('Required Dependencies')).findByText('Removed listing')).toBeTruthy();
    // A listing that exists but the reader may not see is not called removed.
    expect(await within(row('Required Dependencies')).findByText('Hidden listing')).toBeTruthy();
    expect(within(row('Content')).getAllByRole('cell').map((cell) => cell.textContent)).toEqual(['Current file', 'New file']);

    expect((within(row('Thumbnail')).getByRole('img', { name: 'Live thumbnail' }) as HTMLImageElement).src).toMatch(/\/thumbnails\/live\.png$/);
    const pending = await within(row('Thumbnail')).findByRole('img', { name: 'Pending thumbnail' });
    expect(pending.getAttribute('src')).toBe('blob:pending-thumb');
    expect(thumb).toHaveBeenCalledWith('/api/reviews/w1/thumbnail', expect.any(AbortSignal));

    const ops = within(within(dialog).getByRole('list', { name: 'Changelog Changes' })).getAllByRole('listitem');
    expect(ops.map((op) => op.textContent)).toEqual([
      expect.stringMatching(/^AddThe Drowned Bell.*A bell tower\./),
      'DeleteFerry Fixes',
    ]);
  });

  it('downloads the waiting content', async () => {
    stubQueue([item()]);
    vi.spyOn(ReviewService, 'fetchContent').mockResolvedValue({ worldOverview: { name: 'Sedge Landing' } });

    render(<ReviewTab active />);
    const dialog = await openRow('Sedge Landing');
    fireEvent.click(within(dialog).getByRole('button', { name: /Download/ }));

    await waitFor(() => expect(downloads.downloadBlob).toHaveBeenCalledTimes(1));
    expect(ReviewService.fetchContent).toHaveBeenCalledWith('w1');
    expect(downloads.downloadBlob.mock.calls[0][1]).toBe('Sedge Landing.json');
  });
});

describe('approving', () => {
  it('takes the item off the queue and asks for a new count', async () => {
    stubQueue([item(), item({ id: 'w2', name: 'The Ferryman' })]);
    const approve = vi.spyOn(ReviewService, 'approve').mockResolvedValue();
    const onChanged = vi.fn();

    render(<ReviewTab active onChanged={onChanged} />);
    const dialog = await openRow('Sedge Landing');
    fireEvent.click(within(dialog).getByRole('button', { name: /Approve/ }));

    await waitFor(() => expect(screen.queryByRole('button', { name: /Sedge Landing/ })).toBeNull());
    expect(approve).toHaveBeenCalledWith('w1');
    expect(onChanged).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: /The Ferryman/ })).toBeTruthy();
    expect(toast.success).toHaveBeenCalledWith('World approved');
  });

  it('says another mod handled it when the server answers 409, and drops the row', async () => {
    stubQueue([item()]);
    vi.spyOn(ReviewService, 'approve').mockRejectedValue(new ReviewConflictError('This is no longer waiting for review'));
    const onChanged = vi.fn();

    render(<ReviewTab active onChanged={onChanged} />);
    const dialog = await openRow('Sedge Landing');
    fireEvent.click(within(dialog).getByRole('button', { name: /Approve/ }));

    await waitFor(() => expect(toast.info).toHaveBeenCalledWith('Another mod already handled this item'));
    expect(await screen.findByText('Nothing waits for review')).toBeTruthy();
    expect(onChanged).toHaveBeenCalledTimes(1);
  });

  it('keeps an update whose contest is being judged, and says the approval waits for results', async () => {
    stubQueue([item({ type: 'update', pendingUpdate: { fields: {}, content_changed: true } })]);
    vi.spyOn(ReviewService, 'approve').mockRejectedValue(
      new ReviewConflictError('Spooky Season is being judged, so its entries cannot be changed', 'CONTEST_LOCKED'),
    );
    const onChanged = vi.fn();

    render(<ReviewTab active onChanged={onChanged} />);
    const dialog = await openRow('Sedge Landing');
    fireEvent.click(within(dialog).getByRole('button', { name: /Approve/ }));

    await waitFor(() => expect(toast.info).toHaveBeenCalledWith(
      "This update waits for the contest results. Approve it after they're announced.",
    ));
    expect(screen.getByRole('button', { name: /Sedge Landing/, hidden: true })).toBeTruthy();
    expect(onChanged).not.toHaveBeenCalled();
  });

  it('drops an update another mod or the author already settled', async () => {
    stubQueue([item({ type: 'update', pendingUpdate: { fields: {}, content_changed: true } })]);
    vi.spyOn(ReviewService, 'approve').mockRejectedValue(new ReviewConflictError('This is no longer waiting for review'));
    const onChanged = vi.fn();

    render(<ReviewTab active onChanged={onChanged} />);
    const dialog = await openRow('Sedge Landing');
    fireEvent.click(within(dialog).getByRole('button', { name: /Approve/ }));

    await waitFor(() => expect(toast.info).toHaveBeenCalledWith('Another mod already handled this item'));
    await waitFor(() => expect(screen.queryByRole('button', { name: /Sedge Landing/, hidden: true })).toBeNull());
    expect(onChanged).toHaveBeenCalled();
  });

  it('keeps the row when the approval fails for another reason', async () => {
    stubQueue([item()]);
    vi.spyOn(ReviewService, 'approve').mockRejectedValue(new Error('Server down'));

    render(<ReviewTab active />);
    const dialog = await openRow('Sedge Landing');
    fireEvent.click(within(dialog).getByRole('button', { name: /Approve/ }));

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    // The dialog stays open over the row, which hides it from the accessibility tree.
    expect(screen.getByRole('button', { name: /Sedge Landing/, hidden: true })).toBeTruthy();
  });

  it('does nothing after the tab unmounts mid-request', async () => {
    stubQueue([item()]);
    let finish: () => void = () => {};
    vi.spyOn(ReviewService, 'approve').mockReturnValue(new Promise<void>((resolve) => { finish = resolve; }));
    const onChanged = vi.fn();

    const { unmount } = render(<ReviewTab active onChanged={onChanged} />);
    const dialog = await openRow('Sedge Landing');
    fireEvent.click(within(dialog).getByRole('button', { name: /Approve/ }));
    unmount();
    finish();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(onChanged).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
  });
});

describe('rejecting', () => {
  it('runs a new listing through the quarantine dialog, then opens the composer', async () => {
    stubQueue([item()]);
    const reject = vi.spyOn(ReviewService, 'reject').mockResolvedValue(rejection());

    render(<ReviewTab active />);
    const dialog = await openRow('Sedge Landing');
    fireEvent.click(within(dialog).getByRole('button', { name: /Reject/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Quarantine' }));

    const composer = await screen.findByTestId('composer');
    expect(reject).toHaveBeenCalledWith('w1', 7);
    expect(composer.getAttribute('data-to')).toBe('wren_hallow');
    expect(composer.getAttribute('data-subject')).toBe('Your world "Sedge Landing" needs changes');
    expect(composer.textContent).toContain(new Date('2026-11-01T12:00:00.000Z').toLocaleDateString());
    expect(composer.textContent).toMatch(/another week/);
  });

  it('confirms a resubmission without a length, then opens the composer without the extension', async () => {
    stubQueue([item({ type: 'resubmitted', quarantineExpiresAt: '2026-11-01T12:00:00.000Z' })]);
    const reject = vi.spyOn(ReviewService, 'reject').mockResolvedValue(rejection({ quarantineExtended: true }));

    render(<ReviewTab active />);
    const dialog = await openRow('Sedge Landing');
    fireEvent.click(within(dialog).getByRole('button', { name: /Reject/ }));

    // No length to pick: the listing keeps its deadline.
    expect(screen.queryByRole('combobox', { name: 'Quarantine length' })).toBeNull();
    const confirm = await screen.findByRole('alertdialog');
    fireEvent.click(within(confirm).getByRole('button', { name: 'Reject' }));

    const composer = await screen.findByTestId('composer');
    expect(reject).toHaveBeenCalledWith('w1', undefined);
    expect(composer.textContent).not.toMatch(/another week/);
  });

  it('confirms an update, then opens the composer on the rejected-update template', async () => {
    stubQueue([item({ type: 'update', pendingUpdate: { fields: { name: { approved: 'Sedge Landing', pending: 'Sedge Harbor' } } } })]);
    const reject = vi.spyOn(ReviewService, 'reject').mockResolvedValue({ id: 'w1', author: { id: 'a1', username: 'wren_hallow' } });

    render(<ReviewTab active />);
    const dialog = await openRow('Sedge Landing');
    fireEvent.click(within(dialog).getByRole('button', { name: /Reject/ }));

    const confirm = await screen.findByRole('alertdialog');
    expect(reject).not.toHaveBeenCalled();
    fireEvent.click(within(confirm).getByRole('button', { name: 'Reject' }));

    const composer = await screen.findByTestId('composer');
    expect(reject).toHaveBeenCalledWith('w1', undefined);
    expect(composer.dataset.to).toBe('wren_hallow');
    expect(composer.dataset.subject).toBe('Your update to the world "Sedge Landing" was not approved');
    expect(composer.textContent).toMatch(/players still see the live version/);
    expect(composer.textContent).not.toMatch(/deleted on/i);
    expect(toast.success).toHaveBeenCalledWith('Update rejected');
  });

  it('sends nothing when the quarantine dialog is canceled', async () => {
    stubQueue([item()]);
    const reject = vi.spyOn(ReviewService, 'reject');

    render(<ReviewTab active />);
    const dialog = await openRow('Sedge Landing');
    fireEvent.click(within(dialog).getByRole('button', { name: /Reject/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel' }));

    expect(reject).not.toHaveBeenCalled();
    expect(screen.queryByTestId('composer')).toBeNull();
  });

  it('says another mod handled it when the rejection answers 409', async () => {
    stubQueue([item()]);
    vi.spyOn(ReviewService, 'reject').mockRejectedValue(new ReviewConflictError('This is no longer waiting for review'));

    render(<ReviewTab active />);
    const dialog = await openRow('Sedge Landing');
    fireEvent.click(within(dialog).getByRole('button', { name: /Reject/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Quarantine' }));

    await waitFor(() => expect(toast.info).toHaveBeenCalledWith('Another mod already handled this item'));
    expect(screen.queryByTestId('composer')).toBeNull();
    // The item is gone, so the length prompt over it goes too.
    await waitFor(() => expect(screen.queryByRole('combobox', { name: 'Quarantine length' })).toBeNull());
  });
});

describe('the download', () => {
  it('is offered on an update only when it holds new content', async () => {
    stubQueue([item({ type: 'update', pendingUpdate: { fields: { name: { approved: 'Sedge Landing', pending: 'Sedge Harbor' } } } })]);

    render(<ReviewTab active />);
    const dialog = await openRow('Sedge Landing');

    expect(within(dialog).queryByRole('button', { name: /Download/ })).toBeNull();
  });

  it('is offered on an update with new content', async () => {
    stubQueue([item({ type: 'update', pendingUpdate: { fields: {}, content_changed: true } })]);

    render(<ReviewTab active />);
    const dialog = await openRow('Sedge Landing');

    expect(within(dialog).getByRole('button', { name: /Download/ })).toBeTruthy();
  });
});

describe('the staff ladder', () => {
  it('hides the decision on an admin’s listing from a mod', async () => {
    stubQueue([item({ author: { id: 'boss', username: 'root-admin', role: 'admin' } })]);

    render(<ReviewTab active />);
    const dialog = await openRow('Sedge Landing');

    expect(within(dialog).queryByRole('button', { name: /Approve/ })).toBeNull();
    expect(within(dialog).queryByRole('button', { name: /Reject/ })).toBeNull();
    expect(within(dialog).getByRole('button', { name: /Download/ })).toBeTruthy();
  });

  it('hides the decision on the viewer’s own listing', async () => {
    // One sent before a promotion still waits; the server refuses its author.
    stubQueue([item({ author: { id: 'me', username: 'me', role: 'mod' } })]);

    render(<ReviewTab active />);
    const dialog = await openRow('Sedge Landing');

    expect(within(dialog).queryByRole('button', { name: /Approve/ })).toBeNull();
  });

  it('lets an admin decide on a mod’s listing', async () => {
    signedInAs('admin');
    stubQueue([item({ author: { id: 'm2', username: 'a-mod', role: 'mod' } })]);

    render(<ReviewTab active />);
    const dialog = await openRow('Sedge Landing');

    expect(within(dialog).getByRole('button', { name: /Approve/ })).toBeTruthy();
    expect(within(dialog).getByRole('button', { name: /Reject/ })).toBeTruthy();
  });
});
