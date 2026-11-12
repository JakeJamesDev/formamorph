// @vitest-environment jsdom
// Must load before importing the service: its singleton constructor opens IndexedDB.
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import ModelStorageService from './ModelStorageService';
import {
  BUNDLED_AVATARS,
  DEFAULT_AVATAR_ID,
  DEFAULT_MARKED_KEY,
  PRALINE_AVATAR_ID,
  bundledAvatarsFor,
  clearUserDefaultAvatar,
  pickerStart,
  readUserDefaultAvatar,
  setUserDefaultAvatar,
} from '@/lib/defaultAvatar';
import { promisifyRequest } from '@/lib/idb';
import { makeVrm1 } from '@/test/glbFixture';

vi.mock('@/lib/vrmThumbnail', () => ({ renderVrmThumbnail: vi.fn(async () => undefined) }));

const SFW = bundledAvatarsFor('');
const NSFW = bundledAvatarsFor('nsfw');
const DEFAULT_URL = './default-avatar.vrm';
const PRALINE_URL = './praline-avatar.vrm';

/** Serves each bundled file under its model title; a url outside `files` answers like the static host's 404. */
const serve = (files: Record<string, string>) => vi.stubGlobal('fetch', vi.fn(async (url: string) => {
  const title = files[url];
  return title ? { ok: true, blob: async () => makeVrm1({ name: title }) } : { ok: false, status: 404, blob: async () => new Blob(['<html>']) };
}));
const serveBoth = () => serve({ [DEFAULT_URL]: 'Aurelia', [PRALINE_URL]: 'Praline' });
const fetchedUrls = () => vi.mocked(fetch).mock.calls.map(([url]) => url);
const libraryIds = async () => (await ModelStorageService.getModelMetadata()).map((model) => model.id);

beforeEach(async () => {
  localStorage.clear();
  await ModelStorageService.initialize();
  const db = await new Promise<IDBDatabase>((resolve) => {
    const request = indexedDB.open('FORMAMORPH_MODELS_DB');
    request.onsuccess = () => resolve(request.result);
  });
  await promisifyRequest(db.transaction(['models'], 'readwrite').objectStore('models').clear());
  // The bundled file hashes memoize per instance; reset them so each test's served file is read.
  (ModelStorageService as unknown as { bundledHashes: Map<string, unknown> }).bundledHashes.clear();
});
afterEach(() => vi.unstubAllGlobals());

describe('the build flag', () => {
  it('leaves Praline out of a build with FORMAMORPH_AVATARS unset', () => {
    expect(BUNDLED_AVATARS.map((avatar) => avatar.id)).toEqual([DEFAULT_AVATAR_ID]);
  });

  it('adds her on an nsfw build, with her own flag', () => {
    expect(NSFW.map((avatar) => avatar.id).sort()).toEqual([DEFAULT_AVATAR_ID, PRALINE_AVATAR_ID].sort());
    expect(new Set(NSFW.map((avatar) => avatar.seededKey)).size).toBe(2);
  });

  it('keeps the shipped default flag spelling, so a past delete stays deleted', () => {
    expect(SFW[0].seededKey).toBe('FORMAMORPH_defaultModelSeeded');
  });
});

