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
  vi.stubGlobal('URL', { createObjectURL: () => 'blob:model', revokeObjectURL: () => {} });
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

  it('clears resolving even when the model is missing (deleted → falls back to default, no infinite loader)', async () => {
    getModelData.mockRejectedValue(new Error('not found'));

    const { result } = renderHook(() => useVrmSourceUrl({ kind: 'library', id: 'deleted-id' }));
    await waitFor(() => expect(result.current.resolving).toBe(false));
    expect(result.current.url).toBeUndefined(); // fall back to the bundled default
  });

  it('never fetches for the bundled file or no source', () => {
    const bundled = renderHook(() => useVrmSourceUrl({ kind: 'bundled' }));
    expect(bundled.result.current).toEqual({ url: undefined, resolving: false });

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
