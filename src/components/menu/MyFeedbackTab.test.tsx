import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MyFeedbackTab } from './MyFeedbackTab';
import FeedbackService from '@/services/FeedbackService';
import AuthService from '@/services/AuthService';
import { scopeFilterValue } from '@/lib/feedbackPresentation';
import type { FeedbackThread } from '@/types';

vi.mock('react-toastify', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));

// The thread view has its own coverage; the stub records what this tab hands it, which is the only way
// to assert the wiring — whether an admin gets a reply box here is decided by these props, not in there.
const threadProps = vi.hoisted(() => ({ last: null as Record<string, unknown> | null }));

vi.mock('./FeedbackThreadView', () => ({
  FeedbackThreadView: (props: Record<string, unknown>) => { threadProps.last = props; return <div data-testid="thread" />; },
}));

vi.mock('./FeedbackDialog', () => ({
  FeedbackDialog: ({ initialType }: { initialType?: string }) => <div data-testid="dialog" data-type={initialType} />,
}));

vi.mock('@/services/AuthService', () => ({
  default: { getCurrentUser: vi.fn(() => ({ id: 'u1', username: 'finder', accountType: 'normal' })) },
}));

const thread = (over: Partial<FeedbackThread> = {}): FeedbackThread => ({
  id: 'b1',
  type: 'bug',
  title: 'Save button does nothing',
  category: 'crash',
  body: 'Pressing save just spins.',
  status: 'open',
  reporter: { id: 'u1', username: 'finder' },
  diagnostics: {},
  locked: false,
  votes: 0,
  voted: false,
  createdAt: '2026-07-01T00:00:00.000Z',
  updatedAt: '2026-07-01T00:00:00.000Z',
  unread: false,
  ...over,
});

const stubList = (over: Partial<FeedbackThread> = {}) =>
  vi.spyOn(FeedbackService, 'list').mockResolvedValue({ threads: [thread(over)], total: 1 });

/** What the list was asked for on its first fetch. */
const firstQuery = () => vi.mocked(FeedbackService.list).mock.calls[0][0];

beforeEach(() => {
  threadProps.last = null;
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('which threads each tab opens on', () => {
  it('opens the bug tab on the reader’s own', async () => {
    // This is where their replies are, and the badge counts their threads.
    stubList();

    render(<MyFeedbackTab active type="bug" />);

    await waitFor(() => expect(firstQuery()).toMatchObject({ type: 'bug', scope: undefined }));
  });

  it('opens the suggestion tab on everyone’s', async () => {
    // A board is for browsing and voting; mine-first buries the point of it.
    stubList();

    render(<MyFeedbackTab active type="suggestion" />);

    await waitFor(() => expect(firstQuery()).toMatchObject({ type: 'suggestion', scope: 'all' }));
  });

  // Radix's Select cannot be opened in jsdom, so the mapping it drives is asserted directly; the wiring
  // from the dropdown to the list is one expression on each side of `scopeFilterValue`.
  it('maps its two choices to what the list asks the server for', () => {
    expect(scopeFilterValue('mine')).toBeUndefined();
    expect(scopeFilterValue('all')).toBe('all');
  });
});

describe('the file button', () => {
  it('offers to report a bug on the bug tab', async () => {
    stubList();

    render(<MyFeedbackTab active type="bug" />);

    expect(await screen.findByRole('button', { name: /Report a Bug/ })).toBeTruthy();
  });

  it('offers to suggest something on the suggestion tab', async () => {
    stubList();

    render(<MyFeedbackTab active type="suggestion" />);

    expect(await screen.findByRole('button', { name: /Suggest Something/ })).toBeTruthy();
  });

  it('opens the dialog on this tab’s branch', async () => {
    // Landing on Bug from the Suggestions tab would be wrong every time.
    stubList();

    render(<MyFeedbackTab active type="suggestion" />);
    fireEvent.click(await screen.findByRole('button', { name: /Suggest Something/ }));

    expect(screen.getByTestId('dialog').getAttribute('data-type')).toBe('suggestion');
  });
});

describe('the category filter', () => {
  it('is offered on both branches', async () => {
    stubList();

    render(<MyFeedbackTab active type="bug" />);
    expect(await screen.findByLabelText('Filter by category')).toBeTruthy();

    cleanup();
    stubList();
    render(<MyFeedbackTab active type="suggestion" />);
    expect(await screen.findByLabelText('Filter by category')).toBeTruthy();
  });

  it('opens on every category', async () => {
    stubList();

    render(<MyFeedbackTab active type="bug" />);

    await waitFor(() => expect(firstQuery()).toMatchObject({ category: undefined }));
  });
});

describe('what the tab does not say', () => {
  it('drops the blurb, so the controls have the row to themselves', async () => {
    // The tab's own label already says what it is; the sentence was costing the filters their space.
    stubList();

    render(<MyFeedbackTab active type="bug" />);
    await screen.findByRole('button', { name: /Report a Bug/ });

    expect(screen.queryByText(/Bugs you.ve reported/)).toBeNull();
  });
});

describe('the sort control', () => {
  it('is offered on a board of everyone’s suggestions', async () => {
    stubList();

    render(<MyFeedbackTab active type="suggestion" />);

    expect(await screen.findByLabelText('Sort by')).toBeTruthy();
  });

  it('is absent on bugs, which have nothing to rank by', async () => {
    stubList();

    render(<MyFeedbackTab active type="bug" />);
    await screen.findByText('Save button does nothing');

    expect(screen.queryByLabelText('Sort by')).toBeNull();
  });
});

describe('opening a thread from the profile', () => {
  const openFirst = async (type: 'bug' | 'suggestion' = 'bug') => {
    stubList({ type });
    render(<MyFeedbackTab active type={type} />);
    fireEvent.click(await screen.findByText('Save button does nothing'));
    return threadProps.last as Record<string, unknown>;
  };

  it('gives an admin the reply box, wherever they found it', async () => {
    // They are the team on any thread; being in their own profile rather than the panel changes nothing.
    vi.mocked(AuthService.getCurrentUser).mockReturnValue({ id: 'a1', username: 'root-admin', accountType: 'admin' });

    expect(await openFirst()).toMatchObject({ isAdmin: true });
  });

  it('keeps triage out of the profile', async () => {
    // Answering is fine here; moving something through the queue is an Admin Panel action.
    vi.mocked(AuthService.getCurrentUser).mockReturnValue({ id: 'a1', username: 'root-admin', accountType: 'admin' });

    expect((await openFirst()).showTriage).toBeFalsy();
  });

  it('treats an ordinary account as one', async () => {
    expect(await openFirst()).toMatchObject({ isAdmin: false });
  });
});
