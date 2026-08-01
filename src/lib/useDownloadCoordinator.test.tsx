import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useState } from 'react';
import type { WorldRecord } from '@/components/WorldDetails';

const storeWorld = vi.fn(async (_r: unknown) => {});
const fetchCatalogContent = vi.fn(async (..._a: unknown[]) => ({ worldOverview: { tags: ['t'], thumbnail: 'data:img' } }));

vi.mock('@/services/WorldStorageService', () => ({
  default: { storeWorld: (r: unknown) => storeWorld(r), API_URL: 'http://x' },
}));
vi.mock('@/lib/fetchCatalogContent', () => ({ fetchCatalogContent: (...a: unknown[]) => fetchCatalogContent(...a) }));
vi.mock('@/lib/version', () => ({ migrateWorld: (w: unknown) => w }));
vi.mock('@/lib/uuid', () => ({ randomUUID: () => 'fixed' }));
vi.mock('react-toastify', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { useDownloadCoordinator } from './useDownloadCoordinator';

// Drive the hook with a stateful `worlds` list so we can observe add vs replace.
const useHarness = (initial: WorldRecord[]) => {
  const [worlds, setWorlds] = useState<WorldRecord[]>(initial);
  const coord = useDownloadCoordinator(worlds, setWorlds);
  return { worlds, coord };
};

describe('useDownloadCoordinator', () => {
  beforeEach(() => vi.clearAllMocks());

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
});
