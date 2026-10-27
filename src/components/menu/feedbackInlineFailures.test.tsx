import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { FeedbackDialog } from './FeedbackDialog';
import { FeedbackList } from './FeedbackList';
import FeedbackService from '@/services/FeedbackService';
import { DetailedError } from '@/lib/errorDetails';
import { APP_FEEDBACK_CAPABILITIES, WEBSITE_FEEDBACK_CAPABILITIES } from '@/lib/feedbackCapabilities';
import type { FeedbackThread } from '@/types';

vi.mock('@/components/prompt/PromptField', () => ({
  default: (props: { value: string; onChange: (v: string) => void; ariaLabel?: string }) => (
    <textarea id="feedbackBody" aria-label={props.ariaLabel} value={props.value} onChange={(e) => props.onChange(e.target.value)} />
  ),
}));

const setField = (id: string, value: string) => {
  const el = document.getElementById(id) as HTMLInputElement | HTMLTextAreaElement;
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, 'value')!.set!.call(el, value);
  el.dispatchEvent(new Event('input', { bubbles: true }));
};

const send = () => fireEvent.click(screen.getByRole('button', { name: /Send Suggestion/ }));

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('the filing form on the website', () => {
  const open = (notify = vi.fn(), capabilities = WEBSITE_FEEDBACK_CAPABILITIES) => {
    render(<FeedbackDialog notify={notify} open onOpenChange={() => {}} initialType="suggestion" capabilities={capabilities} />);
    return notify;
  };

  it('says an empty title in the form, not to the page', () => {
    const notify = open();
    setField('feedbackBody', 'Some text');
    send();

    expect(screen.getByRole('alert').textContent).toBe('A title is required');
    expect(notify).not.toHaveBeenCalled();
  });

  it('says an empty description in the form, not to the page', () => {
    const notify = open();
    setField('feedbackTitle', 'A title');
    send();

    expect(screen.getByRole('alert').textContent).toBe('A description is required');
    expect(notify).not.toHaveBeenCalled();
  });

  it('says a failed send once, in the form', async () => {
    vi.spyOn(FeedbackService, 'file').mockRejectedValue(new Error('offline'));
    const notify = open();
    setField('feedbackTitle', 'A title');
    setField('feedbackBody', 'Some text');
    send();

    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe('Failed to send this'));
    expect(notify).not.toHaveBeenCalled();
  });

  it('hands a 401 to notify, which owns the session', async () => {
    vi.spyOn(FeedbackService, 'file').mockRejectedValue(new DetailedError('Signed out', '', 401));
    const notify = open();
    setField('feedbackTitle', 'A title');
    setField('feedbackBody', 'Some text');
    send();

    await waitFor(() => expect(notify).toHaveBeenCalledWith('Failed to send this', 'error', expect.anything()));
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

describe('the filing form in the app', () => {
  it('keeps its notify calls for an empty title and a failed send', async () => {
    vi.spyOn(FeedbackService, 'file').mockRejectedValue(new Error('offline'));
    const notify = vi.fn();
    render(<FeedbackDialog notify={notify} open onOpenChange={() => {}} initialType="suggestion" capabilities={APP_FEEDBACK_CAPABILITIES} />);
    send();
    expect(notify).toHaveBeenCalledWith('A title is required', 'error');

    setField('feedbackTitle', 'A title');
    setField('feedbackBody', 'Some text');
    send();
    await waitFor(() => expect(notify).toHaveBeenCalledWith('Failed to send this', 'error', expect.anything()));
  });
});

describe('a failed vote on a list row', () => {
  const thread = (id: string, title: string): FeedbackThread => ({
    id, number: 1, type: 'suggestion', title, category: 'gameplay', body: 'x', status: 'open',
    reporter: { id: 'u1', username: 'finder' }, diagnostics: {},
    createdAt: '2026-07-01T00:00:00.000Z', updatedAt: '2026-07-01T00:00:00.000Z',
    locked: false, votes: 0, voted: false, unread: false,
  });

  const renderList = (capabilities: typeof APP_FEEDBACK_CAPABILITIES, notify = vi.fn()) => {
    vi.spyOn(FeedbackService, 'list').mockResolvedValue({ threads: [thread('a', 'First'), thread('b', 'Second')], total: 2 });
    render(
      <FeedbackList type="suggestion" active page={1} onPageChange={() => {}} onOpen={() => {}} notify={notify} capabilities={capabilities} />,
    );
    return notify;
  };

  it('shows its message under that row only', async () => {
    vi.spyOn(FeedbackService, 'setVote').mockRejectedValue(new Error('offline'));
    const notify = renderList(WEBSITE_FEEDBACK_CAPABILITIES);
    fireEvent.click(await screen.findByRole('button', { name: /Vote for Second/ }));

    const note = await screen.findByRole('alert');
    expect(note.textContent).toBe('Failed to record your vote');
    const rowOf = (name: RegExp) => screen.getByRole('button', { name }).parentElement!.parentElement!;
    expect(rowOf(/Vote for Second/).contains(note)).toBe(true);
    expect(rowOf(/Vote for First/).contains(note)).toBe(false);
    expect(notify).not.toHaveBeenCalled();
  });

  it('keeps the app’s toast', async () => {
    vi.spyOn(FeedbackService, 'setVote').mockRejectedValue(new Error('offline'));
    const notify = renderList(APP_FEEDBACK_CAPABILITIES);
    fireEvent.click(await screen.findByRole('button', { name: /Vote for First/ }));

    await waitFor(() => expect(notify).toHaveBeenCalledWith('Failed to record your vote', 'error', expect.anything()));
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
