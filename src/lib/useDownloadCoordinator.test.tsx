import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useState } from 'react';
import type { WorldRecord } from '@/components/WorldDetails';

import type { DependencyRow, InstalledSource } from '@/lib/worldDependencies';
import type { DownloadedListing } from '@/lib/librarySources';
import type { LibraryKind } from '@/lib/librarySources';
import type { LinkableContent } from '@/lib/linkedContent';

const storeWorld = vi.fn(async (_r: unknown) => {});
const getWorldData = vi.fn(async (_id: string): Promise<Record<string, unknown>> => ({}));
const libraryItems = vi.fn(async (_kind: LibraryKind): Promise<Record<string, unknown>[]> => []);
// Widened so individual tests can vary the world content they hand back (author, thumbnail, …).
type CatalogContent = {
  worldOverview?: { tags?: string[]; thumbnail?: string; author?: string };
  entities?: unknown[];
  dictionaries?: unknown[];
  /** An add-on's own content comes back through the same fetch, and names itself rather than a world. */
  name?: string;
};
const fetchCatalogContent = vi.fn(
  async (..._a: unknown[]): Promise<CatalogContent> => ({ worldOverview: { tags: ['t'], thumbnail: 'data:img' } }),
);
const fetchDependencies = vi.fn(async (_id: string): Promise<DependencyRow[]> => []);
const fetchDependencyContent = vi.fn(async (_w: string, id: string): Promise<unknown> => ({ name: `source ${id}` }));
const fetchAddons = vi.fn(async (_id: string): Promise<Record<string, unknown>[]> => []);
// The library write the coordinator drives, stubbed at the storage boundary so the run is the real one.
const saveDownloadToLibrary = vi.fn(
  async (_kind: LibraryKind, _content: LinkableContent, listing: DownloadedListing): Promise<InstalledSource> => ({
    sourceId: listing.sourceId,
    libraryId: `lib-${listing.sourceId}`,
    name: listing.name ?? 'Source',
    revision: 'R1',
  }),
);

