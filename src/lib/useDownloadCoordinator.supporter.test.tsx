import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useState } from 'react';
import type { WorldRecord } from '@/components/WorldDetails';
import type { DependencyRow, InstalledSource } from '@/lib/worldDependencies';
import type { LibraryKind } from '@/lib/librarySources';

const SCRAMBLED = { dataUrl: 'data:image/png;base64,SCRAMBLED', seed: 7, version: 1, sourceWidth: 8, sourceHeight: 8 };
const AUDIO = 'data:audio/mpeg;base64,QUJD';

const storeWorld = vi.fn(async (_r: unknown) => {});
const fetchWorld = vi.fn();
const fetchCatalogContent = vi.fn(async (..._a: unknown[]): Promise<unknown> => ({ worldOverview: { tags: [] } }));
const fetchDependencies = vi.fn(async (_id: string): Promise<DependencyRow[]> => []);
const fetchDependencyContent = vi.fn(async (_w: string, id: string): Promise<unknown> => ({ name: `source ${id}` }));
const fetchAddons = vi.fn(async (_id: string): Promise<Record<string, unknown>[]> => []);
const saveDownloadToLibrary = vi.fn(
  async (_kind: LibraryKind, _content: unknown, listing: { sourceId: string; name?: string }): Promise<InstalledSource> => ({
    sourceId: listing.sourceId, libraryId: `lib-${listing.sourceId}`, name: listing.name ?? 'Source', revision: 'R1',
  }),
);

vi.mock('@/services/WorldStorageService', () => ({
  default: {
    storeWorld: (r: unknown) => storeWorld(r),
    getWorldData: async () => ({}),
    fetchDependencies: (id: string) => fetchDependencies(id),
    fetchDependencyContent: (w: string, id: string) => fetchDependencyContent(w, id),
    fetchAddons: (id: string) => fetchAddons(id),
    API_URL: 'http://x',
  },
}));
vi.mock('@/lib/fetchCatalogContent', () => ({ fetchCatalogContent: (...a: unknown[]) => fetchCatalogContent(...a) }));
vi.mock('@/lib/librarySources', () => ({
  saveDownloadToLibrary: (...a: Parameters<typeof saveDownloadToLibrary>) => saveDownloadToLibrary(...a),
  libraryItems: async () => [],
}));
vi.mock('@/lib/version', () => ({ migrateWorld: (w: unknown) => w }));
vi.mock('@/lib/uuid', () => ({ randomUUID: () => 'fixed' }));
vi.mock('react-toastify', () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));
// The real walk, with a stand-in for the canvas, which jsdom does not have.
vi.mock('@/lib/supporterContent', async () => {
  const actual = await vi.importActual<typeof import('@/lib/supporterContent/worldContent')>('@/lib/supporterContent/worldContent');
  return {
    supporterContent: { fetchWorld: (id: string) => fetchWorld(id) },
    unscrambleWorldContent: (content: unknown) => actual.unscrambleWorldContent(content, async (layer) => `data:image/png;base64,PLAIN${layer.seed}`),
  };
});

import { toast } from 'react-toastify';
import { toastTexts } from '@/test/toastText';
import { useDownloadCoordinator } from './useDownloadCoordinator';
import type { World } from '@/types';

const useHarness = (initial: WorldRecord[], onStored?: (id: string, data: World, p: (f: number) => void) => Promise<World | null>) => {
  const [worlds, setWorlds] = useState<WorldRecord[]>(initial);
  const coord = useDownloadCoordinator(worlds, setWorlds, onStored);
  return { worlds, coord };
};

const listing: WorldRecord = {
  _id: 'sw-1', name: 'Supporter World', updated_at: 'T2', supporter_only: true, author: { id: 'u-bob', username: 'bob' },
} as WorldRecord;

const sent = (revision: number, accountId = 'acct-1') => ({
  accountId,
  revision,
  contentData: {
    worldOverview: { tags: ['t'], thumbnail: SCRAMBLED },
    entities: [{ id: 'e1', images: [SCRAMBLED, { ...SCRAMBLED, seed: 9 }], voice: AUDIO, note: 'plain text' }],
  },
});

const stored = () => storeWorld.mock.calls.at(-1)?.[0] as Record<string, unknown> & { data: Record<string, unknown> };

