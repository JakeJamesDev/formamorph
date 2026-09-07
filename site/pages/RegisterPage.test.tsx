import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { StrictMode } from 'react';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RegisterPage } from './RegisterPage';
import { LoginPage } from './LoginPage';
import { ProfilePage } from './ProfilePage';
import { leaveTo } from '../leaveSite';
import { at, res, resetAccountPage, signIn } from '../test/support';
import { AGE_GATE_VERSION } from '@/lib/ageGate';
import AuthService from '@/services/AuthService';

vi.mock('../leaveSite', () => ({ leaveTo: vi.fn() }));

beforeEach(() => resetAccountPage('/register'));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.mocked(leaveTo).mockClear();
});

const fillIn = async (username: string, password: string, confirm = password, email = '') => {
  const user = userEvent.setup();
  if (username) await user.type(screen.getByLabelText('Username'), username);
  if (email) await user.type(screen.getByLabelText('Email (Optional)'), email);
  if (password) await user.type(screen.getByLabelText('Password'), password);
  if (confirm) await user.type(screen.getByLabelText('Confirm Password'), confirm);
  await user.click(screen.getByRole('button', { name: 'Create Account' }));
};

/** The registration body, apart from any policy request around it. */
const sentBody = () => {
  const call = vi.mocked(fetch).mock.calls.find(([url]) => String(url).endsWith('/auth/register'));
  return JSON.parse(String((call?.[1] as RequestInit | undefined)?.body));
};

