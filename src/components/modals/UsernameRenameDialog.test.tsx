import { render, screen, cleanup, waitFor, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { UsernameRenameGate } from '@/components/modals/UsernameRenameDialog';
import { PrivacyPolicyProvider } from '@/contexts/PrivacyPolicyContext';
import { AccountDeletionProvider } from '@/contexts/AccountDeletionContext';
import { AgeGateProvider } from '@/contexts/AgeGateContext';
import { AGE_GATE_VERSION, acceptAgeGate } from '@/lib/ageGate';
import { USERNAME_RULE_HELP } from '@/lib/usernameRule';
import { cancelSignIn, requestSignIn } from '@/lib/signInStore';
import AgeGateService from '@/services/AgeGateService';
import PolicyService from '@/services/PolicyService';
import AuthService from '@/services/AuthService';
import type { AuthUser, PolicyState } from '@/types';

vi.mock('react-toastify', () => ({
  toast: { error: vi.fn(), success: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

const TITLE = 'Choose a New Username';

const flagged = (suggestion: string | null = 'Ann_Lee'): AuthUser => ({
  id: 7, username: 'Ann Lee', usernameRename: { required: true, suggestion },
});
const renamed: AuthUser = { id: 7, username: 'ann-lee', usernameRename: null };

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const policies = (over: Partial<PolicyState> = {}): PolicyState => ({
  uploadGate: null, tagNotice: null, privacyPolicy: null, ...over,
});

/** The session as the app holds it after an earlier visit. */
const hold = (user: AuthUser, token = 'token-1') => {
  AuthService.token = token;
  AuthService.currentUser = user;
};

/** Routes the community server's replies; anything not named answers 404. */
let routes: Record<string, () => Response>;
const server = vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  const route = Object.keys(routes).find((path) => url === `${AuthService.API_URL}${path}`);
  return route ? routes[route]() : json(404, { error: 'not found' });
});

// As the app mounts it: inside the privacy prompt, which sits inside the age gate.
const mount = () => render(
  <AgeGateProvider>
    <AccountDeletionProvider>
      <PrivacyPolicyProvider><UsernameRenameGate /></PrivacyPolicyProvider>
    </AccountDeletionProvider>
  </AgeGateProvider>,
);

const field = () => screen.getByLabelText('New Username') as HTMLInputElement;

beforeEach(() => {
  localStorage.clear();
  acceptAgeGate();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(AgeGateService, 'read').mockResolvedValue({ accepted: true, requiredVersion: AGE_GATE_VERSION, acceptedAt: null });
  vi.spyOn(PolicyService, 'fetchPolicies').mockResolvedValue(policies());
  routes = { '/auth/me': () => json(200, { user: flagged() }) };
  // Stubbed before mounting: the gate wraps whatever `fetch` it finds.
  vi.stubGlobal('fetch', server);
  AuthService.token = null;
  AuthService.currentUser = null;
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  server.mockClear();
  cancelSignIn();
  AuthService.token = null;
  AuthService.currentUser = null;
});

describe('opening from the account', () => {
  it('opens at app start for a flagged account, prefilled with the suggestion', async () => {
    hold(flagged());
    mount();

    expect(await screen.findByText(TITLE)).toBeTruthy();
    expect(field().value).toBe('Ann_Lee');
    expect(screen.getByText('Ann Lee')).toBeTruthy();
  });

  it('starts empty when the server has no suggestion', async () => {
    hold(flagged(null));
    mount();

    await screen.findByText(TITLE);
    expect(field().value).toBe('');
  });

  it('stays closed for an account that owes no rename', async () => {
    hold(renamed);
    mount();

    await waitFor(() => expect(PolicyService.fetchPolicies).toHaveBeenCalled());
    expect(screen.queryByText(TITLE)).toBeNull();
  });

  it('opens at sign-in, after Later held it for the session before', async () => {
    hold(flagged());
    mount();
    await screen.findByText(TITLE);

    fireEvent.click(screen.getByRole('button', { name: 'Later' }));
    await waitFor(() => expect(screen.queryByText(TITLE)).toBeNull());

    // A profile read in the same session is not a new session.
    await act(async () => { await AuthService.fetchUserProfile(); });
    expect(screen.queryByText(TITLE)).toBeNull();

    routes['/auth/login'] = () => json(200, { token: 'token-2', user: flagged('Ann_L') });
    await act(async () => { await AuthService.login('Ann Lee', 'secret'); });

    expect(await screen.findByText(TITLE)).toBeTruthy();
    expect(field().value).toBe('Ann_L');
  });

  it('waits behind the Privacy Policy prompt', async () => {
    vi.mocked(PolicyService.fetchPolicies).mockResolvedValue(policies({
      privacyPolicy: { title: 'Privacy Policy', body: 'Policy text.', tags: [], accepted: false },
    }));
    hold(flagged());
    mount();

    expect(await screen.findByText('Policy text.')).toBeTruthy();
    expect(screen.queryByText(TITLE)).toBeNull();

    vi.spyOn(PolicyService, 'acceptPrivacyPolicy').mockResolvedValue(undefined);
    fireEvent.click(screen.getByRole('button', { name: 'Accept' }));

    expect(await screen.findByText(TITLE)).toBeTruthy();
  });

  it('waits while the sign-in dialog is up', async () => {
    hold(flagged());
    act(() => requestSignIn());
    mount();
    await waitFor(() => expect(PolicyService.fetchPolicies).toHaveBeenCalled());
    expect(screen.queryByText(TITLE)).toBeNull();

    act(() => cancelSignIn());

    expect(await screen.findByText(TITLE)).toBeTruthy();
  });

  it('takes the fresher suggestion when the boot profile read lands', async () => {
    hold(flagged('Ann_Lee'));
    routes['/auth/me'] = () => json(200, { user: flagged('Ann_Lee_2') });
    mount();
    await screen.findByText(TITLE);
    expect(field().value).toBe('Ann_Lee');

    await act(async () => { await AuthService.fetchUserProfile(); });

    expect(field().value).toBe('Ann_Lee_2');
  });
});

describe('opening from a refused write', () => {
  it('opens again after Later when the server refuses with the code', async () => {
    hold(flagged());
    routes['/worlds/w1/like'] = () => json(403, { code: 'USERNAME_RENAME_REQUIRED', error: 'Update Formamorph to choose a new username.' });
    mount();
    await screen.findByText(TITLE);
    fireEvent.click(screen.getByRole('button', { name: 'Later' }));
    await waitFor(() => expect(screen.queryByText(TITLE)).toBeNull());

    await act(async () => { await fetch(`${AuthService.API_URL}/worlds/w1/like`, { method: 'POST' }); });

    expect(await screen.findByText(TITLE)).toBeTruthy();
    expect(field().value).toBe('Ann_Lee');
  });

  it('opens for an account whose held payload predates the flag', async () => {
    hold({ id: 7, username: 'Ann Lee' });
    routes['/comments'] = () => json(403, { code: 'USERNAME_RENAME_REQUIRED' });
    mount();
    await waitFor(() => expect(PolicyService.fetchPolicies).toHaveBeenCalled());
    expect(screen.queryByText(TITLE)).toBeNull();

    await act(async () => { await fetch(`${AuthService.API_URL}/comments`, { method: 'POST' }); });

    expect(await screen.findByText(TITLE)).toBeTruthy();
    expect(field().value).toBe('Ann_Lee');
  });

  it('stays closed when the fresh account owes no rename', async () => {
    hold(flagged());
    routes['/auth/me'] = () => json(200, { user: renamed });
    routes['/comments'] = () => json(403, { code: 'USERNAME_RENAME_REQUIRED' });
    mount();
    await screen.findByText(TITLE);
    fireEvent.click(screen.getByRole('button', { name: 'Later' }));
    await waitFor(() => expect(screen.queryByText(TITLE)).toBeNull());

    await act(async () => { await fetch(`${AuthService.API_URL}/comments`, { method: 'POST' }); });
    await waitFor(() => expect(AuthService.getCurrentUser()).toEqual(renamed));

    expect(screen.queryByText(TITLE)).toBeNull();
  });
});

describe('saving', () => {
  const save = () => fireEvent.click(screen.getByRole('button', { name: 'Save Username' }));
  const renameCalls = () => server.mock.calls.filter(([input]) => String(input).endsWith('/auth/username'));

  it('shows the rule and sends nothing for a name that breaks it', async () => {
    hold(flagged());
    mount();
    await screen.findByText(TITLE);

    fireEvent.change(field(), { target: { value: 'ann.lee' } });
    save();

    expect((await screen.findByRole('alert')).textContent).toBe(USERNAME_RULE_HELP);
    expect(renameCalls()).toHaveLength(0);
  });

  it('shows a taken name as taken', async () => {
    hold(flagged());
    routes['/auth/username'] = () => json(409, { code: 'USERNAME_TAKEN', error: 'Username already exists' });
    mount();
    await screen.findByText(TITLE);

    save();

    expect((await screen.findByRole('alert')).textContent).toBe('That username is taken');
    expect(screen.getByText(TITLE)).toBeTruthy();
  });

  it('sends the trimmed name, stores the renamed account and closes', async () => {
    hold(flagged());
    routes['/auth/username'] = () => json(200, { success: true, user: renamed });
    mount();
    await screen.findByText(TITLE);

    fireEvent.change(field(), { target: { value: '  ann-lee ' } });
    save();

    await waitFor(() => expect(screen.queryByText(TITLE)).toBeNull());
    const [, init] = renameCalls()[0];
    expect(JSON.parse(String(init?.body))).toEqual({ username: 'ann-lee' });
    expect(AuthService.getCurrentUser()).toEqual(renamed);
    expect(JSON.parse(localStorage.getItem('currentUser') ?? 'null')).toEqual(renamed);
  });
});
