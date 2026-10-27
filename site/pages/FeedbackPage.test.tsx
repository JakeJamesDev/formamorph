import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AGE_GATE_VERSION, acceptAgeGate } from '@/lib/ageGate';
import AuthService from '@/services/AuthService';
import type { AuthUser, FeedbackThread } from '@/types';
import { FeedbackPage } from './FeedbackPage';
import { res, resetAccountPage, signIn } from '../test/support';

const { leaveTo } = vi.hoisted(() => ({ leaveTo: vi.fn() }));
vi.mock('../leaveSite', () => ({ leaveTo }));

const ID = '3f2b8c1e-9a4d-4e6f-8b7a-1c2d3e4f5a6b';
const NUMBER = 42;

const thread = (over: Partial<FeedbackThread> = {}): FeedbackThread => ({
  id: ID,
  number: NUMBER,
  type: 'suggestion',
  title: 'Add a map',
  category: 'general',
  body: 'A map of the places I have been.',
  status: 'open',
  reporter: { id: 'u2', username: 'rowan' },
  diagnostics: {},
  createdAt: '2026-07-01T00:00:00.000Z',
  updatedAt: '2026-07-01T00:00:00.000Z',
  locked: false,
  votes: 3,
  voted: false,
  unread: false,
  ...over,
} as FeedbackThread);

const reader: AuthUser = { id: 'u1', username: 'morgan' } as AuthUser;

type Answer = { status: number; body: unknown };
type Answers = (url: URL, init?: RequestInit) => Answer;

/** Serve the age-gate read and route every feedback request through `answer`. */
const serve = (answer: Answers) => {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), 'http://api.test');
    if (url.pathname.endsWith('/policies/age-gate')) return res({ accepted: true, requiredVersion: AGE_GATE_VERSION });
    const { status, body } = answer(url, init);
    return res(body, status < 400, status);
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
};

const feedbackCalls = (fetchMock: ReturnType<typeof serve>) =>
  fetchMock.mock.calls.filter(([input]) => String(input).includes('/feedback'));

const hasToken = (init?: RequestInit) => Boolean((init?.headers as Record<string, string> | undefined)?.Authorization);

/** The board on screen: both tabs stay mounted, and jsdom applies no class that hides the other. */
const activeBoard = () => within(document.querySelector<HTMLElement>('[role="tabpanel"][data-state="active"]')!);

const board = (threads: FeedbackThread[]): Answer => ({ status: 200, body: { data: threads, total: threads.length } });

