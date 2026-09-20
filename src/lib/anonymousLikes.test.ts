import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ANONYMOUS_LIKE_CODES, INSTALL_STORAGE_KEY, mayPressHeart, refusalAnswer } from './anonymousLikes';

/**
 * The Install id.
 *
 * It is the only thing an Anonymous Like is addressed by, so two properties carry the feature: it is a
 * UUID, which is the only shape the server accepts, and it is the same one on the next press.
 *
 * Each case imports the module afresh, because the id is held in the module once it is read.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** A module with nothing read yet, as a launch has. */
const fresh = async () => {
  vi.resetModules();
  return (await import('./anonymousLikes')).installId;
};

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('the Install id', () => {
  it('makes a UUID on first need and stores it', async () => {
    const installId = await fresh();

    const id = installId();

    expect(id).toMatch(UUID);
    expect(localStorage.getItem(INSTALL_STORAGE_KEY)).toBe(id);
  });

  it('answers the stored id on a later launch, so a filled heart stays filled', async () => {
    localStorage.setItem(INSTALL_STORAGE_KEY, 'AAAAAAAA-BBBB-4CCC-8DDD-EEEEEEEEEEEE');

    expect((await fresh())()).toBe('aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee');
  });

  it('answers the same id twice in one session', async () => {
    const installId = await fresh();

    expect(installId()).toBe(installId());
  });

  it('replaces a stored value that is not a UUID', async () => {
    // The server refuses anything else, and the column is the key a Claim later moves rows by.
    localStorage.setItem(INSTALL_STORAGE_KEY, 'not-a-uuid');
    const installId = await fresh();

    const id = installId();

    expect(id).toMatch(UUID);
    expect(localStorage.getItem(INSTALL_STORAGE_KEY)).toBe(id);
  });

  it('still answers one id when storage throws', async () => {
    // Private mode throws on both. The Install lasts this session rather than not existing.
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
    const installId = await fresh();

    const id = installId();

    expect(id).toMatch(UUID);
    expect(installId()).toBe(id);
  });
});

describe('who may press the heart', () => {
  const press = (over: Partial<Parameters<typeof mayPressHeart>[0]> = {}) =>
    mayPressHeart({ signedIn: false, ownListing: false, guestLikes: true, serverTakesLikes: true, liked: undefined, ...over });

  it('lets an account press somebody else\'s listing', () => {
    expect(press({ signedIn: true })).toBe(true);
  });

  it('leaves an account a plain count on its own listing', () => {
    expect(press({ signedIn: true, ownListing: true })).toBe(false);
  });

  it('lets a guest press where this shell and this server both take one', () => {
    expect(press()).toBe(true);
  });

  it('sends a guest to sign-in while the server takes none', () => {
    expect(press({ serverTakesLikes: false })).toBe(false);
  });

  it('still lets a guest empty a heart they filled while the server takes none', () => {
    // The privacy text promises that pressing again takes an Anonymous Like back.
    expect(press({ serverTakesLikes: false, liked: true })).toBe(true);
  });

  it('sends every guest press to sign-in in a shell that takes none, filled heart included', () => {
    // The website. An Install names a copy of the app, and the website is not one, so a filled heart
    // there came from an account and is that account's to remove.
    expect(press({ guestLikes: false })).toBe(false);
    expect(press({ guestLikes: false, liked: true })).toBe(false);
  });
});

describe('what the heart does about a refusal', () => {
  it('sends the guest to sign-in when the server takes none', () => {
    expect(refusalAnswer(ANONYMOUS_LIKE_CODES.OFF)).toBe('signIn');
  });

  it('has something to say only about the cap, which signing in gets past', () => {
    expect(refusalAnswer(ANONYMOUS_LIKE_CODES.ADDRESS_CAP)).toBe('cap');
  });

  it.each([
    ANONYMOUS_LIKE_CODES.NOT_VISIBLE,
    ANONYMOUS_LIKE_CODES.BAD_INSTALL,
    ANONYMOUS_LIKE_CODES.BAD_LIKED,
    ANONYMOUS_LIKE_CODES.ACCOUNT_SUSPENDED,
    ANONYMOUS_LIKE_CODES.ACCOUNT_OWN_LISTING,
  ])('says nothing about %s, which is not the reader\'s to act on', (code) => {
    expect(refusalAnswer(code)).toBe('silent');
  });

  it('reports a refusal it cannot name, so a server fault is not swallowed', () => {
    expect(refusalAnswer('')).toBe('report');
    expect(refusalAnswer('something_new')).toBe('report');
  });
});