vi.mock('@/services/WorldStorageService', () => ({
  default: {
    storeWorld: (r: unknown) => storeWorld(r),
    getWorldData: (id: string) => getWorldData(id),
    fetchDependencies: (id: string) => fetchDependencies(id),
    fetchDependencyContent: (w: string, id: string) => fetchDependencyContent(w, id),
    fetchAddons: (id: string) => fetchAddons(id),
    API_URL: 'http://x',
  },
}));
vi.mock('@/lib/fetchCatalogContent', () => ({ fetchCatalogContent: (...a: unknown[]) => fetchCatalogContent(...a) }));
vi.mock('@/lib/librarySources', () => ({
  saveDownloadToLibrary: (...a: Parameters<typeof saveDownloadToLibrary>) => saveDownloadToLibrary(...a),
  libraryItems: (kind: LibraryKind) => libraryItems(kind),
}));
vi.mock('@/lib/version', () => ({ migrateWorld: (w: unknown) => w }));
vi.mock('@/lib/uuid', () => ({ randomUUID: () => 'fixed' }));
vi.mock('react-toastify', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { toast } from 'react-toastify';
import { useDownloadCoordinator } from './useDownloadCoordinator';

// Drive the hook with a stateful `worlds` list so we can observe add vs replace.
const useHarness = (initial: WorldRecord[]) => {
  const [worlds, setWorlds] = useState<WorldRecord[]>(initial);
  const coord = useDownloadCoordinator(worlds, setWorlds);
  return { worlds, coord };
};

describe('useDownloadCoordinator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Re-stated rather than cleared: a persistent `mockResolvedValue` from one case would otherwise
    // decide what the next case's world requires.
    fetchCatalogContent.mockResolvedValue({ worldOverview: { tags: ['t'], thumbnail: 'data:img' } });
    fetchDependencies.mockResolvedValue([]);
    fetchDependencyContent.mockImplementation(async (_w, id) => ({ name: `source ${id}` }));
    fetchAddons.mockResolvedValue([]);
    getWorldData.mockResolvedValue({});
    libraryItems.mockResolvedValue([]);
  });

  const remote: WorldRecord = { _id: 'remote-1', name: 'Remote', updated_at: 'T2', author: { id: 'u-bob', username: 'bob' } };

  it('handleDownloadWorld appends a new local record (isLoading:false, fresh id)', async () => {
    const { result } = renderHook(() => useHarness([]));
    await act(async () => { await result.current.coord.handleDownloadWorld(remote); });

    await waitFor(() => expect(result.current.worlds).toHaveLength(1));
    const added = result.current.worlds[0];
    expect(added.id).toBe('downloaded-fixed');
    expect(added.sourceId).toBe('remote-1');
    expect(added.isLoading).toBe(false);
    expect(added.tags).toEqual(['t']);
    expect(storeWorld).toHaveBeenCalled();
  });

  it('remembers who published it, not just what they are called', async () => {
    // The author line on a local copy is free text somebody typed in the editor and names no account;
    // this is the one thing that can open the right profile.
    const { result } = renderHook(() => useHarness([]));
    await act(async () => { await result.current.coord.handleDownloadWorld(remote); });

    await waitFor(() => expect(result.current.worlds).toHaveLength(1));
    expect(result.current.worlds[0].sourceAuthorId).toBe('u-bob');
    expect(storeWorld).toHaveBeenCalledWith(expect.objectContaining({ sourceAuthorId: 'u-bob' }));
  });

  it('carries no publisher for a listing that names none', async () => {
    // A listing whose author has been deleted: the name is still shown, but there is nobody to open.
    const orphan: WorldRecord = { _id: 'remote-2', name: 'Orphan', updated_at: 'T2', author: { username: 'gone' } };
    const { result } = renderHook(() => useHarness([]));

    await act(async () => { await result.current.coord.handleDownloadWorld(orphan); });

    await waitFor(() => expect(result.current.worlds).toHaveLength(1));
    expect(result.current.worlds[0].sourceAuthorId).toBeUndefined();
  });

  // The stored world's own author line, as opposed to the catalog metadata alongside it.
  const storedAuthor = () =>
    (storeWorld.mock.calls.at(-1)?.[0] as { data: { worldOverview: { author?: string } } })
      .data.worldOverview.author;

  it('credits the uploader when the world names no author', async () => {
    // Somebody who published without filling the field in the editor still made the world.
    fetchCatalogContent.mockResolvedValueOnce({ worldOverview: { tags: ['t'], author: '   ' } });
    const { result } = renderHook(() => useHarness([]));

    await act(async () => { await result.current.coord.handleDownloadWorld(remote); });

    await waitFor(() => expect(result.current.worlds).toHaveLength(1));
    expect(storedAuthor()).toBe('bob');
  });

  it('leaves an authored name alone, even when it differs from the account', async () => {
    // A pen name is a deliberate choice; the account name must not overwrite it.
    fetchCatalogContent.mockResolvedValueOnce({ worldOverview: { tags: ['t'], author: 'The Cartographer' } });
    const { result } = renderHook(() => useHarness([]));

    await act(async () => { await result.current.coord.handleDownloadWorld(remote); });

    await waitFor(() => expect(result.current.worlds).toHaveLength(1));
    expect(storedAuthor()).toBe('The Cartographer');
  });

  it('leaves the author empty when the listing names no uploader either', async () => {
    // An anonymous upload has no name to borrow; inventing one would credit the wrong person.
    fetchCatalogContent.mockResolvedValueOnce({ worldOverview: { tags: ['t'], author: '' } });
    const anon: WorldRecord = { _id: 'remote-3', name: 'Anon', updated_at: 'T2' };
    const { result } = renderHook(() => useHarness([]));

    await act(async () => { await result.current.coord.handleDownloadWorld(anon); });

    await waitFor(() => expect(result.current.worlds).toHaveLength(1));
    expect(storedAuthor()).toBe('');
  });

  it('overwriteWorld replaces the existing copy in place (same id, no duplicate)', async () => {
    const existing: WorldRecord = { id: 'local-1', name: 'Old', sourceId: 'remote-1', isLoading: false };
    const { result } = renderHook(() => useHarness([existing]));
    // overwriteWorld isn't returned directly; reach it through the contextual-overwrite flow.
    await act(async () => {
      result.current.coord.handleContextualDownload(remote, 'update');
    });
    await act(async () => { result.current.coord.handleChooseOverwrite(); });

    await waitFor(() => expect(result.current.worlds[0].name).toBe('Remote'));
    expect(result.current.worlds).toHaveLength(1); // replaced, not appended
    expect(result.current.worlds[0].id).toBe('local-1'); // same id
    expect(result.current.worlds[0].sourceUpdatedAt).toBe('T2');
  });

  describe('required sources and add-ons', () => {
    /** A world whose only character follows the listing `dep-1`, as a published required copy does. */
    const worldWithCopy = (): CatalogContent => ({
      worldOverview: { tags: ['t'] },
      entities: [{ id: 'e1', name: 'Guide', link: { sourceId: 'dep-1', sourceName: 'Guide' } }],
      dictionaries: [],
    });

    const required = (id = 'dep-1'): DependencyRow[] => [
      { id, status: 'ok', listing: { _id: id, name: 'Guide', kind: 'entity', updated_at: 'T9', author: { id: 'u-1', username: 'ann' } } },
    ];

    /** The world content the last storeWorld call wrote. */
    const storedWorld = () =>
      (storeWorld.mock.calls.at(-1)?.[0] as { data: { entities: { link?: Record<string, string> }[] } }).data;

    it('installs a required source and points the world copy at the library item', async () => {
      fetchCatalogContent.mockResolvedValueOnce(worldWithCopy());
      fetchDependencies.mockResolvedValueOnce(required());
      const { result } = renderHook(() => useHarness([]));

      await act(async () => { await result.current.coord.handleDownloadWorld(remote); });

      await waitFor(() => expect(result.current.worlds).toHaveLength(1));
      expect(fetchDependencyContent).toHaveBeenCalledWith('remote-1', 'dep-1');
      expect(saveDownloadToLibrary).toHaveBeenCalledWith(
        'entity', expect.anything(), expect.objectContaining({ sourceId: 'dep-1', authorId: 'u-1' }),
      );
      // What makes the copy read as Linked in the editor: a library item behind the listing it names.
      expect(storedWorld().entities[0].link).toEqual({
        sourceId: 'dep-1', sourceName: 'Guide', libraryId: 'lib-dep-1', sourceRevision: 'R1',
      });
    });

    it('keeps the world pending when a required source fails, then a retry finishes it', async () => {
      fetchCatalogContent.mockResolvedValue(worldWithCopy());
      fetchDependencies.mockResolvedValue(required());
      fetchDependencyContent.mockRejectedValueOnce(new Error('Server said no'));
      const { result } = renderHook(() => useHarness([]));

      await act(async () => { await result.current.coord.handleDownloadWorld(remote); });

      await waitFor(() => expect(result.current.coord.pendingDownload).not.toBeNull());
      expect(result.current.coord.pendingDownload?.worldReady).toBe(false);
      expect(result.current.coord.pendingDownload?.failures)
        .toEqual([{ id: 'dep-1', name: 'Guide', message: 'Server said no' }]);
      expect(result.current.worlds).toHaveLength(0); // not presented as ready
      expect(storeWorld).not.toHaveBeenCalled();

      await act(async () => { result.current.coord.retryDownload(); });

      await waitFor(() => expect(result.current.worlds).toHaveLength(1));
      expect(result.current.coord.pendingDownload).toBeNull();
      // The world content was fetched once: the retry resumed the run rather than starting it again.
      expect(fetchCatalogContent).toHaveBeenCalledTimes(1);
    });

    it('does not download a required source the retry already installed', async () => {
      fetchCatalogContent.mockResolvedValue(worldWithCopy());
      fetchDependencies.mockResolvedValue([...required('dep-1'), ...required('dep-2')]);
      // The first source lands; the second refuses, so only the second is outstanding.
      fetchDependencyContent
        .mockResolvedValueOnce({ name: 'one' })
        .mockRejectedValueOnce(new Error('Server said no'));
      const { result } = renderHook(() => useHarness([]));

      await act(async () => { await result.current.coord.handleDownloadWorld(remote); });
      await waitFor(() => expect(result.current.coord.pendingDownload).not.toBeNull());
      fetchDependencyContent.mockClear();

      await act(async () => { result.current.coord.retryDownload(); });

      await waitFor(() => expect(result.current.worlds).toHaveLength(1));
      expect(fetchDependencyContent).toHaveBeenCalledTimes(1);
      expect(fetchDependencyContent).toHaveBeenCalledWith('remote-1', 'dep-2');
    });

    it('reports a required source the server can no longer resolve', async () => {
      fetchCatalogContent.mockResolvedValueOnce(worldWithCopy());
      fetchDependencies.mockResolvedValueOnce([{ id: 'dep-1', status: 'not_found' }]);
      const { result } = renderHook(() => useHarness([]));

      await act(async () => { await result.current.coord.handleDownloadWorld(remote); });

      await waitFor(() => expect(result.current.coord.pendingDownload).not.toBeNull());
      expect(result.current.coord.pendingDownload?.worldReady).toBe(false);
      expect(fetchDependencyContent).not.toHaveBeenCalled();
    });

    it('installs only the add-ons the player selected', async () => {
      fetchAddons.mockResolvedValue([
        { _id: 'add-1', name: 'Extra', kind: 'dictionary', reviewState: 'approved' },
        { _id: 'add-2', name: 'Other', kind: 'dictionary', reviewState: 'unreviewed' },
      ]);
      const { result } = renderHook(() => useHarness([]));

      await act(async () => {
        await result.current.coord.handleDownloadWorld(remote, { addons: [{ id: 'add-2', name: 'Other' }] });
      });

      await waitFor(() => expect(result.current.worlds).toHaveLength(1));
      const installed = saveDownloadToLibrary.mock.calls.map((call) => call[2].sourceId);
      expect(installed).toEqual(['add-2']);
    });

    it('leaves the world ready when an add-on fails, and retries that add-on alone', async () => {
      fetchAddons.mockResolvedValue([{ _id: 'add-1', name: 'Extra', kind: 'dictionary', reviewState: 'approved' }]);
      fetchCatalogContent
        .mockResolvedValueOnce({ worldOverview: { tags: ['t'] } })
        .mockRejectedValueOnce(new Error('Add-on refused'));
      const { result } = renderHook(() => useHarness([]));

      await act(async () => {
        await result.current.coord.handleDownloadWorld(remote, { addons: [{ id: 'add-1', name: 'Extra' }] });
      });

      await waitFor(() => expect(result.current.coord.pendingDownload).not.toBeNull());
      expect(result.current.worlds).toHaveLength(1); // the world is installed
      expect(result.current.coord.pendingDownload?.worldReady).toBe(true);
      expect(result.current.coord.pendingDownload?.failures)
        .toEqual([{ id: 'add-1', name: 'Extra', message: 'Add-on refused' }]);

      fetchCatalogContent.mockResolvedValueOnce({ name: 'Extra' });
      await act(async () => { result.current.coord.retryDownload(); });

      await waitFor(() => expect(result.current.coord.pendingDownload).toBeNull());
      // The world was stored once: the retry finished the add-on and left the world alone.
      expect(storeWorld).toHaveBeenCalledTimes(1);
      expect(saveDownloadToLibrary).toHaveBeenCalledWith('dictionary', expect.anything(), expect.objectContaining({ sourceId: 'add-1' }));
    });

    it('keeps the world pending when it cannot read what the world requires', async () => {
      // An unknown required set means the world may be incomplete. Installing it would present it as
      // finished when nothing is known about what it follows.
      fetchCatalogContent.mockResolvedValueOnce(worldWithCopy());
      fetchDependencies.mockRejectedValueOnce(new Error('Server said no'));
      const { result } = renderHook(() => useHarness([]));

      await act(async () => { await result.current.coord.handleDownloadWorld(remote); });

      await waitFor(() => expect(result.current.coord.pendingDownload).not.toBeNull());
      expect(result.current.coord.pendingDownload?.worldReady).toBe(false);
      expect(result.current.coord.pendingDownload?.failures[0].message).toBe('Server said no');
      expect(result.current.worlds).toHaveLength(0);
    });

    it('reports a refused add-on read rather than dropping the selection in silence', async () => {
      // Answering an empty list here would install the world, toast success, and lose every add-on the
      // player ticked with nothing on screen to say so.
      fetchAddons.mockRejectedValue(new Error('Server said no'));
      const { result } = renderHook(() => useHarness([]));

      await act(async () => {
        await result.current.coord.handleDownloadWorld(remote, { addons: [{ id: 'add-1', name: 'Extra' }] });
      });

      await waitFor(() => expect(result.current.coord.pendingDownload).not.toBeNull());
      expect(result.current.worlds).toHaveLength(1); // the world is installed
      expect(result.current.coord.pendingDownload?.worldReady).toBe(true);
      expect(result.current.coord.pendingDownload?.failures[0].message).toBe('Server said no');
      expect(saveDownloadToLibrary).not.toHaveBeenCalled();
    });

    it('reports an add-on the world stopped offering rather than dropping it', async () => {
      // Found in live use: the player ticks an add-on, and between the review and the press its author
      // unlists it or the world's author declines it. The world installs, the toast says success, and
      // the selection is gone with nothing on screen to say so.
      fetchAddons.mockResolvedValue([]);
      const { result } = renderHook(() => useHarness([]));

      await act(async () => {
        await result.current.coord.handleDownloadWorld(remote, { addons: [{ id: 'add-1', name: 'Extra' }] });
      });

      await waitFor(() => expect(result.current.coord.pendingDownload).not.toBeNull());
      expect(result.current.worlds).toHaveLength(1);
      expect(result.current.coord.pendingDownload?.failures).toEqual([
        { id: 'add-1', name: 'Extra', message: 'This world no longer offers this add-on.' },
      ]);
    });

    it('retries one add-on and keeps the others reported', async () => {
      fetchAddons.mockResolvedValue([
        { _id: 'add-1', name: 'Extra', kind: 'dictionary', reviewState: 'approved' },
        { _id: 'add-2', name: 'Other', kind: 'dictionary', reviewState: 'approved' },
      ]);
      fetchCatalogContent
        .mockResolvedValueOnce({ worldOverview: { tags: ['t'] } })
        .mockRejectedValueOnce(new Error('First refused'))
        .mockRejectedValueOnce(new Error('Second refused'));
      const { result } = renderHook(() => useHarness([]));

      await act(async () => {
        await result.current.coord.handleDownloadWorld(remote, { addons: [{ id: 'add-1', name: 'Extra' }, { id: 'add-2', name: 'Other' }] });
      });
      await waitFor(() => expect(result.current.coord.pendingDownload?.failures).toHaveLength(2));

      fetchCatalogContent.mockResolvedValueOnce({ name: 'Extra' });
      await act(async () => { result.current.coord.retryDownload('add-1'); });

      await waitFor(() => expect(result.current.coord.pendingDownload?.failures).toHaveLength(1));
      // The one left alone is still reported, with the reason it already had.
      expect(result.current.coord.pendingDownload?.failures)
        .toEqual([{ id: 'add-2', name: 'Other', message: 'Second refused' }]);
      expect(saveDownloadToLibrary).toHaveBeenCalledTimes(1);
      expect(saveDownloadToLibrary.mock.calls[0][2].sourceId).toBe('add-1');
    });

    it('carries the add-on selection through the copy-vs-overwrite decision', async () => {
      fetchAddons.mockResolvedValue([{ _id: 'add-1', name: 'Extra', kind: 'entity', reviewState: 'approved' }]);
      const existing: WorldRecord = { id: 'local-1', name: 'Old', sourceId: 'remote-1', isLoading: false };
      const { result } = renderHook(() => useHarness([existing]));

      await act(async () => {
        result.current.coord.handleContextualDownload(remote, 'update', { addons: [{ id: 'add-1', name: 'Extra' }] });
      });
      await act(async () => { result.current.coord.handleChooseOverwrite(); });

      await waitFor(() => expect(result.current.worlds[0].name).toBe('Remote'));
      expect(saveDownloadToLibrary).toHaveBeenCalledWith('entity', expect.anything(), expect.objectContaining({ sourceId: 'add-1' }));
    });
  });

  describe('updating an existing copy in place', () => {
    const existing: WorldRecord = { id: 'local-1', name: 'Sedge Landing', sourceId: 'remote-1', isLoading: false };

    // The stamps the review compares: the library holds T1 of each source, the listings now say T2.
    const T1 = '2026-09-01T00:00:00.000Z';
    const T2 = '2026-09-08T00:00:00.000Z';

    const requires = (id: string, name: string, updatedAt = T2): DependencyRow[] => [
      { id, status: 'ok', listing: { _id: id, name, kind: 'entity', updated_at: updatedAt } },
    ];

    /** The library item behind `dep-1`, held at the listing version `T1`. */
    const heldGuide = () => [{
      id: 'lib-dep-1', kind: 'entity', name: 'Guide', revision: 'R1', owned: false,
      sourceId: 'dep-1', sourceUpdatedAt: T1, authorLine: 'ann', sourceLine: 'Community Creations',
    }];

    /** The copy the player already has, with `edited` deciding whether it is a local replacement. */
    const installed = (edited: boolean) => ({
      entities: [{
        id: 'e-mine', name: 'Guide', aiDescription: edited ? 'My own guide.' : 'The guide as it arrived.',
        link: {
          libraryId: 'lib-dep-1', sourceId: 'dep-1', sourceName: 'Guide', sourceRevision: 'R1',
          ...(edited ? { localReplacement: true } : {}),
        },
      }],
      dictionaries: [],
      placeholders: [],
    });

    /** The author's republished world: their own version of the guide, plus a second required character. */
    const republished = (): CatalogContent => ({
      worldOverview: { tags: ['t'] },
      entities: [
        { id: 'e-theirs', name: 'Guide', aiDescription: 'The guide the author rewrote.', link: { sourceId: 'dep-1', sourceName: 'Guide' } },
        { id: 'e-new', name: 'Ferryman', link: { sourceId: 'dep-2', sourceName: 'Ferryman' } },
      ],
      dictionaries: [],
    });

    /** The content the last storeWorld call wrote. */
    const storedWorld = () => (storeWorld.mock.calls.at(-1)?.[0] as {
      data: { entities: { name: string; aiDescription?: string; link?: Record<string, unknown> }[] };
    }).data;

    const guideIn = (data: ReturnType<typeof storedWorld>) => data.entities.find((e) => e.name === 'Guide')!;

    type Coordinator = ReturnType<typeof useHarness>['coord'];

    /** Walk the contextual button through to the review the update opens. */
    const openReview = async (result: { current: { coord: Coordinator } }) => {
      await act(async () => { result.current.coord.handleContextualDownload(remote, 'update'); });
      await act(async () => { result.current.coord.handleChooseOverwrite(); });
      await waitFor(() => expect(result.current.coord.worldUpdateReview).not.toBeNull());
    };

    it('opens one review of the changed, new and dropped content, and writes nothing yet', async () => {
      getWorldData.mockResolvedValue(installed(true));
      fetchCatalogContent.mockResolvedValue(republished());
      // `dep-1` is still required and has moved; `dep-2` is new. Nothing dropped here.
      fetchDependencies.mockResolvedValue([...requires('dep-1', 'Guide'), ...requires('dep-2', 'Ferryman')]);
      libraryItems.mockImplementation(async (kind) => (kind === 'entity' ? heldGuide() : []));
      const { result } = renderHook(() => useHarness([existing]));

      await openReview(result);

      expect(result.current.coord.worldUpdateReview?.localName).toBe('Sedge Landing');
      expect(result.current.coord.worldUpdateReview?.rows).toEqual([
        expect.objectContaining({ sourceId: 'dep-1', rowKind: 'changed', state: 'local-replacement' }),
        expect.objectContaining({ sourceId: 'dep-2', rowKind: 'added', name: 'Ferryman' }),
      ]);
      // The review stands between the decision and the write: nothing is downloaded or stored.
      expect(storeWorld).not.toHaveBeenCalled();
      expect(saveDownloadToLibrary).not.toHaveBeenCalled();
    });

    it('keeps a local replacement through Apply and installs the new required source', async () => {
      getWorldData.mockResolvedValue(installed(true));
      fetchCatalogContent.mockResolvedValue(republished());
      fetchDependencies.mockResolvedValue([...requires('dep-1', 'Guide'), ...requires('dep-2', 'Ferryman')]);
      libraryItems.mockImplementation(async (kind) => (kind === 'entity' ? heldGuide() : []));
      const { result } = renderHook(() => useHarness([existing]));
      await openReview(result);

      // The defaults the rows imply: Keep Mine for the replacement, install for the new source.
      await act(async () => { result.current.coord.applyWorldUpdate({}); });

      await waitFor(() => expect(storeWorld).toHaveBeenCalled());
      expect(guideIn(storedWorld()).aiDescription).toBe('My own guide.');
      expect(guideIn(storedWorld()).link).toMatchObject({ localReplacement: true, reviewedRevision: 'R1' });
      // The new source is installed and the copy following it points at the library item.
      expect(saveDownloadToLibrary).toHaveBeenCalledWith(
        'entity', expect.anything(), expect.objectContaining({ sourceId: 'dep-2' }),
      );
      expect(storedWorld().entities.find((e) => e.name === 'Ferryman')?.link)
        .toMatchObject({ libraryId: 'lib-dep-2' });
      expect(result.current.worlds).toHaveLength(1);
    });

    it("takes the author's version when the player chooses Update", async () => {
      getWorldData.mockResolvedValue(installed(true));
      fetchCatalogContent.mockResolvedValue(republished());
      fetchDependencies.mockResolvedValue(requires('dep-1', 'Guide'));
      libraryItems.mockImplementation(async (kind) => (kind === 'entity' ? heldGuide() : []));
      const { result } = renderHook(() => useHarness([existing]));
      await openReview(result);

      await act(async () => { result.current.coord.applyWorldUpdate({ 'dep-1': 'update' }); });

      await waitFor(() => expect(storeWorld).toHaveBeenCalled());
      expect(guideIn(storedWorld()).aiDescription).toBe('The guide the author rewrote.');
    });

    it('turns a dropped requirement into an independent copy with its content intact', async () => {
      getWorldData.mockResolvedValue(installed(false));
      // The author still ships the guide, but embedded: publishing an unchecked source strips the record.
      fetchCatalogContent.mockResolvedValue({
        worldOverview: { tags: ['t'] },
        entities: [{ id: 'e-theirs', name: 'Guide', aiDescription: 'The guide the author rewrote.' }],
        dictionaries: [],
      });
      fetchDependencies.mockResolvedValue([]);
      libraryItems.mockImplementation(async (kind) => (kind === 'entity' ? heldGuide() : []));
      const { result } = renderHook(() => useHarness([existing]));
      await openReview(result);

      expect(result.current.coord.worldUpdateReview?.rows)
        .toEqual([expect.objectContaining({ sourceId: 'dep-1', rowKind: 'dropped' })]);

      await act(async () => { result.current.coord.applyWorldUpdate({}); });

      await waitFor(() => expect(storeWorld).toHaveBeenCalled());
      expect(storedWorld().entities).toHaveLength(1);
      expect(guideIn(storedWorld()).aiDescription).toBe('The guide as it arrived.');
      expect(guideIn(storedWorld()).link).toBeUndefined();
    });

    it('keeps a failed component on its previous content while the world updates, then retries it', async () => {
      getWorldData.mockResolvedValue(installed(false));
      fetchCatalogContent.mockResolvedValue(republished());
      fetchDependencies.mockResolvedValue([...requires('dep-1', 'Guide'), ...requires('dep-2', 'Ferryman')]);
      libraryItems.mockImplementation(async (kind) => (kind === 'entity' ? heldGuide() : []));
      // The guide's source refuses; the new one lands.
      fetchDependencyContent.mockImplementation(async (_w, id) => {
        if (id === 'dep-1') throw new Error('Server said no');
        return { name: `source ${id}` };
      });
      const { result } = renderHook(() => useHarness([existing]));
      await openReview(result);

      await act(async () => { result.current.coord.applyWorldUpdate({ 'dep-1': 'update' }); });

      await waitFor(() => expect(result.current.coord.pendingDownload).not.toBeNull());
      // The world is updated and the other component with it; only the guide is outstanding.
      expect(result.current.coord.pendingDownload?.worldReady).toBe(true);
      expect(result.current.coord.pendingDownload?.failures)
        .toEqual([{ id: 'dep-1', name: 'Guide', message: 'Server said no' }]);
      expect(guideIn(storedWorld()).aiDescription).toBe('The guide as it arrived.');
      expect(storedWorld().entities.find((e) => e.name === 'Ferryman')?.link)
        .toMatchObject({ libraryId: 'lib-dep-2' });

      fetchDependencyContent.mockImplementation(async (_w, id) => ({ name: `source ${id}` }));
      await act(async () => { result.current.coord.retryDownload('dep-1'); });

      await waitFor(() => expect(result.current.coord.pendingDownload).toBeNull());
      expect(guideIn(storedWorld()).aiDescription).toBe('The guide the author rewrote.');
      // The world content was fetched once: the retry resumed the run rather than starting it again.
      expect(fetchCatalogContent).toHaveBeenCalledTimes(1);
    });

    it('downloads a separate copy with no review at all', async () => {
      getWorldData.mockResolvedValue(installed(true));
      fetchCatalogContent.mockResolvedValue(republished());
      fetchDependencies.mockResolvedValue(requires('dep-1', 'Guide'));
      libraryItems.mockImplementation(async (kind) => (kind === 'entity' ? heldGuide() : []));
      const { result } = renderHook(() => useHarness([existing]));

      await act(async () => { result.current.coord.handleContextualDownload(remote, 'update'); });
      await act(async () => { await result.current.coord.handleDownloadWorld(remote); });

      expect(result.current.coord.worldUpdateReview).toBeNull();
      expect(getWorldData).not.toHaveBeenCalled();
      // A fresh world beside the one they had, with the listing's current required set installed.
      await waitFor(() => expect(result.current.worlds).toHaveLength(2));
      expect(saveDownloadToLibrary).toHaveBeenCalledWith(
        'entity', expect.anything(), expect.objectContaining({ sourceId: 'dep-1' }),
      );
    });

    it('writes nothing when it cannot read what the update would change', async () => {
      getWorldData.mockResolvedValue(installed(true));
      fetchDependencies.mockRejectedValue(new Error('Server said no'));
      const { result } = renderHook(() => useHarness([existing]));

      await act(async () => { result.current.coord.handleContextualDownload(remote, 'update'); });
      await act(async () => { result.current.coord.handleChooseOverwrite(); });

      await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Server said no'));
      expect(result.current.coord.worldUpdateReview).toBeNull();
      expect(storeWorld).not.toHaveBeenCalled();
    });
  });
});
