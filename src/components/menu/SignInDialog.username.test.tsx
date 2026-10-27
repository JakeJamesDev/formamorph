import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SignInDialog } from './SignInDialog';
import { PrivacyPolicyProvider } from '@/contexts/PrivacyPolicyContext';
import { AccountDeletionProvider } from '@/contexts/AccountDeletionContext';
import { AgeGateProvider } from '@/contexts/AgeGateContext';
import { acceptAgeGate } from '@/lib/ageGate';
import { USERNAME_RULE_HELP, USERNAME_TAKEN_MESSAGE } from '@/lib/usernameRule';
import PolicyService from '@/services/PolicyService';
import AuthService from '@/services/AuthService';
import type { PolicyState } from '@/types';

vi.mock('react-toastify', () => ({
  toast: { error: vi.fn(), success: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

const NOTHING: PolicyState = { uploadGate: null, tagNotice: null, privacyPolicy: null };

const renderAuth = () => render(
  <AgeGateProvider>
    <AccountDeletionProvider>
      <PrivacyPolicyProvider>
        <SignInDialog open onOpenChange={() => {}} onAuthenticated={() => {}} />
      </PrivacyPolicyProvider>
    </AccountDeletionProvider>
  </AgeGateProvider>,
);

const submitRegistration = (name: string) => {
  fireEvent.click(screen.getByRole('button', { name: 'Create Account' }));
  fireEvent.change(screen.getByPlaceholderText('Enter your username'), { target: { value: name } });
  fireEvent.change(screen.getByPlaceholderText('Enter your password'), { target: { value: 'hunter2!' } });
  fireEvent.change(screen.getByPlaceholderText('Confirm your password'), { target: { value: 'hunter2!' } });
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
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  AuthService.token = null;
});

describe('the username rule at signup', () => {
  it('shows the help line in register mode only', () => {
    renderAuth();
    expect(screen.queryByText(USERNAME_RULE_HELP)).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Create Account' }));

    expect(screen.getByText(USERNAME_RULE_HELP)).toBeTruthy();
  });

  it.each(['ann\tlee', 'ann.lee', 'ab'])('refuses %j with the help text before any request', async (name) => {
    const register = vi.spyOn(AuthService, 'register').mockResolvedValue(true);
    renderAuth();

    submitRegistration(name);

    // The help line is also on screen, so the error is the second match.
    await waitFor(() => expect(screen.getAllByText(USERNAME_RULE_HELP)).toHaveLength(2));
    expect(PolicyService.fetchPublicPrivacyPolicy).not.toHaveBeenCalled();
    expect(register).not.toHaveBeenCalled();
  });

  it('sends the trimmed name', async () => {
    const register = vi.spyOn(AuthService, 'register').mockResolvedValue(true);
    renderAuth();

    submitRegistration('  newcomer ');

    await waitFor(() => expect(register).toHaveBeenCalledWith('newcomer', 'hunter2!', ''));
  });

  it('shows the taken-name error when the server refuses with USERNAME_TAKEN', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ success: false, code: 'USERNAME_TAKEN', error: 'Username already exists' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    )));
    renderAuth();

    submitRegistration('Newcomer');

    expect(await screen.findByText(USERNAME_TAKEN_MESSAGE)).toBeTruthy();
    expect(screen.queryByText('Username already exists')).toBeNull();
  });
});
