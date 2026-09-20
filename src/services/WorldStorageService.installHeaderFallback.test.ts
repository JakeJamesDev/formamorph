// Must load before importing the service: its singleton constructor opens IndexedDB.
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ANONYMOUS_LIKE_CODES, INSTALL_HEADER_NAME, INSTALL_STORAGE_KEY } from '@/lib/anonymousLikes';

/**
 * What the catalog does against a server that will not take the Install header.
 *
 * A server whose CORS allow list omits the header refuses the preflight, and the browser reports that
 * as a network failure. Without a fallback the catalog itself fails, and every guest sees an empty
 * community rather than one heart they cannot press. So the client asks again without the header: a
 * guest against such a server loses the like and keeps everything else.
 *
 * Offline looks identical from here, and must stay a failure. The second ask is what tells the two
 * apart, and it is the only thing a dead network costs.
 *
 * Each test starts from a fresh module registry, because whether the header is in use is one decision
 * per session and the module holds it.
 */

const res = (body: unknown, ok = true, status = 200): Response => ({
  ok,
  status,
  json: async () => body,
  headers: { get: () => null },
} as unknown as Response);

/** What the browser throws when a request never reached the server, preflight refusal included. */
const unreachable = () => new TypeError('Failed to fetch');

/** The headers one request went out with. */
const sentHeaders = (call = 0) =>
  (vi.mocked(fetch).mock.calls[call][1] as RequestInit).headers as Record<string, string>;

/**
 * The service, its auth singleton and the Install module, all from one fresh registry.
 *
 * Imported together because they must be the same copies: a spy on a separately imported auth service
 * would be watching a module the service never sees.
 */
