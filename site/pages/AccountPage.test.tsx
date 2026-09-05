import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AuthService from '@/services/AuthService';
import { AccountPage } from './AccountPage';
import { leaveTo } from '../leaveSite';
import { res, resetAccountPage, signIn } from '../test/support';

// jsdom implements no navigation, so where the page sent the reader is only observable here.
vi.mock('../leaveSite', () => ({ leaveTo: vi.fn() }));

// The crop step decodes a real image, which jsdom cannot do; its own geometry is tested where it lives.
vi.mock('@/components/menu/AvatarCropDialog', () => ({
  AvatarCropDialog: ({ open, onCropped }: { open: boolean; onCropped: (image: string) => void }) =>
    open ? <button onClick={() => onCropped('data:image/webp;base64,AAAA')}>Fake Crop</button> : null,
}));

/** Every request that went out, as `[url, method]`. */
const sent = () => vi.mocked(fetch).mock.calls.map(([url, init]) =>
  [String(url), (init as RequestInit | undefined)?.method ?? 'GET']);

/** Whether any request went to an endpoint whose URL contains `fragment`. */
const asked = (fragment: string) =>
  vi.mocked(fetch).mock.calls.some(([url]) => String(url).includes(fragment));

/**
 * Answer each endpoint on its own.
 *
 * One blanket `mockResolvedValue` hands every section the same body, and the page now reads the account
 * on arrival — so a password test's reply would arrive at `/auth/me` and be adopted as the account.
 */
const routeFetch = (routes: Record<string, Response>) => {
  vi.mocked(fetch).mockImplementation(async (url) => {
    const fragment = Object.keys(routes).find((key) => String(url).includes(key));
    if (!fragment) throw new Error(`No stub for ${String(url)}`);
    return routes[fragment];
  });
};

/** The body of the request whose URL contains `fragment`. */
const bodyOf = (fragment: string) => {
  const call = vi.mocked(fetch).mock.calls.find(([url]) => String(url).includes(fragment));
  return JSON.parse(String((call?.[1] as RequestInit).body));
};

const type = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });

/** Change the password with both fields filled. */
const changePassword = () => {
  type('Current Password', 'old-one');
  type('New Password', 'new-one');
  fireEvent.click(screen.getByRole('button', { name: 'Update Password' }));
};

