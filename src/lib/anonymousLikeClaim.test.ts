// Must load before importing the service: its singleton constructor reaches for IndexedDB.
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import AuthService from '@/services/AuthService';
import WorldStorageService from '@/services/WorldStorageService';
import { INSTALL_STORAGE_KEY } from '@/lib/anonymousLikes';
import { claimSettled, watchSessionForClaim } from './anonymousLikeClaim';

/**
 * Where a guest's likes become an account's.
 *
 * The three ways a session arrives are the three the seam has to catch: signing in, signing up, and a
 * sign-in in another tab reaching this one. Each drives the real AuthService rather than its listener
 * list, because the listener list is not what a person presses.
 *
 * A Claim is the server's to get right. What this file asserts is when the client asks for one, and that
 * sign-in survives a Claim that fails.
 */

const AN_INSTALL = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';

const res = (body: unknown, ok = true): Response => ({
  ok,
  status: ok ? 200 : 400,
  json: async () => body,
} as unknown as Response);

let claim: ReturnType<typeof vi.spyOn>;
let stopWatching: () => void;

beforeEach(() => {
  AuthService.logout();
  localStorage.clear();
  localStorage.setItem(INSTALL_STORAGE_KEY, AN_INSTALL);
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(res({ token: 'a-token', user: { id: 7, username: 'bosun' } })));
  vi.spyOn(console, 'error').mockImplementation(() => {});
  claim = vi.spyOn(WorldStorageService, 'claimAnonymousLikes').mockResolvedValue(0);
  stopWatching = watchSessionForClaim();
});

afterEach(() => {
  // Signed out while the seam is still listening, because that is what clears the session it remembers.
  // Stop watching first and the next case inherits this one's session and asks for no Claim at all.
  AuthService.logout();
  stopWatching();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** A sign-in in another tab, which reaches this one only through the `storage` event. */
const signInElsewhere = () => {
  localStorage.setItem('authToken', 'a-foreign-token');
  localStorage.setItem('currentUser', JSON.stringify({ id: 9, username: 'ari' }));
  window.dispatchEvent(new StorageEvent('storage', { key: 'authToken' }));
};

describe('claiming a guest\'s likes', () => {
  it('claims after a sign-in', async () => {
    await AuthService.login('bosun', 'hunter22');
    await claimSettled();

    expect(claim).toHaveBeenCalledTimes(1);
  });

  it('claims after a sign-up, so a new account starts with the likes it already gave', async () => {
    await AuthService.register('bosun', 'hunter22');
    await claimSettled();

    expect(claim).toHaveBeenCalledTimes(1);
  });

  it('claims after a session adopted from another tab', async () => {
    signInElsewhere();
    await claimSettled();

    expect(claim).toHaveBeenCalledTimes(1);
  });

  it('asks for no Claim when signing out', async () => {
    await AuthService.login('bosun', 'hunter22');
    await claimSettled();
    claim.mockClear();

    AuthService.logout();
    await claimSettled();

    expect(claim).not.toHaveBeenCalled();
  });

  it('asks once for one session, so an avatar change is not another Claim', async () => {
    await AuthService.login('bosun', 'hunter22');
    await claimSettled();

    AuthService.applyAvatar('https://example.test/face.webp');
    await claimSettled();

    expect(claim).toHaveBeenCalledTimes(1);
  });

  it('claims again for the next account on this copy of the app', async () => {
    await AuthService.login('bosun', 'hunter22');
    await claimSettled();
    AuthService.logout();

    vi.mocked(fetch).mockResolvedValue(res({ token: 'b-token', user: { id: 8, username: 'ari' } }));
    await AuthService.login('ari', 'hunter22');
    await claimSettled();

    expect(claim).toHaveBeenCalledTimes(2);
  });
});

describe('a Claim that fails', () => {
  it('lets the sign-in through', async () => {
    claim.mockRejectedValue(new Error('the server is down'));

    await expect(AuthService.login('bosun', 'hunter22')).resolves.toEqual({ deletionCancelled: false });
    await claimSettled();
  });

  it('settles rather than handing its failure to whoever waited', async () => {
    claim.mockRejectedValue(new Error('the server is down'));
    await AuthService.login('bosun', 'hunter22');

    await expect(claimSettled()).resolves.toBeUndefined();
  });

  it('tries again on the next session change, so the likes are not lost', async () => {
    claim.mockRejectedValue(new Error('the server is down'));
    await AuthService.login('bosun', 'hunter22');
    await claimSettled();

    claim.mockResolvedValue(2);
    AuthService.applyAvatar('https://example.test/face.webp');
    await claimSettled();

    expect(claim).toHaveBeenCalledTimes(2);
  });
});

describe('waiting for a Claim', () => {
  it('holds a catalog read until the marks have moved', async () => {
    // The reader key changes the moment the session does, so the catalog refresh starts while the Claim
    // is still in the air. Read too early and the account's new hearts are missing from the answer.
    let finishClaim = (_: number) => {};
    claim.mockReturnValue(new Promise<number>((resolve) => { finishClaim = resolve; }));
    let waited = false;

    await AuthService.login('bosun', 'hunter22');
    const waiting = claimSettled().then(() => { waited = true; });

    await Promise.resolve();
    expect(waited).toBe(false);

    finishClaim(3);
    await waiting;
    expect(waited).toBe(true);
  });

  it('returns at once when no Claim is in the air', async () => {
    await expect(claimSettled()).resolves.toBeUndefined();
  });
});
