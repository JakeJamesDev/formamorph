// Must load before importing the service: its singleton constructor opens IndexedDB.
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import WorldStorageService, { type StoredWorldRecord } from './WorldStorageService';
import { clearDeletedDefaultWorlds } from '@/lib/defaultWorlds';
import AuthService from './AuthService';

const res = (body: unknown, ok = true, status = 200): Response =>
  ({ ok, status, json: async () => body } as unknown as Response);

beforeEach(() => {
  AuthService.logout();
  localStorage.clear();
  vi.stubGlobal('fetch', vi.fn());
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('fetchRemoteWorlds', () => {
  it('builds the query string and normalizes a successful response', async () => {
    vi.mocked(fetch).mockResolvedValue(res({ data: [{ id: 'w1' }], total: 1, pagination: { page: 2 } }));
    const out = await WorldStorageService.fetchRemoteWorlds(2, 5, 'goblin', false, false, 'downloads', 'asc');
    expect(out.success).toBe(true);
    expect(out.data).toEqual([{ id: 'w1' }]);
    expect(out.total).toBe(1);
    const url = vi.mocked(fetch).mock.calls[0][0] as string;
    expect(url).toContain('page=2');
    expect(url).toContain('limit=5');
    expect(url).toContain('search=goblin');
    expect(url).toContain('sort=downloads');
    expect(url).toContain('order=asc');
  });

  it('requires authentication when ownedOnly is set (no request made)', async () => {
    const out = await WorldStorageService.fetchRemoteWorlds(1, 10, '', true);
    expect(out).toEqual({ success: false, error: 'Authentication required', data: [] });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('returns an error payload when the response fails', async () => {
    vi.mocked(fetch).mockResolvedValue(res({}, false, 500));
    const out = await WorldStorageService.fetchRemoteWorlds();
    expect(out.success).toBe(false);
    expect(out.data).toEqual([]);
  });
});

describe('getUserWorlds', () => {
  it('returns [] when not authenticated (no request made)', async () => {
    expect(await WorldStorageService.getUserWorlds()).toEqual([]);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('returns the data array when authenticated', async () => {
    AuthService.token = 'tok';
    vi.mocked(fetch).mockResolvedValue(res({ data: [{ id: 'u1' }] }));
    expect(await WorldStorageService.getUserWorlds()).toEqual([{ id: 'u1' }]);
  });
});

describe('postComment', () => {
  it('throws when not authenticated', async () => {
    await expect(WorldStorageService.postComment('w1', 'hi')).rejects.toThrow(/logged in/);
  });

  it('returns the created comment on success', async () => {
    AuthService.token = 'tok';
    vi.mocked(fetch).mockResolvedValue(res({ data: { id: 'c1', content: 'hi' } }));
    expect(await WorldStorageService.postComment('w1', 'hi')).toEqual({ id: 'c1', content: 'hi' });
  });
});

describe('publishWorld', () => {
  it('throws when not authenticated', async () => {
    await expect(WorldStorageService.publishWorld({ worldOverview: {} })).rejects.toThrow(/logged in/);
  });

  it('POSTs a new world and PUTs an existing one', async () => {
    AuthService.token = 'tok';
    const wd = { worldOverview: { name: 'N', description: 'D', thumbnail: 't' } };
    vi.mocked(fetch).mockResolvedValue(res({ id: 'created' }));

    await WorldStorageService.publishWorld(wd);
    expect(vi.mocked(fetch).mock.calls[0][1]?.method).toBe('POST');

    await WorldStorageService.publishWorld(wd, 'w99');
    const second = vi.mocked(fetch).mock.calls[1];
    expect(second[1]?.method).toBe('PUT');
    expect(second[0] as string).toContain('/worlds/w99');
  });
});

describe('local world storage (IndexedDB)', () => {
  const validWorld: StoredWorldRecord = {
    id: 'rt-1',
    name: 'Round Trip',
    description: 'd',
    author: 'me',
    thumbnail: '',
    data: {
      worldOverview: { name: 'Round Trip' },
      stats: [],
      locations: [],
      entities: [],
      traits: [],
      statUpdates: [],
    },
  };

  it('rejects worlds missing required fields', async () => {
    // Intentionally invalid (missing data) to exercise the runtime validation path.
    await expect(
      WorldStorageService.storeWorld({ id: 'x', name: 'X' } as unknown as StoredWorldRecord),
    ).rejects.toThrow(/missing required/);
  });

  it('stores, reads back, lists, and deletes a world', async () => {
    await WorldStorageService.storeWorld(validWorld);

    const data = (await WorldStorageService.getWorldData('rt-1')) as { id: string };
    expect(data.id).toBe('rt-1');

    const meta = await WorldStorageService.getWorldMetadata();
    expect(meta.some((m) => m.id === 'rt-1' && m.name === 'Round Trip')).toBe(true);

    await WorldStorageService.deleteWorld('rt-1');
    await expect(WorldStorageService.getWorldData('rt-1')).rejects.toBe('World not found');
  });

  it('heals a legacy remote-URL thumbnail by falling back to the embedded one in metadata', async () => {
    await WorldStorageService.storeWorld({
      ...validWorld,
      id: 'heal-1',
      thumbnail: 'https://workshop.fierylion.com/api/thumbnails/x.jpeg', // legacy cross-origin URL
      data: { ...validWorld.data, worldOverview: { name: 'H', thumbnail: 'data:image/png;base64,AAA' } },
    });

    const meta = await WorldStorageService.getWorldMetadata();
    const stored = meta.find((m) => m.id === 'heal-1');
    expect(stored?.thumbnail).toBe('data:image/png;base64,AAA'); // embedded base64 wins over the URL

    await WorldStorageService.deleteWorld('heal-1');
  });

  it('keeps a base64 thumbnail as-is in metadata', async () => {
    await WorldStorageService.storeWorld({
      ...validWorld,
      id: 'keep-1',
      thumbnail: 'data:image/jpeg;base64,BBB',
      data: { ...validWorld.data, worldOverview: { name: 'K', thumbnail: 'data:image/png;base64,ZZZ' } },
    });

    const meta = await WorldStorageService.getWorldMetadata();
    expect(meta.find((m) => m.id === 'keep-1')?.thumbnail).toBe('data:image/jpeg;base64,BBB');

    await WorldStorageService.deleteWorld('keep-1');
  });

  it('keeps sourceId/downloadedAt/sourceUpdatedAt sticky across a save that omits them', async () => {
    await WorldStorageService.storeWorld({
      ...validWorld,
      id: 'sticky-1',
      sourceId: 'server-abc',
      dirty: false,
      downloadedAt: '2026-01-01T00:00:00.000Z',
      sourceUpdatedAt: '2026-01-01T00:00:00.000Z',
    });

    // Simulate an editor save: same id, no source fields, just flips dirty.
    await WorldStorageService.storeWorld({ ...validWorld, id: 'sticky-1', dirty: true });

    const meta = await WorldStorageService.getWorldMetadata();
    const stored = meta.find((m) => m.id === 'sticky-1');
    expect(stored?.sourceId).toBe('server-abc');
    expect(stored?.dirty).toBe(true);
    expect(stored?.downloadedAt).toBe('2026-01-01T00:00:00.000Z');
    expect(stored?.sourceUpdatedAt).toBe('2026-01-01T00:00:00.000Z');

    await WorldStorageService.deleteWorld('sticky-1');
  });

  it('keeps sourceHash sticky across a save that omits it', async () => {
    await WorldStorageService.storeWorld({ ...validWorld, id: 'sticky-2', sourceHash: 'abc123' });
    await WorldStorageService.storeWorld({ ...validWorld, id: 'sticky-2', dirty: true });

    expect((await readRaw('sticky-2'))?.sourceHash).toBe('abc123');

    await WorldStorageService.deleteWorld('sticky-2');
  });
});

/** Read a stored record straight from IndexedDB — `getWorldMetadata` doesn't expose `sourceHash`. */
const readRaw = (id: string): Promise<StoredWorldRecord | undefined> =>
  new Promise((resolve, reject) => {
    const open = indexedDB.open('worldsDB');
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result;
      const req = db.transaction(['worlds'], 'readonly').objectStore('worlds').get(id);
      req.onsuccess = () => { resolve(req.result); db.close(); };
      req.onerror = () => { reject(req.error); db.close(); };
    };
  });

/**
 * Patch a stored record in place, bypassing `storeWorld` — its sticky merge would restore the very
 * `sourceHash` these tests need to stale or clear.
 */
const writeRaw = (record: StoredWorldRecord): Promise<void> =>
  new Promise((resolve, reject) => {
    const open = indexedDB.open('worldsDB');
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result;
      const req = db.transaction(['worlds'], 'readwrite').objectStore('worlds').put(record);
      req.onsuccess = () => { resolve(); db.close(); };
      req.onerror = () => { reject(req.error); db.close(); };
    };
  });

describe('loadDefaultWorlds (content-hash refresh)', () => {
  // The real bundled world, hashed through the real `?raw` glob — the smallest one keeps the parse cheap.
  const seed = [{ id: 'rampage', defaultName: 'Rampage' }];

  afterEach(async () => {
    await WorldStorageService.deleteWorld('rampage').catch(() => {});
  });

  it('seeds a missing world with its content hash, announcing nothing on a first run', async () => {
    const { failed, updated } = await WorldStorageService.loadDefaultWorlds(seed);

    expect(failed).toEqual([]);
    expect(updated).toEqual([]); // a first seed isn't news to the player
    expect((await readRaw('rampage'))?.sourceHash).toEqual(expect.any(String));
  });

  it('does not rewrite an already-converged world (the every-launch re-save loop)', async () => {
    await WorldStorageService.loadDefaultWorlds(seed);

    // A sentinel that only a rewrite would clobber, plus a direct watch on the write path.
    const record = (await readRaw('rampage'))!;
    await writeRaw({ ...record, name: 'SENTINEL' });
    const storeSpy = vi.spyOn(WorldStorageService, 'storeWorld');

    const { updated } = await WorldStorageService.loadDefaultWorlds(seed);

    expect(storeSpy).not.toHaveBeenCalled();
    expect(updated).toEqual([]);
    expect((await readRaw('rampage'))?.name).toBe('SENTINEL');
  });

  it('reseeds and announces when the bundled content changed', async () => {
    await WorldStorageService.loadDefaultWorlds(seed);
    const record = (await readRaw('rampage'))!;
    await writeRaw({ ...record, sourceHash: 'STALE-HASH', name: 'OLD NAME' });

    const { updated } = await WorldStorageService.loadDefaultWorlds(seed);

    expect(updated).toHaveLength(1);
    const healed = await readRaw('rampage');
    expect(healed?.name).not.toBe('OLD NAME'); // bundle content won
    expect(healed?.sourceHash).toBe(record.sourceHash); // hash healed, so the next run converges
  });

  it('backfills a hashless copy silently, then converges', async () => {
    await WorldStorageService.loadDefaultWorlds(seed);
    const record = (await readRaw('rampage'))!;
    delete record.sourceHash; // a world seeded before hashing existed
    await writeRaw(record);

    const first = await WorldStorageService.loadDefaultWorlds(seed);
    expect(first.updated).toEqual([]); // adopting a hash isn't a content change — don't announce it
    expect((await readRaw('rampage'))?.sourceHash).toEqual(expect.any(String));

    const second = await WorldStorageService.loadDefaultWorlds(seed);
    expect(second.updated).toEqual([]);
  });

  it('leaves an edited world alone even when the bundle changed', async () => {
    await WorldStorageService.loadDefaultWorlds(seed);
    const record = (await readRaw('rampage'))!;
    await writeRaw({ ...record, sourceHash: 'STALE-HASH', dirty: true, name: 'MY EDIT' });

    const { updated } = await WorldStorageService.loadDefaultWorlds(seed);

    expect(updated).toEqual([]);
    const stored = await readRaw('rampage');
    expect(stored?.name).toBe('MY EDIT');
    expect(stored?.sourceHash).toBe('STALE-HASH'); // still stale: a later un-edit can still pick the update up
  });

  it('reports a world with no bundled JSON as failed without throwing', async () => {
    const { failed, updated } = await WorldStorageService.loadDefaultWorlds([
      { id: 'no-such-world', defaultName: 'Nope' },
    ]);

    expect(failed).toEqual(['no-such-world']);
    expect(updated).toEqual([]);
  });
});

describe('default worlds: seed vs. the player deleting one', () => {
  const RAMPAGE = [{ id: 'rampage', defaultName: 'City Rampage' }];

  it('seeds a default that has never been stored', async () => {
    const { failed } = await WorldStorageService.loadDefaultWorlds(RAMPAGE);
    expect(failed).toEqual([]);
    await expect(WorldStorageService.getWorldData('rampage')).resolves.toBeTruthy();
  });

  it('does not re-create a default the player deleted', async () => {
    // The bug: the seeder decides on presence alone, so a deleted default looked "never seeded" and came
    // back on the next Main Menu mount.
    await WorldStorageService.loadDefaultWorlds(RAMPAGE);
    await WorldStorageService.deleteWorld('rampage');

    await WorldStorageService.loadDefaultWorlds(RAMPAGE);

    await expect(WorldStorageService.getWorldData('rampage')).rejects.toBe('World not found');
  });

  it('leaves a deleted default gone across repeated seed passes', async () => {
    await WorldStorageService.loadDefaultWorlds(RAMPAGE);
    await WorldStorageService.deleteWorld('rampage');
    for (let i = 0; i < 3; i++) await WorldStorageService.loadDefaultWorlds(RAMPAGE);
    await expect(WorldStorageService.getWorldData('rampage')).rejects.toBe('World not found');
  });

  it('still seeds the other defaults after one is deleted', async () => {
    await WorldStorageService.loadDefaultWorlds(RAMPAGE);
    await WorldStorageService.deleteWorld('rampage');

    await WorldStorageService.loadDefaultWorlds([...RAMPAGE, { id: 'drone', defaultName: 'Reincarnated Drone' }]);

    await expect(WorldStorageService.getWorldData('rampage')).rejects.toBe('World not found');
    await expect(WorldStorageService.getWorldData('drone')).resolves.toBeTruthy();
  });

  it('re-seeds a deleted default once the tombstones are cleared (the Restore button)', async () => {
    await WorldStorageService.loadDefaultWorlds(RAMPAGE);
    await WorldStorageService.deleteWorld('rampage');
    await expect(WorldStorageService.getWorldData('rampage')).rejects.toBe('World not found');

    clearDeletedDefaultWorlds();
    await WorldStorageService.loadDefaultWorlds(RAMPAGE);

    await expect(WorldStorageService.getWorldData('rampage')).resolves.toBeTruthy();
  });

  it('does not tombstone a deleted non-default world', async () => {
    await WorldStorageService.storeWorld({
      id: 'uploaded-1', name: 'Mine', description: '', author: '', thumbnail: '',
      data: { worldOverview: { name: 'Mine' }, stats: [], locations: [], entities: [], traits: [], statUpdates: [] },
    } as unknown as StoredWorldRecord);

    await WorldStorageService.deleteWorld('uploaded-1');

    expect(localStorage.getItem('FORMAMORPH_deletedDefaultWorlds')).toBeNull();
  });
});
