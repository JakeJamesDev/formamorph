import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ResetPasswordPage } from './ResetPasswordPage';
import { at, res, resetAccountPage } from '../test/support';

beforeEach(() => resetAccountPage('/reset-password'));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const requestFor = async (account: string) => {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('Email or Username'), account);
  await user.click(screen.getByRole('button', { name: 'Send Reset Link' }));
  return screen.findByRole('status');
};

describe('requesting a password reset', () => {
  it('refuses an empty account without asking the server', async () => {
    render(<ResetPasswordPage />);

    await userEvent.setup().click(screen.getByRole('button', { name: 'Send Reset Link' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Email or username is required');
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each(['wren@example.com', 'wren_hallow'])(
    'gives the same confirmation for %s',
    async (account) => {
      vi.mocked(fetch).mockResolvedValue(res({ success: true }));
      render(<ResetPasswordPage />);

      const confirmation = await requestFor(account);

      expect(confirmation.textContent).toBe(
        'If that account has a verified email, a password reset link is on its way.',
      );
      expect(screen.queryByLabelText('Email or Username')).toBeNull();
      const [, init] = vi.mocked(fetch).mock.calls[0];
      expect(JSON.parse(String((init as RequestInit).body))).toEqual({ account });
    },
  );

  it('keeps a refused request distinct from an accepted generic response', async () => {
    vi.mocked(fetch).mockResolvedValue(
      res({ error: 'Too many reset requests. Try again later.' }, false, 429),
    );
    render(<ResetPasswordPage />);

    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Email or Username'), 'wren_hallow');
    await user.click(screen.getByRole('button', { name: 'Send Reset Link' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Too many reset requests');
    expect(screen.queryByText(/a password reset link is on its way/)).toBeNull();
    expect(screen.getByLabelText('Email or Username')).toBeInTheDocument();
  });
});

describe('using a password-reset link', () => {
  it('refuses an empty password without spending the token', async () => {
    at('/reset-password?token=t0ken');
    render(<ResetPasswordPage />);

    await userEvent.setup().click(screen.getByRole('button', { name: 'Reset Password' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('A new password is required');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('sets the new password, then points to sign in', async () => {
    at('/reset-password?token=t0ken');
    vi.mocked(fetch).mockResolvedValue(res({ success: true }));
    render(<ResetPasswordPage />);

    const user = userEvent.setup();
    await user.type(screen.getByLabelText('New Password'), 'new-secret');
    await user.click(screen.getByRole('button', { name: 'Reset Password' }));

    expect(await screen.findByRole('status')).toHaveTextContent('Your password has been reset.');
    const nextStep = screen.getByText(/with your new password/).closest('p');
    expect(nextStep).not.toBeNull();
    expect(within(nextStep!).getByRole('link', { name: 'Sign In' })).toHaveAttribute('href', '/login');
    const [, init] = vi.mocked(fetch).mock.calls[0];
    expect(JSON.parse(String((init as RequestInit).body)))
      .toEqual({ token: 't0ken', newPassword: 'new-secret' });
  });

  it('replaces an expired link with a path to request another', async () => {
    at('/reset-password?token=spent');
    vi.mocked(fetch).mockResolvedValue(res({
      code: 'TOKEN_INVALID',
      error: 'That password reset link has expired or has already been used',
    }, false, 400));
    render(<ResetPasswordPage />);

    const user = userEvent.setup();
    await user.type(screen.getByLabelText('New Password'), 'new-secret');
    await user.click(screen.getByRole('button', { name: 'Reset Password' }));

    expect(await screen.findByRole('alert'))
      .toHaveTextContent('That password reset link has expired or has already been used');
    expect(screen.getByRole('link', { name: 'Request a New Link' }))
      .toHaveAttribute('href', '/reset-password');
    expect(screen.queryByLabelText('New Password')).toBeNull();
  });

  it('keeps a transport failure retryable instead of calling the link expired', async () => {
    at('/reset-password?token=t0ken');
    vi.mocked(fetch).mockRejectedValue(new Error('Failed to fetch'));
    render(<ResetPasswordPage />);

    const user = userEvent.setup();
    await user.type(screen.getByLabelText('New Password'), 'new-secret');
    await user.click(screen.getByRole('button', { name: 'Reset Password' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Failed to fetch');
    expect(screen.getByLabelText('New Password')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Request a New Link' })).toBeNull();
  });

  it('submits a single-use token only once under a rapid double click', async () => {
    at('/reset-password?token=t0ken');
    let answer: ((response: Response) => void) | undefined;
    vi.mocked(fetch).mockImplementation(() => new Promise((resolve) => { answer = resolve; }));
    render(<ResetPasswordPage />);

    const user = userEvent.setup();
    await user.type(screen.getByLabelText('New Password'), 'new-secret');
    await user.dblClick(screen.getByRole('button', { name: 'Reset Password' }));

    expect(fetch).toHaveBeenCalledTimes(1);
    answer?.(res({ success: true }));
    expect(await screen.findByRole('status')).toHaveTextContent('Your password has been reset.');
  });
});
