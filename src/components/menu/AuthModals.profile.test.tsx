import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AuthModals } from './AuthModals';
import { PrivacyPolicyProvider } from '@/contexts/PrivacyPolicyContext';
import { AccountDeletionProvider } from '@/contexts/AccountDeletionContext';
import { AgeGateProvider } from '@/contexts/AgeGateContext';
import { acceptAgeGate } from '@/lib/ageGate';
import PolicyService from '@/services/PolicyService';
import AuthService from '@/services/AuthService';
import type { PolicyState } from '@/types';
import type { WorldRecord } from '@/components/WorldDetails';

vi.mock('react-toastify', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));

// The tab panels have their own coverage; stubbing them keeps this file about the dialog's own shell.
vi.mock('./MessagesTab', () => ({ MessagesTab: () => <div data-testid="messages" /> }));
vi.mock('./TermsTab', () => ({ TermsTab: () => <div data-testid="terms" /> }));
vi.mock('./NotificationsTab', () => ({ NotificationsTab: () => <div data-testid="notifications" /> }));
// The header's numbers come from the same public profile route everybody else's do.
vi.mock('@/services/UserService', () => ({
  default: { fetchProfile: vi.fn(async () => ({ id: 'u1', username: 'me', avatarUrl: null, createdAt: '2026-01-01T00:00:00.000Z', followers: 3, likes: 41, downloads: 108 })) },
}));

const WITH_GATE: PolicyState = {
  uploadGate: { title: 'Contributor Terms', body: 'Be excellent.', tags: [], accepted: false },
  tagNotice: null,
  privacyPolicy: null,
};

const NO_GATE: PolicyState = { uploadGate: null, tagNotice: null, privacyPolicy: null };

const user = (over: Record<string, unknown> = {}) => ({
  username: 'finder',
  status: 'normal',
  createdAt: '2026-07-01 00:00:00',
  ...over,
}) as unknown as WorldRecord;

// The real provider, because the dialog reads the privacy prompt from it. It asks the same
// `fetchPolicies` this file already stubs, and finds no policy in it.
const renderProfile = (over: Record<string, unknown> = {}) =>
  render(
    <AgeGateProvider>
    <AccountDeletionProvider>
    <PrivacyPolicyProvider>
    <AuthModals
      showProfileDialog
      setShowProfileDialog={() => {}}
      currentUser={user()}
      onLogout={() => {}}
      {...over}
    />
    </PrivacyPolicyProvider>
    </AccountDeletionProvider>
    </AgeGateProvider>
  );

beforeEach(() => {
  localStorage.clear();
  // The privacy prompt reads nothing until the age gate is answered, and the app never reaches this
  // dialog before it is.
  acceptAgeGate();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(PolicyService, 'fetchPolicies').mockResolvedValue(NO_GATE);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  AuthService.currentUser = null;
});

describe('the profile shell', () => {
  it('has no Manage tab', async () => {
    // Changing a password is an account action, not a place to browse to.
    renderProfile();
    await screen.findByRole('tab', { name: 'Messages' });

    expect(screen.queryByRole('tab', { name: 'Manage' })).toBeNull();
  });

  it('keeps only Log Out in the header', async () => {
    renderProfile();

    expect(await screen.findByRole('button', { name: /Log Out/ })).toBeTruthy();
    // The other account controls live in the Settings tab, which is not open.
    expect(screen.queryByRole('button', { name: /Change Password/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Delete Account/ })).toBeNull();
  });

  it('opens the deletion flow from the Settings tab, without sending anything', async () => {
    const sent = vi.spyOn(AuthService, 'requestAccountDeletion');
    renderProfile({ initialTab: 'settings' });

    fireEvent.click(await screen.findByRole('button', { name: /Delete Account/ }));

    // The first step, which is an explanation rather than a question.
    expect(await screen.findByText(/erased seven days from now/i)).toBeTruthy();
    expect(sent).not.toHaveBeenCalled();
  });

  it('sends a suspended account to Feedback rather than hiding the control', async () => {
    // Hiding it would leave a suspended account with no way to learn the path exists.
    const sent = vi.spyOn(AuthService, 'requestAccountDeletion');
    // The flow stands above this dialog and reads the session rather than the dialog's own prop, so
    // the suspension has to be on the session for it to see one.
    AuthService.currentUser = { username: 'finder', status: 'suspended' };
    renderProfile({ currentUser: user({ status: 'suspended' }), initialTab: 'settings' });

    fireEvent.click(await screen.findByRole('button', { name: /Delete Account/ }));

    expect(await screen.findByText(/cannot be deleted from here/i)).toBeTruthy();
    expect(screen.queryByLabelText('Password')).toBeNull();
    expect(sent).not.toHaveBeenCalled();
  });

  it('logs out from the header button', async () => {
    const onLogout = vi.fn();
    renderProfile({ onLogout });

    fireEvent.click(await screen.findByRole('button', { name: /Log Out/ }));

    expect(onLogout).toHaveBeenCalled();
  });
});

