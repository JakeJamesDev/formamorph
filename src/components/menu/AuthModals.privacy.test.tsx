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

import { toast } from 'react-toastify';

vi.mock('react-toastify', () => ({
  toast: { error: vi.fn(), success: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));
vi.mock('./MessagesTab', () => ({ MessagesTab: () => <div /> }));
vi.mock('./TermsTab', () => ({ TermsTab: () => <div /> }));
vi.mock('./NotificationsTab', () => ({ NotificationsTab: () => <div /> }));
vi.mock('@/services/UserService', () => ({ default: { fetchProfile: vi.fn(async () => null) } }));

const POLICY = { title: 'Privacy Policy', body: 'A salted hash of your address, kept 90 days.' };

const NOTHING: PolicyState = { uploadGate: null, tagNotice: null, privacyPolicy: null };

const renderAuth = (over: Record<string, unknown> = {}) =>
  render(
    <AgeGateProvider>
    <AccountDeletionProvider>
    <PrivacyPolicyProvider>
      <AuthModals
        showAuthDialog
        setShowAuthDialog={() => {}}
        showProfileDialog={false}
        setShowProfileDialog={() => {}}
        currentUser={null}
        onAuthenticated={() => {}}
        onLogout={() => {}}
        {...over}
      />
    </PrivacyPolicyProvider>
    </AccountDeletionProvider>
    </AgeGateProvider>,
  );

/** Fill the register form with a credible account and submit it. */
const submitRegistration = async () => {
  fireEvent.click(screen.getByRole('button', { name: 'Create Account' }));
  fireEvent.change(screen.getByPlaceholderText('Enter your username'), { target: { value: 'newcomer' } });
  fireEvent.change(screen.getByPlaceholderText('Enter your password'), { target: { value: 'hunter2!' } });
  fireEvent.change(screen.getByPlaceholderText('Confirm your password'), { target: { value: 'hunter2!' } });
  fireEvent.click(screen.getByRole('button', { name: 'Register' }));
};

beforeEach(() => {
  localStorage.clear();
  acceptAgeGate();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(PolicyService, 'fetchPolicies').mockResolvedValue(NOTHING);
  AuthService.token = null;
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  AuthService.token = null;
});

describe('the Privacy Policy at signup', () => {
  it('shows the policy before the account exists', async () => {
    vi.spyOn(PolicyService, 'fetchPublicPrivacyPolicy').mockResolvedValue(POLICY);
    const register = vi.spyOn(AuthService, 'register').mockResolvedValue(true);

    renderAuth();
    await submitRegistration();

    expect(await screen.findByText(POLICY.body)).toBeTruthy();
    // Nothing has been created yet: the reader has not answered.
    expect(register).not.toHaveBeenCalled();
  });

  it('creates no account and sends nothing when the reader declines', async () => {
    vi.spyOn(PolicyService, 'fetchPublicPrivacyPolicy').mockResolvedValue(POLICY);
    const register = vi.spyOn(AuthService, 'register').mockResolvedValue(true);
    const accept = vi.spyOn(PolicyService, 'acceptPrivacyPolicy').mockResolvedValue();
    const decline = vi.spyOn(PolicyService, 'declinePrivacyPolicy').mockResolvedValue();

    renderAuth();
    await submitRegistration();
    fireEvent.click(await screen.findByRole('button', { name: 'Decline' }));

    await waitFor(() => expect(screen.queryByText(POLICY.body)).toBeNull());
    expect(register).not.toHaveBeenCalled();
    expect(accept).not.toHaveBeenCalled();
    // There is no account to record a refusal against, so nothing is sent at all.
    expect(decline).not.toHaveBeenCalled();
  });

  it('registers and then records the acceptance, in that order', async () => {
    vi.spyOn(PolicyService, 'fetchPublicPrivacyPolicy').mockResolvedValue(POLICY);
    const order: string[] = [];
    vi.spyOn(AuthService, 'register').mockImplementation(async () => { order.push('register'); return true; });
    vi.spyOn(PolicyService, 'acceptPrivacyPolicy').mockImplementation(async () => { order.push('accept'); });

    renderAuth();
    await submitRegistration();
    fireEvent.click(await screen.findByRole('button', { name: 'Accept and Create Account' }));

    // The acceptance needs the token registration issues, so it cannot come first.
    await waitFor(() => expect(order).toEqual(['register', 'accept']));
  });

  it('retries the acceptance once when it fails', async () => {
    vi.spyOn(PolicyService, 'fetchPublicPrivacyPolicy').mockResolvedValue(POLICY);
    vi.spyOn(AuthService, 'register').mockResolvedValue(true);
    const accept = vi.spyOn(PolicyService, 'acceptPrivacyPolicy')
      .mockRejectedValueOnce(new Error('flaky'))
      .mockResolvedValue();

    renderAuth();
    await submitRegistration();
    fireEvent.click(await screen.findByRole('button', { name: 'Accept and Create Account' }));

    await waitFor(() => expect(accept).toHaveBeenCalledTimes(2));
  });

  it('keeps the account and asks again when the acceptance never lands', async () => {
    vi.spyOn(PolicyService, 'fetchPublicPrivacyPolicy').mockResolvedValue(POLICY);
    const register = vi.spyOn(AuthService, 'register')
      .mockImplementation(async () => { AuthService.token = 'token-abc'; return true; });
    vi.spyOn(PolicyService, 'acceptPrivacyPolicy').mockRejectedValue(new Error('down'));
    // The re-read that failure schedules: the server says this account still owes an answer.
    vi.spyOn(PolicyService, 'fetchPolicies').mockResolvedValue({
      ...NOTHING,
      privacyPolicy: { ...POLICY, tags: [], accepted: false },
    });

    renderAuth();
    await submitRegistration();
    fireEvent.click(await screen.findByRole('button', { name: 'Accept and Create Account' }));

    // The account is real, so the failure must not read as a failed signup. It becomes the prompt.
    await waitFor(() => expect(register).toHaveBeenCalledTimes(1));
    expect(await screen.findByRole('button', { name: 'Sign Out' })).toBeTruthy();
  });

  it('registers with no policy shown when the server has none switched on', async () => {
    vi.spyOn(PolicyService, 'fetchPublicPrivacyPolicy').mockResolvedValue(null);
    const register = vi.spyOn(AuthService, 'register').mockResolvedValue(true);
    const accept = vi.spyOn(PolicyService, 'acceptPrivacyPolicy').mockResolvedValue();
    const onAuthenticated = vi.fn();
    const setShowAuthDialog = vi.fn();

    renderAuth({ onAuthenticated, setShowAuthDialog });
    await submitRegistration();

    await waitFor(() => expect(register).toHaveBeenCalledTimes(1));
    expect(screen.queryByText(POLICY.body)).toBeNull();
    expect(accept).not.toHaveBeenCalled();

    // This is how the policy ships, so it is the path most people take. It has to report the new
    // session exactly as the answered path does, or the account exists behind a dialog that never
    // closed and a header that still offers Login.
    await waitFor(() => expect(onAuthenticated).toHaveBeenCalledTimes(1));
    expect(setShowAuthDialog).toHaveBeenCalledWith(false);
    expect(toast.success).toHaveBeenCalledWith('Registered successfully');
  });

  it('reports the new session the same way when the policy was accepted', async () => {
    vi.spyOn(PolicyService, 'fetchPublicPrivacyPolicy').mockResolvedValue(POLICY);
    vi.spyOn(AuthService, 'register').mockResolvedValue(true);
    vi.spyOn(PolicyService, 'acceptPrivacyPolicy').mockResolvedValue();
    const onAuthenticated = vi.fn();
    const setShowAuthDialog = vi.fn();

    renderAuth({ onAuthenticated, setShowAuthDialog });
    await submitRegistration();
    fireEvent.click(await screen.findByRole('button', { name: 'Accept and Create Account' }));

    // The pair of these two cases is the point: neither route may quietly skip a step the other takes.
    await waitFor(() => expect(onAuthenticated).toHaveBeenCalledTimes(1));
    expect(setShowAuthDialog).toHaveBeenCalledWith(false);
    expect(toast.success).toHaveBeenCalledWith('Registered successfully');
  });

  it('treats a policy switched off mid-signup as nothing outstanding', async () => {
    vi.spyOn(PolicyService, 'fetchPublicPrivacyPolicy').mockResolvedValue(POLICY);
    vi.spyOn(AuthService, 'register').mockResolvedValue(true);
    // What the server answers once the row is disabled: there is nothing to accept.
    const accept = vi.spyOn(PolicyService, 'acceptPrivacyPolicy').mockResolvedValue();

    renderAuth();
    await submitRegistration();
    fireEvent.click(await screen.findByRole('button', { name: 'Accept and Create Account' }));

    await waitFor(() => expect(accept).toHaveBeenCalledTimes(1));
    // No retry, and no warning that an answer never landed.
    expect(toast.warn).not.toHaveBeenCalled();
  });

  it('still creates the account when the policy cannot be read', async () => {
    vi.spyOn(PolicyService, 'fetchPublicPrivacyPolicy').mockRejectedValue(new Error('offline'));
    const register = vi.spyOn(AuthService, 'register').mockResolvedValue(true);

    renderAuth();
    await submitRegistration();

    // Refusing the signup would be worse: the server asks again at the first request either way.
    await waitFor(() => expect(register).toHaveBeenCalledTimes(1));
  });
});

describe('the Privacy Policy at sign-in', () => {
  it('prompts an existing account that has not accepted', async () => {
    // The real sign-in over a stubbed `fetch`, rather than a stubbed `login`: this case is about what
    // happens after a session is established, so the round trip that establishes one should be real.
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      JSON.stringify({ token: 'token-abc', user: { id: 'u1', username: 'regular' } }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )));
    vi.spyOn(PolicyService, 'fetchPolicies')
      .mockResolvedValue({ ...NOTHING, privacyPolicy: { ...POLICY, tags: [], accepted: false } });

    renderAuth();
    fireEvent.change(screen.getByPlaceholderText('Enter your username'), { target: { value: 'regular' } });
    fireEvent.change(screen.getByPlaceholderText('Enter your password'), { target: { value: 'hunter2!' } });
    fireEvent.click(screen.getByRole('button', { name: 'Login' }));

    expect(await screen.findByText(POLICY.body)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Sign Out' })).toBeTruthy();
    vi.unstubAllGlobals();
  });
});

describe('a deletion the sign-in called off', () => {
  /** Sign in for real over a stubbed server, with whatever the login reply should carry. */
  const signIn = async (reply: Record<string, unknown>) => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      JSON.stringify({ token: 'token-abc', user: { id: 'u1', username: 'regular' }, ...reply }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )));
    vi.spyOn(PolicyService, 'fetchPolicies').mockResolvedValue(NOTHING);

    renderAuth();
    fireEvent.change(screen.getByPlaceholderText('Enter your username'), { target: { value: 'regular' } });
    fireEvent.change(screen.getByPlaceholderText('Enter your password'), { target: { value: 'hunter2!' } });
    fireEvent.click(screen.getByRole('button', { name: 'Login' }));
  };

  it('says so, because the server cancelled it without being asked', async () => {
    await signIn({ deletionCancelled: true });

    expect(await screen.findByText('Your account deletion was cancelled.')).toBeTruthy();
    vi.unstubAllGlobals();
  });

  it('says nothing on an ordinary sign-in', async () => {
    await signIn({});

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Logged in successfully'));
    expect(screen.queryByText('Your account deletion was cancelled.')).toBeNull();
    vi.unstubAllGlobals();
  });
});
