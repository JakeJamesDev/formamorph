import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LoginPage } from './LoginPage';
import { ProfilePage } from './ProfilePage';
import { leaveTo } from '../leaveSite';
import { at, res, resetAccountPage } from '../test/support';
import { SiteLayout } from '../components/SiteLayout';
import { StrictMode } from 'react';
import { AGE_GATE_VERSION } from '@/lib/ageGate';
import AuthService from '@/services/AuthService';

// jsdom implements no navigation, so where a finished sign-in sent the reader is only observable
// through this seam.
vi.mock('../leaveSite', () => ({ leaveTo: vi.fn() }));

beforeEach(() => resetAccountPage('/login'));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.mocked(leaveTo).mockClear();
});

const signIn = async (username = 'alice', password = 'hunter22') => {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('Username'), username);
  await user.type(screen.getByLabelText('Password'), password);
  await user.click(screen.getByRole('button', { name: 'Sign In' }));
};

const beginProfileSignIn = async () => {
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
  const signInHref = screen.getByRole('link', { name: 'Sign In' }).getAttribute('href');
  expect(signInHref).toMatch(/^\/login\?contentWarningFlow=/);

  cleanup();
  at(signInHref!);
  vi.mocked(fetch).mockReset();
};

describe('LoginPage', () => {
  it('records the warning accepted on the way into this sign-in before returning', async () => {
    await beginProfileSignIn();
    vi.mocked(fetch)
      .mockResolvedValueOnce(res({ token: 'tok', user: { id: 'u1', username: 'alice' } }))
      .mockResolvedValueOnce(res({
        accepted: false,
        requiredVersion: AGE_GATE_VERSION,
        acceptedAt: null,
      }))
      .mockResolvedValueOnce(res({
        accepted: true,
        requiredVersion: AGE_GATE_VERSION,
        acceptedAt: '2026-09-06T12:00:00.000Z',
      }));
    render(<LoginPage />);

    await signIn();

    await waitFor(() => expect(leaveTo).toHaveBeenCalledWith('/'));
    expect(vi.mocked(fetch).mock.calls.map(([url]) => String(url))).toEqual([
      expect.stringMatching(/\/auth\/login$/),
      expect.stringMatching(/\/policies\/age-gate$/),
      expect.stringMatching(/\/policies\/age-gate\/accept$/),
    ]);
    expect(vi.mocked(fetch).mock.calls[2]?.[1]).toMatchObject({
      method: 'POST',
      body: JSON.stringify({ acceptanceVersion: AGE_GATE_VERSION }),
    });

    cleanup();
    localStorage.removeItem('FORMAMORPH_ageGate');
    at('/u/alice');
    vi.mocked(fetch).mockReset();
    vi.mocked(fetch).mockImplementation((input) => {
      const url = String(input);
      if (url.endsWith('/policies/age-gate')) {
        return Promise.resolve(res({
          accepted: true,
          requiredVersion: AGE_GATE_VERSION,
          acceptedAt: '2026-09-06T12:00:00.000Z',
        }));
      }
      if (url.includes('/by-username/')) {
        return Promise.resolve(res({
          success: true,
          data: {
            id: 'u1', username: 'alice', avatarUrl: null,
            createdAt: '2026-01-02T00:00:00.000Z', role: 'normal',
            followers: 0, likes: 0, downloads: 0,
          },
        }));
      }
      return Promise.resolve(res({ success: true, data: [] }));
    });
    render(<ProfilePage username="alice" />);

    expect(await screen.findByRole('heading', { name: 'alice' })).toBeInTheDocument();
    expect(screen.queryByText('Adult Content Ahead')).not.toBeInTheDocument();
  });

  it('keeps the active answer through a failed sign-in retry', async () => {
    await beginProfileSignIn();
    vi.mocked(fetch)
      .mockResolvedValueOnce(res({ message: 'Invalid credentials' }, false, 401))
      .mockResolvedValueOnce(res({ token: 'tok', user: { id: 'u1', username: 'alice' } }))
      .mockResolvedValueOnce(res({ accepted: false, requiredVersion: AGE_GATE_VERSION, acceptedAt: null }))
      .mockResolvedValueOnce(res({ accepted: true, requiredVersion: AGE_GATE_VERSION, acceptedAt: '2026-09-06T12:00:00.000Z' }));
    render(<LoginPage />);

    await signIn();
    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid credentials');
    expect(leaveTo).not.toHaveBeenCalled();

    await userEvent.setup().click(screen.getByRole('button', { name: 'Sign In' }));

    await waitFor(() => expect(leaveTo).toHaveBeenCalledWith('/'));
    const urls = vi.mocked(fetch).mock.calls.map(([url]) => String(url));
    expect(urls.filter((url) => url.endsWith('/auth/login'))).toHaveLength(2);
    expect(urls.filter((url) => url.endsWith('/policies/age-gate/accept'))).toHaveLength(1);
  });

  it('retries a lost save response without signing in or accepting again', async () => {
    await beginProfileSignIn();
    let accountAccepted = false;
    vi.mocked(fetch).mockImplementation((input) => {
      const url = String(input);
      if (url.endsWith('/auth/login')) {
        return Promise.resolve(res({ token: 'tok', user: { id: 'u1', username: 'alice' } }));
      }
      if (url.endsWith('/policies/age-gate')) {
        return Promise.resolve(res({
          accepted: accountAccepted,
          requiredVersion: AGE_GATE_VERSION,
          acceptedAt: accountAccepted ? '2026-09-06T12:00:00.000Z' : null,
        }));
      }
      accountAccepted = true;
      return Promise.reject(new Error('The response was lost'));
    });
    render(<LoginPage />);

    await signIn();

    expect(await screen.findByRole('alert')).toHaveTextContent('The response was lost');
    expect(screen.getByRole('button', { name: 'Retry' })).toBeVisible();
    expect(leaveTo).not.toHaveBeenCalled();

    await userEvent.setup().click(screen.getByRole('button', { name: 'Retry' }));

    await waitFor(() => expect(leaveTo).toHaveBeenCalledWith('/'));
    const urls = vi.mocked(fetch).mock.calls.map(([url]) => String(url));
    expect(urls.filter((url) => url.endsWith('/auth/login'))).toHaveLength(1);
    expect(urls.filter((url) => url.endsWith('/policies/age-gate'))).toHaveLength(2);
    expect(urls.filter((url) => url.endsWith('/policies/age-gate/accept'))).toHaveLength(1);
  });

  it('does not write again when the resulting account already accepted this warning', async () => {
    await beginProfileSignIn();
    vi.mocked(fetch)
      .mockResolvedValueOnce(res({ token: 'tok', user: { id: 'u1', username: 'alice' } }))
      .mockResolvedValueOnce(res({
        accepted: true,
        requiredVersion: AGE_GATE_VERSION,
        acceptedAt: '2026-09-01T12:00:00.000Z',
      }));
    render(<LoginPage />);

    await signIn();

    await waitFor(() => expect(leaveTo).toHaveBeenCalledWith('/'));
    expect(vi.mocked(fetch).mock.calls.some(([url]) => String(url).endsWith('/policies/age-gate/accept')))
      .toBe(false);
  });

  it('does not stamp newer warning wording that appeared during sign-in', async () => {
    await beginProfileSignIn();
    vi.mocked(fetch)
      .mockResolvedValueOnce(res({ token: 'tok', user: { id: 'u1', username: 'alice' } }))
      .mockResolvedValueOnce(res({
        accepted: false,
        requiredVersion: AGE_GATE_VERSION + 1,
        acceptedAt: null,
      }));
    render(<LoginPage />);

    await signIn();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Update Formamorph to review the current adult-content warning.',
    );
    expect(leaveTo).not.toHaveBeenCalled();
    expect(vi.mocked(fetch).mock.calls.some(([url]) => String(url).endsWith('/policies/age-gate/accept')))
      .toBe(false);
  });

  it('does not attribute a historical guest answer to an unrelated direct sign-in', async () => {
    await beginProfileSignIn();
    at('/login');
    vi.mocked(fetch).mockResolvedValue(res({ token: 'tok', user: { id: 'u2', username: 'second' } }));
    render(<LoginPage />);

    await signIn('second');

    await waitFor(() => expect(leaveTo).toHaveBeenCalledWith('/'));
    expect(vi.mocked(fetch).mock.calls.map(([url]) => String(url))).toEqual([
      expect.stringMatching(/\/auth\/login$/),
    ]);
  });

  it('cannot reuse a carried answer after its authentication page is abandoned', async () => {
    await beginProfileSignIn();
    const abandonedPath = `${window.location.pathname}${window.location.search}`;
    render(<LoginPage />);
    window.dispatchEvent(new Event('pagehide'));
    cleanup();

    at(abandonedPath);
    vi.mocked(fetch).mockReset();
    vi.mocked(fetch).mockResolvedValue(res({ token: 'tok', user: { id: 'u2', username: 'second' } }));
    render(<LoginPage />);
    await signIn('second');

    await waitFor(() => expect(leaveTo).toHaveBeenCalledWith('/'));
    expect(vi.mocked(fetch).mock.calls.map(([url]) => String(url))).toEqual([
      expect.stringMatching(/\/auth\/login$/),
    ]);
  });

  it('cannot finish the first account flow after another tab replaces the session', async () => {
    await beginProfileSignIn();
    let resolveRead: (response: Response) => void = () => {};
    const delayedRead = new Promise<Response>((resolve) => { resolveRead = resolve; });
    vi.mocked(fetch)
      .mockResolvedValueOnce(res({ token: 'first-token', user: { id: 'u1', username: 'alice' } }))
      .mockReturnValueOnce(delayedRead);
    render(<LoginPage />);

    await signIn();
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    localStorage.setItem(AuthService.tokenKey, 'second-token');
    localStorage.setItem(AuthService.userKey, JSON.stringify({ id: 'u2', username: 'second' }));
    window.dispatchEvent(new StorageEvent('storage', {
      key: AuthService.tokenKey,
      newValue: 'second-token',
    }));
    resolveRead(res({ accepted: false, requiredVersion: AGE_GATE_VERSION, acceptedAt: null }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Your signed-in account changed');
    expect(leaveTo).not.toHaveBeenCalled();
    expect(vi.mocked(fetch).mock.calls.some(([url]) => String(url).endsWith('/policies/age-gate/accept')))
      .toBe(false);
  });

  it('stores the session under the keys the game reads', async () => {
    vi.mocked(fetch).mockResolvedValue(res({ token: 'tok', user: { username: 'alice' } }));
    render(<LoginPage />);

    await signIn();

    // The whole point of the shared session: /play/ reads these two keys on the same origin.
    await waitFor(() => expect(localStorage.getItem('authToken')).toBe('tok'));
    expect(JSON.parse(localStorage.getItem('currentUser') ?? 'null')).toEqual({ username: 'alice' });
  });

  it('shows the refusal inline and keeps the reader here', async () => {
    vi.mocked(fetch).mockResolvedValue(res({ message: 'Invalid credentials' }, false, 401));
    render(<LoginPage />);

    await signIn();

    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid credentials');
    expect(localStorage.getItem('authToken')).toBeNull();
    expect(leaveTo).not.toHaveBeenCalled();
  });

  it('refuses an empty form without asking the server', async () => {
    render(<LoginPage />);

    await userEvent.setup().click(screen.getByRole('button', { name: 'Sign In' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Username and password are required');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('returns to the page the reader came from', async () => {
    at('/login?next=%2Faccount');
    vi.mocked(fetch).mockResolvedValue(res({ token: 'tok', user: { username: 'alice' } }));
    render(<LoginPage />);

    await signIn();

    await waitFor(() => expect(leaveTo).toHaveBeenCalledWith('/account'));
  });

  it('carries a canceled-deletion notice through the safe return, then shows it once', async () => {
    at('/login?next=%2Faccount');
    vi.mocked(fetch).mockResolvedValue(res({
      token: 'tok',
      user: { username: 'alice' },
      deletionCancelled: true,
    }));
    const login = render(<LoginPage />);

    await signIn();
    await waitFor(() => expect(leaveTo).toHaveBeenCalledWith('/account'));

    login.unmount();
    render(<StrictMode><SiteLayout><p>Account destination</p></SiteLayout></StrictMode>);
    expect(screen.getByRole('status')).toHaveTextContent('Account deletion canceled');

    cleanup();
    render(<SiteLayout><p>Another page</p></SiteLayout>);
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('ignores a return path pointing off this site', async () => {
    at('/login?next=https%3A%2F%2Fevil.test%2Fsteal');
    vi.mocked(fetch).mockResolvedValue(res({ token: 'tok', user: { username: 'alice' } }));
    render(<LoginPage />);

    await signIn();

    await waitFor(() => expect(leaveTo).toHaveBeenCalledWith('/'));
  });

  it('carries the return path across to the register page', () => {
    at('/login?next=%2Faccount');
    render(<LoginPage />);

    expect(screen.getByRole('link', { name: 'Create one' }))
      .toHaveAttribute('href', '/register?next=%2Faccount');
  });

  it('offers password recovery', () => {
    render(<LoginPage />);

    expect(screen.getByRole('link', { name: 'Forgot password?' }))
      .toHaveAttribute('href', '/reset-password');
  });
});
