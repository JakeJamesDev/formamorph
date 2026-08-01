import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import UserService from './UserService';
import AuthService from './AuthService';

/** Whatever the endpoint answers; the tests here care about what went out, not what came back. */
const respondWith = (data: unknown) =>
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(JSON.stringify({ success: true, data }), { headers: { 'Content-Type': 'application/json' } })
  );

/** The Authorization header of the last request, or undefined if none was sent. */
const sentAuth = (): string | undefined => {
  const [, init] = vi.mocked(globalThis.fetch).mock.calls[0];

  return (init?.headers as Record<string, string> | undefined)?.Authorization;
};

const signedIn = (token: string | null) =>
  vi.spyOn(AuthService, 'token', 'get').mockReturnValue(token);

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('reading a profile', () => {
  it('sends the reader’s token, since it is what decides whether their follow state comes back', async () => {
    // Found live: without it the endpoint answers `following: undefined` for everybody, so reopening a
    // profile you already follow offered Follow again.
    signedIn('t0ken');
    respondWith({ id: 'u1', username: 'wren_hallow', followers: 3, following: true });

    const result = await UserService.fetchProfile('u1');

    expect(sentAuth()).toBe('Bearer t0ken');
    expect(result.following).toBe(true);
  });

  it('reads without one, since a signed-out visitor may still click a name', async () => {
    signedIn(null);
    respondWith({ id: 'u1', username: 'wren_hallow', followers: 3 });

    await UserService.fetchProfile('u1');

    expect(sentAuth()).toBeUndefined();
    expect(vi.mocked(globalThis.fetch)).toHaveBeenCalled();
  });

  it('throws the server’s own wording when the account cannot be read', async () => {
    signedIn(null);
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ success: false, error: 'User not found' }), { status: 404 })
    );

    await expect(UserService.fetchProfile('nope')).rejects.toThrow('User not found');
  });
});
