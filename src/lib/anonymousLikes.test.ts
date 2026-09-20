import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { INSTALL_STORAGE_KEY } from './anonymousLikes';

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