/** Walk the delete flow to its end, choosing to keep the published work. */
const deleteAccount = async () => {
  fireEvent.click(screen.getByRole('button', { name: 'Delete Account' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Continue' }));
  fireEvent.click(await screen.findByRole('radio', { name: /Keep My Work/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
  fireEvent.change(await screen.findByLabelText('Password'), { target: { value: 'old-one' } });
  fireEvent.click(screen.getByRole('button', { name: 'Delete My Account' }));
};

beforeEach(() => resetAccountPage('/account'));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.mocked(leaveTo).mockClear();
});

describe('who /account is for', () => {
  it('sends a signed-out reader to sign in, and back here afterwards', async () => {
    render(<AccountPage />);

    await waitFor(() => expect(leaveTo).toHaveBeenCalledWith('/login?next=%2Faccount'));
  });

  it('shows a signed-out reader none of the controls on the way past', () => {
    // Not merely disabled: a password box on screen for somebody with no session is an invitation to
    // type one into a page that cannot send it anywhere.
    render(<AccountPage />);

    expect(screen.queryByLabelText('Current Password')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Delete Account' })).toBeNull();
  });

  it('opens for a signed-in reader without sending them anywhere', () => {
    signIn({ username: 'wren_hallow' });
    render(<AccountPage />);

    expect(screen.getByLabelText('Current Password')).toBeTruthy();
    expect(leaveTo).not.toHaveBeenCalled();
  });
});

describe('changing the password', () => {
  beforeEach(() => signIn({ username: 'wren_hallow' }));

  it('sends both passwords to the endpoint the app uses', async () => {
    vi.mocked(fetch).mockResolvedValue(res({ token: 'fresh' }));
    render(<AccountPage />);

    changePassword();

    await waitFor(() => expect(sent()).toContainEqual([
      expect.stringContaining('/auth/change-password'), 'POST',
    ]));
    expect(bodyOf('/auth/change-password')).toEqual({
      currentPassword: 'old-one',
      newPassword: 'new-one',
    });
  });

  it('says it worked and empties the boxes, so the old one is not left on screen', async () => {
    vi.mocked(fetch).mockResolvedValue(res({ token: 'fresh' }));
    render(<AccountPage />);

    changePassword();

    expect(await screen.findByRole('status')).toHaveTextContent('Password changed successfully');
    expect((screen.getByLabelText('Current Password') as HTMLInputElement).value).toBe('');
    expect((screen.getByLabelText('New Password') as HTMLInputElement).value).toBe('');
  });

  it('shows a refusal verbatim, because the two that happen are both actionable', async () => {
    vi.mocked(fetch).mockResolvedValue(res({ error: 'Current password is incorrect' }, false, 400));
    render(<AccountPage />);

    changePassword();

    expect(await screen.findByRole('alert')).toHaveTextContent('Current password is incorrect');
  });

  it('sends nothing when a box is empty, rather than asking the server to say so', async () => {
    render(<AccountPage />);

    type('Current Password', 'old-one');
    fireEvent.click(screen.getByRole('button', { name: 'Update Password' }));

    expect(await screen.findByRole('alert'))
      .toHaveTextContent('Both current and new passwords are required');
    // Named rather than "no request at all": the page reads the account on arrival, and that request
    // is not this form submitting.
    expect(asked('/auth/change-password')).toBe(false);
  });
});

describe('a suspended account', () => {
  beforeEach(() => signIn({ username: 'wren_hallow', status: 'suspended' }));

  it('is told why the controls will not work, before it fills them in', () => {
    render(<AccountPage />);

    expect(screen.getByText('Account Suspended')).toBeTruthy();
    expect((screen.getByLabelText('Current Password') as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Update Password' }) as HTMLButtonElement).disabled)
      .toBe(true);
  });

  it('still reaches the delete flow, which is where it learns the team does that one', async () => {
    render(<AccountPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Delete Account' }));

    expect(await screen.findByText(/cannot be deleted from here/i)).toBeTruthy();
    expect(asked('/auth/delete-account')).toBe(false);
  });

  it('is sent to Feedback by name, not to a button this page does not have', async () => {
    // The game's copy points at an Open Feedback button beside it. There is no Feedback hub here, so
    // the same sentence would name a control that is not on screen.
    render(<AccountPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Delete Account' }));

    expect(await screen.findByText(/Feedback in the game/i)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Open Feedback' })).toBeNull();
  });

  it('says the password rule where the boxes are, as the game does', () => {
    render(<AccountPage />);

    expect(screen.getByText(/password can.t be changed while your account is suspended/i))
      .toBeTruthy();
  });
});

describe('the profile image', () => {
  beforeEach(() => signIn({ username: 'wren_hallow' }));

  it('writes the new URL into the record the landing page and the game read', async () => {
    // Routed rather than blanket: the page reads `/auth/me` on arrival, and adopting an avatar reply
    // as the account would put this test's answer where the account belongs.
    routeFetch({
      '/auth/me': res({ success: true, user: { username: 'wren_hallow' } }),
      '/avatar': res({ data: { avatarUrl: '/api/avatars/new.webp' } }),
    });
    render(<AccountPage />);

    fireEvent.change(screen.getByLabelText('Profile image file'), {
      target: { files: [new File(['x'], 'face.png', { type: 'image/png' })] },
    });
    fireEvent.click(await screen.findByText('Fake Crop'));

    // The shared key, not this page's state: the header and `/play/` both read the avatar from here.
    await waitFor(() => expect(
      JSON.parse(localStorage.getItem(AuthService.userKey) ?? 'null'),
    ).toMatchObject({ avatarUrl: '/api/avatars/new.webp' }));
  });

  it('clears the shared record when the picture is removed, not only when one is set', async () => {
    signIn({ username: 'wren_hallow', avatarUrl: '/api/avatars/old.webp' });
    routeFetch({
      '/auth/me': res({ success: true, user: { username: 'wren_hallow', avatarUrl: '/api/avatars/old.webp' } }),
      '/avatar': res({ success: true }),
    });
    render(<AccountPage />);

    fireEvent.click(screen.getByLabelText('Remove your profile image'));

    await waitFor(() => expect(
      JSON.parse(localStorage.getItem(AuthService.userKey) ?? 'null'),
    ).toMatchObject({ avatarUrl: null }));
    expect(await screen.findByRole('status')).toHaveTextContent('Profile image removed');
  });

  it('says a refusal in a line of its own, having no toasts to float one in', async () => {
    vi.mocked(fetch).mockResolvedValue(res({ error: 'Your account has been suspended' }, false, 403));
    render(<AccountPage />);

    fireEvent.change(screen.getByLabelText('Profile image file'), {
      target: { files: [new File(['x'], 'face.png', { type: 'image/png' })] },
    });
    fireEvent.click(await screen.findByText('Fake Crop'));

    expect(await screen.findByRole('alert')).toHaveTextContent('Your account has been suspended');
  });
});

describe('deleting the account', () => {
  beforeEach(() => signIn({ username: 'wren_hallow' }));

  it('asks the endpoint the app asks, with the password and the content choice', async () => {
    vi.mocked(fetch).mockResolvedValue(res({ deletionScheduledFor: '2026-12-25T12:00:00.000Z' }));
    render(<AccountPage />);

    await deleteAccount();

    await waitFor(() => expect(sent()).toContainEqual([
      expect.stringContaining('/auth/delete-account'), 'POST',
    ]));
    expect(bodyOf('/auth/delete-account')).toEqual({ password: 'old-one', deleteContent: false });
  });

  it('clears the shared keys, so the game signs out with the site', async () => {
    vi.mocked(fetch).mockResolvedValue(res({ deletionScheduledFor: '2026-12-25T12:00:00.000Z' }));
    render(<AccountPage />);

    await deleteAccount();

    await waitFor(() => expect(localStorage.getItem(AuthService.tokenKey)).toBeNull());
    expect(localStorage.getItem(AuthService.userKey)).toBeNull();
  });

  it('stays put while the confirmation is on screen, then leaves', async () => {
    vi.mocked(fetch).mockResolvedValue(res({ deletionScheduledFor: '2026-12-25T12:00:00.000Z' }));
    render(<AccountPage />);

    await deleteAccount();

    // The session has already ended, which is the same thing a sign-out elsewhere does. Leaving on it
    // would take away the one screen that says when the account goes.
    const done = await screen.findByRole('button', { name: 'Done' });
    expect(leaveTo).not.toHaveBeenCalled();

    fireEvent.click(done);
    // The whole call list, not just that '/' is among it: the session has ended by now, and a page that
    // also re-ran its signed-out redirect would send somebody who just asked to be erased to sign in —
    // which is the one thing that calls the deletion off.
    await waitFor(() => expect(vi.mocked(leaveTo).mock.calls).toEqual([['/']]));
  });
});

describe('the session ending somewhere else', () => {
  it('takes the reader off a page that is now not theirs', async () => {
    signIn({ username: 'wren_hallow' });
    render(<AccountPage />);

    // What a sign-out in another tab looks like from here: the keys go, and the singleton says so.
    AuthService.logout();

    await waitFor(() => expect(leaveTo).toHaveBeenCalledWith('/'));
  });
});

describe('the email address', () => {
  /** An account record as `/auth/me` answers with one. */
  const account = (over: Record<string, unknown> = {}) =>
    res({ success: true, user: { username: 'wren_hallow', email: null, emailVerified: false, ...over } });

  const saveEmail = (address: string) => {
    type('Email Address', address);
    fireEvent.click(screen.getByRole('button', { name: 'Save Email' }));
  };

  beforeEach(() => signIn({ username: 'wren_hallow' }));

  it('reads the account on arrival, so a session held since before emails existed is not wrong', async () => {
    // The cached record can predate the field entirely. Left to it, somebody with a verified address
    // would be told they have none, under a box inviting them to add one.
    routeFetch({ '/auth/me': account({ email: 'wren@example.com', emailVerified: true }) });
    render(<AccountPage />);

    expect(await screen.findByText(/wren@example\.com/)).toBeTruthy();
    expect(screen.getByText(/Verified\./)).toBeTruthy();
    expect((screen.getByLabelText('Email Address') as HTMLInputElement).value)
      .toBe('wren@example.com');
  });

  it('says an unverified address is unverified, and offers the resend', async () => {
    routeFetch({ '/auth/me': account({ email: 'wren@example.com', emailVerified: false }) });
    render(<AccountPage />);

    expect(await screen.findByText(/Not verified yet\./)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Resend Verification Email' })).toBeTruthy();
  });

  it('offers no resend where there is nothing to resend to', async () => {
    routeFetch({ '/auth/me': account() });
    render(<AccountPage />);

    expect(await screen.findByText(/No email address on file/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Resend Verification Email' })).toBeNull();
  });

  it('sends the address to the endpoint the app uses, and says the mail went', async () => {
    routeFetch({
      '/auth/me': account(),
      '/auth/email': res({
        success: true,
        user: { username: 'wren_hallow', email: 'wren@example.com', emailVerified: false },
        mailSent: true,
      }),
    });
    render(<AccountPage />);

    saveEmail('wren@example.com');

    expect(await screen.findByRole('status'))
      .toHaveTextContent('Verification email sent to wren@example.com');
    expect(bodyOf('/auth/email')).toEqual({ email: 'wren@example.com' });
    // The shared record, not this section's state: an open /play/ reads the address from there.
    await waitFor(() => expect(
      JSON.parse(localStorage.getItem(AuthService.userKey) ?? 'null'),
    ).toMatchObject({ email: 'wren@example.com', emailVerified: false }));
  });

  it('says the address was saved even when the mail could not go', async () => {
    // Delivery runs through somebody else's service. An outage there must not read as "nothing
    // happened", because the address is on file and a resend is all that is left to do.
    routeFetch({
      '/auth/me': account(),
      '/auth/email': res({
        success: true,
        user: { username: 'wren_hallow', email: 'wren@example.com', emailVerified: false },
        mailSent: false,
      }),
    });
    render(<AccountPage />);

    saveEmail('wren@example.com');

    expect(await screen.findByRole('alert')).toHaveTextContent(/Address saved/);
    expect(await screen.findByRole('button', { name: 'Resend Verification Email' })).toBeTruthy();
  });

  it('shows the taken-address refusal verbatim, which is the one thing to act on', async () => {
    routeFetch({
      '/auth/me': account(),
      '/auth/email': res({
        code: 'EMAIL_TAKEN',
        error: 'That email address is already registered',
      }, false, 409),
    });
    render(<AccountPage />);

    saveEmail('taken@example.com');

    expect(await screen.findByRole('alert'))
      .toHaveTextContent('That email address is already registered');
  });

  it('refuses a malformed address without asking the server', async () => {
    routeFetch({ '/auth/me': account() });
    render(<AccountPage />);

    saveEmail('not-an-address');

    expect(await screen.findByRole('alert')).toHaveTextContent('Enter a valid email address');
    expect(asked('/auth/email')).toBe(false);
  });

  it('resends, and stops offering the resend once the address turns out to be verified', async () => {
    routeFetch({
      '/auth/me': account({ email: 'wren@example.com', emailVerified: false }),
      '/auth/resend-verification': res({ success: true, emailVerified: true, mailSent: false }),
    });
    render(<AccountPage />);

    fireEvent.click(await screen.findByRole('button', { name: 'Resend Verification Email' }));

    expect(await screen.findByRole('status'))
      .toHaveTextContent('Your email address is already verified.');
    expect(screen.queryByRole('button', { name: 'Resend Verification Email' })).toBeNull();
  });

  it('shows the mail budget refusal, which is the whole point of the budget', async () => {
    routeFetch({
      '/auth/me': account({ email: 'wren@example.com', emailVerified: false }),
      '/auth/resend-verification': res({
        error: 'Too many verification mails asked for. Try again later.',
      }, false, 429),
    });
    render(<AccountPage />);

    fireEvent.click(await screen.findByRole('button', { name: 'Resend Verification Email' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/Too many verification mails/);
  });

  it('is inert for a suspended account, which the server refuses every write from', async () => {
    signIn({ username: 'wren_hallow', status: 'suspended' });
    routeFetch({ '/auth/me': account({ status: 'suspended' }) });
    render(<AccountPage />);

    expect((screen.getByLabelText('Email Address') as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Save Email' }) as HTMLButtonElement).disabled)
      .toBe(true);
    expect(screen.getByText(/email address can.t be changed while your account is suspended/i))
      .toBeTruthy();
  });
});
