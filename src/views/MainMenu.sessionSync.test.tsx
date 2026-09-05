import { screen, fireEvent, waitFor, within, cleanup } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderMainMenu } from '@/test/mainMenu';
import AuthService from '@/services/AuthService';
import { AGE_GATE_VERSION } from '@/lib/ageGate';

/**
 * The main menu following a session another tab established.
 *
 * The site pages and the game are separate builds served from one origin, so signing in at
 * `formamorph.ai/login` reaches an open `/play/` only through `localStorage` and the `storage` event.
 * Every case here writes the keys and fires the event the way the browser does for the other tabs, then
 * asks the rendered menu what it shows — the footer circle is the identity a player actually sees.
 */

vi.mock('react-toastify', () => ({
  toast: { error: vi.fn(), success: vi.fn(), info: vi.fn(), warn: vi.fn() },
  ToastContainer: () => null,
}));

const answer = (body: unknown) => new Response(JSON.stringify(body), {
  status: 200,
  headers: { 'Content-Type': 'application/json' },
});

beforeEach(() => {
  localStorage.clear();
  AuthService.token = null;
  AuthService.currentUser = null;
  attest();

  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url.endsWith('/auth/me')) return answer({ username: 'bob' });
    return answer({ data: [] });
  }));
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** This device has already answered the gate, so nothing here waits on it unless a case says so. */
const attest = () => localStorage.setItem('FORMAMORPH_ageGate', JSON.stringify({
  accepted: true, acceptanceVersion: AGE_GATE_VERSION, acceptedAt: '2026-01-01T00:00:00.000Z',
}));

/** A sign-in in another tab: the keys AuthService writes, then the event the browser delivers here. */
const signInElsewhere = () => {
  localStorage.setItem('authToken', 'site-token');
  localStorage.setItem('currentUser', JSON.stringify({ username: 'bob' }));
  fireEvent(window, new StorageEvent('storage', { key: 'authToken', newValue: 'site-token' }));
};

/** A sign-out in another tab. Logout clears both keys, so the token removal is what arrives. */
const signOutElsewhere = () => {
  localStorage.removeItem('authToken');
  localStorage.removeItem('currentUser');
  fireEvent(window, new StorageEvent('storage', { key: 'authToken', newValue: null }));
};

describe('the main menu and a session from another tab', () => {
  it('shows the account when the site signs in, with no reload', async () => {
    renderMainMenu();
    await screen.findByRole('button', { name: 'Login' });

    signInElsewhere();

    await waitFor(() => expect(screen.getByRole('button', { name: /^User Profile/ })).toBeTruthy());
    // The same rendered menu, not a fresh one: nothing here re-rendered the tree from scratch.
    expect(screen.queryByRole('button', { name: 'Login' })).toBeNull();
  });

  it('drops the account when the other tab signs out', async () => {
    localStorage.setItem('authToken', 'site-token');
    localStorage.setItem('currentUser', JSON.stringify({ username: 'bob' }));
    AuthService.token = 'site-token';
    AuthService.currentUser = { username: 'bob' };

    renderMainMenu();
    await screen.findByRole('button', { name: /^User Profile/ });

    signOutElsewhere();

    await waitFor(() => expect(screen.getByRole('button', { name: 'Login' })).toBeTruthy());
  });

  it('asks the age gate before adopting a session on an unattested device', async () => {
    localStorage.removeItem('FORMAMORPH_ageGate');
    renderMainMenu();
    await screen.findByRole('button', { name: 'Login' });

    signInElsewhere();

    await screen.findByRole('dialog', { name: /Adult Content Ahead/ });
    // The token is held, but the menu has not taken the identity up behind the standing gate. Read
    // through the gate's own `aria-hidden`, which is what covers the menu while a modal dialog stands.
    expect(AuthService.isAuthenticated()).toBe(true);
    expect(screen.queryByRole('button', { name: /^User Profile/, hidden: true })).toBeNull();
    expect(screen.getByRole('button', { name: 'Login', hidden: true })).toBeTruthy();
  });

  it('adopts the session once the age gate is accepted', async () => {
    localStorage.removeItem('FORMAMORPH_ageGate');
    renderMainMenu();
    await screen.findByRole('button', { name: 'Login' });

    signInElsewhere();
    const gate = await screen.findByRole('dialog', { name: /Adult Content Ahead/ });
    fireEvent.click(within(gate).getByRole('button', { name: 'Accept' }));

    await waitFor(() => expect(screen.getByRole('button', { name: /^User Profile/ })).toBeTruthy());
  });

  it('signs the adopted session back out when the age gate is declined', async () => {
    localStorage.removeItem('FORMAMORPH_ageGate');
    renderMainMenu();
    await screen.findByRole('button', { name: 'Login' });

    signInElsewhere();
    const gate = await screen.findByRole('dialog', { name: /Adult Content Ahead/ });
    fireEvent.click(within(gate).getByRole('button', { name: 'Decline' }));

    await waitFor(() => expect(AuthService.isAuthenticated()).toBe(false));
    expect(localStorage.getItem('authToken')).toBeNull();
    expect(screen.getByRole('button', { name: 'Login' })).toBeTruthy();
  });
});

describe('a session arriving while the age gate already stands', () => {
  const openCommunity = () =>
    fireEvent.click(screen.getByRole('button', { name: /Community Creations/, hidden: true }));

  it('still opens what raised the gate, and takes the session up', async () => {
    localStorage.removeItem('FORMAMORPH_ageGate');
    renderMainMenu();
    await screen.findByRole('button', { name: 'Login' });
    openCommunity();
    const gate = await screen.findByRole('dialog', { name: /Adult Content Ahead/ });

    signInElsewhere();
    fireEvent.click(within(gate).getByRole('button', { name: 'Accept' }));

    // The browser is what the player asked for; the session is what arrived while they were asked.
    await screen.findByRole('dialog', { name: /Community Creations/ });
    await waitFor(() => expect(screen.getByRole('button', { name: /^User Profile/, hidden: true })).toBeTruthy());
  });

  it('signs the arrived session out when that gate is declined', async () => {
    localStorage.removeItem('FORMAMORPH_ageGate');
    renderMainMenu();
    await screen.findByRole('button', { name: 'Login' });
    openCommunity();
    const gate = await screen.findByRole('dialog', { name: /Adult Content Ahead/ });

    signInElsewhere();
    fireEvent.click(within(gate).getByRole('button', { name: 'Decline' }));

    await waitFor(() => expect(AuthService.isAuthenticated()).toBe(false));
    expect(screen.queryByRole('dialog', { name: /Community Creations/ })).toBeNull();
  });
});