describe('the terms tab', () => {
  it('is absent until an admin has authored a gate', async () => {
    // Most installs have none; an empty tab would be worse than no tab.
    renderProfile();
    await screen.findByRole('tab', { name: 'Messages' });

    expect(screen.queryByRole('tab', { name: 'Terms' })).toBeNull();
  });

  it('appears once one exists', async () => {
    vi.spyOn(PolicyService, 'fetchPolicies').mockResolvedValue(WITH_GATE);

    renderProfile();

    expect(await screen.findByRole('tab', { name: 'Terms' })).toBeTruthy();
  });

  it('appears even for someone who has already accepted', async () => {
    // They are bound by it, so it stays readable rather than vanishing on acceptance.
    vi.spyOn(PolicyService, 'fetchPolicies').mockResolvedValue({
      ...WITH_GATE,
      uploadGate: { ...WITH_GATE.uploadGate!, accepted: true },
    });

    renderProfile();

    expect(await screen.findByRole('tab', { name: 'Terms' })).toBeTruthy();
  });

  it('honors a request to land on it', async () => {
    // The check is async, so falling back on "not fetched yet" knocked it to Messages before the
    // answer ever arrived — which made `initialTab: 'terms'` impossible to satisfy.
    vi.spyOn(PolicyService, 'fetchPolicies').mockResolvedValue(WITH_GATE);

    renderProfile({ initialTab: 'terms' });

    expect(await screen.findByTestId('terms')).toBeTruthy();
  });

  it('falls back to Messages when asked for a tab that is not there', async () => {
    // A dev route or a remembered tab would otherwise leave an empty panel.
    renderProfile({ initialTab: 'terms' });

    expect(await screen.findByTestId('messages')).toBeTruthy();
    expect(screen.queryByTestId('terms')).toBeNull();
  });

  it('leaves the rest of the dialog working when the check fails', async () => {
    vi.spyOn(PolicyService, 'fetchPolicies').mockRejectedValue(new Error('offline'));

    renderProfile();

    expect(await screen.findByRole('tab', { name: 'Messages' })).toBeTruthy();
    expect(screen.queryByRole('tab', { name: 'Terms' })).toBeNull();
  });

  it('lands on Messages even when the terms are unanswered', async () => {
    // The tab is there to be found, not pushed.
    vi.spyOn(PolicyService, 'fetchPolicies').mockResolvedValue(WITH_GATE);

    renderProfile();
    await screen.findByRole('tab', { name: 'Terms' });

    expect(screen.getByTestId('messages')).toBeTruthy();
  });
});

describe('landing on a tab while already open', () => {
  it('follows a second request rather than ignoring it', async () => {
    // The dev-router points at a tab by changing this prop. Applying it only on open meant a `goto` at
    // an already-open dialog silently left the reader wherever they were.
    const { rerender } = render(
      <AgeGateProvider>
    <AccountDeletionProvider>
    <PrivacyPolicyProvider>
      <AuthModals
        showProfileDialog
        setShowProfileDialog={() => {}}
        currentUser={user()}
        onLogout={() => {}}
        initialTab="messages"
      />
      </PrivacyPolicyProvider>
    </AccountDeletionProvider>
      </AgeGateProvider>
    );
    await screen.findByTestId('messages');

    rerender(
      <AgeGateProvider>
    <AccountDeletionProvider>
    <PrivacyPolicyProvider>
      <AuthModals
        showProfileDialog
        setShowProfileDialog={() => {}}
        currentUser={user()}
        onLogout={() => {}}
        initialTab="notifications"
      />
      </PrivacyPolicyProvider>
    </AccountDeletionProvider>
      </AgeGateProvider>
    );

    expect(await screen.findByTestId('notifications')).toBeTruthy();
  });
});

