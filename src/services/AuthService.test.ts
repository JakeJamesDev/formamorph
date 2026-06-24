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
  it('stores token + user and returns true on success', async () => {
    vi.mocked(fetch).mockResolvedValue(res({ token: 'tok', user: { username: 'bob' } }));
    const ok = await AuthService.login('bob', 'pw');
    expect(ok).toBe(true);
    expect(AuthService.token).toBe('tok');
    expect(AuthService.getCurrentUser()).toEqual({ username: 'bob' });
    expect(localStorage.getItem('authToken')).toBe('tok');
  });

  it('throws the server-supplied message on failure', async () => {
    vi.mocked(fetch).mockResolvedValue(res({ message: 'Bad creds' }, false, 401));
    await expect(AuthService.login('bob', 'pw')).rejects.toThrow('Bad creds');
    expect(AuthService.token).toBeNull();
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
