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
