import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { FeedbackQueueTab } from './FeedbackQueueTab';
import FeedbackService from '@/services/FeedbackService';
import { ANY_CATEGORY, CATEGORY_OPTIONS, categoryFilterValue } from '@/lib/feedbackPresentation';
import type { FeedbackThread } from '@/types';

vi.mock('react-toastify', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));

// The thread view has its own coverage; the stub records what this tab hands it, which is where the
// difference between an admin queue and a reader's own list actually lives.
const threadProps = vi.hoisted(() => ({ last: null as Record<string, unknown> | null }));

vi.mock('./FeedbackThreadView', () => ({
  FeedbackThreadView: (props: Record<string, unknown>) => { threadProps.last = props; return <div data-testid="thread" />; },
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

/** What the list was asked for on its first fetch. */
const firstQuery = () => vi.mocked(FeedbackService.list).mock.calls[0][0];

beforeEach(() => {
  threadProps.last = null;
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(FeedbackService, 'list').mockResolvedValue({ threads: [thread()], total: 1 });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('the admin queue', () => {
  it('asks for everyone’s threads on its own branch', async () => {
    render(<FeedbackQueueTab active type="suggestion" />);

    await waitFor(() => expect(firstQuery()).toMatchObject({ scope: 'all', type: 'suggestion' }));
  });

  it('opens a thread with triage controls', async () => {
    // This is the surface that moves something through the queue; without the prop it is read-and-reply
    // only, and nothing could ever be resolved.
    render(<FeedbackQueueTab active type="bug" />);
    fireEvent.click(await screen.findByText('Save button does nothing'));

    expect(threadProps.last).toMatchObject({ isAdmin: true, showTriage: true });
  });
});

describe('the category filter', () => {
  it('opens on every category', async () => {
    render(<FeedbackQueueTab active type="bug" />);

    await waitFor(() => expect(firstQuery()).toMatchObject({ category: undefined }));
  });

  it('offers the categories of its own branch', async () => {
    // 'Crash or freeze' is not a thing to suggest, and 'Interface' is not a thing to crash.
    render(<FeedbackQueueTab active type="bug" />);

    expect(await screen.findByLabelText('Filter by category')).toBeTruthy();
    expect(CATEGORY_OPTIONS.bug.map((o) => o.value)).toContain('crash');
    expect(CATEGORY_OPTIONS.suggestion.map((o) => o.value)).not.toContain('crash');
  });

  // Radix's Select cannot be opened in jsdom, so the mapping it drives is asserted directly; the wiring
  // from the dropdown to the list is one expression on each side of `categoryFilterValue`.
  it('maps its choice to what the list asks the server for', () => {
    expect(categoryFilterValue(ANY_CATEGORY)).toBeUndefined();
    expect(categoryFilterValue('crash')).toBe('crash');
  });
});

describe('what the tab does not say', () => {
  it('drops the blurb, so the controls have the row to themselves', async () => {
    // The tab's own label already says what it is; the sentence was costing the filters their space.
    render(<FeedbackQueueTab active type="bug" />);
    await screen.findByText('Save button does nothing');

    expect(screen.queryByText(/Reports filed by users/)).toBeNull();
  });
});

describe('what each queue opens on', () => {
  it('shows the bug queue the open work', async () => {
    // A queue of everything ever resolved is not a queue.
    render(<FeedbackQueueTab active type="bug" />);

    await waitFor(() => expect(firstQuery()).toMatchObject({ status: 'open' }));
  });

  it('shows the suggestion queue everything, ranked', async () => {
    // What matters there is what is most wanted, whatever state it is in.
    render(<FeedbackQueueTab active type="suggestion" />);

    await waitFor(() => expect(firstQuery()).toMatchObject({ status: undefined, sort: 'votes' }));
  });

  it('offers a sort control only where there is something to rank', async () => {
    render(<FeedbackQueueTab active type="suggestion" />);
    expect(await screen.findByLabelText('Sort by')).toBeTruthy();

    cleanup();
    render(<FeedbackQueueTab active type="bug" />);
    await screen.findByText('Save button does nothing');
    expect(screen.queryByLabelText('Sort by')).toBeNull();
  });
});
