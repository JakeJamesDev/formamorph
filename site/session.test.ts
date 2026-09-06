import { describe, it, expect, beforeEach, vi } from 'vitest';
import AuthService from '@/services/AuthService';
import { serverAssetSrc } from '@/lib/serverAssets';
import { TOKEN_KEY, USER_KEY, API_ORIGIN, DELETION_CANCELLATION_KEY, readSession, watchSession, avatarSrc,
  takeDeletionCancellation }
  from '../hosting/session.js';
import { DELETION_CANCELLATION_KEY as APP_DELETION_CANCELLATION_KEY, recordDeletionCancellation }
  from '@/lib/deletionCancellation';

/**
 * The vanilla session module the landing page reads through.
 *
 * It ships as a plain file under `hosting/`, so nothing type-checks it against the app it shadows.
 * That is what the first two tests are for: the keys and the avatar origin are the app's, and a rename
 * on either side has to break here rather than on the live landing page.
 */

/** A stored session, the way AuthService leaves one behind. */
const hold = (user: Record<string, unknown> | null, token: string | null = 'tok') => {
  localStorage.clear();
  if (token) localStorage.setItem(TOKEN_KEY, token);
  if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
};

/** A write from another tab. Same-document writes raise no event, which is the point of the event. */
const fromAnotherTab = (key: string | null, newValue: string | null = null) =>
  window.dispatchEvent(new StorageEvent('storage', { key, newValue }));

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

describe('the canceled-deletion handoff', () => {
  it('uses the same key as the account pages', () => {
    expect(DELETION_CANCELLATION_KEY).toBe(APP_DELETION_CANCELLATION_KEY);
  });

  it('shows the account-page signal once on the static landing page', () => {
    recordDeletionCancellation();

    expect(takeDeletionCancellation()).toBe(true);
    expect(takeDeletionCancellation()).toBe(false);
  });
});

describe('the keys the landing page shares with the app', () => {
  it('are the ones AuthService writes', () => {
    expect(TOKEN_KEY).toBe(AuthService.tokenKey);
    expect(USER_KEY).toBe(AuthService.userKey);
  });

  it('name the host the app talks to', () => {
    // The module cannot read the build's environment, so the origin is written out in it. This is
    // what stops the two drifting: move the API and the landing page's avatars go with it.
    expect(`${API_ORIGIN}/api`).toBe(import.meta.env.VITE_API_URL_PROD);
  });

  it('resolve an avatar to the same URL the app does', () => {
    const path = '/api/avatars/9f2c.webp';

    // Against the app's own joining rule, handed the same base the app is handed.
    expect(avatarSrc(path)).toBe(serverAssetSrc(path, import.meta.env.VITE_API_URL_PROD));
  });
});

describe('readSession', () => {
  it('reads the username and avatar out of the held user', () => {
    hold({ username: 'rowan', avatarUrl: '/api/avatars/9f2c.webp' });

    expect(readSession()).toEqual({ username: 'rowan', avatarUrl: '/api/avatars/9f2c.webp' });
  });

  it('reports no avatar rather than an empty one', () => {
    hold({ username: 'rowan' });

    expect(readSession()).toEqual({ username: 'rowan', avatarUrl: null });
  });

  it('is null with no token, whatever user is left behind', () => {
    hold({ username: 'rowan' }, null);

    expect(readSession()).toBeNull();
  });

  it('is null when the stored user is corrupt', () => {
    localStorage.setItem(TOKEN_KEY, 'tok');
    localStorage.setItem(USER_KEY, '{not json');

    expect(readSession()).toBeNull();
  });

  it('is null when the stored user carries no username', () => {
    // A token whose user never arrived. There is no profile to link to, so this reads as signed out.
    hold({ avatarUrl: '/api/avatars/9f2c.webp' });

    expect(readSession()).toBeNull();
  });

  it('is null when storage itself refuses to be read', () => {
    const getItem = vi.spyOn(Storage.prototype, 'getItem')
      .mockImplementation(() => { throw new Error('site data is blocked'); });

    expect(readSession()).toBeNull();
    getItem.mockRestore();
  });
});

describe('watchSession', () => {
  it('reports a sign-in from another tab', () => {
    const seen = vi.fn();
    const stop = watchSession(seen);

    hold({ username: 'rowan', avatarUrl: null });
    fromAnotherTab(TOKEN_KEY, 'tok');

    expect(seen).toHaveBeenCalledWith({ username: 'rowan', avatarUrl: null });
    stop();
  });

  it('reports a sign-out from another tab', () => {
    hold({ username: 'rowan' });
    const seen = vi.fn();
    const stop = watchSession(seen);

    localStorage.clear();
    fromAnotherTab(TOKEN_KEY, null);

    expect(seen).toHaveBeenCalledWith(null);
    stop();
  });

  it('follows a whole-storage clear, which arrives with no key at all', () => {
    hold({ username: 'rowan' });
    const seen = vi.fn();
    const stop = watchSession(seen);

    localStorage.clear();
    fromAnotherTab(null);

    expect(seen).toHaveBeenCalledWith(null);
    stop();
  });

  it('ignores a key that is not the session', () => {
    const seen = vi.fn();
    const stop = watchSession(seen);

    fromAnotherTab('FORMAMORPH_updateCache', '{}');

    expect(seen).not.toHaveBeenCalled();
    stop();
  });

  it('stops when it is unsubscribed', () => {
    const seen = vi.fn();
    watchSession(seen)();

    hold({ username: 'rowan' });
    fromAnotherTab(TOKEN_KEY, 'tok');

    expect(seen).not.toHaveBeenCalled();
  });
});

describe('avatarSrc', () => {
  it('gives a stored path the API origin', () => {
    expect(avatarSrc('/api/avatars/9f2c.webp')).toBe(`${API_ORIGIN}/api/avatars/9f2c.webp`);
  });

  it('leaves a URL that already says where it comes from alone', () => {
    expect(avatarSrc('https://cdn.test/9f2c.webp')).toBe('https://cdn.test/9f2c.webp');
  });

  it('is null when there is no avatar', () => {
    expect(avatarSrc(null)).toBeNull();
    expect(avatarSrc('')).toBeNull();
  });
});
