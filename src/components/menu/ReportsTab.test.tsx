import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ReportsTab } from './ReportsTab';
import ReportService from '@/services/ReportService';
import AuthService from '@/services/AuthService';
import type { QueuedReport, ReportGroup } from '@/lib/contentReports';

vi.mock('react-toastify', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));

const report = (over: Partial<QueuedReport> = {}): QueuedReport => ({
  id: `r-${Math.random().toString(16).slice(2, 8)}`,
  reporter_id: 'u1',
  reporter_username: 'wren',
  category: 'spam',
  details: null,
  created_at: '2026-08-01T12:00:00.000Z',
  target_gone_at: null,
  ...over,
});

const group = (over: Partial<ReportGroup> = {}): ReportGroup => ({
  target_kind: 'listing',
  target_id: 'w1',
  target_name: 'Sedge Landing',
  target_author_id: 'a1',
  target_author_username: 'author',
  target_author_role: null,
  target_snippet: 'A world for testing',
  target_parent_id: null,
  report_count: 1,
  first_reported_at: '2026-08-01T12:00:00.000Z',
  last_reported_at: '2026-08-01T12:00:00.000Z',
  target_gone: false,
  reports: [report()],
  ...over,
});

const stubQueue = (groups: ReportGroup[]) =>
  vi.spyOn(ReportService, 'fetchQueue').mockResolvedValue(groups);

/** The queue's own "View" button. Exact, because the author's name is itself a "View …'s profile" one. */
const viewButton = () => screen.queryByRole('button', { name: 'View' });

const stubResolve = (result = { resolved: 1, notified: 1 }) =>
  vi.spyOn(ReportService, 'resolve').mockResolvedValue(result);

/** Who is working the queue. The role decides which groups they may close. */
const signedInAs = (accountType: string) =>
  vi.spyOn(AuthService, 'getCurrentUser').mockReturnValue({ id: 'me', username: 'me', accountType });

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  signedInAs('mod');
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('reading the queue', () => {
  it('shows one entry per target, however many reported it', async () => {
    // The whole reason the queue groups: a pile-on is one decision, not twelve.
    stubQueue([group({
      report_count: 3,
      reports: [
        report({ category: 'spam' }),
        report({ category: 'spam' }),
        report({ category: 'hate' }),
      ],
    })]);

    render(<ReportsTab active />);

    expect(await screen.findByText('Listing: Sedge Landing')).toBeTruthy();
    expect(screen.getByText(/3 reports/)).toBeTruthy();
    // Counted rather than listed, so the shape of the agreement is readable at a glance.
    expect(screen.getByText('Spam or scam ×2')).toBeTruthy();
    expect(screen.getByText('Hate or harassment')).toBeTruthy();
  });

  it('shows what each reporter wrote', async () => {
    stubQueue([group({ reports: [report({ details: 'This is my world, reposted.' })] })]);

    render(<ReportsTab active />);

    expect(await screen.findByText(/This is my world, reposted\./)).toBeTruthy();
  });

  it('says so when the author took the content away', async () => {
    // `onOpenListing` is supplied so the only thing suppressing View is the content being gone — without
    // it the button would be absent anyway and this would pass for the wrong reason.
    stubQueue([group({ target_gone: true })]);

    render(<ReportsTab active onOpenListing={vi.fn()} />);

    expect(await screen.findByText(/Removed by its author/)).toBeTruthy();
    // Nothing to follow: the snapshot is all there is, so offering a View button would lie.
    expect(viewButton()).toBeNull();
  });

  it('still offers View on the same group while the content is there', async () => {
    stubQueue([group({ target_gone: false })]);

    render(<ReportsTab active onOpenListing={vi.fn()} />);

    expect(await screen.findByRole('button', { name: 'View' })).toBeTruthy();
  });

  it('says plainly when nothing has been reported', async () => {
    stubQueue([]);

    render(<ReportsTab active />);

    expect(await screen.findByText('Nothing has been reported.')).toBeTruthy();
  });

  it('fetches nothing while the tab is hidden', async () => {
    const fetchQueue = stubQueue([group()]);

    render(<ReportsTab active={false} />);

    await waitFor(() => expect(fetchQueue).not.toHaveBeenCalled());
  });
});

