import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RegisterPage } from './RegisterPage';
import { leaveTo } from '../leaveSite';
import { at, res, resetAccountPage } from '../test/support';

vi.mock('../leaveSite', () => ({ leaveTo: vi.fn() }));

beforeEach(() => resetAccountPage('/register'));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.mocked(leaveTo).mockClear();
});

const fillIn = async (username: string, password: string, confirm = password) => {
  const user = userEvent.setup();
  if (username) await user.type(screen.getByLabelText('Username'), username);
  if (password) await user.type(screen.getByLabelText('Password'), password);
  if (confirm) await user.type(screen.getByLabelText('Confirm Password'), confirm);
  await user.click(screen.getByRole('button', { name: 'Create Account' }));
};

describe('RegisterPage', () => {
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

  // The length rules live in AuthService, which refuses before the network call. The page only has to
  // show what it throws — so this is the guard that the two are really wired together.
  it('shows the length rule AuthService refuses on, without asking the server', async () => {
    render(<RegisterPage />);

    await fillIn('ab', 'hunter22');

    expect(await screen.findByRole('alert'))
      .toHaveTextContent('Username must be between 3 and 20 characters');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('shows the password rule AuthService refuses on, without asking the server', async () => {
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

  it('ignores a return path pointing off this site', async () => {
    at('/register?next=%2F%2Fevil.test%2Fsteal');
    vi.mocked(fetch).mockResolvedValue(res({ token: 'tok', user: { username: 'alice' } }));
    render(<RegisterPage />);

    await fillIn('alice', 'hunter22');

    await waitFor(() => expect(leaveTo).toHaveBeenCalledWith('/'));
  });
});
