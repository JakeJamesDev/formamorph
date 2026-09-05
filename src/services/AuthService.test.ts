import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import AuthService from './AuthService';

// Minimal fetch Response stub (only the bits AuthService reads).
const res = (body: unknown, ok = true, status = 200): Response =>
  ({ ok, status, json: async () => body } as unknown as Response);

beforeEach(() => {
  localStorage.clear();
  AuthService.logout(); // reset the singleton's token/currentUser
  vi.stubGlobal('fetch', vi.fn());
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('isValidEmail', () => {
  it('accepts well-formed addresses', () => {
    expect(AuthService.isValidEmail('a@b.co')).toBe(true);
  });
  it('rejects malformed addresses', () => {
    expect(AuthService.isValidEmail('not-an-email')).toBe(false);
    expect(AuthService.isValidEmail('a@b')).toBe(false);
    expect(AuthService.isValidEmail('a b@c.com')).toBe(false);
  });
});

describe('register validation (rejects before any network call)', () => {
  it('rejects a too-short username', async () => {
    await expect(AuthService.register('ab', 'password')).rejects.toThrow(/3 and 20/);
    expect(fetch).not.toHaveBeenCalled();
  });
  it('rejects a too-short password', async () => {
    await expect(AuthService.register('alice', '123')).rejects.toThrow(/6 characters/);
  });
  it('rejects an invalid email', async () => {
    await expect(AuthService.register('alice', 'password', 'bad')).rejects.toThrow(/email/i);
  });
});

describe('login', () => {
  it('stores token + user on success', async () => {
    vi.mocked(fetch).mockResolvedValue(res({ token: 'tok', user: { username: 'bob' } }));
    await AuthService.login('bob', 'pw');
    expect(AuthService.token).toBe('tok');
    expect(AuthService.getCurrentUser()).toEqual({ username: 'bob' });
    expect(localStorage.getItem('authToken')).toBe('tok');
  });

  it('throws the server-supplied message on failure', async () => {
    vi.mocked(fetch).mockResolvedValue(res({ message: 'Bad creds' }, false, 401));
    await expect(AuthService.login('bob', 'pw')).rejects.toThrow('Bad creds');
    expect(AuthService.token).toBeNull();
  });

  it('reports a deletion the sign-in cancelled', async () => {
    // The server clears a pending request when the account signs in, and says so in the reply. The
    // user may not remember asking, so the flag has to survive as far as the caller.
    vi.mocked(fetch).mockResolvedValue(
      res({ token: 'tok', user: { username: 'bob' }, deletionCancelled: true }),
    );

    expect(await AuthService.login('bob', 'pw')).toEqual({ deletionCancelled: true });
  });

  it('reports no cancellation on an ordinary sign-in', async () => {
    vi.mocked(fetch).mockResolvedValue(res({ token: 'tok', user: { username: 'bob' } }));

    expect(await AuthService.login('bob', 'pw')).toEqual({ deletionCancelled: false });
  });
});

describe('requestAccountDeletion', () => {
  it('sends the password and the content choice', async () => {
    AuthService.token = 'tok';
    vi.mocked(fetch).mockResolvedValue(res({ success: true, deletionScheduledFor: '2026-09-10T12:00:00.000Z' }));

    const due = await AuthService.requestAccountDeletion('hunter2', true);

    expect(due).toBe('2026-09-10T12:00:00.000Z');
    const [url, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    expect(url).toMatch(/\/auth\/delete-account$/);
    expect(JSON.parse(String(init.body))).toEqual({ password: 'hunter2', deleteContent: true });
  });

  it('carries a false content choice rather than omitting it', async () => {
    // The server refuses a body without the boolean, so "keep my work" cannot ride on an absent field.
    AuthService.token = 'tok';
    vi.mocked(fetch).mockResolvedValue(res({ success: true, deletionScheduledFor: '2026-09-10T12:00:00.000Z' }));

    await AuthService.requestAccountDeletion('hunter2', false);

    const [, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toEqual({ password: 'hunter2', deleteContent: false });
  });

  it('throws the server message when the password is wrong', async () => {
    AuthService.token = 'tok';
    vi.mocked(fetch).mockResolvedValue(res({ error: 'Password is incorrect' }, false, 401));

    await expect(AuthService.requestAccountDeletion('nope', true)).rejects.toThrow('Password is incorrect');
    // The session survives a wrong password: the flow keeps the user where they are to try again.
    expect(AuthService.token).toBe('tok');
  });

  it('throws the server message when the account is suspended', async () => {
    AuthService.token = 'tok';
    vi.mocked(fetch).mockResolvedValue(
      res({ error: 'A suspended account cannot be deleted from here.' }, false, 403),
    );

    await expect(AuthService.requestAccountDeletion('hunter2', true)).rejects.toThrow(/suspended/);
  });

  it('makes no request without a token', async () => {
    AuthService.token = null;
    await expect(AuthService.requestAccountDeletion('hunter2', true)).rejects.toThrow(/Not authenticated/);
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe('fetchUserProfile', () => {
  it('logs out and returns null on a 401', async () => {
    AuthService.token = 'tok';
    vi.mocked(fetch).mockResolvedValue(res({}, false, 401));
    expect(await AuthService.fetchUserProfile()).toBeNull();
    expect(AuthService.token).toBeNull();
  });

  it('makes no request and returns null when there is no token', async () => {
    AuthService.token = null;
    expect(await AuthService.fetchUserProfile()).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe('changePassword', () => {
  it('adopts the replacement token the server issues', async () => {
    // The server retires every token signed under the old password, this session's included. Keeping the
    // old one would 401 the very next request the user made.
    AuthService.token = 'old-tok';
    localStorage.setItem('authToken', 'old-tok');
    vi.mocked(fetch).mockResolvedValue(res({ success: true, token: 'new-tok' }));

    await AuthService.changePassword('old-pw', 'new-pw');

    expect(AuthService.token).toBe('new-tok');
    expect(localStorage.getItem('authToken')).toBe('new-tok');
  });

  it('keeps the held token when the server sends none', async () => {
    // A server predating the replacement token leaves the session valid, so there is nothing to swap.
    AuthService.token = 'old-tok';
    localStorage.setItem('authToken', 'old-tok');
    vi.mocked(fetch).mockResolvedValue(res({ success: true }));

    await AuthService.changePassword('old-pw', 'new-pw');

    expect(AuthService.token).toBe('old-tok');
  });

  it('keeps the held token when the body is not JSON at all', async () => {
    AuthService.token = 'old-tok';
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => { throw new Error('not json'); }
    } as unknown as Response);

    await expect(AuthService.changePassword('old-pw', 'new-pw')).resolves.toBe(true);
    expect(AuthService.token).toBe('old-tok');
  });

  it('leaves the token alone when the change is refused', async () => {
    AuthService.token = 'old-tok';
    vi.mocked(fetch).mockResolvedValue(res({ error: 'Current password is incorrect' }, false, 400));

    await expect(AuthService.changePassword('wrong', 'new-pw')).rejects.toThrow(/incorrect/);
    expect(AuthService.token).toBe('old-tok');
  });

  it('makes no request without a token', async () => {
    AuthService.token = null;
    await expect(AuthService.changePassword('a', 'b')).rejects.toThrow(/Not authenticated/);
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe('logout', () => {
  it('clears token, user, and storage', () => {
    AuthService.token = 'tok';
    localStorage.setItem('authToken', 'tok');
    localStorage.setItem('currentUser', JSON.stringify({ username: 'bob' }));
    AuthService.logout();
    expect(AuthService.token).toBeNull();
    expect(AuthService.getCurrentUser()).toBeNull();
    expect(localStorage.getItem('authToken')).toBeNull();
  });
});

describe('cross-tab session sync', () => {
  /** What the browser delivers to the *other* tabs after a write. jsdom fires none of its own. */
  const foreignWrite = (key: string | null, newValue: string | null) => {
    window.dispatchEvent(new StorageEvent('storage', { key, newValue }));
  };

  it('adopts a session another tab signed into', () => {
    const adopted = vi.fn();
    const unsubscribe = AuthService.onSessionAdopted(adopted);

    localStorage.setItem('authToken', 'tok');
    localStorage.setItem('currentUser', JSON.stringify({ username: 'bob' }));
    foreignWrite('authToken', 'tok');

    expect(AuthService.isAuthenticated()).toBe(true);
    expect(AuthService.getCurrentUser()).toEqual({ username: 'bob' });
    expect(adopted).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it('ends the session when another tab removes the token', () => {
    AuthService.token = 'tok';
    AuthService.currentUser = { username: 'bob' };
    const ended = vi.fn();
    const unsubscribe = AuthService.onSessionEnded(ended);

    localStorage.removeItem('authToken');
    localStorage.removeItem('currentUser');
    foreignWrite('authToken', null);

    expect(AuthService.isAuthenticated()).toBe(false);
    expect(AuthService.getCurrentUser()).toBeNull();
    expect(ended).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it('ends the session when another tab clears storage wholesale', () => {
    // `localStorage.clear()` arrives as one event with a null key rather than one event per key.
    AuthService.token = 'tok';
    AuthService.currentUser = { username: 'bob' };
    const ended = vi.fn();
    const unsubscribe = AuthService.onSessionEnded(ended);

    localStorage.clear();
    foreignWrite(null, null);

    expect(AuthService.isAuthenticated()).toBe(false);
    expect(ended).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it('signs in on a corrupt user blob rather than throwing', () => {
    // The token is what authenticates; an unreadable DTO costs the display name, not the session.
    const adopted = vi.fn();
    const unsubscribe = AuthService.onSessionAdopted(adopted);

    localStorage.setItem('authToken', 'tok');
    localStorage.setItem('currentUser', '{not json');
    foreignWrite('currentUser', '{not json');

    expect(AuthService.isAuthenticated()).toBe(true);
    expect(AuthService.getCurrentUser()).toBeNull();
    expect(adopted).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it('ignores a write to any other key', () => {
    const adopted = vi.fn();
    const ended = vi.fn();
    const unsubscribeAdopted = AuthService.onSessionAdopted(adopted);
    const unsubscribeEnded = AuthService.onSessionEnded(ended);

    localStorage.setItem('authToken', 'tok');
    foreignWrite('FORMAMORPH_introSeen', 'true');

    expect(AuthService.isAuthenticated()).toBe(false);
    expect(adopted).not.toHaveBeenCalled();
    expect(ended).not.toHaveBeenCalled();
    unsubscribeAdopted();
    unsubscribeEnded();
  });

  it('says nothing when the stored session is the one already held', () => {
    // The other tab wrote something else about the same session — an avatar swap re-writes the user
    // blob. Re-announcing an unchanged session would re-run every subscriber's profile fetch.
    AuthService.token = 'tok';
    AuthService.currentUser = { username: 'bob' };
    localStorage.setItem('authToken', 'tok');
    localStorage.setItem('currentUser', JSON.stringify({ username: 'bob' }));
    const adopted = vi.fn();
    const unsubscribe = AuthService.onSessionAdopted(adopted);

    foreignWrite('currentUser', JSON.stringify({ username: 'bob' }));

    expect(adopted).not.toHaveBeenCalled();
    unsubscribe();
  });

  it('keeps the other listeners when one throws', () => {
    const first = vi.fn(() => { throw new Error('boom'); });
    const second = vi.fn();
    const unsubscribeFirst = AuthService.onSessionAdopted(first);
    const unsubscribeSecond = AuthService.onSessionAdopted(second);

    localStorage.setItem('authToken', 'tok');
    foreignWrite('authToken', 'tok');

    expect(second).toHaveBeenCalledTimes(1);
    unsubscribeFirst();
    unsubscribeSecond();
  });
});

describe('a browser that refuses site data', () => {
  it('reads a foreign write as no session rather than throwing out of the handler', () => {
    // Private modes and blocked-site-data settings throw on the read itself. This runs inside a
    // `storage` listener, where a throw reaches nobody and takes the rest of the handler with it.
    AuthService.token = 'tok';
    AuthService.currentUser = { username: 'bob' };
    const ended = vi.fn();
    const unsubscribe = AuthService.onSessionEnded(ended);
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('denied'); });

    expect(() => window.dispatchEvent(new StorageEvent('storage', { key: 'authToken' }))).not.toThrow();

    expect(AuthService.isAuthenticated()).toBe(false);
    expect(ended).toHaveBeenCalledTimes(1);
    unsubscribe();
  });
});

describe('registration refusals', () => {
  it('shows the taken-address sentence rather than a generic failure', async () => {
    // The server answers refusals in `error`. Read from `message` alone, a taken address and a taken
    // name both came out as "Registration failed", which points at neither fix.
    vi.mocked(fetch).mockResolvedValue(
      res({ code: 'EMAIL_TAKEN', error: 'That email address is already registered' }, false, 409));

    await expect(AuthService.register('alice', 'password', 'a@b.co'))
      .rejects.toThrow('That email address is already registered');
  });

  it('shows the taken-name sentence too', async () => {
    vi.mocked(fetch).mockResolvedValue(res({ error: 'Username already exists' }, false, 400));

    await expect(AuthService.register('alice', 'password')).rejects.toThrow('Username already exists');
  });

  it('sends the address only when one was typed', async () => {
    vi.mocked(fetch).mockResolvedValue(res({ token: 'tok', user: { username: 'alice' } }));

    await AuthService.register('alice', 'password');

    const body = JSON.parse(String((vi.mocked(fetch).mock.calls[0][1] as RequestInit).body));
    expect('email' in body).toBe(false);
  });
});

describe('setEmail', () => {
  it('sends the address and adopts the account the server answers with', async () => {
    AuthService.token = 'tok';
    vi.mocked(fetch).mockResolvedValue(res({
      success: true,
      user: { username: 'alice', email: 'a@b.co', emailVerified: false },
      mailSent: true,
    }));

    const outcome = await AuthService.setEmail('a@b.co');

    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(String(url)).toMatch(/\/auth\/email$/);
    expect(JSON.parse(String((init as RequestInit).body))).toEqual({ email: 'a@b.co' });
    expect(outcome).toEqual({ emailVerified: false, mailSent: true });
    // Adopted into storage as well, because the account page and an open /play/ read it from there.
    expect(JSON.parse(localStorage.getItem('currentUser') as string).email).toBe('a@b.co');
  });

  it('throws the server sentence when the address is taken', async () => {
    AuthService.token = 'tok';
    vi.mocked(fetch).mockResolvedValue(
      res({ code: 'EMAIL_TAKEN', error: 'That email address is already registered' }, false, 409));

    await expect(AuthService.setEmail('a@b.co')).rejects.toThrow('That email address is already registered');
    // The refusal changed nothing, so the cached account must not have moved either.
    expect(localStorage.getItem('currentUser')).toBeNull();
  });

  it('refuses without a session rather than calling the server', async () => {
    await expect(AuthService.setEmail('a@b.co')).rejects.toThrow('Not authenticated');
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe('resendVerification', () => {
  it('reports that the mail went', async () => {
    AuthService.token = 'tok';
    vi.mocked(fetch).mockResolvedValue(res({ success: true, emailVerified: false, mailSent: true }));

    expect(await AuthService.resendVerification()).toEqual({ emailVerified: false, mailSent: true });
  });

  it('reports an address that needed no mail', async () => {
    AuthService.token = 'tok';
    vi.mocked(fetch).mockResolvedValue(res({ success: true, emailVerified: true, mailSent: false }));

    expect(await AuthService.resendVerification()).toEqual({ emailVerified: true, mailSent: false });
  });

  it('throws the limiter sentence, which is the whole point of the limiter', async () => {
    AuthService.token = 'tok';
    vi.mocked(fetch).mockResolvedValue(
      res({ error: 'Too many verification mails asked for. Try again later.' }, false, 429));

    await expect(AuthService.resendVerification()).rejects.toThrow(/Too many verification mails/);
  });
});

describe('fetchEmailState', () => {
  it('reads the address and its state off the account', async () => {
    AuthService.token = 'tok';
    vi.mocked(fetch).mockResolvedValue(
      res({ success: true, user: { username: 'alice', email: 'a@b.co', emailVerified: true } }));

    expect(await AuthService.fetchEmailState()).toEqual({ email: 'a@b.co', emailVerified: true });
  });

  it('leaves the cached account alone, so a late read cannot undo a change made since', async () => {
    // `fetchUserProfile` replaces the whole record. A read started on arrival that lands after the
    // reader has removed their avatar would put the old avatar back, which is why this one is separate.
    AuthService.token = 'tok';
    AuthService.currentUser = { username: 'alice', avatarUrl: null };
    localStorage.setItem('currentUser', JSON.stringify(AuthService.currentUser));
    vi.mocked(fetch).mockResolvedValue(res({
      success: true,
      user: { username: 'alice', avatarUrl: '/api/avatars/old.webp', email: 'a@b.co' },
    }));

    await AuthService.fetchEmailState();

    expect(AuthService.getCurrentUser()).toEqual({ username: 'alice', avatarUrl: null });
    expect(JSON.parse(localStorage.getItem('currentUser') as string).avatarUrl).toBeNull();
  });

  it('answers null rather than throwing when the read fails', async () => {
    AuthService.token = 'tok';
    vi.mocked(fetch).mockRejectedValue(new Error('Failed to fetch'));

    expect(await AuthService.fetchEmailState()).toBeNull();
  });

  it('asks nothing without a session', async () => {
    expect(await AuthService.fetchEmailState()).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe('verifyEmail', () => {
  it('confirms the address and marks a session on this device proven', async () => {
    AuthService.token = 'tok';
    AuthService.currentUser = { username: 'alice', email: 'a@b.co', emailVerified: false };
    vi.mocked(fetch).mockResolvedValue(res({ success: true, email: 'a@b.co', emailVerified: true }));

    expect(await AuthService.verifyEmail('t0ken')).toEqual({ verified: true, email: 'a@b.co' });
    expect(AuthService.getCurrentUser()?.emailVerified).toBe(true);
  });

  it('leaves a session belonging to somebody else alone', async () => {
    // A shared computer: the mail is opened in a browser signed in as another account. Stamping that
    // account's record would claim it holds an address it does not.
    AuthService.token = 'tok';
    AuthService.currentUser = { username: 'bob', email: 'bob@b.co', emailVerified: false };
    vi.mocked(fetch).mockResolvedValue(res({ success: true, email: 'a@b.co', emailVerified: true }));

    expect(await AuthService.verifyEmail('t0ken')).toEqual({ verified: true, email: 'a@b.co' });
    expect(AuthService.getCurrentUser()).toEqual({
      username: 'bob', email: 'bob@b.co', emailVerified: false,
    });
  });

  it('works with no session, because the mail is read wherever it is read', async () => {
    vi.mocked(fetch).mockResolvedValue(res({ success: true, email: 'a@b.co', emailVerified: true }));

    expect(await AuthService.verifyEmail('t0ken')).toEqual({ verified: true, email: 'a@b.co' });
    const [, init] = vi.mocked(fetch).mock.calls[0];
    expect((init as RequestInit).headers).not.toHaveProperty('Authorization');
  });

  it('calls a spent link spent, rather than throwing', async () => {
    vi.mocked(fetch).mockResolvedValue(res({
      code: 'TOKEN_INVALID',
      error: 'That verification link has expired or has already been used',
    }, false, 400));

    const outcome = await AuthService.verifyEmail('t0ken');

    expect(outcome).toEqual({
      verified: false,
      spent: true,
      message: 'That verification link has expired or has already been used',
    });
  });

  it('separates a server that never answered from a link that is dead', async () => {
    // The page offers a fresh mail for a spent link and a retry for an outage. One flag decides which,
    // so an outage must never read as spent.
    vi.mocked(fetch).mockRejectedValue(new Error('Failed to fetch'));

    expect(await AuthService.verifyEmail('t0ken')).toMatchObject({ verified: false, spent: false });
  });
});
