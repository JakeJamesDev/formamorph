import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { FeedbackList } from './FeedbackList';
import { FeedbackQueueTab } from './FeedbackQueueTab';
import { MyFeedbackTab } from './MyFeedbackTab';
import { ANY_STATUS, statusFilterValue } from '@/lib/feedbackPresentation';
import FeedbackService from '@/services/FeedbackService';
import type { FeedbackThread } from '@/types';

vi.mock('react-toastify', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));

// The thread and the report form have their own coverage; stubbing them keeps this file about the list.
vi.mock('./FeedbackThreadView', () => ({ FeedbackThreadView: () => <div data-testid="thread" /> }));
vi.mock('./FeedbackDialog', () => ({ FeedbackDialog: () => null }));

const report = (over: Partial<FeedbackThread> = {}): FeedbackThread => ({
  id: 'b1',
  type: 'bug',
  title: 'Save button does nothing',
  category: 'crash',
  body: 'Pressing save just spins.',
  status: 'open',
  reporter: { id: 'u1', username: 'finder' },
  diagnostics: {},
  createdAt: '2026-07-01T00:00:00.000Z',
  updatedAt: '2026-07-01T00:00:00.000Z',
  locked: false,
  votes: 0,
  voted: false,
  unread: false,
  ...over,
});

const stubList = (threads: FeedbackThread[], total = threads.length) =>
  vi.spyOn(FeedbackService, 'list').mockResolvedValue({ threads, total });

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

    render(<FeedbackList type="bug" active={false} onOpen={() => {}} />);

    await waitFor(() => expect(list).not.toHaveBeenCalled());
  });

  it('shows the title, category and status', async () => {
    stubList([report()]);

    render(<FeedbackList type="bug" active onOpen={() => {}} />);

    expect(await screen.findByText('Save button does nothing')).toBeTruthy();
    expect(screen.getByText(/Crash or freeze/)).toBeTruthy();
    expect(screen.getByText('Open')).toBeTruthy();
  });

  it('flags a thread with replies the reader has not seen', async () => {
    stubList([report({ unread: true })]);

    render(<FeedbackList type="bug" active onOpen={() => {}} />);

    expect(await screen.findByLabelText('New replies')).toBeTruthy();
  });

  it('weights an unread title as well as dotting it', async () => {
    // The dot is a color, and color alone excludes anybody whose vision does not separate these hues.
    stubList([report({ unread: true })]);

    render(<FeedbackList type="bug" active onOpen={() => {}} />);

    expect((await screen.findByText('Save button does nothing')).className).toContain('font-semibold');
  });

  it('leaves a read title at the ordinary weight, or the weight says nothing', async () => {
    stubList([report({ unread: false })]);

    render(<FeedbackList type="bug" active onOpen={() => {}} />);

    expect((await screen.findByText('Save button does nothing')).className).not.toContain('font-semibold');
  });

  it('rails the whole unread row, not just its title', async () => {
    // Scanning a long list should not mean hunting for dots at the end of each title.
    stubList([report({ unread: true })]);

    const { container } = render(<FeedbackList type="bug" active onOpen={() => {}} />);
    await screen.findByText('Save button does nothing');

    const row = container.querySelector('.relative.flex.items-stretch');
    expect(row?.querySelector('[aria-hidden="true"].absolute')).toBeTruthy();
  });

  it('leaves a read row unrailed', async () => {
    stubList([report({ unread: false })]);

    const { container } = render(<FeedbackList type="bug" active onOpen={() => {}} />);
    await screen.findByText('Save button does nothing');

    expect(container.querySelector('[aria-hidden="true"].absolute')).toBeNull();
  });

  it('leaves a read thread unflagged', async () => {
    stubList([report({ unread: false })]);

    render(<FeedbackList type="bug" active onOpen={() => {}} />);
    await screen.findByText('Save button does nothing');

    expect(screen.queryByLabelText('New replies')).toBeNull();
  });

  it('names the reporter only on the admin queue', async () => {
    // Your own list is all yours, so naming you on every row is noise.
    const { unmount } = render(<FeedbackList type="bug" active onOpen={() => {}} />);
    stubList([report()]);
    unmount();

    stubList([report()]);
    render(<FeedbackList type="bug" active onOpen={() => {}} />);
    await screen.findByText('Save button does nothing');
    expect(screen.queryByText(/finder/)).toBeNull();
    cleanup();

    stubList([report()]);
    render(<FeedbackList type="bug" active scope="all" onOpen={() => {}} />);
    await screen.findByText('Save button does nothing');
    expect(screen.getByText(/finder/)).toBeTruthy();
  });

  it('opens the report that was clicked', async () => {
    stubList([report({ id: 'b7' })]);
    const onOpen = vi.fn();

    render(<FeedbackList type="bug" active onOpen={onOpen} />);
    fireEvent.click(await screen.findByText('Save button does nothing'));

    expect(onOpen).toHaveBeenCalledWith('b7');
  });

  it('says so when there is nothing to show', async () => {
    stubList([]);

    render(<FeedbackList type="bug" active onOpen={() => {}} emptyLabel="Nothing here." />);

    expect(await screen.findByText('Nothing here.')).toBeTruthy();
  });

  it('shows no pager when everything fits one page', async () => {
    stubList([report()], 1);

    render(<FeedbackList type="bug" active onOpen={() => {}} />);
    await screen.findByText('Save button does nothing');

    expect(screen.queryByText(/Page 1 of/)).toBeNull();
  });
});

