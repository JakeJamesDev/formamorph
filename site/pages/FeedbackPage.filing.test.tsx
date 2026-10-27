import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AGE_GATE_VERSION, acceptAgeGate } from '@/lib/ageGate';
import { loadFeedbackDraft } from '@/lib/feedbackDraft';
import type { AuthUser, FeedbackThread } from '@/types';
import { FeedbackPage } from './FeedbackPage';
import { res, resetAccountPage, signIn } from '../test/support';

vi.mock('../leaveSite', () => ({ leaveTo: vi.fn() }));

// jsdom can't drive a real Lexical selection; the editor is stubbed to a textarea.
vi.mock('@/components/prompt/PromptField', () => ({
  default: ({ value, onChange, ariaLabel }: { value: string; onChange: (v: string) => void; ariaLabel?: string }) => (
    <textarea aria-label={ariaLabel} value={value} onChange={(e) => onChange(e.target.value)} />
  ),
}));

const thread = (over: Partial<FeedbackThread> = {}): FeedbackThread => ({
  id: 'uuid-42',
  number: 42,
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

const reader = { id: 'u1', username: 'morgan' } as AuthUser;

type Answer = { status: number; body: unknown };

/** Serves the age-gate read, then routes each feedback request through `answer`. */
const serve = (answer: (url: URL, init?: RequestInit) => Answer) => {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), 'http://api.test');
    if (url.pathname.endsWith('/policies/age-gate')) return res({ accepted: true, requiredVersion: AGE_GATE_VERSION });
    const { status, body } = answer(url, init);
    return res(body, status < 400, status);
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
};

const filings = (fetchMock: ReturnType<typeof serve>) =>
  fetchMock.mock.calls.filter(([, init]) => init?.method === 'POST');

const empty: Answer = { status: 200, body: { data: [], total: 0 } };

const typeInto = async (user: ReturnType<typeof userEvent.setup>, label: string | RegExp, text: string) => {
  const field = screen.getByLabelText(label);
  await user.click(field);
  await user.paste(text);
};

beforeEach(() => {
  resetAccountPage('/feedback');
  signIn(reader);
  acceptAgeGate();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('filing from the website', () => {
  it('offers Suggestion and Question only, with a link to the app for bugs', async () => {
    const user = userEvent.setup();
    serve(() => empty);
    render(<FeedbackPage />);

    await user.click(await screen.findByRole('button', { name: 'Suggest Something' }));

    const dialog = await screen.findByRole('dialog');
    const tabs = within(dialog).getAllByRole('tab').map((tab) => tab.textContent);
    expect(tabs).toEqual(['Suggestion', 'Question']);
    expect(within(dialog).getByRole('link', { name: 'open the app' })).toHaveAttribute('href', '/play/');
    expect(within(dialog).queryByText(/in your profile/)).not.toBeInTheDocument();
  });

  it('files a suggestion without diagnostics and lands on the new thread', async () => {
    const user = userEvent.setup();
    const fetchMock = serve((url, init) => {
      if (init?.method === 'POST') return { status: 201, body: { data: thread({ number: 57, title: 'Add a compass' }) } };
      if (url.pathname.endsWith('/feedback/57')) return { status: 200, body: { data: thread({ number: 57, title: 'Add a compass' }), comments: [] } };
      return empty;
    });
    render(<FeedbackPage />);

    await user.click(await screen.findByRole('button', { name: 'Suggest Something' }));
    await user.type(await screen.findByLabelText('Title'), 'Add a compass');
    await typeInto(user, 'What You Have in Mind', 'Point me home.');
    await user.click(screen.getByRole('button', { name: 'Send Suggestion' }));

    await waitFor(() => expect(window.location.pathname).toBe('/feedback/57'));
    const [[, init]] = filings(fetchMock);
    const sent = JSON.parse(String(init?.body));
    expect(sent).toMatchObject({ type: 'suggestion', title: 'Add a compass' });
    expect(sent).not.toHaveProperty('diagnostics');
    expect(await screen.findByRole('heading', { name: /Add a compass #57/ })).toBeInTheDocument();
  });

  it('lists similar questions while typing a title, and opens one at its own address', async () => {
    const user = userEvent.setup();
    const match = thread({ id: 'uuid-9', number: 9, type: 'question', title: 'How do saves work?' });
    const fetchMock = serve((url) => {
      if (url.pathname.endsWith('/feedback/9')) return { status: 200, body: { data: match, comments: [] } };
      if (url.searchParams.get('search')) return { status: 200, body: { data: [match], total: 1 } };
      return empty;
    });
    render(<FeedbackPage />);

    await user.click(await screen.findByRole('button', { name: 'Suggest Something' }));
    await user.click(await screen.findByRole('tab', { name: 'Question' }));
    await user.type(screen.getByLabelText('Title'), 'saves');

    await user.click(await screen.findByRole('button', { name: /How do saves work\?/ }));

    await waitFor(() => expect(window.location.pathname).toBe('/feedback/9'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(loadFeedbackDraft()).toMatchObject({ type: 'question', title: 'saves' });
    expect(fetchMock.mock.calls.some(([input]) => String(input).includes('type=question') && String(input).includes('search=saves'))).toBe(true);
  });

  it('shows the server message for a refused filing and keeps the form', async () => {
    const user = userEvent.setup();
    const fetchMock = serve((_url, init) => (init?.method === 'POST'
      ? { status: 429, body: { error: 'You are posting too fast. Try again in a minute.' } }
      : empty));
    render(<FeedbackPage />);

    await user.click(await screen.findByRole('button', { name: 'Suggest Something' }));
    await user.type(await screen.findByLabelText('Title'), 'Add a compass');
    await typeInto(user, 'What You Have in Mind', 'Point me home.');
    await user.click(screen.getByRole('button', { name: 'Send Suggestion' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('You are posting too fast. Try again in a minute.');
    expect(screen.getByLabelText('Title')).toHaveValue('Add a compass');
    expect(window.location.pathname).toBe('/feedback');
    expect(filings(fetchMock)).toHaveLength(1);
  });
});
