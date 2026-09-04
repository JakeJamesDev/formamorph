// Must load before importing the service: its singleton constructor opens IndexedDB.
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import WorldStorageService, { type StoredWorldRecord } from './WorldStorageService';
import { clearDeletedDefaultWorlds } from '@/lib/defaultWorlds';
import { encodePlaceholderToken } from '@/lib/placeholders';
import AuthService from './AuthService';
import { getDownloadState } from '@/lib/downloadState';

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

  it('omits kind entirely for worlds, so the request is what shipped before kinds existed', async () => {
    vi.mocked(fetch).mockResolvedValue(res({ data: [], total: 0 }));
    await WorldStorageService.fetchRemoteWorlds();
    expect(vi.mocked(fetch).mock.calls[0][0] as string).not.toContain('kind');
  });

  it('asks for a single kind when given one', async () => {
    vi.mocked(fetch).mockResolvedValue(res({ data: [], total: 0 }));
    await WorldStorageService.fetchRemoteWorlds(1, 10, '', false, false, '', 'desc', 'entity');
    expect(vi.mocked(fetch).mock.calls[0][0] as string).toContain('kind=entity');
  });

  it('asks for the whole catalog when given `all`', async () => {
    vi.mocked(fetch).mockResolvedValue(res({ data: [], total: 0 }));
    await WorldStorageService.fetchRemoteWorlds(1, 1000, '', false, false, '', 'desc', 'all');
    expect(vi.mocked(fetch).mock.calls[0][0] as string).toContain('kind=all');
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

describe('updateComment', () => {
  it('throws when not authenticated', async () => {
    await expect(WorldStorageService.updateComment('c1', 'fixed')).rejects.toThrow(/logged in/);
  });

  it('PUTs the new text to the comment itself, signed', async () => {
    // The flat comment route, not a world-scoped one: the server has no nested edit path.
    AuthService.token = 'tok';
    vi.mocked(fetch).mockResolvedValue(res({ data: { id: 'c1', content: 'fixed' } }));

    await WorldStorageService.updateComment('c1', 'fixed');

    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url as string).toContain('/comments/c1');
    expect(init?.method).toBe('PUT');
    expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer tok');
    expect(JSON.parse(init?.body as string)).toEqual({ content: 'fixed' });
  });

  it('hands back the server’s version, so the edited marker comes from the server', async () => {
    AuthService.token = 'tok';
    vi.mocked(fetch).mockResolvedValue(res({ data: { id: 'c1', content: 'fixed', edited_at: '2026-08-22T10:00:00.000Z' } }));

    expect(await WorldStorageService.updateComment('c1', 'fixed')).toEqual({
      id: 'c1', content: 'fixed', edited_at: '2026-08-22T10:00:00.000Z',
    });
  });

  it('surfaces a refusal rather than swallowing it', async () => {
    AuthService.token = 'tok';
    vi.mocked(fetch).mockResolvedValue(res({ error: 'Not authorized to update this comment' }, false, 403));

    await expect(WorldStorageService.updateComment('c1', 'fixed')).rejects.toThrow(/Not authorized/);
  });
});

describe('deleteComment', () => {
  it('throws when not authenticated', async () => {
    await expect(WorldStorageService.deleteComment('c1')).rejects.toThrow(/logged in/);
  });

  it('DELETEs the comment itself, signed', async () => {
    AuthService.token = 'tok';
    vi.mocked(fetch).mockResolvedValue(res({ success: true, data: {} }));

    await WorldStorageService.deleteComment('c1');

    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url as string).toContain('/comments/c1');
    expect(init?.method).toBe('DELETE');
    expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer tok');
  });

  it('surfaces a refusal rather than swallowing it', async () => {
    AuthService.token = 'tok';
    vi.mocked(fetch).mockResolvedValue(res({ error: 'Not authorized to delete this comment' }, false, 403));

    await expect(WorldStorageService.deleteComment('c1')).rejects.toThrow(/Not authorized/);
  });
});

