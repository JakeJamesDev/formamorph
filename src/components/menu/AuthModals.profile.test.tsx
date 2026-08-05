import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AuthModals } from './AuthModals';
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
};

const NO_GATE: PolicyState = { uploadGate: null, tagNotice: null };

const user = (over: Record<string, unknown> = {}) => ({
  username: 'finder',
  status: 'normal',
  createdAt: '2026-07-01 00:00:00',
  ...over,
}) as unknown as WorldRecord;

const renderProfile = (over: Record<string, unknown> = {}) =>
  render(
    <AuthModals
      showAuthDialog={false}
      setShowAuthDialog={() => {}}
      showProfileDialog
      setShowProfileDialog={() => {}}
      currentUser={user()}
      onAuthenticated={() => {}}
      onLogout={() => {}}
      {...over}
    />
  );

beforeEach(() => {
  localStorage.clear();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(PolicyService, 'fetchPolicies').mockResolvedValue(NO_GATE);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('the profile shell', () => {
  it('has no Manage tab', async () => {
    // Changing a password is an account action, not a place to browse to.
    renderProfile();
    await screen.findByRole('tab', { name: 'Messages' });

    expect(screen.queryByRole('tab', { name: 'Manage' })).toBeNull();
  });

  it('puts both account actions in the header', async () => {
    renderProfile();

    expect(await screen.findByRole('button', { name: /Change Password/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Logout/ })).toBeTruthy();
  });

  it('logs out from the header button', async () => {
    const onLogout = vi.fn();
    renderProfile({ onLogout });

    fireEvent.click(await screen.findByRole('button', { name: /Logout/ }));

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
      <AuthModals
        showAuthDialog={false}
        setShowAuthDialog={() => {}}
        showProfileDialog
        setShowProfileDialog={() => {}}
        currentUser={user()}
        onAuthenticated={() => {}}
        onLogout={() => {}}
        initialTab="messages"
      />
    );
    await screen.findByTestId('messages');

    rerender(
      <AuthModals
        showAuthDialog={false}
        setShowAuthDialog={() => {}}
        showProfileDialog
        setShowProfileDialog={() => {}}
        currentUser={user()}
        onAuthenticated={() => {}}
        onLogout={() => {}}
        initialTab="notifications"
      />
    );

    expect(await screen.findByTestId('notifications')).toBeTruthy();
  });
});

describe('the password popup', () => {
  const openPopup = async () => {
    fireEvent.click(await screen.findByRole('button', { name: /Change Password/ }));
    return screen.findByLabelText('Current Password');
  };

  it('opens from the header with the old flow', async () => {
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

    expect(screen.getByText(/can’t be changed while your account is suspended/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Update Password' }).hasAttribute('disabled')).toBe(true);
  });
});

describe('your own numbers on the account dialog', () => {
  it('reads the same row a stranger sees on your profile popup', async () => {
    // Two places showing one account must not become two answers to the same question.
    // Needs an id: the header reads the public profile route, which is keyed on one.
    renderProfile({ currentUser: user({ id: 'u1' }) });

    expect(await screen.findByTitle('3 followers')).toBeTruthy();
    expect(screen.getByTitle('41 likes')).toBeTruthy();
    expect(screen.getByTitle('108 downloads')).toBeTruthy();
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
