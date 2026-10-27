import { readFileSync } from 'node:fs';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MyFeedbackSection } from './MyFeedbackSection';
import { FeedbackThreadView } from './FeedbackThreadView';
import FeedbackService from '@/services/FeedbackService';
import AuthService from '@/services/AuthService';
import { APP_FEEDBACK_CAPABILITIES, WEBSITE_FEEDBACK_CAPABILITIES } from '@/lib/feedbackCapabilities';
import type { FeedbackComment, FeedbackThread } from '@/types';

vi.mock('@/components/game/MarkdownRenderer', () => ({
  MarkdownRenderer: ({ text }: { text: string }) => <div>{text}</div>,
}));

// jsdom can't drive a real Lexical selection; the editors are stubbed to textareas.
vi.mock('@/components/prompt/PromptField', () => ({
  default: ({ value, onChange, ariaLabel }: { value: string; onChange: (v: string) => void; ariaLabel?: string }) => (
    <textarea aria-label={ariaLabel} value={value} onChange={(e) => onChange(e.target.value)} />
  ),
}));

const thread = (over: Partial<FeedbackThread> = {}): FeedbackThread => ({
  id: 's1',
  number: 1,
  type: 'suggestion',
  title: 'Darker map tiles',
  category: 'other',
  body: 'The map is hard to read at night.',
  status: 'open',
  reporter: { id: 'u2', username: 'mapper' },
  diagnostics: {},
  createdAt: '2026-07-01T00:00:00.000Z',
  updatedAt: '2026-07-01T00:00:00.000Z',
  locked: false,
  votes: 3,
  voted: false,
  unread: false,
  ...over,
});

const comment = (over: Partial<FeedbackComment> = {}): FeedbackComment => ({
  id: 'c1',
  body: 'Seconded.',
  createdAt: '2026-07-01T01:00:00.000Z',
  editedAt: null,
  author: { id: 'u3', username: 'reader' },
  ...over,
});

