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

vi.mock('react-toastify', () => ({
  toast: { error: vi.fn(), success: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));
vi.mock('./MessagesTab', () => ({ MessagesTab: () => <div /> }));
vi.mock('./TermsTab', () => ({ TermsTab: () => <div /> }));
vi.mock('./NotificationsTab', () => ({ NotificationsTab: () => <div /> }));
vi.mock('@/services/UserService', () => ({ default: { fetchProfile: vi.fn(async () => null) } }));

const NOTHING: PolicyState = { uploadGate: null, tagNotice: null, privacyPolicy: null };

const modals = (open: boolean) => (
  <AgeGateProvider>
  <AccountDeletionProvider>
  <PrivacyPolicyProvider>
    <AuthModals
      showAuthDialog={open}
      setShowAuthDialog={() => {}}
      showProfileDialog={false}
      setShowProfileDialog={() => {}}
      currentUser={null}
      onAuthenticated={() => {}}
      onLogout={() => {}}
    />
  </PrivacyPolicyProvider>
  </AccountDeletionProvider>
  </AgeGateProvider>
);

const renderAuth = () => render(modals(true));

/** Switch to register mode and fill a credible account, optionally with an address. */
const submitRegistration = (email = '') => {
  fireEvent.click(screen.getByRole('button', { name: 'Create Account' }));
  fireEvent.change(screen.getByPlaceholderText('Enter your username'), { target: { value: 'newcomer' } });
  fireEvent.change(screen.getByPlaceholderText('Enter your password'), { target: { value: 'hunter2!' } });
  fireEvent.change(screen.getByPlaceholderText('Confirm your password'), { target: { value: 'hunter2!' } });
  if (email) fireEvent.change(screen.getByPlaceholderText('you@example.com'), { target: { value: email } });
  fireEvent.click(screen.getByRole('button', { name: 'Register' }));
};

beforeEach(() => {
  localStorage.clear();
  acceptAgeGate();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(PolicyService, 'fetchPolicies').mockResolvedValue(NOTHING);
  vi.spyOn(PolicyService, 'fetchPublicPrivacyPolicy').mockResolvedValue(null);
  AuthService.token = null;
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  AuthService.token = null;
});

describe('the optional address at signup', () => {
  it('is asked for only when creating an account', () => {
    renderAuth();

    // Sign-in never needs it, and a box on the login form invites somebody to sign in with it.
    expect(screen.queryByPlaceholderText('you@example.com')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Create Account' }));

    expect(screen.getByPlaceholderText('you@example.com')).toBeTruthy();
  });

  it('reaches the register call', async () => {
    const register = vi.spyOn(AuthService, 'register').mockResolvedValue(true);
    renderAuth();

    submitRegistration('newcomer@example.com');

    await waitFor(() => expect(register)
      .toHaveBeenCalledWith('newcomer', 'hunter2!', 'newcomer@example.com'));
  });

  it('registers with no address when the box is left empty', async () => {
    const register = vi.spyOn(AuthService, 'register').mockResolvedValue(true);
    renderAuth();

    submitRegistration();

    await waitFor(() => expect(register).toHaveBeenCalledWith('newcomer', 'hunter2!', ''));
  });

  it('refuses a malformed address before the policy step, not after it', async () => {
    // The policy is read and answered between this form and the register call. Left to AuthService, a
    // mistyped address would only be found after the reader had read and accepted a policy.
    const policy = vi.spyOn(PolicyService, 'fetchPublicPrivacyPolicy');
    const register = vi.spyOn(AuthService, 'register').mockResolvedValue(true);
    renderAuth();

    submitRegistration('not-an-address');

    expect(await screen.findByText('Invalid email format')).toBeTruthy();
    expect(policy).not.toHaveBeenCalled();
    expect(register).not.toHaveBeenCalled();
  });

  it('shows the taken-address refusal, which names a different fix than a taken name', async () => {
    vi.spyOn(AuthService, 'register')
      .mockRejectedValue(new Error('That email address is already registered'));
    renderAuth();

    submitRegistration('taken@example.com');

    expect(await screen.findByText('That email address is already registered')).toBeTruthy();
  });

  it('empties the box when the dialog is opened again', async () => {
    vi.spyOn(AuthService, 'register')
      .mockRejectedValue(new Error('That email address is already registered'));
    const { rerender } = renderAuth();

    submitRegistration('taken@example.com');
    await screen.findByText('That email address is already registered');

    // A closed and reopened dialog is a fresh attempt; an address left behind belongs to the last one.
    // The mode is not reset with the fields, so the box is still on screen when it reopens.
    rerender(modals(false));
    rerender(modals(true));

    expect((screen.getByPlaceholderText('you@example.com') as HTMLInputElement).value).toBe('');
  });
});

describe('password recovery from the app', () => {
  it('opens the site reset page through the external-link path', () => {
    renderAuth();

    const link = screen.getByRole('link', { name: 'Forgot password?' });
    expect(link).toHaveAttribute('href', 'https://formamorph.ai/reset-password');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });
});