describe('downloading a Supporter-only world', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchWorld.mockResolvedValue(sent(3));
    fetchDependencies.mockResolvedValue([]);
    fetchAddons.mockResolvedValue([]);
  });

  it('stores plain images, untouched media and the marker, fetched through the gated route', async () => {
    const { result } = renderHook(() => useHarness([]));
    await act(async () => { await result.current.coord.handleContextualDownload(listing, 'none'); });

    await waitFor(() => expect(result.current.worlds).toHaveLength(1));
    expect(fetchWorld).toHaveBeenCalledWith('sw-1');
    expect(fetchCatalogContent).not.toHaveBeenCalled();
    const record = stored();
    expect(record.supporterCopy).toEqual({ listingId: 'sw-1', accountId: 'acct-1', revision: 3 });
    expect(record.sourceId).toBe('sw-1');
    expect(record.data.entities).toEqual([
      { id: 'e1', images: ['data:image/png;base64,PLAIN7', 'data:image/png;base64,PLAIN9'], voice: AUDIO, note: 'plain text' },
    ]);
    expect((record.data.worldOverview as { thumbnail: string }).thumbnail).toBe('data:image/png;base64,PLAIN7');
  });

  it('leaves the downscale offer out, since re-encoding would damage the watermark', async () => {
    const onStored = vi.fn(async () => null);
    const { result } = renderHook(() => useHarness([], onStored));
    await act(async () => { await result.current.coord.handleContextualDownload(listing, 'none'); });

    await waitFor(() => expect(result.current.worlds).toHaveLength(1));
    expect(onStored).not.toHaveBeenCalled();
  });

  it('gives a normal listing no marker and keeps the downscale offer', async () => {
    const onStored = vi.fn(async () => null);
    const plain = { _id: 'pw-1', name: 'Plain', updated_at: 'T2', author: { id: 'u-bob', username: 'bob' } } as WorldRecord;
    const { result } = renderHook(() => useHarness([], onStored));
    await act(async () => { await result.current.coord.handleContextualDownload(plain, 'none'); });

    await waitFor(() => expect(result.current.worlds).toHaveLength(1));
    expect(fetchWorld).not.toHaveBeenCalled();
    expect(stored()).not.toHaveProperty('supporterCopy');
    expect(onStored).toHaveBeenCalled();
  });

  it('stores nothing when the gated route refuses', async () => {
    fetchWorld.mockRejectedValue(new Error('This account cannot install that Supporter content'));
    const { result } = renderHook(() => useHarness([]));
    await act(async () => { await result.current.coord.handleContextualDownload(listing, 'none'); });

    expect(storeWorld).not.toHaveBeenCalled();
    expect(result.current.worlds).toHaveLength(0);
  });

  it('updates the existing copy in place without offering a second copy, and keeps the marker', async () => {
    fetchWorld.mockResolvedValue(sent(4));
    const held = {
      id: 'local-1', name: 'Supporter World', sourceId: 'sw-1', sourceUpdatedAt: 'T1',
      supporterCopy: { listingId: 'sw-1', accountId: 'acct-1', revision: 3 },
    } as WorldRecord;
    const { result } = renderHook(() => useHarness([held]));
    await act(async () => { result.current.coord.handleContextualDownload(listing, 'update'); });

    await waitFor(() => expect(storeWorld).toHaveBeenCalled());
    expect(result.current.coord.contextualAction).toBeNull();
    expect(stored().id).toBe('local-1');
    expect(stored().supporterCopy).toEqual({ listingId: 'sw-1', accountId: 'acct-1', revision: 4 });
    expect(result.current.worlds).toHaveLength(1);
  });

  it('makes a second, marked world when only a plain copy is held, and leaves the plain copy unmarked', async () => {
    const plainCopy = { id: 'local-plain', name: 'Supporter World', sourceId: 'sw-1', sourceUpdatedAt: 'T1' } as WorldRecord;
    const { result } = renderHook(() => useHarness([plainCopy]));
    await act(async () => { await result.current.coord.handleContextualDownload(listing, 'update'); });

    await waitFor(() => expect(storeWorld).toHaveBeenCalled());
    expect(stored().id).not.toBe('local-plain');
    expect(stored().supporterCopy).toEqual({ listingId: 'sw-1', accountId: 'acct-1', revision: 3 });
    await waitFor(() => expect(result.current.worlds).toHaveLength(2));
    expect(result.current.worlds.find((w) => w.id === 'local-plain')).not.toHaveProperty('supporterCopy');
  });

  it('overwrites the Supporter Copy, not the plain copy, when both are held', async () => {
    const plainCopy = { id: 'local-plain', name: 'Supporter World', sourceId: 'sw-1', sourceUpdatedAt: 'T1' } as WorldRecord;
    const marked = {
      id: 'local-marked', name: 'Supporter World', sourceId: 'sw-1', sourceUpdatedAt: 'T1',
      supporterCopy: { listingId: 'sw-1', accountId: 'acct-1', revision: 3 },
    } as WorldRecord;
    const { result } = renderHook(() => useHarness([plainCopy, marked]));
    await act(async () => { await result.current.coord.handleContextualDownload(listing, 'update'); });

    await waitFor(() => expect(storeWorld).toHaveBeenCalled());
    expect(stored().id).toBe('local-marked');
    expect(result.current.coord.showOverwriteSelect).toBe(false);
  });

  it('offers only the Supporter Copies, never a plain copy, when two Supporter Copies are held', async () => {
    const plainCopy = { id: 'local-plain', name: 'Supporter World', sourceId: 'sw-1', sourceUpdatedAt: 'T1' } as WorldRecord;
    const markedFor = (id: string, accountId: string) => ({
      id, name: 'Supporter World', sourceId: 'sw-1', sourceUpdatedAt: 'T1',
      supporterCopy: { listingId: 'sw-1', accountId, revision: 3 },
    } as WorldRecord);
    const { result } = renderHook(() => useHarness([plainCopy, markedFor('local-a', 'acct-1'), markedFor('local-b', 'acct-2')]));
    await act(async () => { await result.current.coord.handleContextualDownload(listing, 'update'); });

    expect(result.current.coord.showOverwriteSelect).toBe(true);
    expect(result.current.coord.overwriteCopiesForWorld(listing).map((w) => w.id)).toEqual(['local-a', 'local-b']);
    expect(result.current.coord.overwriteSelectedId).not.toBe('local-plain');
    expect(storeWorld).not.toHaveBeenCalled();
  });

  it('still offers every copy of a listing that is not Supporter-only', () => {
    const plain = { _id: 'pw-1', name: 'Plain', updated_at: 'T2', author: { id: 'u-bob', username: 'bob' } } as WorldRecord;
    const copy = (id: string) => ({ id, name: 'Plain', sourceId: 'pw-1', sourceUpdatedAt: 'T1' } as WorldRecord);
    const { result } = renderHook(() => useHarness([copy('p-1'), copy('p-2')]));
    expect(result.current.coord.overwriteCopiesForWorld(plain).map((w) => w.id)).toEqual(['p-1', 'p-2']);
  });

  it('still fetches a Supporter-only required source for a world that is not Supporter-only', async () => {
    fetchDependencies.mockResolvedValue([
      { id: 'd-locked', status: 'ok', listing: { _id: 'd-locked', name: 'Locked Cast', kind: 'entity', supporter_only: true } as WorldRecord },
    ]);
    const plain = { _id: 'pw-1', name: 'Plain', updated_at: 'T2', author: { id: 'u-bob', username: 'bob' } } as WorldRecord;
    const { result } = renderHook(() => useHarness([]));
    await act(async () => { await result.current.coord.handleContextualDownload(plain, 'none'); });

    await waitFor(() => expect(fetchDependencyContent).toHaveBeenCalledWith('pw-1', 'd-locked'));
    expect(toast.warning).not.toHaveBeenCalled();
  });

  it('leaves out a required source that is itself Supporter-only, installs the public one, and names it', async () => {
    fetchDependencies.mockResolvedValue([
      { id: 'd-open', status: 'ok', listing: { _id: 'd-open', name: 'Open Cast', kind: 'entity', updated_at: 'T1' } as WorldRecord },
      { id: 'd-locked', status: 'ok', listing: { _id: 'd-locked', name: 'Locked Cast', kind: 'entity', supporter_only: true } as WorldRecord },
    ]);
    const { result } = renderHook(() => useHarness([]));
    await act(async () => { await result.current.coord.handleContextualDownload(listing, 'none'); });

    await waitFor(() => expect(result.current.worlds).toHaveLength(1));
    expect(fetchDependencyContent).toHaveBeenCalledTimes(1);
    expect(fetchDependencyContent).toHaveBeenCalledWith('sw-1', 'd-open');
    expect(result.current.coord.pendingDownload).toBeNull();
    expect(toastTexts(vi.mocked(toast.warning)).join(' ')).toContain('Locked Cast');
  });
});
