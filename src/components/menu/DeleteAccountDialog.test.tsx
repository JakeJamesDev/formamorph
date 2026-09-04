import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DeleteAccountDialog } from './DeleteAccountDialog';
import AuthService from '@/services/AuthService';

vi.mock('react-toastify', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));

/** Minimal fetch stub: only what AuthService reads back. */
const res = (body: unknown, ok = true, status = 200): Response =>
  ({ ok, status, json: async () => body } as unknown as Response);

const DUE = '2026-12-25T12:00:00.000Z';

const open = (over: Record<string, unknown> = {}) =>
  render(
    <DeleteAccountDialog open onClose={() => {}} suspended={false} {...over} />,
  );

/** The request body of the one call that should have gone out. */
const sentBody = () => {
  const [, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
  return JSON.parse(String(init.body));
};

/** Walk the flow as far as the password field, choosing whether the published work goes. */
const reachPassword = async (keepWork = false) => {
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

  const choice = await screen.findByRole('radio', {
    name: keepWork ? /Keep My Work/ : /Delete My Work/,
  });
  fireEvent.click(choice);
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

  return screen.findByLabelText('Password');
};

beforeEach(() => {
  AuthService.token = 'tok';
  vi.stubGlobal('fetch', vi.fn());
  vi.spyOn(AuthService, 'logout').mockImplementation(() => { AuthService.token = null; });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('what happens, before anything is sent', () => {
  it('names the window and how to call it off', () => {
    open();

    expect(screen.getByText(/erased seven days from now/i)).toBeTruthy();
    expect(screen.getByText(/signing in during those seven days cancels/i)).toBeTruthy();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('leaves by its own control without sending anything', () => {
    const onClose = vi.fn();
    open({ onClose });

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onClose).toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe('the content choice', () => {
  it('has no default, and holds the flow until it is answered', async () => {
    open();
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    const options = await screen.findAllByRole('radio');
    expect(options.every((option) => option.getAttribute('aria-checked') !== 'true')).toBe(true);
    // Which of their work survives is the one thing a user cannot be assumed into.
    expect(screen.getByRole('button', { name: 'Continue' }).hasAttribute('disabled')).toBe(true);
  });

  it('opens the password step once answered', async () => {
    open();

    expect(await reachPassword()).toBeTruthy();
  });
});

describe('the request', () => {
  it('carries the password and a chosen deletion of the work', async () => {
    vi.mocked(fetch).mockResolvedValue(res({ success: true, deletionScheduledFor: DUE }));
    open();

    const password = await reachPassword();
    fireEvent.change(password, { target: { value: 'hunter2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Delete My Account' }));

    await waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(sentBody()).toEqual({ password: 'hunter2', deleteContent: true });
  });

  it('carries a kept-work choice as its own answer, not as an absent one', async () => {
    vi.mocked(fetch).mockResolvedValue(res({ success: true, deletionScheduledFor: DUE }));
    open();

    const password = await reachPassword(true);
    fireEvent.change(password, { target: { value: 'hunter2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Delete My Account' }));

    await waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(sentBody()).toEqual({ password: 'hunter2', deleteContent: false });
  });

  it('stays on the password step with the server message when the password is wrong', async () => {
    vi.mocked(fetch).mockResolvedValue(res({ error: 'Password is incorrect' }, false, 401));
    open();

    const password = await reachPassword();
    fireEvent.change(password, { target: { value: 'nope' } });
    fireEvent.click(screen.getByRole('button', { name: 'Delete My Account' }));

    expect(await screen.findByText('Password is incorrect')).toBeTruthy();
    // Still able to try again, and still signed in.
    expect(screen.getByLabelText('Password')).toBeTruthy();
    expect(AuthService.logout).not.toHaveBeenCalled();
  });

  it('shows the erasure date and signs out on success', async () => {
    vi.mocked(fetch).mockResolvedValue(res({ success: true, deletionScheduledFor: DUE }));
    open();

    const password = await reachPassword();
    fireEvent.change(password, { target: { value: 'hunter2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Delete My Account' }));

    const done = await screen.findByText(/erased on/i);
    // The date the server named, in whatever the reader's locale makes of it.
    expect(done.textContent).toMatch(/2026/);
    expect(done.textContent).toMatch(/25/);
    expect(AuthService.logout).toHaveBeenCalled();
  });
});

describe('a suspended account', () => {
  it('is sent to Feedback and never asked for a password', () => {
    open({ suspended: true });

    expect(screen.getByText(/Feedback/)).toBeTruthy();
    expect(screen.queryByLabelText('Password')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Continue' })).toBeNull();
  });

  it('sends nothing at all', () => {
    open({ suspended: true, onOpenFeedback: vi.fn() });

    fireEvent.click(screen.getByRole('button', { name: 'Open Feedback' }));

    expect(fetch).not.toHaveBeenCalled();
  });

  it('takes the reader to Feedback and closes', () => {
    const onOpenFeedback = vi.fn();
    const onClose = vi.fn();
    open({ suspended: true, onOpenFeedback, onClose });

    fireEvent.click(screen.getByRole('button', { name: 'Open Feedback' }));

    expect(onOpenFeedback).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('offers no Feedback button when nothing below has lent an opener', () => {
    // The prompt can stand above the menu that owns Feedback, so the link is not always there to give.
    open({ suspended: true });

    expect(screen.queryByRole('button', { name: 'Open Feedback' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Close' })).toBeTruthy();
  });
});