describe('publishItem', () => {
  const payload = (over = {}) => ({
    kind: 'world' as const, name: 'N', description: 'D', thumbnail: 't', contentData: { a: 1 }, ...over,
  });

  // Every field the request is allowed to carry for `payload({ tags: ['fantasy'] })`, and nothing else.
  const wholeBody = {
    name: 'N', description: 'D', thumbnail: 't', contentData: { a: 1 }, kind: 'world', tags: ['fantasy'],
  };

  it('throws when not authenticated', async () => {
    await expect(WorldStorageService.publishItem(payload())).rejects.toThrow(/logged in/);
  });

  it('POSTs a new listing and PUTs an existing one', async () => {
    AuthService.token = 'tok';
    vi.mocked(fetch).mockResolvedValue(res({ id: 'created' }));

    await WorldStorageService.publishItem(payload());
    expect(vi.mocked(fetch).mock.calls[0][1]?.method).toBe('POST');

    await WorldStorageService.publishItem(payload(), 'w99');
    const second = vi.mocked(fetch).mock.calls[1];
    expect(second[1]?.method).toBe('PUT');
    expect(second[0] as string).toContain('/worlds/w99');
  });

  it('sends the kind, so a character is not filed as a world', async () => {
    AuthService.token = 'tok';
    vi.mocked(fetch).mockResolvedValue(res({ id: 'created' }));

    await WorldStorageService.publishItem(payload({ kind: 'entity', contentData: { name: 'Mara' } }));

    const body = JSON.parse(vi.mocked(fetch).mock.calls[0][1]?.body as string);
    expect(body.kind).toBe('entity');
    expect(body.contentData).toEqual({ name: 'Mara' });
  });

  it('hands back the listing itself, so a caller can link the local copy to it', async () => {
    AuthService.token = 'tok';
    vi.mocked(fetch).mockResolvedValue(res({ success: true, data: { id: 'created', updated_at: '2026-01-02 03:04:05' } }));

    const listing = await WorldStorageService.publishItem(payload());

    expect(listing).toEqual({ id: 'created', updated_at: '2026-01-02 03:04:05' });
  });

  it('sends each list field once, so the thumbnail is not repeated in a preview copy', async () => {
    AuthService.token = 'tok';
    vi.mocked(fetch).mockResolvedValue(res({ id: 'created' }));

    await WorldStorageService.publishItem(payload({ tags: ['fantasy'] }));

    const body = JSON.parse(vi.mocked(fetch).mock.calls[0][1]?.body as string);
    expect(body).toEqual(wholeBody);
  });

  it('sends the same body when updating, so a re-publish carries the thumbnail once too', async () => {
    AuthService.token = 'tok';
    vi.mocked(fetch).mockResolvedValue(res({ id: 'w99' }));

    await WorldStorageService.publishItem(payload({ tags: ['fantasy'] }), 'w99');

    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(init?.method).toBe('PUT');
    expect(url as string).toContain('/worlds/w99');
    expect(JSON.parse(init?.body as string)).toEqual(wholeBody);
  });

  it('carries the contest entry when given one, and omits it when not', async () => {
    AuthService.token = 'tok';
    vi.mocked(fetch).mockResolvedValue(res({ id: 'created' }));

    await WorldStorageService.publishItem(payload(), null, 'ev1');
    await WorldStorageService.publishItem(payload());

    const entered = JSON.parse(vi.mocked(fetch).mock.calls[0][1]?.body as string);
    const plain = JSON.parse(vi.mocked(fetch).mock.calls[1][1]?.body as string);
    expect(entered.contestEventId).toBe('ev1');
    expect(plain).not.toHaveProperty('contestEventId');
  });
});

