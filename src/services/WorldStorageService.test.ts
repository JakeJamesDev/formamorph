// Must load before importing the service: its singleton constructor opens IndexedDB.
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import WorldStorageService, { type StoredWorldRecord } from './WorldStorageService';
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
});
