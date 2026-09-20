// Must load before importing the service: its singleton constructor opens IndexedDB.
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import WorldStorageService, { AnonymousLikeRefused } from './WorldStorageService';
import AuthService from './AuthService';
import { ANONYMOUS_LIKE_CODES, INSTALL_HEADER_NAME, INSTALL_STORAGE_KEY, installId } from '@/lib/anonymousLikes';

/**
 * What the service says about who is asking.
 *
 * A guest's hearts are addressed by their Install, so the header is how the server knows which ones to
 * mark. A session's are addressed by the account, and the two must never travel together: a request
 * carrying both would name two readers of one answer.
 */

const res = (body: unknown, ok = true, status = 200): Response => ({
  ok,
  status,
  json: async () => body,
  headers: { get: () => null },
} as unknown as Response);

/** The headers the last request went out with. */
const sentHeaders = (call = 0) =>
  (vi.mocked(fetch).mock.calls[call][1] as RequestInit).headers as Record<string, string>;

beforeEach(() => {
  AuthService.logout();
  localStorage.clear();
  vi.stubGlobal('fetch', vi.fn());
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** Sign in, as far as the service can tell. */
const signIn = () => {
  vi.spyOn(AuthService, 'isAuthenticated').mockReturnValue(true);
  vi.spyOn(AuthService, 'token', 'get').mockReturnValue('a-token');
};

describe('the Install header', () => {
  it('goes out on the catalog request for a guest', async () => {
    vi.mocked(fetch).mockResolvedValue(res({ data: [] }));

    await WorldStorageService.fetchCatalog();

    expect(sentHeaders()[INSTALL_HEADER_NAME]).toBe(installId());
    expect(sentHeaders()['Authorization']).toBeUndefined();
  });

  it('stays off the catalog request once there is a session', async () => {
    signIn();
    vi.mocked(fetch).mockResolvedValue(res({ data: [] }));

    await WorldStorageService.fetchCatalog();

    expect(sentHeaders()[INSTALL_HEADER_NAME]).toBeUndefined();
    expect(sentHeaders()['Authorization']).toBe('Bearer a-token');
  });

  it('goes out on the listing request for a guest, and not for a session', async () => {
    vi.mocked(fetch).mockResolvedValue(res({ data: {} }));

    await WorldStorageService.fetchListingDetails('w1');
    signIn();
    await WorldStorageService.fetchListingDetails('w1');

    expect(sentHeaders(0)[INSTALL_HEADER_NAME]).toBe(installId());
    expect(sentHeaders(1)[INSTALL_HEADER_NAME]).toBeUndefined();
  });

  it('carries the stored id unchanged, which is the only shape the server accepts', async () => {
    // Sent as `crypto.randomUUID()` writes it: the server refuses anything else.
    localStorage.setItem(INSTALL_STORAGE_KEY, installId());
    vi.mocked(fetch).mockResolvedValue(res({ data: { liked: true, likes: 4 } }));

    await WorldStorageService.setAnonymousWorldLiked('w1', true);

    expect(sentHeaders()[INSTALL_HEADER_NAME]).toBe(localStorage.getItem(INSTALL_STORAGE_KEY));
  });
});

describe('whether this server takes a guest\'s like', () => {
  it('reads the catalog response', async () => {
    vi.mocked(fetch).mockResolvedValue(res({ data: [], anonymousLikes: true }));

    const out = await WorldStorageService.fetchCatalog();

    expect(out).toMatchObject({ status: 'fresh', anonymousLikes: true });
  });

  it('reads a catalog response that says nothing as off', async () => {
    vi.mocked(fetch).mockResolvedValue(res({ data: [] }));

    const out = await WorldStorageService.fetchCatalog();

    expect(out).toMatchObject({ status: 'fresh', anonymousLikes: false });
  });

  it('reads the listing response', async () => {
    vi.mocked(fetch).mockResolvedValue(res({ data: {}, anonymousLikes: true }));

    expect((await WorldStorageService.fetchListingDetails('w1'))?.anonymousLikes).toBe(true);
  });

  it('reads a listing response that says nothing as off', async () => {
    vi.mocked(fetch).mockResolvedValue(res({ data: {} }));

    expect((await WorldStorageService.fetchListingDetails('w1'))?.anonymousLikes).toBe(false);
  });
});

describe('a guest\'s press', () => {
  it('sends the state to the anonymous route and answers with the server\'s count', async () => {
    vi.mocked(fetch).mockResolvedValue(res({ data: { liked: true, likes: 4 } }));

    const state = await WorldStorageService.setAnonymousWorldLiked('w1', true);

    expect(vi.mocked(fetch).mock.calls[0][0]).toContain('/worlds/w1/anonymous-like');
    expect((vi.mocked(fetch).mock.calls[0][1] as RequestInit).body).toBe('{"liked":true}');
    expect(state).toEqual({ liked: true, likes: 4 });
  });

  it('carries no token, so signing out is never a way to move an account\'s Like', async () => {
    signIn();
    vi.mocked(fetch).mockResolvedValue(res({ data: { liked: false, likes: 3 } }));

    await WorldStorageService.setAnonymousWorldLiked('w1', false);

    expect(sentHeaders()['Authorization']).toBeUndefined();
  });

  it('throws the refusal with its code, so each one gets its own answer', async () => {
    vi.mocked(fetch).mockResolvedValue(
      res({ code: ANONYMOUS_LIKE_CODES.ADDRESS_CAP, error: 'Too many from here' }, false, 403),
    );

    const refusal = await WorldStorageService.setAnonymousWorldLiked('w1', true).catch((e) => e);

    expect(refusal).toBeInstanceOf(AnonymousLikeRefused);
    expect(refusal.code).toBe(ANONYMOUS_LIKE_CODES.ADDRESS_CAP);
    expect(refusal.message).toBe('Too many from here');
  });

  it('throws a coded refusal even when the body carries no code', async () => {
    // A server fault is not a rule this Install met. An empty code is what tells the two apart.
    vi.mocked(fetch).mockResolvedValue(res({}, false, 500));

    const refusal = await WorldStorageService.setAnonymousWorldLiked('w1', true).catch((e) => e);

    expect(refusal).toBeInstanceOf(AnonymousLikeRefused);
    expect(refusal.code).toBe('');
  });

  it('answers the already-liked case as the state it is, because the server calls it a success', async () => {
    vi.mocked(fetch).mockResolvedValue(
      res({ code: ANONYMOUS_LIKE_CODES.ACCOUNT_ALREADY_LIKED, data: { liked: true, likes: 9 } }),
    );

    expect(await WorldStorageService.setAnonymousWorldLiked('w1', false)).toEqual({ liked: true, likes: 9 });
  });
});

describe('the Claim', () => {
  it('asks the account route with both the session and the Install', async () => {
    // The one request that carries the two together, because it is the one that joins them: the account
    // it moves the marks to, and the Install it moves them from.
    signIn();
    vi.mocked(fetch).mockResolvedValue(res({ data: { claimed: 2 } }));

    expect(await WorldStorageService.claimAnonymousLikes()).toBe(2);

    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(String(url)).toMatch(/\/users\/me\/anonymous-likes\/claim$/);
    expect((init as RequestInit).method).toBe('POST');
    expect(sentHeaders()['Authorization']).toBe('Bearer a-token');
    expect(sentHeaders()[INSTALL_HEADER_NAME]).toBe(installId());
  });

  it('asks nothing of the server when this copy of the app has no Install', async () => {
    // A Claim would make one to send, link it to the account, and move nothing. Nothing to move is the
    // ordinary case for somebody who has never pressed a heart. Imported afresh, because this file has
    // already made an Install by now and the module holds it.
    vi.resetModules();
    localStorage.clear();
    const service = (await import('./WorldStorageService')).default;
    signIn();

    expect(await service.claimAnonymousLikes()).toBe(0);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('answers zero for a Claim that moved nothing, which is the ordinary case', async () => {
    signIn();
    vi.mocked(fetch).mockResolvedValue(res({ data: { claimed: 0 } }));

    expect(await WorldStorageService.claimAnonymousLikes()).toBe(0);
  });

  it('throws when the server refuses, so the seam knows to try again', async () => {
    signIn();
    vi.mocked(fetch).mockResolvedValue(
      res({ code: ANONYMOUS_LIKE_CODES.BAD_INSTALL, error: 'This request carried no usable install id' }, false, 400),
    );

    await expect(WorldStorageService.claimAnonymousLikes()).rejects.toThrow('This request carried no usable install id');
  });
});
