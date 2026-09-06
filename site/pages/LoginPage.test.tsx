import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LoginPage } from './LoginPage';
import { leaveTo } from '../leaveSite';
import { at, res, resetAccountPage } from '../test/support';
import { SiteLayout } from '../components/SiteLayout';
import { StrictMode } from 'react';

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

describe('LoginPage', () => {
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
