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

  it('reads the counts a profile draws', async () => {
    signedIn(null);
    respondWith({ id: 'u1', username: 'wren_hallow', followers: 3, likes: 41, downloads: 108 });

    const result = await UserService.fetchProfile('u1');

    expect(result).toMatchObject({ followers: 3, likes: 41, downloads: 108 });
  });

  it('zeroes counts a server that predates them never sent', async () => {
    // The client can reach people before the server it talks to is updated, and the profile row renders
    // these straight onto the screen — a missing number would draw an icon beside nothing.
    signedIn(null);
    respondWith({ id: 'u1', username: 'wren_hallow' });

    const result = await UserService.fetchProfile('u1');

    expect(result).toMatchObject({ followers: 0, likes: 0, downloads: 0 });
  });

  it('throws the server’s own wording when the account cannot be read', async () => {
    signedIn(null);
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ success: false, error: 'User not found' }), { status: 404 })
    );

    await expect(UserService.fetchProfile('nope')).rejects.toThrow('User not found');
  });
});

describe('reading a profile by name', () => {
  /** A refusal the way the server sends one. */
  const refuse = (status: number, error: string) =>
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ success: false, error }), {
        status,
        headers: { 'Content-Type': 'application/json' },
      })
    );

  it('asks the by-name endpoint, escaping the name it was given', async () => {
    signedIn(null);
    respondWith({ id: 'u1', username: 'wren hallow', followers: 0 });

    await UserService.fetchProfileByUsername('wren hallow');

    const [url] = vi.mocked(globalThis.fetch).mock.calls[0];
    expect(String(url)).toContain('/users/by-username/wren%20hallow/profile');
  });

  it('sends the reader’s token, so their own follow state comes back', async () => {
    signedIn('t0ken');
    respondWith({ id: 'u1', username: 'wren_hallow', followers: 3, following: true });

    const result = await UserService.fetchProfileByUsername('wren_hallow');

    expect(sentAuth()).toBe('Bearer t0ken');
    expect(result?.following).toBe(true);
  });

  it('coerces the counts the same way the by-id read does', async () => {
    signedIn(null);
    respondWith({ id: 'u1', username: 'wren_hallow' });

    const result = await UserService.fetchProfileByUsername('wren_hallow');

    expect(result).toMatchObject({ followers: 0, likes: 0, downloads: 0 });
  });

  it('answers null for a name nobody has, rather than throwing', async () => {
    // The page draws a not-found for this, which is a different screen from a server that broke.
    signedIn(null);
    refuse(404, 'User not found');

    await expect(UserService.fetchProfileByUsername('nobody')).resolves.toBeNull();
  });

  it('still throws when the server actually broke', async () => {
    signedIn(null);
    refuse(500, 'Server error');

    await expect(UserService.fetchProfileByUsername('wren_hallow')).rejects.toThrow('Server error');
  });
});
