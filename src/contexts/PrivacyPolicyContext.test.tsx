import { render, screen, cleanup, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PrivacyPolicyProvider } from '@/contexts/PrivacyPolicyContext';
import { AgeGateProvider } from '@/contexts/AgeGateContext';
import { acceptAgeGate } from '@/lib/ageGate';
import PolicyService from '@/services/PolicyService';
import AuthService from '@/services/AuthService';
import type { PolicyState } from '@/types';

vi.mock('react-toastify', () => ({ toast: { error: vi.fn(), success: vi.fn(), warn: vi.fn() } }));

const POLICY = { title: 'Privacy Policy', body: 'We keep a hash of your address for 90 days.', tags: [] };

const state = (over: Partial<PolicyState> = {}): PolicyState => ({
  uploadGate: null,
  tagNotice: null,
  privacyPolicy: null,
  ...over,
});

/** A signed-in session, which is what makes the provider read anything at all. */
const signedIn = () => { AuthService.token = 'token-abc'; };

// Under the age gate, as the app mounts it. Nothing is read from the community server until the
// player has attested, so every case here answers that first.
const mount = () => render(
  <AgeGateProvider><PrivacyPolicyProvider><div>app</div></PrivacyPolicyProvider></AgeGateProvider>,
);

beforeEach(() => {
  localStorage.clear();
  acceptAgeGate();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(AuthService, 'logout').mockImplementation(() => { AuthService.token = null; });
  AuthService.token = null;
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  AuthService.token = null;
});

describe('the privacy prompt at boot', () => {
  it('asks an account that has not accepted', async () => {
    signedIn();
    vi.spyOn(PolicyService, 'fetchPolicies').mockResolvedValue(
      state({ privacyPolicy: { ...POLICY, accepted: false } }),
    );

    mount();

    expect(await screen.findByText(POLICY.title)).toBeTruthy();
    expect(screen.getByText(POLICY.body)).toBeTruthy();
  });

  it('says nothing to an account that has already accepted', async () => {
    signedIn();
    const read = vi.spyOn(PolicyService, 'fetchPolicies').mockResolvedValue(
      state({ privacyPolicy: { ...POLICY, accepted: true } }),
    );

    mount();

    await waitFor(() => expect(read).toHaveBeenCalled());
    expect(screen.queryByText(POLICY.title)).toBeNull();
  });

  it('says nothing while the policy is switched off server-side', async () => {
    signedIn();
    const read = vi.spyOn(PolicyService, 'fetchPolicies').mockResolvedValue(state());

    mount();

    await waitFor(() => expect(read).toHaveBeenCalled());
    expect(screen.queryByText(POLICY.title)).toBeNull();
  });

  it('reads nothing at all while signed out', async () => {
    const read = vi.spyOn(PolicyService, 'fetchPolicies').mockResolvedValue(state());

    mount();

    await screen.findByText('app');
    expect(read).not.toHaveBeenCalled();
  });

  it('stays closed when the read fails, leaving the server to refuse in plain words', async () => {
    signedIn();
    vi.spyOn(PolicyService, 'fetchPolicies').mockRejectedValue(new Error('offline'));

    mount();

    await waitFor(() => expect(console.error).toHaveBeenCalled());
    expect(screen.queryByText(POLICY.title)).toBeNull();
  });
});

describe('answering the prompt', () => {
  beforeEach(() => {
    signedIn();
    vi.spyOn(PolicyService, 'fetchPolicies').mockResolvedValue(
      state({ privacyPolicy: { ...POLICY, accepted: false } }),
    );
  });

  it('records the acceptance and closes', async () => {
    const accept = vi.spyOn(PolicyService, 'acceptPrivacyPolicy').mockResolvedValue();
    mount();

    (await screen.findByRole('button', { name: 'Accept' })).click();

    await waitFor(() => expect(screen.queryByText(POLICY.title)).toBeNull());
    expect(accept).toHaveBeenCalledTimes(1);
  });

  it('stays open when recording the acceptance fails', async () => {
    vi.spyOn(PolicyService, 'acceptPrivacyPolicy').mockRejectedValue(new Error('nope'));
    mount();

    (await screen.findByRole('button', { name: 'Accept' })).click();

    // Closing here would leave the account refused by the server with nothing on screen to answer.
    await waitFor(() => expect(PolicyService.acceptPrivacyPolicy).toHaveBeenCalled());
    expect(screen.getByText(POLICY.title)).toBeTruthy();
  });

  it('signs out without touching the account', async () => {
    const accept = vi.spyOn(PolicyService, 'acceptPrivacyPolicy').mockResolvedValue();
    const decline = vi.spyOn(PolicyService, 'declinePrivacyPolicy').mockResolvedValue();
    mount();

    (await screen.findByRole('button', { name: 'Sign Out' })).click();

    await waitFor(() => expect(AuthService.logout).toHaveBeenCalledTimes(1));
    expect(screen.queryByText(POLICY.title)).toBeNull();
    // The account is left exactly as it was, free to sign in and accept later.
    expect(accept).not.toHaveBeenCalled();
    expect(decline).not.toHaveBeenCalled();
  });

  it('offers no way out but its two buttons', async () => {
    mount();
    await screen.findByText(POLICY.title);

    const dialog = screen.getByRole('dialog');
    expect(dialog.querySelector('button[aria-label="Close"]')).toBeNull();
    expect(screen.getByRole('button', { name: 'Accept' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Sign Out' })).toBeTruthy();
  });
});

describe('a refused request', () => {
  it('raises the same prompt wherever it was made from', async () => {
    signedIn();
    // Accepted at boot, then refused later: the policy's version was bumped mid-session.
    vi.spyOn(PolicyService, 'fetchPolicies')
      .mockResolvedValueOnce(state({ privacyPolicy: { ...POLICY, accepted: true } }))
      .mockResolvedValue(state({ privacyPolicy: { ...POLICY, accepted: false } }));

    // Stubbed before mounting, because the provider wraps whatever `fetch` it finds — a stub installed
    // afterwards would replace the wrapper rather than be watched by it.
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      JSON.stringify({ success: false, code: 'PRIVACY_REQUIRED', error: 'Formamorph needs updating to continue.' }),
      { status: 403, headers: { 'Content-Type': 'application/json' } },
    )));

    mount();
    await waitFor(() => expect(PolicyService.fetchPolicies).toHaveBeenCalledTimes(1));
    expect(screen.queryByText(POLICY.title)).toBeNull();

    // Some unrelated action, refused by the server.
    await fetch(`${AuthService.API_URL}/worlds/w1/like`, { method: 'POST' });

    expect(await screen.findByText(POLICY.title)).toBeTruthy();
    vi.unstubAllGlobals();
  });

  it('ignores a refusal from anything that is not the community server', async () => {
    signedIn();
    const read = vi.spyOn(PolicyService, 'fetchPolicies').mockResolvedValue(
      state({ privacyPolicy: { ...POLICY, accepted: true } }),
    );
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      JSON.stringify({ success: false, code: 'PRIVACY_REQUIRED' }),
      { status: 403, headers: { 'Content-Type': 'application/json' } },
    )));

    mount();
    await waitFor(() => expect(read).toHaveBeenCalledTimes(1));

    await fetch('https://images.example.test/a.webp');

    expect(read).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(POLICY.title)).toBeNull();
    vi.unstubAllGlobals();
  });
});