describe('the admin queue', () => {
  it('asks for everyone’s reports, open ones first', async () => {
    // The default filter is the queue that needs work, not the whole archive.
    const list = stubList([report()]);

    render(<FeedbackQueueTab type="bug" active />);

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

    render(<FeedbackList type="bug" active scope="all" status="confirmed" onOpen={() => {}} />);

    await waitFor(() => expect(list).toHaveBeenCalledWith(
      expect.objectContaining({ scope: 'all', status: 'confirmed' })
    ));
  });

  it('opens a thread with the triage controls', async () => {
    stubList([report()]);

    render(<FeedbackQueueTab type="bug" active />);
    fireEvent.click(await screen.findByText('Save button does nothing'));

    expect(await screen.findByTestId('thread')).toBeTruthy();
  });
});

describe('the reporter’s own tab', () => {
  it('never asks for anyone else’s reports', async () => {
    const list = stubList([report()]);

    render(<MyFeedbackTab type="bug" active />);

    await waitFor(() => expect(list).toHaveBeenCalled());
    expect(list.mock.calls[0][0]).not.toMatchObject({ scope: 'all' });
  });

  it('offers to file a new one', async () => {
    stubList([]);

    render(<MyFeedbackTab type="bug" active />);

    expect(await screen.findByRole('button', { name: /Report a Bug/ })).toBeTruthy();
  });
});

describe('votes on the list', () => {
  const suggestion = (over: Partial<FeedbackThread> = {}) =>
    report({ type: 'suggestion', category: 'gameplay', title: 'Let me rename a save', ...over });

  it('offers a vote button on a suggestion', async () => {
    stubList([suggestion({ votes: 3, voted: false })]);

    render(<FeedbackList type="suggestion" active onOpen={() => {}} />);

    expect(await screen.findByRole('button', { name: /Vote for Let me rename a save/ })).toBeTruthy();
    expect(screen.getByText('3')).toBeTruthy();
  });

  it('offers none on a bug', async () => {
    // A bug is not a popularity contest — one person hitting it is reason enough to fix it.
    stubList([report()]);

    render(<FeedbackList type="bug" active onOpen={() => {}} />);
    await screen.findByText('Save button does nothing');

    expect(screen.queryByRole('button', { name: /Vote/ })).toBeNull();
  });

  it('says when the vote on screen is the reader’s', async () => {
    stubList([suggestion({ votes: 1, voted: true })]);

    render(<FeedbackList type="suggestion" active onOpen={() => {}} />);

    const button = await screen.findByRole('button', { name: /Remove your vote/ });
    expect(button.getAttribute('aria-pressed')).toBe('true');
  });

  it('sends the vote and patches the row in place', async () => {
    // Patched rather than reloaded: re-sorting the board under a click would move the row out from
    // under the pointer.
    const list = stubList([suggestion({ votes: 3, voted: false })]);
    const setVote = vi.spyOn(FeedbackService, 'setVote')
      .mockResolvedValue(suggestion({ votes: 4, voted: true }));

    render(<FeedbackList type="suggestion" active onOpen={() => {}} />);
    fireEvent.click(await screen.findByRole('button', { name: /Vote for/ }));

    await waitFor(() => expect(setVote).toHaveBeenCalledWith('b1', true));
    expect(await screen.findByText('4')).toBeTruthy();
    expect(list).toHaveBeenCalledTimes(1);
  });

  it('takes a vote back', async () => {
    stubList([suggestion({ votes: 1, voted: true })]);
    const setVote = vi.spyOn(FeedbackService, 'setVote')
      .mockResolvedValue(suggestion({ votes: 0, voted: false }));

    render(<FeedbackList type="suggestion" active onOpen={() => {}} />);
    fireEvent.click(await screen.findByRole('button', { name: /Remove your vote/ }));

    await waitFor(() => expect(setVote).toHaveBeenCalledWith('b1', false));
  });

  it('leaves the count alone when the vote fails', async () => {
    stubList([suggestion({ votes: 3, voted: false })]);
    vi.spyOn(FeedbackService, 'setVote').mockRejectedValue(new Error('offline'));

    render(<FeedbackList type="suggestion" active onOpen={() => {}} />);
    fireEvent.click(await screen.findByRole('button', { name: /Vote for/ }));

    await waitFor(() => expect(screen.getByText('3')).toBeTruthy());
  });

  it('does not open the thread when the vote is clicked', async () => {
    // The vote sits inside the row; a stray navigation on every vote would make the board unusable.
    stubList([suggestion()]);
    vi.spyOn(FeedbackService, 'setVote').mockResolvedValue(suggestion({ votes: 2, voted: true }));
    const onOpen = vi.fn();

    render(<FeedbackList type="suggestion" active onOpen={onOpen} />);
    fireEvent.click(await screen.findByRole('button', { name: /Vote for/ }));

    await waitFor(() => expect(FeedbackService.setVote).toHaveBeenCalled());
    expect(onOpen).not.toHaveBeenCalled();
  });
});

