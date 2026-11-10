// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AuthService from '@/services/AuthService';
import { openExternal } from '@/lib/openExternal';
import { AccountSettingsTab } from './AccountSettingsTab';

vi.mock('@/lib/openExternal', () => ({ openExternal: vi.fn() }));
vi.mock('@/contexts/AccountDeletionContext', () => ({ useAccountDeletion: () => ({ startDeletion: vi.fn() }) }));
vi.mock('@/components/PatreonSection', () => ({ PatreonSection: () => null }));

const res = (body: unknown, ok = true, status = 200): Response =>
  ({ ok, status, json: async () => body, text: async () => JSON.stringify(body) } as unknown as Response);

const UNDELIVERABLE = { success: false, code: 'EMAIL_UNDELIVERABLE', error: 'Mail to this address bounced or was reported as spam' };
const user = (over: Record<string, unknown> = {}) =>
  ({ username: 'wren_hallow', email: 'wren@example.com', emailVerified: false, ...over });

/** Answers each endpoint the section calls; an unknown one fails the test. */
const routeFetch = (routes: Record<string, () => Response>) => {
  vi.mocked(fetch).mockImplementation(async (url) => {
    const fragment = Object.keys(routes).find((key) => String(url).includes(key));
    if (!fragment) throw new Error(`No stub for ${String(url)}`);
    return routes[fragment]();
  });
};

const show = (onOpenFeedback?: () => void) =>
  render(<AccountSettingsTab suspended={false} onChangePassword={() => {}} onOpenFeedback={onOpenFeedback} />);

