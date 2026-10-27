import { render, screen, fireEvent, cleanup, waitFor, within } from '@testing-library/react';
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { FeedbackThreadView } from './FeedbackThreadView';
import AuthService from '@/services/AuthService';
import {
  APP_FEEDBACK_CAPABILITIES, WEBSITE_FEEDBACK_CAPABILITIES, type FeedbackCapabilities,
} from '@/lib/feedbackCapabilities';
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

const THREAD_ID = '3f2b8c1e-9a4d-4e6f-8b7a-1c2d3e4f5a6b';

const thread = (over: Partial<FeedbackThread> = {}): FeedbackThread => ({
  id: THREAD_ID,
  number: 7,
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

interface Sent { method: string; path: string; body: unknown }

/** Answer feedback requests like the server; `refuse` fails the write whose method and path suffix it names. */
function serve(detail: { thread: FeedbackThread; comments: FeedbackComment[] }, refuse?: { when: string; status: number }) {
  const sent: Sent[] = [];
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), 'http://api.test');
    const method = init?.method ?? 'GET';
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    const path = url.pathname.replace(/^.*\/feedback/, '/feedback');
    const reply = (json: unknown, status = 200) => new Response(JSON.stringify(json), { status });
    if (method === 'GET') return reply({ data: detail.thread, comments: detail.comments });

    sent.push({ method, path, body });
    if (refuse && `${method} ${path}`.endsWith(refuse.when)) return reply({ error: 'refused' }, refuse.status);
    if (path.endsWith('/vote')) {
      const voted = (body as { voted: boolean }).voted;
      return reply({ data: { ...detail.thread, voted, votes: detail.thread.votes + (voted ? 1 : 0) } });
    }
    if (path.endsWith('/comments') && method === 'POST') {
      return reply({ data: comment({ id: 'new', body: (body as { body: string }).body, author: { id: 'u1', username: 'morgan' } }) });
    }
    if (method === 'PUT' && path.includes('/comments/')) {
      return reply({ data: comment({ id: 'mine', body: (body as { body: string }).body, editedAt: '2026-07-02T00:00:00.000Z', author: { id: 'u1', username: 'morgan' } }) });
    }
    if (method === 'PUT') return reply({ data: { ...detail.thread, ...(body as object), editedAt: '2026-07-02T00:00:00.000Z' } });
    return reply({});
  }));
  return sent;
}

const mine = comment({ id: 'mine', body: 'My own words.', author: { id: 'u1', username: 'morgan' } });
const theirs = comment({ id: 'theirs', body: 'Somebody else.' });

function show(capabilities: FeedbackCapabilities) {
  const notify = vi.fn();
  render(<FeedbackThreadView threadId={THREAD_ID} onBack={() => {}} notify={notify} capabilities={capabilities} />);
  return notify;
}

const signedInAs = (id: string) =>
  vi.spyOn(AuthService, 'getCurrentUser').mockReturnValue({ id, username: 'morgan', accountType: 'normal' });