describe('the password popup', () => {
  const openPopup = async () => {
    // Radix selects a tab on mouse-down, not click.
    fireEvent.mouseDown(await screen.findByRole('tab', { name: 'Settings' }));
    fireEvent.click(await screen.findByRole('button', { name: /Change Password/ }));
    return screen.findByLabelText('Current Password');
  };

  it('opens from the Settings tab with the old flow', async () => {
    renderProfile();

    await openPopup();

    expect(screen.getByLabelText('New Password')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Update Password' })).toBeTruthy();
  });

  it('changes the password and closes only itself', async () => {
    const change = vi.spyOn(AuthService, 'changePassword').mockResolvedValue(undefined as never);
    const setShowProfileDialog = vi.fn();
    renderProfile({ setShowProfileDialog });

    await openPopup();
    fireEvent.change(screen.getByLabelText('Current Password'), { target: { value: 'old-one' } });
    fireEvent.change(screen.getByLabelText('New Password'), { target: { value: 'new-one' } });
    fireEvent.click(screen.getByRole('button', { name: 'Update Password' }));

    await waitFor(() => expect(change).toHaveBeenCalledWith('old-one', 'new-one'));
    // The profile stays open behind it — only the popup goes.
    expect(setShowProfileDialog).not.toHaveBeenCalledWith(false);
  });

  it('refuses a half-filled form', async () => {
    const change = vi.spyOn(AuthService, 'changePassword').mockResolvedValue(undefined as never);
    renderProfile();

    await openPopup();
    fireEvent.change(screen.getByLabelText('Current Password'), { target: { value: 'old-one' } });
    fireEvent.click(screen.getByRole('button', { name: 'Update Password' }));

    expect(await screen.findByText(/Both current and new passwords are required/)).toBeTruthy();
    expect(change).not.toHaveBeenCalled();
  });

  it('says why it is unavailable to a suspended account', async () => {
    // The server refuses the write; saying so beats letting them fill it in and be rejected.
    renderProfile({ currentUser: user({ status: 'suspended' }) });

    await openPopup();

    expect(screen.getByText(/Your password can’t be changed while your account is suspended/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Update Password' }).hasAttribute('disabled')).toBe(true);
  });
});

/**
 * One profile stat. The number and its word sit in one role-less span — the word `sr-only`, so a reader
 * who cannot see the icon still hears it — and the same string is what the span raises on hover.
 */
const stat = async (value: string, word: string) => {
  const el = (await screen.findByText(word)).closest('span[tabindex]');
  expect(el).toHaveTextContent(`${value}${word}`);
  return el;
};

describe('your own numbers on the account dialog', () => {
  it('reads the same row a stranger sees on your profile popup', async () => {
    // Two places showing one account must not become two answers to the same question.
    // Needs an id: the header reads the public profile route, which is keyed on one.
    renderProfile({ currentUser: user({ id: 'u1' }) });

    expect(await stat('3', 'followers')).toBeTruthy();
    expect(await stat('41', 'likes')).toBeTruthy();
    expect(await stat('108', 'downloads')).toBeTruthy();
  });
});

describe('Member since', () => {
  // The login reply carries id/username/status but NOT createdAt (only GET /auth/me does), and the
  // cached currentUser is built from that reply — so the date has to come off the profile fetch.
  const LOGIN_SHAPE = { id: 'u1', username: 'me', status: 'normal', createdAt: undefined };

  it('shows the join date from the profile, not today, for a login-cached user', async () => {
    renderProfile({ currentUser: LOGIN_SHAPE as unknown as WorldRecord });

    const expected = new Date('2026-01-01T00:00:00.000Z').toLocaleDateString();
    expect(await screen.findByText(`Member since ${expected}`)).toBeTruthy();
    // The bug: an unparseable date silently became today, which reads as a real join date.
    expect(screen.queryByText(`Member since ${new Date().toLocaleDateString()}`)).toBeNull();
  });

  it('says nothing at all rather than guessing when no date is reachable', async () => {
    const { default: UserService } = await import('@/services/UserService');
    vi.mocked(UserService.fetchProfile).mockRejectedValueOnce(new Error('offline'));

    renderProfile({ currentUser: LOGIN_SHAPE as unknown as WorldRecord });

    await screen.findByText('me');
    await waitFor(() => expect(screen.queryByText(/Member since/)).toBeNull());
  });
});

describe('the settings tab', () => {
  const openSettings = () => renderProfile({ initialTab: 'settings' });

  it('is a tab beside the others, and can be landed on', async () => {
    vi.spyOn(AuthService, 'fetchEmailState').mockResolvedValue(null);
    openSettings();

    expect(await screen.findByRole('tab', { name: 'Settings' })).toBeTruthy();
    expect(await screen.findByLabelText('Email Address')).toBeTruthy();
  });

  it('shows the address on file and its state', async () => {
    AuthService.currentUser = { username: 'finder', email: 'me@example.com', emailVerified: false };
    vi.spyOn(AuthService, 'fetchEmailState').mockResolvedValue(null);
    openSettings();

    expect(await screen.findByText('me@example.com')).toBeTruthy();
    expect(screen.getByText(/Not verified yet/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Resend Verification Email' })).toBeTruthy();
  });

  it('saves a new address and says the mail was sent', async () => {
    vi.spyOn(AuthService, 'fetchEmailState').mockResolvedValue({ email: null, emailVerified: false });
    const set = vi.spyOn(AuthService, 'setEmail').mockResolvedValue({ emailVerified: false, mailSent: true });
    openSettings();

    fireEvent.change(await screen.findByLabelText('Email Address'), { target: { value: 'new@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Email' }));

    await waitFor(() => expect(set).toHaveBeenCalledWith('new@example.com'));
    expect(await screen.findByText(/Verification email sent to new@example.com/)).toBeTruthy();
  });

  it('refuses an invalid address before calling the server', async () => {
    vi.spyOn(AuthService, 'fetchEmailState').mockResolvedValue(null);
    const set = vi.spyOn(AuthService, 'setEmail');
    openSettings();

    fireEvent.change(await screen.findByLabelText('Email Address'), { target: { value: 'nope' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Email' }));

    expect(await screen.findByText('Enter a valid email address')).toBeTruthy();
    expect(set).not.toHaveBeenCalled();
  });

  it('shows the server refusal', async () => {
    vi.spyOn(AuthService, 'fetchEmailState').mockResolvedValue(null);
    vi.spyOn(AuthService, 'setEmail').mockRejectedValue(new Error('Email already in use'));
    openSettings();

    fireEvent.change(await screen.findByLabelText('Email Address'), { target: { value: 'taken@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Email' }));

    expect(await screen.findByText('Email already in use')).toBeTruthy();
  });

  it('resends the verification mail', async () => {
    AuthService.currentUser = { username: 'finder', email: 'me@example.com', emailVerified: false };
    vi.spyOn(AuthService, 'fetchEmailState').mockResolvedValue(null);
    const resend = vi.spyOn(AuthService, 'resendVerification').mockResolvedValue({ emailVerified: false, mailSent: true });
    openSettings();

    fireEvent.click(await screen.findByRole('button', { name: 'Resend Verification Email' }));

    await waitFor(() => expect(resend).toHaveBeenCalled());
    expect(await screen.findByText('Verification email sent. Open the link in it to finish.')).toBeTruthy();
  });

  it('locks the email box for a suspended account', async () => {
    vi.spyOn(AuthService, 'fetchEmailState').mockResolvedValue(null);
    renderProfile({ currentUser: user({ status: 'suspended' }), initialTab: 'settings' });

    expect((await screen.findByLabelText('Email Address')).hasAttribute('disabled')).toBe(true);
    expect(screen.getByRole('button', { name: 'Save Email' }).hasAttribute('disabled')).toBe(true);
  });

  it('asks for an address when the box is empty', async () => {
    vi.spyOn(AuthService, 'fetchEmailState').mockResolvedValue(null);
    const set = vi.spyOn(AuthService, 'setEmail');
    openSettings();

    fireEvent.click(await screen.findByRole('button', { name: 'Save Email' }));

    expect(await screen.findByText('Enter an email address')).toBeTruthy();
    expect(set).not.toHaveBeenCalled();
  });

  it('says so when the saved address is already verified', async () => {
    vi.spyOn(AuthService, 'fetchEmailState').mockResolvedValue(null);
    vi.spyOn(AuthService, 'setEmail').mockResolvedValue({ emailVerified: true, mailSent: false });
    openSettings();

    fireEvent.change(await screen.findByLabelText('Email Address'), { target: { value: 'same@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Email' }));

    expect(await screen.findByText('That address is already saved and verified.')).toBeTruthy();
  });

  it('names the Resend button when the mail could not be sent', async () => {
    vi.spyOn(AuthService, 'fetchEmailState').mockResolvedValue(null);
    vi.spyOn(AuthService, 'setEmail').mockResolvedValue({ emailVerified: false, mailSent: false });
    openSettings();

    fireEvent.change(await screen.findByLabelText('Email Address'), { target: { value: 'new@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Email' }));

    expect(await screen.findByText(/Try Resend Verification Email in a moment/)).toBeTruthy();
  });

  it('fills the address from the server read when the cached account has none', async () => {
    vi.spyOn(AuthService, 'fetchEmailState').mockResolvedValue({ email: 'server@example.com', emailVerified: true });
    openSettings();

    expect(await screen.findByText('server@example.com')).toBeTruthy();
    expect(screen.getByText(/Verified\./)).toBeTruthy();
  });
});