beforeEach(() => {
  localStorage.clear();
  AuthService.logout();
  AuthService.token = 'tok';
  AuthService.currentUser = user();
  vi.stubGlobal('fetch', vi.fn());
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('the email section for an address mail no longer reaches', () => {
  it('shows the bounce notice in place of the resend', async () => {
    routeFetch({ '/auth/me': () => res({ success: true, user: user({ emailMarker: 'bounce' }) }) });
    show();

    expect(await screen.findByText(/Email to this address bounced, so/)).toBeTruthy();
    expect(screen.getByText(/Not verified\./)).toBeTruthy();
    expect(screen.queryByText(/Not verified yet/)).toBeNull();
    expect(screen.queryByRole('button', { name: 'Resend Verification Email' })).toBeNull();
  });

  it('shows the notice from the signed-in account when the account read fails', async () => {
    AuthService.currentUser = user({ emailMarker: 'complaint' });
    routeFetch({ '/auth/me': () => res({ error: 'Server error' }, false, 500) });
    show();

    expect(screen.getByText(/marked an email from Formamorph as spam/)).toBeTruthy();
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(screen.getByText(/marked an email from Formamorph as spam/)).toBeTruthy();
  });

  it('names a spam report as the cause for a complaint', async () => {
    routeFetch({ '/auth/me': () => res({ success: true, user: user({ emailMarker: 'complaint' }) }) });
    show();

    expect(await screen.findByText(/marked an email from Formamorph as spam/)).toBeTruthy();
    expect(screen.queryByText(/Email to this address bounced/)).toBeNull();
  });

  it('opens the Feedback window from the link, or the website when the host has none', async () => {
    routeFetch({ '/auth/me': () => res({ success: true, user: user({ emailMarker: 'bounce' }) }) });
    const open = vi.fn();
    const { unmount } = show(open);

    fireEvent.click(await screen.findByRole('button', { name: 'ask staff in Feedback' }));
    expect(open).toHaveBeenCalledOnce();
    unmount();

    show();
    fireEvent.click(await screen.findByRole('button', { name: 'ask staff in Feedback' }));
    expect(openExternal).toHaveBeenCalledWith('https://formamorph.ai/feedback?board=questions');
  });

  it('shows the notice, not the could-not-send note, when a resend is refused for the marker', async () => {
    let reads = 0;
    routeFetch({
      '/auth/me': () => res({ success: true, user: user(reads++ === 0 ? {} : { emailMarker: 'bounce' }) }),
      '/auth/resend-verification': () => res(UNDELIVERABLE, false, 409),
    });
    show();

    fireEvent.click(await screen.findByRole('button', { name: 'Resend Verification Email' }));

    expect(await screen.findByText(/Email to this address bounced, so/)).toBeTruthy();
    expect(screen.queryByText(/couldn.t be sent/)).toBeNull();
    expect(screen.queryByRole('button', { name: 'Resend Verification Email' })).toBeNull();
  });

  it('shows the notice when the marked address is saved again', async () => {
    routeFetch({
      '/auth/me': () => res({ success: true, user: user() }),
      '/auth/email': () => res({ ...UNDELIVERABLE, user: user({ emailMarker: 'complaint' }) }, false, 409),
    });
    show();
    await screen.findByText(/Not verified yet\./);

    fireEvent.click(screen.getByRole('button', { name: 'Save Email' }));

    expect(await screen.findByText(/marked an email from Formamorph as spam/)).toBeTruthy();
    expect(screen.queryByText(/couldn.t be sent/)).toBeNull();
  });

  it('removes the notice once a different address is saved', async () => {
    routeFetch({
      '/auth/me': () => res({ success: true, user: user({ emailMarker: 'bounce' }) }),
      '/auth/email': () => res({ success: true, user: user({ email: 'new@example.com', emailMarker: null }), mailSent: true }),
    });
    show();
    await screen.findByText(/Email to this address bounced, so/);

    fireEvent.change(screen.getByLabelText('Email Address'), { target: { value: 'new@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Email' }));

    expect(await screen.findByText(/Verification email sent to new@example\.com/)).toBeTruthy();
    expect(screen.queryByText(/Email to this address bounced/)).toBeNull();
    expect(screen.getByRole('button', { name: 'Resend Verification Email' })).toBeTruthy();
  });
});

describe('a bounce that arrives after the send', () => {
  const account = (over: Record<string, unknown> = {}) => res({ success: true, user: user(over) });

  /** The server as it is while `marked` is false, and after the bounce once it is true. */
  const server = (state: { marked: boolean }) => {
    vi.mocked(fetch).mockImplementation(async (url) => {
      const path = String(url);
      if (path.includes('/auth/resend-verification')) return res({ success: true, mailSent: true, emailVerified: false });
      if (path.includes('/auth/me')) return account(state.marked ? { emailMarker: 'bounce' } : {});
      throw new Error(`No stub for ${path}`);
    });
  };

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });
  afterEach(() => vi.useRealTimers());

  it('replaces the sent note with the notice a few seconds after a resend', async () => {
    const state = { marked: false };
    server(state);
    show();

    fireEvent.click(await screen.findByRole('button', { name: 'Resend Verification Email' }));
    expect(await screen.findByText(/Verification email sent\. Open the link/)).toBeTruthy();

    state.marked = true;
    await vi.advanceTimersByTimeAsync(5000);

    expect(await screen.findByText(/Email to this address bounced, so/)).toBeTruthy();
    expect(screen.queryByText(/Verification email sent/)).toBeNull();
    expect(screen.queryByRole('button', { name: 'Resend Verification Email' })).toBeNull();
  });

  it('shows the notice when the window comes back into view', async () => {
    const state = { marked: false };
    server(state);
    show();
    await screen.findByRole('button', { name: 'Resend Verification Email' });

    state.marked = true;
    fireEvent(window, new Event('focus'));

    expect(await screen.findByText(/Email to this address bounced, so/)).toBeTruthy();
  });

  it('reads nothing after the tab is gone', async () => {
    const state = { marked: false };
    server(state);
    const { unmount } = show();

    fireEvent.click(await screen.findByRole('button', { name: 'Resend Verification Email' }));
    await screen.findByText(/Verification email sent\. Open the link/);
    unmount();
    const reads = vi.mocked(fetch).mock.calls.length;

    await vi.advanceTimersByTimeAsync(10000);
    fireEvent(window, new Event('focus'));

    expect(vi.mocked(fetch).mock.calls.length).toBe(reads);
  });
});