describe('getUserWorlds', () => {
  it('omits kind for worlds, so the request is what shipped before kinds existed', async () => {
    AuthService.token = 'tok';
    vi.mocked(fetch).mockResolvedValue(res({ data: [] }));

    await WorldStorageService.getUserWorlds();

    expect(vi.mocked(fetch).mock.calls[0][0] as string).not.toContain('kind');
  });

  it('asks for a kind when given one, so a world is never offered a character to overwrite', async () => {
    AuthService.token = 'tok';
    vi.mocked(fetch).mockResolvedValue(res({ data: [] }));

    await WorldStorageService.getUserWorlds('entity');

    expect(vi.mocked(fetch).mock.calls[0][0] as string).toContain('kind=entity');
  });

  it('returns [] when signed out, without a request', async () => {
    expect(await WorldStorageService.getUserWorlds('entity')).toEqual([]);
    expect(fetch).not.toHaveBeenCalled();
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

  it('renders placeholder chips in the blurb the library card draws', async () => {
    // The card has no playthrough behind it, so an unrendered chip reaches the player as raw token text.
    const token = encodePlaceholderToken({ id: 'fen', mode: 'world', placementId: 'p1' });
    await WorldStorageService.storeWorld({
      ...validWorld,
      id: 'ph-1',
      description: `Adrift in the ${token}.`,
      data: { ...validWorld.data, placeholders: [{ id: 'fen', name: 'fen', values: ['Sedge Fen'] }] },
    });

    const meta = await WorldStorageService.getWorldMetadata();
    expect(meta.find((m) => m.id === 'ph-1')?.description).toBe('Adrift in the Sedge Fen.');

    await WorldStorageService.deleteWorld('ph-1');
  });

  it('keeps the source fields sticky across a save that omits them', async () => {
    await WorldStorageService.storeWorld({
      ...validWorld,
      id: 'sticky-1',
      sourceId: 'server-abc',
      dirty: false,
      downloadedAt: '2026-01-01T00:00:00.000Z',
      sourceUpdatedAt: '2026-01-01T00:00:00.000Z',
      sourceAuthorId: 'u-publisher',
    });

    // Simulate an editor save: same id, no source fields, just flips dirty.
    await WorldStorageService.storeWorld({ ...validWorld, id: 'sticky-1', dirty: true });

    const meta = await WorldStorageService.getWorldMetadata();
    const stored = meta.find((m) => m.id === 'sticky-1');
    expect(stored?.sourceId).toBe('server-abc');
    expect(stored?.dirty).toBe(true);
    expect(stored?.downloadedAt).toBe('2026-01-01T00:00:00.000Z');
    expect(stored?.sourceUpdatedAt).toBe('2026-01-01T00:00:00.000Z');
    // Whoever published it does not stop being who published it because the reader edited their copy.
    expect(stored?.sourceAuthorId).toBe('u-publisher');

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

describe('linkWorldToListing', () => {
  const world: StoredWorldRecord = {
    id: 'link-1',
    name: 'Salt-Bright Reaches',
    data: {
      worldOverview: { name: 'Salt-Bright Reaches' },
      stats: [], locations: [], entities: [], traits: [], statUpdates: [],
    },
  };

  it('points a published world at its listing without touching what was uploaded', async () => {
    await WorldStorageService.storeWorld(world);

    await WorldStorageService.linkWorldToListing('link-1', 'srv-1', '2026-01-02 03:04:05');

    const meta = (await WorldStorageService.getWorldMetadata()).find((m) => m.id === 'link-1');
    expect(meta?.sourceId).toBe('srv-1');
    expect(meta?.sourceUpdatedAt).toBe('2026-01-02 03:04:05');
    // The content is the author's own, and publishing it is no reason to rewrite it.
    expect(await WorldStorageService.getWorldData('link-1')).toEqual({ ...world.data, id: 'link-1' });

    await WorldStorageService.deleteWorld('link-1');
  });

  it('clears a stamp the reply did not renew, rather than leaving one that reads as an update', async () => {
    // A copy downloaded long ago carries the version it held then. Publishing over that listing and
    // keeping the old stamp would offer the author their own upload back as an update — no stamp at all
    // reads as a plain re-download, which is the safe answer when the server told us nothing.
    await WorldStorageService.storeWorld({ ...world, id: 'link-2' });
    await WorldStorageService.linkWorldToListing('link-2', 'srv-2', '2020-01-02 03:04:05');

    await WorldStorageService.linkWorldToListing('link-2', 'srv-2', undefined);

    const meta = (await WorldStorageService.getWorldMetadata()).find((m) => m.id === 'link-2');
    expect(meta?.sourceUpdatedAt).toBeUndefined();
    expect(getDownloadState('2026-01-02 03:04:05', [meta!])).toBe('refresh');

    await WorldStorageService.deleteWorld('link-2');
  });

  it('does nothing for a world that is no longer in the library', async () => {
    await expect(WorldStorageService.linkWorldToListing('gone', 'srv-3', '2026-01-02 03:04:05')).resolves.toBeUndefined();
  });
});

/**
 * The two reads the main menu waits on before it can draw anything.
 *
 * Both used to pull every stored record out of IndexedDB, which on a real library means deserializing
 * a hundred megabytes of world payload to answer questions that never look at it: how many worlds are
 * there, and are the three bundled ones current. These guards watch the store itself, because the
 * return value is identical either way — only the cost differs, and only the store can see it.
 */
describe('what the launch reads actually touch', () => {
  /** Counts each store method the code under test reaches for, whichever record it asks about. */
  const watchStore = () => ({
    getAll: vi.spyOn(IDBObjectStore.prototype, 'getAll'),
    getAllKeys: vi.spyOn(IDBObjectStore.prototype, 'getAllKeys'),
    get: vi.spyOn(IDBObjectStore.prototype, 'get'),
  });

  afterEach(async () => {
    await WorldStorageService.deleteWorld('rampage').catch(() => {});
    await WorldStorageService.deleteWorld('mine-1').catch(() => {});
  });

  it('reads ids off the key index, without deserializing one record', async () => {
    await writeRaw({ id: 'mine-1', name: 'Mine', data: { worldOverview: {} } } as StoredWorldRecord);
    const store = watchStore();

    const ids = await WorldStorageService.getWorldIds();

    expect(ids).toContain('mine-1');
    // A `getAll().map(w => w.id)` returns the same array and costs the whole library to build it.
    expect(store.getAllKeys).toHaveBeenCalled();
    expect(store.getAll).not.toHaveBeenCalled();
    expect(store.get).not.toHaveBeenCalled();
  });

  it('compares the bundled defaults without reading the worlds the player made', async () => {
    await writeRaw({ id: 'mine-1', name: 'Mine', data: { worldOverview: {} } } as StoredWorldRecord);
    const store = watchStore();

    await WorldStorageService.loadDefaultWorlds([{ id: 'rampage', defaultName: 'Rampage' }]);

    expect(store.getAll).not.toHaveBeenCalled();
    const asked = store.get.mock.calls.map(([key]) => key);
    expect(asked).toContain('rampage');
    expect(asked).not.toContain('mine-1');
  });

  it('still seeds a default it has never stored, reading by id', async () => {
    // The narrowed read must not turn "absent" into "present": a missing key returns undefined, and the
    // seed path depends on telling that apart from a stored copy.
    await WorldStorageService.loadDefaultWorlds([{ id: 'rampage', defaultName: 'Rampage' }]);

    expect((await readRaw('rampage'))?.sourceHash).toEqual(expect.any(String));
  });
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

describe('the listing changelog', () => {
  const entryRow = (over: Record<string, unknown> = {}) => ({
    id: 'e1',
    world_id: 'w1',
    title: 'Update 1',
    body: 'The drowned quarter is walkable now.',
    entry_date: '2026-08-01',
    created_at: '2026-08-01T12:00:00.000Z',
    updated_at: '2026-08-01T12:00:00.000Z',
    ...over,
  });

  it('asks for the changelog as part of the listing, behind the opt-in flag', async () => {
    vi.mocked(fetch).mockResolvedValue(res({ data: { id: 'w1', changelog: [] } }));

    await WorldStorageService.fetchChangelog('w1');

    expect(vi.mocked(fetch).mock.calls[0][0]).toContain('/worlds/w1?includeChangelog=true');
  });

  it('hands back the entries in reading order', async () => {
    vi.mocked(fetch).mockResolvedValue(res({
      data: {
        id: 'w1',
        changelog: [entryRow({ id: 'old', entry_date: '2026-01-01' }), entryRow({ id: 'new', entry_date: '2026-08-01' })],
      },
    }));

    const entries = await WorldStorageService.fetchChangelog('w1');

    expect(entries?.map((e) => e.id)).toEqual(['new', 'old']);
  });

  it('answers null on a server whose listings carry no changelog field', async () => {
    // The whole of graceful degradation: an older community deploy answers the flag by ignoring it, and
    // every surface reading this hides itself rather than showing an empty tab.
    vi.mocked(fetch).mockResolvedValue(res({ data: { id: 'w1', name: 'Sedge Landing' } }));

    expect(await WorldStorageService.fetchChangelog('w1')).toBeNull();
  });

  it('tells an empty changelog apart from a server that has none', async () => {
    vi.mocked(fetch).mockResolvedValue(res({ data: { id: 'w1', changelog: [] } }));

    expect(await WorldStorageService.fetchChangelog('w1')).toEqual([]);
  });

  it('answers null rather than throwing when the request fails', async () => {
    vi.mocked(fetch).mockResolvedValue(res({ error: 'World not found' }, false, 404));

    expect(await WorldStorageService.fetchChangelog('w1')).toBeNull();
  });

  it('answers null when the network is gone', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('offline'));

    expect(await WorldStorageService.fetchChangelog('w1')).toBeNull();
  });

  it('posts a new entry with its fields trimmed', async () => {
    AuthService.token = 'tok';
    vi.mocked(fetch).mockResolvedValue(res({ data: entryRow() }, true, 201));

    const created = await WorldStorageService.createChangelogEntry('w1', {
      title: '  Update 1  ', body: '  Something changed.  ', date: '2026-08-01',
    });

    const [url, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/worlds/w1/changelog');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({
      title: 'Update 1', body: 'Something changed.', date: '2026-08-01',
    });
    expect(created.id).toBe('e1');
  });

  it('addresses an edit through the listing the entry belongs to', async () => {
    AuthService.token = 'tok';
    vi.mocked(fetch).mockResolvedValue(res({ data: entryRow({ title: 'New for v2' }) }));

    await WorldStorageService.updateChangelogEntry('w1', 'e1', {
      title: 'New for v2', body: 'Rewritten.', date: '2026-08-01',
    });

    const [url, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/worlds/w1/changelog/e1');
    expect(init.method).toBe('PUT');
  });

  it('raises the server refusal, so the popup can show it beside the field', async () => {
    AuthService.token = 'tok';
    vi.mocked(fetch).mockResolvedValue(res({ error: 'A changelog holds at most 100 entries.' }, false, 400));

    await expect(WorldStorageService.createChangelogEntry('w1', {
      title: 'Update 1', body: 'Something changed.', date: '2026-08-01',
    })).rejects.toThrow('A changelog holds at most 100 entries.');
  });

  it('makes no request at all when nobody is signed in', async () => {
    await expect(WorldStorageService.createChangelogEntry('w1', {
      title: 'Update 1', body: 'Something changed.', date: '2026-08-01',
    })).rejects.toThrow(/logged in/i);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('deletes an entry through its listing', async () => {
    AuthService.token = 'tok';
    vi.mocked(fetch).mockResolvedValue(res({ data: {} }));

    await WorldStorageService.deleteChangelogEntry('w1', 'e1');

    const [url, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/worlds/w1/changelog/e1');
    expect(init.method).toBe('DELETE');
  });
});

describe('fetchCatalog', () => {
  /** A response with headers, so the tag the server sets is readable the way a real one is. */
  const catalogRes = (body: unknown, status = 200, etag?: string): Response =>
    ({
      ok: status >= 200 && status < 300,
      status,
      headers: new Headers(etag ? { ETag: etag } : {}),
      json: async () => body,
    } as unknown as Response);

  it('sends no conditional header and no cache bypass without a tag', async () => {
    vi.mocked(fetch).mockResolvedValue(catalogRes({ data: [{ id: 'w1' }] }));

    await WorldStorageService.fetchCatalog();

    const [, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>)['If-None-Match']).toBeUndefined();
    expect(init.cache).toBeUndefined();
  });

  it('sends the tag and bypasses the browser cache, so a 304 reaches the app', async () => {
    vi.mocked(fetch).mockResolvedValue(catalogRes(null, 304));

    await WorldStorageService.fetchCatalog('W/"abc"');

    const [, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>)['If-None-Match']).toBe('W/"abc"');
    // Not 'reload': that sends Cache-Control: no-cache, which the server answers 200 to whatever the
    // tag says, so the conditional request would be off with nothing to show for it.
    expect(init.cache).toBe('no-store');
  });

  it('answers unchanged on a 304 rather than throwing', async () => {
    vi.mocked(fetch).mockResolvedValue(catalogRes(null, 304));

    expect(await WorldStorageService.fetchCatalog('W/"abc"')).toEqual({ status: 'unchanged' });
  });

  it('answers fresh with the rows and the tag the response carries', async () => {
    vi.mocked(fetch).mockResolvedValue(catalogRes({ data: [{ id: 'w1' }] }, 200, 'W/"new"'));

    expect(await WorldStorageService.fetchCatalog()).toEqual({
      status: 'fresh', data: [{ id: 'w1' }], tag: 'W/"new"',
    });
  });

  it('answers fresh with no tag when the server exposes none', async () => {
    vi.mocked(fetch).mockResolvedValue(catalogRes({ data: [{ id: 'w1' }] }));

    expect(await WorldStorageService.fetchCatalog()).toEqual({
      status: 'fresh', data: [{ id: 'w1' }], tag: null,
    });
  });

  it('asks for every kind in one request', async () => {
    vi.mocked(fetch).mockResolvedValue(catalogRes({ data: [] }));

    await WorldStorageService.fetchCatalog();

    const url = vi.mocked(fetch).mock.calls[0][0] as string;
    expect(url).toContain('limit=1000');
    expect(url).toContain('kind=all');
  });

  it('answers with the error rather than throwing when the request fails', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('offline'));

    expect(await WorldStorageService.fetchCatalog()).toEqual({ status: 'error', error: 'offline' });
  });
});
