import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { BugReportList } from './BugReportList';
import { BugsTab } from './BugsTab';
import { ANY_STATUS, statusFilterValue } from '@/lib/bugPresentation';
import { MyBugsTab } from './MyBugsTab';
import BugService from '@/services/BugService';
import type { BugReport } from '@/types';

vi.mock('react-toastify', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));

// The thread and the report form have their own coverage; stubbing them keeps this file about the list.
vi.mock('./BugThreadView', () => ({ BugThreadView: () => <div data-testid="thread" /> }));
vi.mock('./BugReportDialog', () => ({ BugReportDialog: () => null }));

const report = (over: Partial<BugReport> = {}): BugReport => ({
  id: 'b1',
  title: 'Save button does nothing',
  category: 'crash',
  body: 'Pressing save just spins.',
  status: 'open',
  reporter: { id: 'u1', username: 'finder' },
  diagnostics: {},
  createdAt: '2026-07-01T00:00:00.000Z',
  updatedAt: '2026-07-01T00:00:00.000Z',
  unread: false,
  ...over,
});

const stubList = (reports: BugReport[], total = reports.length) =>
  vi.spyOn(BugService, 'list').mockResolvedValue({ reports, total });

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('the list', () => {
  it('fetches nothing while it is off screen', async () => {
    // Each tab pays for its own data only while it is the one being looked at.
    const list = stubList([report()]);

    render(<BugReportList active={false} onOpen={() => {}} />);

    await waitFor(() => expect(list).not.toHaveBeenCalled());
  });

  it('shows the title, category and status', async () => {
    stubList([report()]);

    render(<BugReportList active onOpen={() => {}} />);

    expect(await screen.findByText('Save button does nothing')).toBeTruthy();
    expect(screen.getByText(/Crash or freeze/)).toBeTruthy();
    expect(screen.getByText('Open')).toBeTruthy();
  });

  it('flags a thread with replies the reader has not seen', async () => {
    stubList([report({ unread: true })]);

    render(<BugReportList active onOpen={() => {}} />);

    expect(await screen.findByLabelText('New replies')).toBeTruthy();
  });

  it('leaves a read thread unflagged', async () => {
    stubList([report({ unread: false })]);

    render(<BugReportList active onOpen={() => {}} />);
    await screen.findByText('Save button does nothing');

    expect(screen.queryByLabelText('New replies')).toBeNull();
  });

  it('names the reporter only on the admin queue', async () => {
    // Your own list is all yours, so naming you on every row is noise.
    const { unmount } = render(<BugReportList active onOpen={() => {}} />);
    stubList([report()]);
    unmount();

    stubList([report()]);
    render(<BugReportList active onOpen={() => {}} />);
    await screen.findByText('Save button does nothing');
    expect(screen.queryByText(/finder/)).toBeNull();
    cleanup();

    stubList([report()]);
    render(<BugReportList active scope="all" onOpen={() => {}} />);
    await screen.findByText('Save button does nothing');
    expect(screen.getByText(/finder/)).toBeTruthy();
  });

  it('opens the report that was clicked', async () => {
    stubList([report({ id: 'b7' })]);
    const onOpen = vi.fn();

    render(<BugReportList active onOpen={onOpen} />);
    fireEvent.click(await screen.findByText('Save button does nothing'));

    expect(onOpen).toHaveBeenCalledWith('b7');
  });

  it('says so when there is nothing to show', async () => {
    stubList([]);

    render(<BugReportList active onOpen={() => {}} emptyLabel="Nothing here." />);

    expect(await screen.findByText('Nothing here.')).toBeTruthy();
  });

  it('shows no pager when everything fits one page', async () => {
    stubList([report()], 1);

    render(<BugReportList active onOpen={() => {}} />);
    await screen.findByText('Save button does nothing');

    expect(screen.queryByText(/Page 1 of/)).toBeNull();
  });
});

describe('the admin queue', () => {
  it('asks for everyone’s reports, open ones first', async () => {
    // The default filter is the queue that needs work, not the whole archive.
    const list = stubList([report()]);

    render(<BugsTab active />);

    await waitFor(() => expect(list).toHaveBeenCalledWith(
      expect.objectContaining({ scope: 'all', status: 'open' })
    ));
  });

  it('drops the filter when All statuses is chosen', () => {
    // Sent as nothing rather than the sentinel, which the server would ignore as an unknown status —
    // right by accident, and wrong the moment it starts rejecting them instead.
    expect(statusFilterValue(ANY_STATUS)).toBeUndefined();
    expect(statusFilterValue('resolved')).toBe('resolved');
  });

  it('passes a chosen status straight through to the list', async () => {
    const list = stubList([report()]);

    render(<BugReportList active scope="all" status="confirmed" onOpen={() => {}} />);

    await waitFor(() => expect(list).toHaveBeenCalledWith(
      expect.objectContaining({ scope: 'all', status: 'confirmed' })
    ));
  });

  it('opens a thread with the triage controls', async () => {
    stubList([report()]);

    render(<BugsTab active />);
    fireEvent.click(await screen.findByText('Save button does nothing'));

    expect(await screen.findByTestId('thread')).toBeTruthy();
  });
});

describe('the reporter’s own tab', () => {
  it('never asks for anyone else’s reports', async () => {
    const list = stubList([report()]);

    render(<MyBugsTab active />);

    await waitFor(() => expect(list).toHaveBeenCalled());
    expect(list.mock.calls[0][0]).not.toMatchObject({ scope: 'all' });
  });

  it('offers to file a new one', async () => {
    stubList([]);

    render(<MyBugsTab active />);

    expect(await screen.findByRole('button', { name: /Report a Bug/ })).toBeTruthy();
  });
});
