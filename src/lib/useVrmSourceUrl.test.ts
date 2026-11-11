// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

// Mock the two dependencies so the hook can run without a real provider or IndexedDB.
const getModelData = vi.fn();
vi.mock('@/services/ModelStorageService', () => ({ default: { getModelData: (id: string) => getModelData(id) } }));
let storeVrm: string | undefined;
vi.mock('@/contexts/GameDataContext', () => ({
  useGameData: () => ({
    worldOverview: { vrmStore: storeVrm ? { wren: { name: 'Wren', file: { data: storeVrm, type: 'model/vrm' } } } : undefined },
  }),
}));

import { useVrmSourceUrl } from './useVrmSourceUrl';

beforeEach(() => {
  getModelData.mockReset();
  storeVrm = undefined;
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:model');
});

describe('useVrmSourceUrl', () => {
  it('resolves a library id: resolving true while fetching, then false with the blob URL', async () => {
    let resolve!: (v: { blob: Blob }) => void;
    getModelData.mockReturnValue(new Promise((r) => { resolve = r; }));

    const { result } = renderHook(() => useVrmSourceUrl({ kind: 'library', id: 'lib-123' }));
    expect(result.current.resolving).toBe(true); // holds the loader while fetching
    expect(result.current.url).toBeUndefined();

    resolve({ blob: new Blob() });
    await waitFor(() => expect(result.current.resolving).toBe(false));
    expect(result.current.url).toBe('blob:model');
  });

  it('clears resolving with no URL when the model fails to load, so no Avatar shows and no loader spins', async () => {
    getModelData.mockRejectedValue(new Error('not found'));

    const { result } = renderHook(() => useVrmSourceUrl({ kind: 'library', id: 'deleted-id' }));
    await waitFor(() => expect(result.current.resolving).toBe(false));
    expect(result.current.url).toBeUndefined();
  });

  it('holds resolving without a fetch while the library list is pending', () => {
    const pending = renderHook(() => useVrmSourceUrl({ kind: 'pending' }));
    expect(pending.result.current).toEqual({ url: undefined, resolving: true });
  });

  it('never fetches for no source', () => {
    const none = renderHook(() => useVrmSourceUrl(undefined));
    expect(none.result.current).toEqual({ url: undefined, resolving: false });
    expect(getModelData).not.toHaveBeenCalled();
  });

  it("returns a store entry's embedded file without resolving", () => {
    storeVrm = 'data:model/world';
    const { result } = renderHook(() => useVrmSourceUrl({ kind: 'world', id: 'wren' }));
    expect(result.current).toEqual({ url: 'data:model/world', resolving: false });
  });
});