const SURFACES = [
  ['the app', APP_FEEDBACK_CAPABILITIES],
  ['the website', WEBSITE_FEEDBACK_CAPABILITIES],
] as const;

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('a signed-in reader on a thread', () => {
  it('sends the same requests from the website as from the app', async () => {
    const runs: Sent[][] = [];
    for (const [, capabilities] of SURFACES) {
      signedInAs('u1');
      const sent = serve({ thread: thread(), comments: [mine] });
      show(capabilities);

      fireEvent.click(await screen.findByRole('button', { name: /^Vote · 3/ }));
      fireEvent.click(await screen.findByRole('button', { name: /^Voted · 4/ }));
      await screen.findByRole('button', { name: /^Vote · 3/ });
      fireEvent.change(screen.getByLabelText('Reply'), { target: { value: 'A new comment.' } });
      fireEvent.click(screen.getByRole('button', { name: 'Send Reply' }));
      await screen.findByText('A new comment.');
      runs.push(sent);
      cleanup();
      vi.unstubAllGlobals();
    }

    expect(runs[0]).toEqual([
      { method: 'PUT', path: `/feedback/${THREAD_ID}/vote`, body: { voted: true } },
      { method: 'PUT', path: `/feedback/${THREAD_ID}/vote`, body: { voted: false } },
      { method: 'POST', path: `/feedback/${THREAD_ID}/comments`, body: { body: 'A new comment.' } },
    ]);
    expect(runs[1]).toEqual(runs[0]);
  });

  it('updates the count and the control on a vote, and takes it back', async () => {
    signedInAs('u1');
    serve({ thread: thread(), comments: [] });
    show(WEBSITE_FEEDBACK_CAPABILITIES);

    const vote = await screen.findByRole('button', { name: /^Vote · 3/ });
    fireEvent.click(vote);
    const voted = await screen.findByRole('button', { name: /^Voted · 4/ });
    expect(voted.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(voted);
    expect((await screen.findByRole('button', { name: /^Vote · 3/ })).getAttribute('aria-pressed')).toBe('false');
  });

  it('keeps the count and control and says so under Vote when the request fails', async () => {
    signedInAs('u1');
    serve({ thread: thread(), comments: [] }, { when: '/vote', status: 500 });
    const notify = show(WEBSITE_FEEDBACK_CAPABILITIES);

    const vote = await screen.findByRole('button', { name: /^Vote · 3/ });
    fireEvent.click(vote);

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toBe('Failed to record your vote');
    expect(vote.nextElementSibling).toBe(alert);
    expect(screen.getByRole('button', { name: /^Vote · 3/ }).getAttribute('aria-pressed')).toBe('false');
    expect(notify).not.toHaveBeenCalled();
  });

  it('keeps the app’s toast and shows no line under the control', async () => {
    signedInAs('u1');
    serve({ thread: thread(), comments: [] }, { when: '/vote', status: 500 });
    const notify = show(APP_FEEDBACK_CAPABILITIES);

    fireEvent.click(await screen.findByRole('button', { name: /^Vote · 3/ }));

    await waitFor(() => expect(notify).toHaveBeenCalledWith('Failed to record your vote', 'error', expect.anything()));
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('leaves a refused session to notify instead of a line under the control', async () => {
    signedInAs('u1');
    serve({ thread: thread(), comments: [] }, { when: '/vote', status: 401 });
    const notify = show(WEBSITE_FEEDBACK_CAPABILITIES);

    fireEvent.click(await screen.findByRole('button', { name: /^Vote · 3/ }));

    await waitFor(() => expect(notify).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('keeps the typed text and says so under the reply box when a post fails', async () => {
    signedInAs('u1');
    serve({ thread: thread(), comments: [] }, { when: 'POST /feedback/' + THREAD_ID + '/comments', status: 500 });
    show(WEBSITE_FEEDBACK_CAPABILITIES);

    const box = await screen.findByLabelText('Reply');
    fireEvent.change(box, { target: { value: 'Do not lose this.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send Reply' }));

    expect((await screen.findByRole('alert')).textContent).toBe('Failed to post the comment');
    expect((screen.getByLabelText('Reply') as HTMLTextAreaElement).value).toBe('Do not lose this.');
    expect(screen.queryByText('Do not lose this.', { selector: 'div' })).toBeNull();
  });

  it('edits an own comment, then deletes it after confirming', async () => {
    signedInAs('u1');
    const sent = serve({ thread: thread(), comments: [mine, theirs] });
    show(WEBSITE_FEEDBACK_CAPABILITIES);

    await screen.findByText('My own words.');
    fireEvent.click(screen.getByRole('button', { name: 'Edit comment' }));
    fireEvent.change(screen.getByLabelText('Comment text'), { target: { value: 'Better words.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await screen.findByText('Better words.');

    fireEvent.click(screen.getByRole('button', { name: 'Delete comment' }));
    expect(sent.some((request) => request.method === 'DELETE')).toBe(false);
    const dialog = await screen.findByRole('alertdialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Confirm' }));

    await waitFor(() => expect(screen.queryByText('Better words.')).toBeNull());
    expect(sent.map((request) => `${request.method} ${request.path}`)).toEqual([
      `PUT /feedback/${THREAD_ID}/comments/mine`,
      `DELETE /feedback/${THREAD_ID}/comments/mine`,
    ]);
    expect(screen.getByText('Somebody else.')).toBeTruthy();
  });

  it('keeps a comment and says so under it when the delete fails', async () => {
    signedInAs('u1');
    serve({ thread: thread(), comments: [mine] }, { when: 'DELETE /feedback/' + THREAD_ID + '/comments/mine', status: 500 });
    show(WEBSITE_FEEDBACK_CAPABILITIES);

    await screen.findByText('My own words.');
    fireEvent.click(screen.getByRole('button', { name: 'Delete comment' }));
    fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Confirm' }));

    expect((await screen.findByRole('alert')).textContent).toBe('Failed to delete the comment');
    expect(screen.getByText('My own words.')).toBeTruthy();
  });

  it('edits an own thread and sends only that thread’s changed words', async () => {
    signedInAs('u2');
    const sent = serve({ thread: thread(), comments: [] });
    show(WEBSITE_FEEDBACK_CAPABILITIES);

    await screen.findByText('Darker map tiles');
    fireEvent.click(screen.getByRole('button', { name: /Edit this report/ }));
    fireEvent.change(await screen.findByLabelText('Title'), { target: { value: 'Darker night map tiles' } });
    fireEvent.click(screen.getByRole('button', { name: /^Save/ }));

    await screen.findByText(/Darker night map tiles/);
    expect(sent).toEqual([
      { method: 'PUT', path: `/feedback/${THREAD_ID}`, body: { title: 'Darker night map tiles' } },
    ]);
  });

  it('says a failed thread save inside the edit dialog and keeps the draft', async () => {
    signedInAs('u2');
    serve({ thread: thread(), comments: [] }, { when: 'PUT /feedback/' + THREAD_ID, status: 500 });
    const notify = show(WEBSITE_FEEDBACK_CAPABILITIES);

    await screen.findByText('Darker map tiles');
    fireEvent.click(screen.getByRole('button', { name: /Edit this report/ }));
    fireEvent.change(await screen.findByLabelText('Title'), { target: { value: 'Darker night map tiles' } });
    fireEvent.click(screen.getByRole('button', { name: /^Save/ }));

    const dialog = await screen.findByRole('dialog');
    expect((await within(dialog).findByRole('alert')).textContent).toBe('Failed to save the changes');
    expect((within(dialog).getByLabelText('Title') as HTMLInputElement).value).toBe('Darker night map tiles');
    expect(notify).not.toHaveBeenCalled();
  });

  it('shows no edit or delete on other people’s posts', async () => {
    signedInAs('u1');
    serve({ thread: thread(), comments: [theirs] });
    show(WEBSITE_FEEDBACK_CAPABILITIES);

    await screen.findByText('Somebody else.');
    expect(screen.queryByRole('button', { name: 'Edit comment' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Delete comment' })).toBeNull();
    expect(screen.queryByRole('button', { name: /Edit this report/ })).toBeNull();
  });

  it('shows a staff reader no edit or delete on other people’s posts', async () => {
    vi.spyOn(AuthService, 'getCurrentUser').mockReturnValue({ id: 'u9', username: 'mod', accountType: 'admin' });
    serve({ thread: thread(), comments: [theirs] });
    show(WEBSITE_FEEDBACK_CAPABILITIES);

    await screen.findByText('Somebody else.');
    expect(screen.queryByRole('button', { name: 'Delete comment' })).toBeNull();
    expect(screen.queryByRole('button', { name: /Edit this report/ })).toBeNull();
  });

  it('shows a locked thread as locked with no comment box and no comment edit', async () => {
    signedInAs('u1');
    serve({ thread: thread({ locked: true }), comments: [mine] });
    show(WEBSITE_FEEDBACK_CAPABILITIES);

    await screen.findByText('My own words.');
    expect(screen.getAllByText('Locked').length).toBeGreaterThan(0);
    expect(screen.queryByLabelText('Reply')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Edit comment' })).toBeNull();
  });
});
