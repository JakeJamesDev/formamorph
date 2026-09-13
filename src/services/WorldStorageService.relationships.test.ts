// Must load before the service singleton, whose first use opens IndexedDB.
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import WorldStorageService from './WorldStorageService';

vi.mock('./AuthService', () => ({
  default: { isAuthenticated: () => true, token: 'a-token' },
}));

/** One fetch answer, in the shape the server sends. */
const answer = (status: number, body: unknown) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
});

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => vi.unstubAllGlobals());

describe('fetchDependencies', () => {
  it('answers the rows the server resolved, with the reader\'s own token', async () => {
    const dependencies = [{ id: 'r1', status: 'ok', listing: { _id: 'r1', name: 'Lore' } }];
    fetchMock.mockResolvedValue(answer(200, { success: true, data: { dependencies } }));

    expect(await WorldStorageService.fetchDependencies('w-1')).toEqual(dependencies);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/worlds/w-1/dependencies'),
      { headers: { Authorization: 'Bearer a-token' } },
    );
  });

  it('answers nothing against a server that predates the route', async () => {
    // A 404 here is a server with no relationships to report, which is what it said before they existed.
    fetchMock.mockResolvedValue(answer(404, {}));
    expect(await WorldStorageService.fetchDependencies('w-1')).toEqual([]);
  });

  it('throws on any other refusal rather than reading as a world that requires nothing', async () => {
    // Answering [] here would install a world with nothing following anything and call it finished.
    fetchMock.mockResolvedValue(answer(500, { error: 'Server said no' }));
    await expect(WorldStorageService.fetchDependencies('w-1')).rejects.toThrow('Server said no');
  });
});

describe('fetchAddons', () => {
  it('answers the offerings the server returned', async () => {
    const addons = [{ _id: 'a1', name: 'Extra', reviewState: 'approved' }];
    fetchMock.mockResolvedValue(answer(200, { success: true, data: addons }));
    expect(await WorldStorageService.fetchAddons('w-1')).toEqual(addons);
  });

  it('answers nothing against a server that predates the route', async () => {
    fetchMock.mockResolvedValue(answer(404, {}));
    expect(await WorldStorageService.fetchAddons('w-1')).toEqual([]);
  });

  it('throws on any other refusal rather than dropping the player\'s selections', async () => {
    // A download re-reads this to resolve what the player ticked. An empty answer would install the
    // world, report success, and lose every selected add-on with nothing on screen to say so.
    fetchMock.mockResolvedValue(answer(500, { error: 'Server said no' }));
    await expect(WorldStorageService.fetchAddons('w-1')).rejects.toThrow('Server said no');
  });
});

describe('fetchDependencyContent', () => {
  it('unwraps the content the route answers with', async () => {
    fetchMock.mockResolvedValue(answer(200, { success: true, data: { contentData: { name: 'Sedge' } } }));
    expect(await WorldStorageService.fetchDependencyContent('w-1', 'r1')).toEqual({ name: 'Sedge' });
  });

  it('throws when the source is gone, 404 included', async () => {
    // Unlike the two list routes, a missing source here is a real failure: the download asked for one
    // named thing and did not get it.
    fetchMock.mockResolvedValue(answer(404, {}));
    await expect(WorldStorageService.fetchDependencyContent('w-1', 'r1'))
      .rejects.toThrow('Failed to download this source');
  });
});
