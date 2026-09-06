import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { StrictMode } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RegisterPage } from './RegisterPage';
import { leaveTo } from '../leaveSite';
import { at, res, resetAccountPage, signIn } from '../test/support';

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