describe('following a report to its target', () => {
  it('opens a reported listing by its own id', async () => {
    stubQueue([group({ target_kind: 'listing', target_id: 'w1' })]);
    const onOpenListing = vi.fn();

    render(<ReportsTab active onOpenListing={onOpenListing} />);

    fireEvent.click(await screen.findByRole('button', { name: 'View' }));

    expect(onOpenListing).toHaveBeenCalledWith('w1');
  });

  it('opens a reported comment through the listing it sits on', async () => {
    // A comment has no address of its own; the snapshot's parent is the only way to reach one.
    stubQueue([group({ target_kind: 'comment', target_id: 'c1', target_parent_id: 'w9' })]);
    const onOpenListing = vi.fn();

    render(<ReportsTab active onOpenListing={onOpenListing} />);

    fireEvent.click(await screen.findByRole('button', { name: 'View' }));

    expect(onOpenListing).toHaveBeenCalledWith('w9');
  });

  it('offers nothing to follow for a comment whose parent was never recorded', async () => {
    stubQueue([group({ target_kind: 'comment', target_id: 'c1', target_parent_id: null })]);

    render(<ReportsTab active onOpenListing={vi.fn()} />);

    await screen.findByText(/Comment/);
    expect(viewButton()).toBeNull();
  });
});

describe('resolving a group', () => {
  it('closes every open report on the target in one call', async () => {
    stubQueue([group({ target_kind: 'listing', target_id: 'w1', report_count: 3 })]);
    const resolve = stubResolve({ resolved: 3, notified: 3 });

    render(<ReportsTab active />);

    fireEvent.click(await screen.findByRole('button', { name: 'Action Taken' }));

    await waitFor(() => expect(resolve).toHaveBeenCalledWith({
      targetKind: 'listing',
      targetId: 'w1',
      outcome: 'actioned',
      note: undefined,
    }));
  });

  it('sends the note when one was written', async () => {
    stubQueue([group()]);
    const resolve = stubResolve();

    render(<ReportsTab active />);

    fireEvent.click(await screen.findByRole('button', { name: 'Add Note' }));
    fireEvent.change(screen.getByLabelText('Note to the reporters'), {
      target: { value: 'The author has been contacted.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));

    await waitFor(() => expect(resolve).toHaveBeenCalledWith(expect.objectContaining({
      outcome: 'dismissed',
      note: 'The author has been contacted.',
    })));
  });

  it('takes the group off the queue once it is closed', async () => {
    stubQueue([group()]);
    stubResolve();

    render(<ReportsTab active />);

    fireEvent.click(await screen.findByRole('button', { name: 'Dismiss' }));

    await waitFor(() => expect(screen.queryByText('Listing: Sedge Landing')).toBeNull());
    expect(screen.getByText('Nothing has been reported.')).toBeTruthy();
  });

  it('tells the caller, so a badge elsewhere can catch up', async () => {
    stubQueue([group()]);
    stubResolve();
    const onResolved = vi.fn();

    render(<ReportsTab active onResolved={onResolved} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Dismiss' }));

    await waitFor(() => expect(onResolved).toHaveBeenCalled());
  });

  it('leaves the group on the queue when the resolution fails', async () => {
    stubQueue([group()]);
    vi.spyOn(ReportService, 'resolve').mockRejectedValue(new Error('nope'));

    render(<ReportsTab active />);

    fireEvent.click(await screen.findByRole('button', { name: 'Dismiss' }));

    await waitFor(() => expect(screen.getByRole('button', { name: 'Dismiss' })).toBeTruthy());
    expect(screen.getByText('Listing: Sedge Landing')).toBeTruthy();
  });
});

describe('who may close what', () => {
  it('offers a mod no way to close a report on a fellow staff member', async () => {
    // Staff moderate the room, not each other. The server refuses it too; hiding the button is the
    // courtesy of not offering an action that would bounce.
    signedInAs('mod');
    stubQueue([group({ target_author_id: 'dev-1', target_author_role: 'dev' })]);

    render(<ReportsTab active />);

    expect(await screen.findByText(/an admin closes this one/i)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Action Taken' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Dismiss' })).toBeNull();
  });

  it('still shows a mod the group, so a complaint about staff is never invisible', async () => {
    signedInAs('mod');
    stubQueue([group({ target_author_id: 'dev-1', target_author_role: 'dev' })]);

    render(<ReportsTab active />);

    expect(await screen.findByText('Listing: Sedge Landing')).toBeTruthy();
  });

  it('offers an admin the buttons on the same group', async () => {
    signedInAs('admin');
    stubQueue([group({ target_author_id: 'dev-1', target_author_role: 'dev' })]);

    render(<ReportsTab active />);

    expect(await screen.findByRole('button', { name: 'Action Taken' })).toBeTruthy();
  });

  it('offers a mod the buttons on an ordinary account', async () => {
    signedInAs('mod');
    stubQueue([group({ target_author_id: 'u9', target_author_role: 'normal' })]);

    render(<ReportsTab active />);

    expect(await screen.findByRole('button', { name: 'Action Taken' })).toBeTruthy();
  });
});