beforeEach(() => {
  resetAccountPage('/feedback');
  leaveTo.mockClear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('the website feedback page', () => {
  it('shows not-found for a thread UUID and sends nothing', () => {
    resetAccountPage(`/feedback/${ID}`);
    const fetchMock = serve(() => board([]));

    render(<FeedbackPage />);

    expect(screen.getByRole('heading', { name: 'Page Not Found' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('tells an outage apart from an empty board', async () => {
    acceptAgeGate();
    serve(() => ({ status: 503, body: { error: 'Service unavailable' } }));
    const { unmount } = render(<FeedbackPage />);
    expect(await screen.findByText('Formamorph couldn’t load these threads.')).toBeInTheDocument();
    expect(screen.queryByText('No suggestions match this filter.')).not.toBeInTheDocument();
    unmount();

    serve(() => board([]));
    render(<FeedbackPage />);
    expect(await screen.findByText('No suggestions match this filter.')).toBeInTheDocument();
    expect(screen.queryByText('Formamorph couldn’t load these threads.')).not.toBeInTheDocument();
  });

  it('shows the sign-in nudge in place of the board when the server refuses a guest read', async () => {
    acceptAgeGate();
    serve(() => ({ status: 401, body: { error: 'Not authorized' } }));

    render(<FeedbackPage />);

    expect(await screen.findByText('Sign in to read suggestions and questions.')).toBeInTheDocument();
    expect(within(screen.getByRole('main')).getByRole('link', { name: 'Sign In' })).toHaveAttribute('href', '/login?next=%2Ffeedback');
    expect(screen.queryByText('Formamorph couldn’t load these threads.')).not.toBeInTheDocument();
  });

  it('clears a stale session and reads the board once as a guest', async () => {
    signIn(reader);
    acceptAgeGate();
    const fetchMock = serve((_url, init) => (hasToken(init)
      ? { status: 401, body: { error: 'Not authorized' } }
      : board([thread()])));

    render(<FeedbackPage />);

    expect(await screen.findByText('Add a map')).toBeInTheDocument();
    expect(AuthService.token).toBeNull();
    const lists = feedbackCalls(fetchMock);
    expect(lists.map(([, init]) => hasToken(init))).toEqual([true, false]);
  });

  it('shows not-found when a guest opens a missing thread', async () => {
    resetAccountPage(`/feedback/${NUMBER}`);
    acceptAgeGate();
    serve(() => ({ status: 404, body: { error: 'Not found' } }));

    render(<FeedbackPage />);

    expect(await screen.findByRole('heading', { name: 'Page Not Found' })).toBeInTheDocument();
  });

  it('refuses to render a bug a signed-in reader may open in the app', async () => {
    resetAccountPage(`/feedback/${NUMBER}`);
    signIn(reader);
    serve((url) => (url.pathname.endsWith(`/feedback/${NUMBER}`)
      ? { status: 200, body: { data: thread({ type: 'bug', title: 'Secret crash' }), comments: [] } }
      : board([])));

    render(<FeedbackPage />);

    expect(await screen.findByRole('heading', { name: 'Page Not Found' })).toBeInTheDocument();
    expect(screen.queryByText('Secret crash')).not.toBeInTheDocument();
  });

  it('shows no staff control to a staff session', async () => {
    resetAccountPage(`/feedback/${NUMBER}`);
    signIn({ ...reader, accountType: 'admin' } as AuthUser);
    serve(() => ({
      status: 200,
      body: {
        data: thread({ type: 'question', title: 'How do saves work?' }),
        comments: [{ id: 'c1', body: 'Like this.', author: { id: 'u3', username: 'wren' }, createdAt: '2026-07-02T00:00:00.000Z' }],
      },
    }));

    render(<FeedbackPage />);

    expect(await screen.findByText('How do saves work?')).toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: 'Status' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Lock thread|Unlock thread/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete thread' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete comment' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Accept Answer' })).not.toBeInTheDocument();
  });

  it('sends a guest to sign in from Vote, New and Reply, and back to the same address', async () => {
    const user = userEvent.setup();
    acceptAgeGate();
    const fetchMock = serve((url) => (url.pathname.endsWith(`/feedback/${NUMBER}`)
      ? { status: 200, body: { data: thread(), comments: [] } }
      : board([thread()])));
    render(<FeedbackPage />);

    await user.click(await screen.findByRole('button', { name: 'Vote for Add a map' }));
    expect(leaveTo).toHaveBeenLastCalledWith('/login?next=%2Ffeedback');
    await user.click(activeBoard().getByRole('button', { name: 'Suggest Something' }));
    expect(leaveTo).toHaveBeenLastCalledWith('/login?next=%2Ffeedback');

    await user.click(screen.getByText('Add a map'));
    await user.click(await screen.findByRole('button', { name: 'Sign In to Reply' }));
    expect(leaveTo).toHaveBeenLastCalledWith(`/login?next=${encodeURIComponent(`/feedback/${NUMBER}`)}`);

    expect(feedbackCalls(fetchMock).every(([, init]) => !init?.method || init.method === 'GET')).toBe(true);
  });

  it('hides the Mine scope from a guest and shows it to a signed-in reader', async () => {
    acceptAgeGate();
    serve(() => board([thread()]));
    const { unmount } = render(<FeedbackPage />);
    await screen.findByText('Add a map');
    expect(activeBoard().queryByRole('combobox', { name: 'Which threads' })).not.toBeInTheDocument();
    unmount();

    signIn(reader);
    render(<FeedbackPage />);
    await screen.findByText('Add a map');
    expect(activeBoard().getByRole('combobox', { name: 'Which threads' })).toBeInTheDocument();
  });

  it('turns into the guest view when the session ends on the page', async () => {
    const user = userEvent.setup();
    signIn(reader);
    serve(() => board([thread()]));
    render(<FeedbackPage />);
    await screen.findByText('Add a map');
    expect(activeBoard().getByRole('combobox', { name: 'Which threads' })).toBeInTheDocument();

    act(() => AuthService.logout());

    await waitFor(() => expect(activeBoard().queryByRole('combobox', { name: 'Which threads' })).not.toBeInTheDocument());
    await user.click(await screen.findByRole('button', { name: 'Vote for Add a map' }));
    expect(leaveTo).toHaveBeenLastCalledWith('/login?next=%2Ffeedback');
  });

  it('opens a linked thread at its own address, and shows a linked bug as unavailable', async () => {
    const user = userEvent.setup();
    resetAccountPage(`/feedback/${NUMBER}`);
    acceptAgeGate();
    const linked = thread({ id: 'uuid-7', number: 7, title: 'Pin a stat to the panel' });
    const fetchMock = serve((url) => (url.pathname.endsWith('/feedback/7')
      ? { status: 200, body: { data: linked, comments: [] } }
      : {
        status: 200,
        body: {
          data: thread({
            body: 'See #7 and #9.',
            targets: [
              { kind: 'thread', ref: '7', available: true, number: 7, title: linked.title, type: 'suggestion', status: 'open' },
              { kind: 'thread', ref: '9', available: true, number: 9, title: 'Secret crash', type: 'bug', status: 'open' },
            ],
          }),
          comments: [],
        },
      }));
    render(<FeedbackPage />);

    const chip = await screen.findByRole('link', { name: /Pin a stat to the panel/ });
    expect(chip).toHaveAttribute('href', '/feedback/7');
    expect(screen.getByText('9 · Unavailable thread')).toBeInTheDocument();
    expect(screen.queryByText('Secret crash')).not.toBeInTheDocument();

    await user.click(chip);

    expect(window.location.pathname).toBe('/feedback/7');
    expect(await screen.findByRole('heading', { name: /Pin a stat to the panel #7/ })).toBeInTheDocument();
    expect(feedbackCalls(fetchMock).some(([input]) => String(input).endsWith('/feedback/7'))).toBe(true);
  });

  it('sends a name to the site profile page', async () => {
    const user = userEvent.setup();
    resetAccountPage(`/feedback/${NUMBER}`);
    acceptAgeGate();
    serve(() => ({ status: 200, body: { data: thread(), comments: [] } }));
    render(<FeedbackPage />);

    await user.click(await screen.findByRole('button', { name: 'View rowan\'s profile' }));

    expect(leaveTo).toHaveBeenLastCalledWith('/u/rowan');
  });
});
