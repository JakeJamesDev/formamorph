import { render, screen, fireEvent, cleanup, waitFor, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { FeedbackDialog } from './FeedbackDialog';
import { FEEDBACK_SEARCH_DELAY_MS } from './FeedbackSearchInput';
import { SIMILAR_LIMIT } from './SimilarQuestions';
import FeedbackService, { type FeedbackPage } from '@/services/FeedbackService';
import type { FeedbackThread } from '@/types';

vi.mock('react-toastify', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));

vi.mock('@/components/game/MarkdownRenderer', () => ({
  MarkdownRenderer: ({ text }: { text: string }) => <div>{text}</div>,
}));

// jsdom can't drive a real Lexical selection; the editors are stubbed to textareas so they can be filled.
vi.mock('@/components/prompt/PromptField', () => ({
  default: ({ value, onChange, ariaLabel }: { value: string; onChange: (v: string) => void; ariaLabel?: string }) => (
    <textarea aria-label={ariaLabel} value={value} onChange={(e) => onChange(e.target.value)} />
  ),
}));

const question = (over: Partial<FeedbackThread> = {}): FeedbackThread => ({
  id: 'q1',
  type: 'question',
  title: 'Can a stat change when the player enters a location?',
  category: 'editor',
  body: 'I want warmth to drop in the cave.',
  status: 'open',
  reporter: { id: 'u2', username: 'asker' },
  diagnostics: {},
  createdAt: '2026-07-01T00:00:00.000Z',
  updatedAt: '2026-07-01T00:00:00.000Z',
  locked: false,
  votes: 4,
  voted: false,
  unread: false,
  ...over,
});

const page = (...threads: FeedbackThread[]): FeedbackPage => ({ threads, total: threads.length });

/** Sets a field's value the way typing does, so React's change handler fires. */
const fill = (el: HTMLElement, value: string) => {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, 'value')!.set!.call(el, value);
  el.dispatchEvent(new Event('input', { bubbles: true }));
};

const setTitle = (value: string) => fill(document.getElementById('feedbackTitle')!, value);
const setBody = (value: string) => fill(screen.getByLabelText('What you tried'), value);

const pause = () => act(() => new Promise((resolve) => setTimeout(resolve, FEEDBACK_SEARCH_DELAY_MS + 100)));

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('similar questions while asking', () => {
  it('searches every question by the title once it has a few characters', async () => {
    const list = vi.spyOn(FeedbackService, 'list').mockResolvedValue(page(question()));

    render(<FeedbackDialog open onOpenChange={() => {}} initialType="question" />);
    setTitle('ca');
    await pause();
    expect(list).not.toHaveBeenCalled();

    setTitle('stat location');
    expect(await screen.findByText('Similar Questions')).toBeTruthy();
    expect(list).toHaveBeenCalledTimes(1);
    expect(list).toHaveBeenCalledWith({ type: 'question', scope: 'all', search: 'stat location', limit: SIMILAR_LIMIT });
    expect(screen.getByRole('button', { name: /Can a stat change/ })).toBeTruthy();
  });

  it('never searches for a bug or a suggestion', async () => {
    const list = vi.spyOn(FeedbackService, 'list').mockResolvedValue(page(question()));

    render(<FeedbackDialog open onOpenChange={() => {}} initialType="suggestion" />);
    setTitle('Let me pin a stat');
    await pause();

    expect(list).not.toHaveBeenCalled();
    expect(screen.queryByText('Similar Questions')).toBeNull();
  });

  it('drops a response that arrives after a newer keystroke', async () => {
    const resolvers: ((value: FeedbackPage) => void)[] = [];
    vi.spyOn(FeedbackService, 'list').mockImplementation(
      () => new Promise<FeedbackPage>((resolve) => { resolvers.push(resolve); }),
    );

    render(<FeedbackDialog open onOpenChange={() => {}} initialType="question" />);
    setTitle('undo turn');
    await waitFor(() => expect(resolvers).toHaveLength(1));
    setTitle('stat location');
    await waitFor(() => expect(resolvers).toHaveLength(2));

    await act(async () => { resolvers[1](page(question({ id: 'new', title: 'Newer match' }))); });
    await act(async () => { resolvers[0](page(question({ id: 'old', title: 'Older match' }))); });

    expect(screen.getByText('Newer match')).toBeTruthy();
    expect(screen.queryByText('Older match')).toBeNull();
  });

  it('hides the list when a newer search fails', async () => {
    const list = vi.spyOn(FeedbackService, 'list').mockResolvedValueOnce(page(question()));

    render(<FeedbackDialog open onOpenChange={() => {}} initialType="question" />);
    setTitle('stat location');
    expect(await screen.findByText('Similar Questions')).toBeTruthy();

    list.mockRejectedValueOnce(new Error('offline'));
    setTitle('stat location cave');
    await waitFor(() => expect(list).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByText('Similar Questions')).toBeNull());
  });

  it('sends nothing once the dialog unmounts mid-pause', async () => {
    const list = vi.spyOn(FeedbackService, 'list').mockResolvedValue(page(question()));

    const { unmount } = render(<FeedbackDialog open onOpenChange={() => {}} initialType="question" />);
    setTitle('stat location');
    unmount();
    await pause();

    expect(list).not.toHaveBeenCalled();
  });

  it('opens a match in the dialog, votes and replies there, and goes back to the unchanged draft', async () => {
    vi.spyOn(FeedbackService, 'list').mockResolvedValue(page(question()));
    vi.spyOn(FeedbackService, 'fetchThread').mockResolvedValue({ thread: question(), comments: [] });
    const vote = vi.spyOn(FeedbackService, 'setVote').mockResolvedValue(question({ voted: true, votes: 5 }));
    const comment = vi.spyOn(FeedbackService, 'comment').mockResolvedValue({
      id: 'c1', body: 'Me too.', createdAt: '2026-07-02T00:00:00.000Z', editedAt: null, author: { id: 'me', username: 'me' },
    });

    render(<FeedbackDialog open onOpenChange={() => {}} initialType="question" />);
    setTitle('stat location');
    setBody('Tried a script.');
    fireEvent.click(await screen.findByRole('button', { name: /Can a stat change/ }));

    expect(await screen.findByText('I want warmth to drop in the cave.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Post Question' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /Vote · 4/ }));
    await waitFor(() => expect(vote).toHaveBeenCalledWith('q1', true));

    fill(screen.getByLabelText('Reply'), 'Me too.');
    fireEvent.click(screen.getByRole('button', { name: /Send Reply/ }));
    await waitFor(() => expect(comment).toHaveBeenCalledWith('q1', 'Me too.'));

    fireEvent.click(screen.getByRole('button', { name: /Back/ }));

    expect((document.getElementById('feedbackTitle') as HTMLInputElement).value).toBe('stat location');
    expect((screen.getByLabelText('What you tried') as HTMLTextAreaElement).value).toBe('Tried a script.');
    expect(screen.getByRole('button', { name: 'Post Question' })).toBeTruthy();
  });
});