describe('RegisterPage', () => {
  it('carries the warning answer through account creation after the Privacy Policy step', async () => {
    at('/u/alice');
    vi.mocked(fetch).mockImplementation((input) => Promise.resolve(
      String(input).includes('/by-username/')
        ? res({
          success: true,
          data: {
            id: 'u1',
            username: 'alice',
            avatarUrl: null,
            createdAt: '2026-01-02T00:00:00.000Z',
            role: 'normal',
            followers: 0,
            likes: 0,
            downloads: 0,
          },
        })
        : res({ success: true, data: [] }),
    ));
    render(<ProfilePage username="alice" />);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Accept' }));
    const loginHref = screen.getByRole('link', { name: 'Sign In' }).getAttribute('href');

    cleanup();
    at(loginHref!);
    render(<LoginPage />);
    const registerHref = screen.getByRole('link', { name: 'Create one' }).getAttribute('href');
    expect(registerHref).toMatch(/^\/register\?contentWarningFlow=/);

    cleanup();
    at(registerHref!);
    vi.mocked(fetch).mockReset();
    vi.mocked(fetch)
      .mockResolvedValueOnce(res({
        privacyPolicy: { title: 'Privacy Policy', body: 'What we store.' },
      }))
      .mockResolvedValueOnce(res({ token: 'tok', user: { id: 'u1', username: 'alice' } }))
      .mockResolvedValueOnce(res({ success: true, accepted: true }))
      .mockResolvedValueOnce(res({ accepted: false, requiredVersion: AGE_GATE_VERSION, acceptedAt: null }))
      .mockResolvedValueOnce(res({
        accepted: true,
        requiredVersion: AGE_GATE_VERSION,
        acceptedAt: '2026-09-06T12:00:00.000Z',
      }));
    render(<RegisterPage />);
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', loginHref);

    await fillIn('alice', 'hunter22');
    await userEvent.click(await screen.findByRole('button', { name: 'Accept and Create Account' }));

    await waitFor(() => expect(leaveTo).toHaveBeenCalledWith('/'));
    expect(vi.mocked(fetch).mock.calls.map(([url]) => String(url))).toEqual([
      expect.stringMatching(/\/policies\/privacy-policy$/),
      expect.stringMatching(/\/auth\/register$/),
      expect.stringMatching(/\/policies\/privacy-policy\/accept$/),
      expect.stringMatching(/\/policies\/age-gate$/),
      expect.stringMatching(/\/policies\/age-gate\/accept$/),
    ]);
  });

  it('cannot bind the pending answer to an account adopted while Privacy is being accepted', async () => {
    at('/u/alice');
    vi.mocked(fetch).mockImplementation((input) => Promise.resolve(
      String(input).includes('/by-username/')
        ? res({
          success: true,
          data: {
            id: 'u1', username: 'alice', avatarUrl: null,
            createdAt: '2026-01-02T00:00:00.000Z', role: 'normal',
            followers: 0, likes: 0, downloads: 0,
          },
        })
        : res({ success: true, data: [] }),
    ));
    render(<ProfilePage username="alice" />);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Accept' }));
    const loginHref = screen.getByRole('link', { name: 'Sign In' }).getAttribute('href');
    cleanup();
    at(loginHref!);
    render(<LoginPage />);
    const registerHref = screen.getByRole('link', { name: 'Create one' }).getAttribute('href');
    cleanup();
    at(registerHref!);

    let finishPrivacy: (response: Response) => void = () => {};
    vi.mocked(fetch).mockReset();
    vi.mocked(fetch)
      .mockResolvedValueOnce(res({ privacyPolicy: { title: 'Privacy Policy', body: 'What we store.' } }))
      .mockResolvedValueOnce(res({ token: 'created-token', user: { id: 'u1', username: 'alice' } }))
      .mockImplementationOnce(() => new Promise<Response>((resolve) => { finishPrivacy = resolve; }));
    render(<RegisterPage />);

    await fillIn('alice', 'hunter22');
    await userEvent.click(await screen.findByRole('button', { name: 'Accept and Create Account' }));
    await waitFor(() => expect(AuthService.token).toBe('created-token'));

    localStorage.setItem(AuthService.tokenKey, 'other-token');
    localStorage.setItem(AuthService.userKey, JSON.stringify({ id: 'u2', username: 'other' }));
    window.dispatchEvent(new StorageEvent('storage', {
      key: AuthService.tokenKey,
      newValue: 'other-token',
    }));
    await act(async () => finishPrivacy(res({ success: true, accepted: true })));

    expect(leaveTo).not.toHaveBeenCalled();
    expect(vi.mocked(fetch).mock.calls.some(([url]) => String(url).includes('/policies/age-gate')))
      .toBe(false);
  });

  it('retries only the warning persistence after the account has been created', async () => {
    at('/u/alice');
    vi.mocked(fetch).mockImplementation((input) => Promise.resolve(
      String(input).includes('/by-username/')
        ? res({
          success: true,
          data: {
            id: 'u1', username: 'alice', avatarUrl: null,
            createdAt: '2026-01-02T00:00:00.000Z', role: 'normal',
            followers: 0, likes: 0, downloads: 0,
          },
        })
        : res({ success: true, data: [] }),
    ));
    render(<ProfilePage username="alice" />);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Accept' }));
    const loginHref = screen.getByRole('link', { name: 'Sign In' }).getAttribute('href');
    cleanup();
    at(loginHref!);
    render(<LoginPage />);
    const registerHref = screen.getByRole('link', { name: 'Create one' }).getAttribute('href');
    cleanup();
    at(registerHref!);

    vi.mocked(fetch).mockReset();
    vi.mocked(fetch)
      .mockResolvedValueOnce(res({}, false, 404))
      .mockResolvedValueOnce(res({ token: 'tok', user: { id: 'u1', username: 'alice' } }))
      .mockResolvedValueOnce(res({ accepted: false, requiredVersion: AGE_GATE_VERSION, acceptedAt: null }))
      .mockResolvedValueOnce(res({ error: 'Could not save your answer' }, false, 503))
      .mockResolvedValueOnce(res({ accepted: false, requiredVersion: AGE_GATE_VERSION, acceptedAt: null }))
      .mockResolvedValueOnce(res({
        accepted: true,
        requiredVersion: AGE_GATE_VERSION,
        acceptedAt: '2026-09-06T12:00:00.000Z',
      }));
    render(<RegisterPage />);

    await fillIn('alice', 'hunter22');

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not save your answer');
    expect(screen.getByRole('heading', { name: 'Finish Account Setup' })).toBeInTheDocument();
    expect(leaveTo).not.toHaveBeenCalled();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Retry' }));

    await waitFor(() => expect(leaveTo).toHaveBeenCalledWith('/'));
    const urls = vi.mocked(fetch).mock.calls.map(([url]) => String(url));
    expect(urls.filter((url) => url.endsWith('/auth/register'))).toHaveLength(1);
    expect(urls.filter((url) => url.endsWith('/policies/age-gate'))).toHaveLength(2);
    expect(urls.filter((url) => url.endsWith('/policies/age-gate/accept'))).toHaveLength(2);
  });

  it('accepts the current privacy policy before the new account leaves the page', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(res({
        privacyPolicy: {
          title: 'Privacy Policy',
          body: 'We store your **account name**.',
        },
      }))
      .mockResolvedValueOnce(res({ token: 'tok', user: { username: 'alice' } }))
      .mockResolvedValueOnce(res({ success: true, accepted: true }));
    render(<RegisterPage />);

    await fillIn('alice', 'hunter22');

    expect(await screen.findByRole('heading', { name: 'Privacy Policy' })).toBeInTheDocument();
    expect(screen.getByText('account name')).toHaveProperty('tagName', 'STRONG');
    expect(localStorage.getItem('authToken')).toBeNull();
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(leaveTo).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: 'Accept and Create Account' }));

    await waitFor(() => expect(leaveTo).toHaveBeenCalledWith('/'));
    expect(vi.mocked(fetch).mock.calls.map(([url]) => String(url))).toEqual([
      expect.stringMatching(/\/policies\/privacy-policy$/),
      expect.stringMatching(/\/auth\/register$/),
      expect.stringMatching(/\/policies\/privacy-policy\/accept$/),
    ]);
    expect(vi.mocked(fetch).mock.calls[2][1]).toMatchObject({
      method: 'POST',
      headers: { Authorization: 'Bearer tok' },
    });
  });

  it('keeps a created account on the policy when acceptance fails, then retries only the answer', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(res({
        privacyPolicy: { title: 'Privacy Policy', body: 'What we store.' },
      }))
      .mockResolvedValueOnce(res({ token: 'tok', user: { username: 'alice' } }))
      .mockResolvedValueOnce(res({ error: 'upstream unavailable' }, false, 503))
      .mockResolvedValueOnce(res({ success: true, accepted: true }));
    render(<RegisterPage />);

    await fillIn('alice', 'hunter22');
    await userEvent.click(await screen.findByRole('button', { name: 'Accept and Create Account' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Your account was created, but recording your acceptance failed. Try again.',
    );
    expect(localStorage.getItem('authToken')).toBe('tok');
    expect(screen.getByRole('heading', { name: 'Privacy Policy' })).toBeInTheDocument();
    expect(leaveTo).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: 'Accept' }));

    await waitFor(() => expect(leaveTo).toHaveBeenCalledWith('/'));
    const urls = vi.mocked(fetch).mock.calls.map(([url]) => String(url));
    expect(urls.filter((url) => url.endsWith('/auth/register'))).toHaveLength(1);
    expect(urls.filter((url) => url.endsWith('/policies/privacy-policy/accept'))).toHaveLength(2);
  });

  it('asks an existing signed-in account for an outdated policy answer', async () => {
    signIn({ username: 'alice' });
    vi.mocked(fetch)
      .mockResolvedValueOnce(res({
        privacyPolicy: {
          title: 'Updated Privacy Policy',
          body: 'The current terms.',
          tags: [],
          accepted: false,
        },
      }))
      .mockResolvedValueOnce(res({ success: true, accepted: true }));

    render(<RegisterPage />);

    expect(await screen.findByRole('heading', { name: 'Updated Privacy Policy' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Username')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Accept' }));

    await waitFor(() => expect(leaveTo).toHaveBeenCalledWith('/'));
    expect(vi.mocked(fetch).mock.calls.map(([url]) => String(url))).toEqual([
      expect.stringMatching(/\/policies$/),
      expect.stringMatching(/\/policies\/privacy-policy\/accept$/),
    ]);
  });

  it('checks an existing account only once under the site entry StrictMode', async () => {
    signIn({ username: 'alice' });
    vi.mocked(fetch).mockResolvedValue(res({ privacyPolicy: null }));

    render(<StrictMode><RegisterPage /></StrictMode>);

    await waitFor(() => expect(leaveTo).toHaveBeenCalledWith('/'));
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('stores the session under the keys the game reads', async () => {
    vi.mocked(fetch).mockResolvedValue(res({ token: 'tok', user: { username: 'alice' } }));
    render(<RegisterPage />);

    await fillIn('alice', 'hunter22');

    await waitFor(() => expect(localStorage.getItem('authToken')).toBe('tok'));
    expect(JSON.parse(localStorage.getItem('currentUser') ?? 'null')).toEqual({ username: 'alice' });
    expect(leaveTo).toHaveBeenCalledWith('/');
  });

  it('shows the refusal inline when the name is taken', async () => {
    vi.mocked(fetch).mockResolvedValue(res({ message: 'Username already exists' }, false, 409));
    render(<RegisterPage />);

    await fillIn('alice', 'hunter22');

    expect(await screen.findByRole('alert')).toHaveTextContent('Username already exists');
    expect(localStorage.getItem('authToken')).toBeNull();
    expect(leaveTo).not.toHaveBeenCalled();
  });

  it('refuses a mismatched confirmation without asking the server', async () => {
    render(<RegisterPage />);

    await fillIn('alice', 'hunter22', 'hunter23');

    expect(await screen.findByRole('alert')).toHaveTextContent('Passwords do not match');
    expect(fetch).not.toHaveBeenCalled();
  });

  // Keep the site's pre-policy checks aligned with the AuthService request boundary.
  it('shows the username length rule before loading the policy', async () => {
    render(<RegisterPage />);

    await fillIn('ab', 'hunter22');

    expect(await screen.findByRole('alert'))
      .toHaveTextContent('Username must be between 3 and 20 characters');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('shows the password length rule before loading the policy', async () => {
    render(<RegisterPage />);

    await fillIn('alice', 'short');

    expect(await screen.findByRole('alert'))
      .toHaveTextContent('Password must be at least 6 characters long');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('returns to the page the reader came from', async () => {
    at('/register?next=%2Fu%2Falice');
    vi.mocked(fetch).mockResolvedValue(res({ token: 'tok', user: { username: 'alice' } }));
    render(<RegisterPage />);

    await fillIn('alice', 'hunter22');

    await waitFor(() => expect(leaveTo).toHaveBeenCalledWith('/u/alice'));
  });

  it('sends the address the reader typed', async () => {
    vi.mocked(fetch).mockResolvedValue(res({ token: 'tok', user: { username: 'alice' } }));
    render(<RegisterPage />);

    await fillIn('alice', 'hunter22', 'hunter22', 'alice@example.com');

    await waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(sentBody().email).toBe('alice@example.com');
  });

  it('creates the account with no address at all when the box is left empty', async () => {
    // Optional means the field is absent from the request, not present and empty: the server reads a
    // missing field as no address and an empty string through its validator.
    vi.mocked(fetch).mockResolvedValue(res({ token: 'tok', user: { username: 'alice' } }));
    render(<RegisterPage />);

    await fillIn('alice', 'hunter22');

    await waitFor(() => expect(fetch).toHaveBeenCalled());
    expect('email' in sentBody()).toBe(false);
    expect(leaveTo).toHaveBeenCalledWith('/');
  });

  it('refuses a malformed address without asking the server', async () => {
    render(<RegisterPage />);

    await fillIn('alice', 'hunter22', 'hunter22', 'not-an-address');

    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid email format');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('shows the taken-address refusal inline, so the reader knows which fix is theirs', async () => {
    vi.mocked(fetch).mockResolvedValue(res({
      code: 'EMAIL_TAKEN',
      error: 'That email address is already registered',
    }, false, 409));
    render(<RegisterPage />);

    await fillIn('alice', 'hunter22', 'hunter22', 'alice@example.com');

    expect(await screen.findByRole('alert'))
      .toHaveTextContent('That email address is already registered');
    expect(localStorage.getItem('authToken')).toBeNull();
    expect(leaveTo).not.toHaveBeenCalled();
  });

  it('ignores a return path pointing off this site', async () => {
    at('/register?next=%2F%2Fevil.test%2Fsteal');
    vi.mocked(fetch).mockResolvedValue(res({ token: 'tok', user: { username: 'alice' } }));
    render(<RegisterPage />);

    await fillIn('alice', 'hunter22');

    await waitFor(() => expect(leaveTo).toHaveBeenCalledWith('/'));
  });
});