const freshModules = async () => {
  vi.resetModules();
  const service = (await import('./WorldStorageService')).default;
  const auth = (await import('./AuthService')).default;
  const likes = await import('@/lib/anonymousLikes');
  return { service, auth, likes };
};

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal('fetch', vi.fn());
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('a server that refuses the Install header', () => {
  it('answers the catalog on a second ask without it', async () => {
    const { service } = await freshModules();
    vi.mocked(fetch)
      .mockRejectedValueOnce(unreachable())
      .mockResolvedValueOnce(res({ data: [{ id: 'w1' }], anonymousLikes: true }));

    const out = await service.fetchCatalog();

    expect(out).toMatchObject({ status: 'fresh' });
    expect((out as { data: unknown[] }).data).toHaveLength(1);
    expect(sentHeaders(0)[INSTALL_HEADER_NAME]).toBe(localStorage.getItem(INSTALL_STORAGE_KEY));
    expect(sentHeaders(1)[INSTALL_HEADER_NAME]).toBeUndefined();
  });

  it('reads that server as one that takes no guest like, whatever its catalog says', async () => {
    // The flag is true in the body, and the press it would enable is the one request this server will
    // not take. A heart offered here fails every time it is pressed.
    const { service } = await freshModules();
    vi.mocked(fetch)
      .mockRejectedValueOnce(unreachable())
      .mockResolvedValueOnce(res({ data: [], anonymousLikes: true }));

    expect(await service.fetchCatalog()).toMatchObject({ anonymousLikes: false });
  });

  it('stops sending the header for the rest of the session', async () => {
    const { service } = await freshModules();
    vi.mocked(fetch)
      .mockRejectedValueOnce(unreachable())
      .mockResolvedValue(res({ data: [], anonymousLikes: true }));

    await service.fetchCatalog();
    await service.fetchCatalog();
    await service.fetchListingDetails('w1');

    expect(fetch).toHaveBeenCalledTimes(4);
    expect(sentHeaders(2)[INSTALL_HEADER_NAME]).toBeUndefined();
    expect(sentHeaders(3)[INSTALL_HEADER_NAME]).toBeUndefined();
  });

  it('keeps the listing panel too', async () => {
    const { service } = await freshModules();
    vi.mocked(fetch)
      .mockRejectedValueOnce(unreachable())
      .mockResolvedValueOnce(res({ data: { modelLicense: 'CC0' }, anonymousLikes: true }));

    const details = await service.fetchListingDetails('w1');

    expect(details?.modelLicense).toBe('CC0');
    expect(details?.anonymousLikes).toBe(false);
  });

  it('keeps the in-game prompt answerable', async () => {
    const { service } = await freshModules();
    vi.mocked(fetch)
      .mockRejectedValueOnce(unreachable())
      .mockResolvedValueOnce(res({ data: { liked: false }, anonymousLikes: true }));

    expect(await service.fetchListingLikeState('w1')).toEqual({
      status: 'ok', liked: false, ownListing: false, anonymousLikes: false,
    });
  });

  it('turns a press into a refusal the heart already knows how to answer', async () => {
    // The press is the one thing lost. It comes back as a coded refusal rather than a thrown network
    // error, so the heart springs back without a toast about a connection that is fine.
    const { service } = await freshModules();
    vi.mocked(fetch)
      .mockRejectedValueOnce(unreachable())
      .mockResolvedValueOnce(res({ code: ANONYMOUS_LIKE_CODES.BAD_INSTALL }, false, 400));

    const refusal = await service.setAnonymousWorldLiked('w1', true).catch((e) => e);

    expect(refusal.code).toBe(ANONYMOUS_LIKE_CODES.BAD_INSTALL);
    expect(sentHeaders(1)[INSTALL_HEADER_NAME]).toBeUndefined();
  });

  it('asks it for no Claim, which it would refuse the same way', async () => {
    const { service, auth, likes } = await freshModules();
    likes.installId();
    likes.noteInstallHeaderRefused();
    vi.spyOn(auth, 'isAuthenticated').mockReturnValue(true);
    vi.spyOn(auth, 'token', 'get').mockReturnValue('a-token');

    expect(await service.claimAnonymousLikes()).toBe(0);
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe('a network that is simply down', () => {
  it('fails as it always did, one extra request later', async () => {
    const { service } = await freshModules();
    vi.mocked(fetch).mockRejectedValue(unreachable());

    expect(await service.fetchCatalog()).toMatchObject({ status: 'error' });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('leaves the guest their hearts, because two failures name the network and not the header', async () => {
    const { service } = await freshModules();
    vi.mocked(fetch)
      .mockRejectedValueOnce(unreachable())
      .mockRejectedValueOnce(unreachable())
      .mockResolvedValue(res({ data: [], anonymousLikes: true }));

    await service.fetchCatalog();
    const out = await service.fetchCatalog();

    expect(sentHeaders(2)[INSTALL_HEADER_NAME]).toBe(localStorage.getItem(INSTALL_STORAGE_KEY));
    expect(out).toMatchObject({ anonymousLikes: true });
  });

  it('costs a signed-in reader nothing, because their request carried no header to drop', async () => {
    const { service, auth } = await freshModules();
    vi.spyOn(auth, 'isAuthenticated').mockReturnValue(true);
    vi.spyOn(auth, 'token', 'get').mockReturnValue('a-token');
    vi.mocked(fetch).mockRejectedValue(unreachable());

    expect(await service.fetchCatalog()).toMatchObject({ status: 'error' });
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});

describe('a shell that takes no guest like', () => {
  it('names no Install on the catalog, and offers no guest heart', async () => {
    const { service, likes } = await freshModules();
    likes.setShellOffersGuestLikes(false);
    vi.mocked(fetch).mockResolvedValue(res({ data: [], anonymousLikes: true }));

    const out = await service.fetchCatalog();

    expect(sentHeaders()[INSTALL_HEADER_NAME]).toBeUndefined();
    expect(out).toMatchObject({ anonymousLikes: false });
  });

  it('names none on the listing either', async () => {
    const { service, likes } = await freshModules();
    likes.setShellOffersGuestLikes(false);
    vi.mocked(fetch).mockResolvedValue(res({ data: {}, anonymousLikes: true }));

    await service.fetchListingDetails('w1');

    expect(sentHeaders()[INSTALL_HEADER_NAME]).toBeUndefined();
  });

  it('stores no Install id, because a visitor there has no use for one', async () => {
    const { service, likes } = await freshModules();
    likes.setShellOffersGuestLikes(false);
    vi.mocked(fetch).mockResolvedValue(res({ data: [] }));

    await service.fetchCatalog();

    expect(localStorage.getItem(INSTALL_STORAGE_KEY)).toBeNull();
  });
});