describe('seeding on an NSFW build', () => {
  it('seeds each entry once, named from its own file', async () => {
    serveBoth();
    await ModelStorageService.seedBundledAvatars(NSFW);
    await ModelStorageService.seedBundledAvatars(NSFW);

    expect(fetchedUrls().sort()).toEqual([DEFAULT_URL, PRALINE_URL]);
    const names = Object.fromEntries((await ModelStorageService.getModelMetadata()).map((model) => [model.id, model.name]));
    expect(names).toEqual({ [DEFAULT_AVATAR_ID]: 'Aurelia', [PRALINE_AVATAR_ID]: 'Praline' });
  });

  it('keeps a deleted Praline gone after a reload', async () => {
    serveBoth();
    await ModelStorageService.seedBundledAvatars(NSFW);
    await ModelStorageService.deleteModel(PRALINE_AVATAR_ID);

    await ModelStorageService.seedBundledAvatars(NSFW);

    expect(await libraryIds()).toEqual([DEFAULT_AVATAR_ID]);
    expect(fetchedUrls().filter((url) => url === PRALINE_URL)).toHaveLength(1);
  });

  it('keeps a deleted default gone while Praline stays', async () => {
    serveBoth();
    await ModelStorageService.seedBundledAvatars(NSFW);
    await ModelStorageService.deleteModel(DEFAULT_AVATAR_ID);

    await ModelStorageService.seedBundledAvatars(NSFW);

    expect(await libraryIds()).toEqual([PRALINE_AVATAR_ID]);
  });

  it('seeds the default last on a new install, and the picker opens on it', async () => {
    serveBoth();
    await ModelStorageService.seedBundledAvatars(NSFW);

    expect(fetchedUrls()).toEqual([PRALINE_URL, DEFAULT_URL]);
    expect(pickerStart(await libraryIds(), readUserDefaultAvatar())).toBe(DEFAULT_AVATAR_ID);
  });

  it('retries only the entry whose file failed', async () => {
    serve({ [DEFAULT_URL]: 'Aurelia' });
    await ModelStorageService.seedBundledAvatars(NSFW);
    expect(await libraryIds()).toEqual([DEFAULT_AVATAR_ID]);

    serveBoth();
    await ModelStorageService.seedBundledAvatars(NSFW);

    expect(fetchedUrls()).toEqual([PRALINE_URL]);
    expect((await libraryIds()).sort()).toEqual([DEFAULT_AVATAR_ID, PRALINE_AVATAR_ID].sort());
  });
});

describe('an existing library on an NSFW build', () => {
  /** A player from an older build: the default seeded under its own flag, and a device default chosen. */
  const seedOlderBuild = async (title: string) => {
    serve({ [DEFAULT_URL]: title });
    await ModelStorageService.seedBundledAvatars(SFW);
    const own = await ModelStorageService.addModel(new File([await makeVrm1({ name: 'Heron' })], 'heron.vrm', { type: 'model/vrm' }));
    vi.unstubAllGlobals();
    return own.id;
  };

  it('gains Praline, keeps its old default copy, and never reads the new default file', async () => {
    await seedOlderBuild('Elaina');
    serveBoth();

    await ModelStorageService.seedBundledAvatars(NSFW);

    expect(fetchedUrls()).toEqual([PRALINE_URL]);
    const names = Object.fromEntries((await ModelStorageService.getModelMetadata()).map((model) => [model.id, model.name]));
    expect(names[DEFAULT_AVATAR_ID]).toBe('Elaina');
    expect(names[PRALINE_AVATAR_ID]).toBe('Praline');
  });

  it('keeps its chosen default though Praline is the newest record', async () => {
    const own = await seedOlderBuild('Elaina');
    setUserDefaultAvatar(own);
    serveBoth();

    await ModelStorageService.seedBundledAvatars(NSFW);

    expect(readUserDefaultAvatar()).toBe(own);
    expect(pickerStart(await libraryIds(), readUserDefaultAvatar())).toBe(own);
  });

  it('keeps opening on its seeded default with none chosen', async () => {
    await seedOlderBuild('Elaina');
    serveBoth();

    await ModelStorageService.seedBundledAvatars(NSFW);

    expect(pickerStart(await libraryIds(), readUserDefaultAvatar())).toBe(DEFAULT_AVATAR_ID);
  });

  it('keeps opening on its own Avatar after deleting the seeded default', async () => {
    const own = await seedOlderBuild('Elaina');
    await ModelStorageService.deleteModel(DEFAULT_AVATAR_ID);
    serveBoth();

    await ModelStorageService.seedBundledAvatars(NSFW);

    expect(await libraryIds()).toContain(PRALINE_AVATAR_ID);
    expect(pickerStart(await libraryIds(), readUserDefaultAvatar())).toBe(own);
  });
});