describe('what the list asks for', () => {
  it('names its branch', async () => {
    stubList([]);

    render(<FeedbackList type="suggestion" active onOpen={() => {}} />);

    await waitFor(() => expect(vi.mocked(FeedbackService.list).mock.calls[0][0])
      .toMatchObject({ type: 'suggestion' }));
  });

  it('passes the sort through', async () => {
    stubList([]);

    render(<FeedbackList type="suggestion" active sort="votes" onOpen={() => {}} />);

    await waitFor(() => expect(vi.mocked(FeedbackService.list).mock.calls[0][0])
      .toMatchObject({ sort: 'votes' }));
  });

  it('marks a locked thread', async () => {
    stubList([report({ locked: true })]);

    render(<FeedbackList type="bug" active onOpen={() => {}} />);

    expect(await screen.findByLabelText('Locked')).toBeTruthy();
  });
});

describe('the reply count', () => {
  it('says how many, so a busy thread reads as busy from the list', async () => {
    stubList([report({ commentCount: 4 })]);

    render(<FeedbackList type="bug" active onOpen={() => {}} />);

    expect((await screen.findByLabelText('4 replies')).textContent).toContain('4');
  });

  it('is worded singular for one, since the glyph does not carry the number', async () => {
    stubList([report({ commentCount: 1 })]);

    render(<FeedbackList type="bug" active onOpen={() => {}} />);

    expect(await screen.findByLabelText('1 reply')).toBeTruthy();
  });

  it('is absent on a thread nobody has replied to', async () => {
    // A column of zeroes down an untouched queue says only that the feature exists.
    stubList([report({ commentCount: 0 })]);

    render(<FeedbackList type="bug" active onOpen={() => {}} />);

    await screen.findByText('Save button does nothing');
    expect(screen.queryByLabelText(/repl/)).toBeNull();
  });

  it('is absent when the server never sent one', async () => {
    // An older server omits the field; that is not the same as a thread with no replies, and showing a
    // zero would state something this build does not know.
    stubList([report()]);

    render(<FeedbackList type="bug" active onOpen={() => {}} />);

    await screen.findByText('Save button does nothing');
    expect(screen.queryByLabelText(/repl/)).toBeNull();
  });

  it('sits under the status rather than beside the title', async () => {
    // Both are per-thread facts about where it stands; splitting them puts one at each end of the row.
    stubList([report({ commentCount: 2 })]);

    render(<FeedbackList type="bug" active onOpen={() => {}} />);

    const count = await screen.findByLabelText('2 replies');
    expect(count.parentElement?.textContent).toContain('Open');
  });

  it('counts on a suggestion too, where a vote already competes for the eye', async () => {
    stubList([report({ type: 'suggestion', category: 'gameplay', status: 'open', votes: 7, commentCount: 3 })]);

    render(<FeedbackList type="suggestion" active onOpen={() => {}} />);

    expect(await screen.findByLabelText('3 replies')).toBeTruthy();
  });
});