const signedOut = () => vi.spyOn(AuthService, 'getCurrentUser').mockReturnValue(null);
const signedInAs = (id: string, accountType = 'normal') =>
  vi.spyOn(AuthService, 'getCurrentUser').mockReturnValue({ id, username: 'someone', accountType });

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('the website set for a guest', () => {
  const renderBoard = () => {
    const onGuestWrite = vi.fn();
    const notify = vi.fn();
    render(
      <MyFeedbackSection active capabilities={WEBSITE_FEEDBACK_CAPABILITIES} notify={notify} onGuestWrite={onGuestWrite} />,
    );
    return { onGuestWrite, notify };
  };

  it('shows the Votable boards and no bug tab', async () => {
    signedOut();
    vi.spyOn(FeedbackService, 'list').mockResolvedValue({ threads: [thread()], total: 1 });
    renderBoard();

    expect(await screen.findByText('Darker map tiles')).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Suggestions' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('tab', { name: 'Questions' })).toBeTruthy();
    expect(screen.queryByRole('tab', { name: 'Bugs' })).toBeNull();
  });

  it('sends Vote and New to the sign-in handler instead of the service', async () => {
    signedOut();
    vi.spyOn(FeedbackService, 'list').mockResolvedValue({ threads: [thread()], total: 1 });
    const setVote = vi.spyOn(FeedbackService, 'setVote');
    const { onGuestWrite } = renderBoard();

    fireEvent.click(await screen.findByRole('button', { name: 'Vote for Darker map tiles' }));
    expect(onGuestWrite).toHaveBeenCalledTimes(1);
    expect(setVote).not.toHaveBeenCalled();

    // Every board's New button is mounted; the visible tab's is the first.
    fireEvent.click(screen.getAllByRole('button', { name: 'Suggest Something' })[0]);
    expect(onGuestWrite).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('sends a thread’s Vote and Reply to the sign-in handler instead of the service', async () => {
    signedOut();
    vi.spyOn(FeedbackService, 'list').mockResolvedValue({ threads: [thread()], total: 1 });
    vi.spyOn(FeedbackService, 'fetchThread').mockResolvedValue({ thread: thread(), comments: [comment()] });
    const setVote = vi.spyOn(FeedbackService, 'setVote');
    const post = vi.spyOn(FeedbackService, 'comment');
    const { onGuestWrite } = renderBoard();

    fireEvent.click(await screen.findByText('Darker map tiles'));
    fireEvent.click(await screen.findByRole('button', { name: /^Vote · 3/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Sign In to Reply' }));

    expect(onGuestWrite).toHaveBeenCalledTimes(2);
    expect(setVote).not.toHaveBeenCalled();
    expect(post).not.toHaveBeenCalled();
    expect(screen.queryByLabelText('Reply')).toBeNull();
  });

  it('reports a failed load through notify with the error', async () => {
    signedOut();
    const failure = new Error('offline');
    vi.spyOn(FeedbackService, 'list').mockRejectedValue(failure);
    const { notify } = renderBoard();

    await waitFor(() => expect(notify).toHaveBeenCalledWith('Failed to load these', 'error', failure));
  });
});

describe('staff controls', () => {
  const question = thread({ id: 'q1', type: 'question', title: 'How do saves sync?', reporter: { id: 'u2', username: 'asker' } });

  const renderThread = (capabilities: typeof APP_FEEDBACK_CAPABILITIES) => {
    vi.spyOn(FeedbackService, 'fetchThread').mockResolvedValue({ thread: question, comments: [comment()] });
    render(
      <FeedbackThreadView threadId="q1" onBack={() => {}} isAdmin showTriage notify={vi.fn()} capabilities={capabilities} />,
    );
  };

  it('shows the staff controls in the app set', async () => {
    signedInAs('a1', 'admin');
    renderThread(APP_FEEDBACK_CAPABILITIES);

    expect(await screen.findByRole('combobox', { name: 'Status' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Lock thread' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Delete thread' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Accept Answer' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Delete comment' })).toBeTruthy();
  });

  it('treats a staff reader as a player in the website set', async () => {
    signedInAs('a1', 'admin');
    renderThread(WEBSITE_FEEDBACK_CAPABILITIES);

    expect(await screen.findByText('How do saves sync?')).toBeTruthy();
    expect(screen.queryByRole('combobox', { name: 'Status' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Lock thread' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Delete thread' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Accept Answer' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Delete comment' })).toBeNull();
  });

  it('keeps the asker’s own Accept Answer in the website set', async () => {
    signedInAs('u2');
    renderThread(WEBSITE_FEEDBACK_CAPABILITIES);

    expect(await screen.findByRole('button', { name: 'Accept Answer' })).toBeTruthy();
  });
});

describe('the unread badge', () => {
  const renderUnread = (capabilities: typeof APP_FEEDBACK_CAPABILITIES) => {
    signedInAs('u1');
    vi.spyOn(FeedbackService, 'list').mockResolvedValue({ threads: [thread({ unread: true })], total: 1 });
    render(<MyFeedbackSection active initialTab="suggestions" capabilities={capabilities} notify={vi.fn()} />);
  };

  it('marks an unread thread in the app set', async () => {
    renderUnread(APP_FEEDBACK_CAPABILITIES);
    expect(await screen.findByLabelText('New replies')).toBeTruthy();
  });

  it('leaves it unmarked in the website set', async () => {
    renderUnread(WEBSITE_FEEDBACK_CAPABILITIES);
    expect(await screen.findByText('Darker map tiles')).toBeTruthy();
    expect(screen.queryByLabelText('New replies')).toBeNull();
  });
});

describe('the reused components', () => {
  const REUSED = [
    'MyFeedbackSection', 'MyFeedbackTab', 'FeedbackList', 'FeedbackThreadView', 'FeedbackDialog', 'FeedbackEditDialog',
  ];

  it.each(REUSED)('%s imports no toast library', (name) => {
    const source = readFileSync(`src/components/menu/${name}.tsx`, 'utf-8');
    expect(source).not.toMatch(/from ["'](react-toastify|@\/lib\/linkToast|@\/lib\/feedbackToast)["']/);
  });
});