describe('marking the bundled default as the Default Avatar', () => {
  /** An install from before the mark existed: seeded, with no Default Avatar and no done flag. */
  const installBeforeTheMark = async () => {
    serve({ [DEFAULT_URL]: 'Aurelia' });
    await ModelStorageService.seedBundledAvatars(SFW);
    clearUserDefaultAvatar();
    localStorage.removeItem(DEFAULT_MARKED_KEY);
  };

  it('marks it on a fresh install', async () => {
    serve({ [DEFAULT_URL]: 'Aurelia' });
    await ModelStorageService.seedBundledAvatars(SFW);
    expect(readUserDefaultAvatar()).toBe(DEFAULT_AVATAR_ID);
  });

  it('marks it once on an existing install that has none marked and still holds it', async () => {
    await installBeforeTheMark();
    await ModelStorageService.seedBundledAvatars(SFW);
    expect(readUserDefaultAvatar()).toBe(DEFAULT_AVATAR_ID);
  });

  it('keeps a clear across a restart', async () => {
    await installBeforeTheMark();
    await ModelStorageService.seedBundledAvatars(SFW);
    clearUserDefaultAvatar();
    await ModelStorageService.seedBundledAvatars(SFW);
    expect(readUserDefaultAvatar()).toBeUndefined();
  });

  it('keeps a Default Avatar the player marked before the update', async () => {
    await installBeforeTheMark();
    const own = await ModelStorageService.addModel(new File([await makeVrm1({ name: 'Heron' })], 'heron.vrm', { type: 'model/vrm' }));
    setUserDefaultAvatar(own.id);
    await ModelStorageService.seedBundledAvatars(SFW);
    expect(readUserDefaultAvatar()).toBe(own.id);
  });

  it('marks the bundled Avatar once when the stored Default Avatar is gone from the library', async () => {
    await installBeforeTheMark();
    setUserDefaultAvatar('deleted-avatar');
    await ModelStorageService.seedBundledAvatars(SFW);
    expect(readUserDefaultAvatar()).toBe(DEFAULT_AVATAR_ID);
  });

  it('marks nothing and adds nothing on an install that deleted the bundled Avatar', async () => {
    await installBeforeTheMark();
    await ModelStorageService.deleteModel(DEFAULT_AVATAR_ID);
    vi.unstubAllGlobals();
    serve({ [DEFAULT_URL]: 'Aurelia' });
    await ModelStorageService.seedBundledAvatars(SFW);
    expect(readUserDefaultAvatar()).toBeUndefined();
    expect(await libraryIds()).toEqual([]);
  });

  it('marks nothing on a build with no bundled Avatar', async () => {
    await ModelStorageService.seedBundledAvatars(bundledAvatarsFor('none'));
    expect(readUserDefaultAvatar()).toBeUndefined();
  });

  it('waits for a failed first seed, then marks on the retry', async () => {
    serve({});
    await ModelStorageService.seedBundledAvatars(SFW);
    expect(readUserDefaultAvatar()).toBeUndefined();

    serve({ [DEFAULT_URL]: 'Aurelia' });
    await ModelStorageService.seedBundledAvatars(SFW);
    expect(readUserDefaultAvatar()).toBe(DEFAULT_AVATAR_ID);
  });
});

describe('seeding on an SFW build', () => {
  it('never requests her file, with the file available to fetch', async () => {
    serveBoth();
    await ModelStorageService.seedBundledAvatars(SFW);
    expect(fetchedUrls()).toEqual([DEFAULT_URL]);
    expect(await libraryIds()).toEqual([DEFAULT_AVATAR_ID]);
  });

  it('never requests her file for the hash check', async () => {
    serveBoth();
    await ModelStorageService.bundledAvatarHashes(SFW);
    expect(fetchedUrls()).not.toContain(PRALINE_URL);
  });

  it('leaves her flag unset, so a later NSFW build on the same profile seeds her', async () => {
    serveBoth();
    await ModelStorageService.seedBundledAvatars(SFW);
    expect(localStorage.getItem(NSFW.find((avatar) => avatar.id === PRALINE_AVATAR_ID)!.seededKey)).toBeNull();

    await ModelStorageService.seedBundledAvatars(NSFW);

    expect(await libraryIds()).toContain(PRALINE_AVATAR_ID);
  });
});

describe('a bundled file that is not there', () => {
  it('stores nothing and leaves the flag unset on a 404', async () => {
    serve({});
    await ModelStorageService.seedBundledAvatars(NSFW);
    expect(await libraryIds()).toEqual([]);
    expect(NSFW.map((avatar) => localStorage.getItem(avatar.seededKey))).toEqual([null, null]);
  });
});
