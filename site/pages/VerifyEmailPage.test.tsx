import { StrictMode } from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { VerifyEmailPage } from './VerifyEmailPage';
import { res, resetAccountPage, signIn } from '../test/support';

/** Whether any request went to an endpoint whose URL contains `fragment`. */
const asked = (fragment: string) =>
  vi.mocked(fetch).mock.calls.some(([url]) => String(url).includes(fragment));

/** The body of the request whose URL contains `fragment`. */
const bodyOf = (fragment: string) => {
  const call = vi.mocked(fetch).mock.calls.find(([url]) => String(url).includes(fragment));
  return JSON.parse(String((call?.[1] as RequestInit).body));
};

const CONFIRMED = res({ success: true, email: 'wren@example.com', emailVerified: true });

const SPENT = res({
  code: 'TOKEN_INVALID',
  error: 'That verification link has expired or has already been used',
}, false, 400);

beforeEach(() => resetAccountPage('/verify-email?token=t0ken'));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('a link that works', () => {
  it('confirms the address and names it', async () => {
    vi.mocked(fetch).mockResolvedValue(CONFIRMED);
    render(<VerifyEmailPage />);

    expect(await screen.findByText(/is confirmed/)).toHaveTextContent('wren@example.com');
    expect(bodyOf('/auth/verify-email')).toEqual({ token: 't0ken' });
  });

  it('sends the token with no session at all, because the mail is read where it is read', async () => {
    vi.mocked(fetch).mockResolvedValue(CONFIRMED);
    render(<VerifyEmailPage />);

    await screen.findByText(/is confirmed/);
    const [, init] = vi.mocked(fetch).mock.calls[0];
    expect((init as RequestInit).headers).not.toHaveProperty('Authorization');
  });

  it('spends the token once under StrictMode, which the entry mounts it in', async () => {
    // The token works once, so a second consume answers "already used" and turns the reader's good link
    // into a dead one before they ever saw it work. StrictMode runs every effect twice, and `site/main`
    // mounts this page inside one.
    vi.mocked(fetch).mockResolvedValue(CONFIRMED);
    render(<StrictMode><VerifyEmailPage /></StrictMode>);

    await screen.findByText(/is confirmed/);
    expect(vi.mocked(fetch).mock.calls
      .filter(([url]) => String(url).includes('/auth/verify-email'))).toHaveLength(1);
  });

  it('marks a session held on this device proven, so /account agrees', async () => {
    signIn({ username: 'wren_hallow', email: 'wren@example.com', emailVerified: false });
    vi.mocked(fetch).mockResolvedValue(CONFIRMED);
    render(<VerifyEmailPage />);

    await screen.findByText(/is confirmed/);
    await waitFor(() => expect(
      JSON.parse(localStorage.getItem('currentUser') ?? 'null'),
    ).toMatchObject({ emailVerified: true }));
  });
});

describe('a link that no longer works', () => {
  it('says so in the server sentence rather than a generic failure', async () => {
    vi.mocked(fetch).mockResolvedValue(SPENT);
    render(<VerifyEmailPage />);

    expect(await screen.findByRole('alert'))
      .toHaveTextContent('That verification link has expired or has already been used');
  });

  it('offers a fresh mail to a reader who is signed in here', async () => {
    signIn({ username: 'wren_hallow' });
    vi.mocked(fetch).mockResolvedValue(SPENT);
    render(<VerifyEmailPage />);

    fireEvent.click(await screen.findByRole('button', { name: 'Send a New Link' }));

    await waitFor(() => expect(asked('/auth/resend-verification')).toBe(true));
  });

  it('reports the fresh mail going out', async () => {
    signIn({ username: 'wren_hallow' });
    vi.mocked(fetch).mockImplementation(async (url) => String(url).includes('/auth/verify-email')
      ? SPENT
      : res({ success: true, emailVerified: false, mailSent: true }));
    render(<VerifyEmailPage />);

    fireEvent.click(await screen.findByRole('button', { name: 'Send a New Link' }));

    expect(await screen.findByRole('status')).toHaveTextContent('Verification email sent');
  });

  it('sends a signed-out reader to sign in first, because asking needs a session', async () => {
    // The mail is often read on a phone while the account is signed in on a desktop. There is nobody
    // to send a mail to from here, so the only honest offer is the sign-in that leads to the button.
    vi.mocked(fetch).mockResolvedValue(SPENT);
    render(<VerifyEmailPage />);

    const link = await screen.findByRole('link', { name: 'Sign in' });
    expect(link.getAttribute('href')).toBe('/login?next=%2Faccount');
    expect(screen.queryByRole('button', { name: 'Send a New Link' })).toBeNull();
  });

  it('treats a link carrying no code as one to replace, without asking the server', async () => {
    resetAccountPage('/verify-email');
    render(<VerifyEmailPage />);

    expect(await screen.findByRole('alert')).toHaveTextContent('missing its verification code');
    expect(asked('/auth/verify-email')).toBe(false);
  });
});

describe('a server that never answered', () => {
  it('is not called a dead link, and offers no mail for one', async () => {
    // A fresh mail fixes a spent link and does nothing for an outage. Told the same way, the reader
    // spends one of a small budget of mails on a problem it cannot touch.
    signIn({ username: 'wren_hallow' });
    vi.mocked(fetch).mockRejectedValue(new Error('Failed to fetch'));
    render(<VerifyEmailPage />);

    expect(await screen.findByText(/Open the link from your email again/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Send a New Link' })).toBeNull();
  });
});
