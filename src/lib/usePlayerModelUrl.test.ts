import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

// Mock the two dependencies so the hook can run without a real provider or IndexedDB.
const getModelData = vi.fn();
vi.mock('@/services/ModelStorageService', () => ({ default: { getModelData: (id: string) => getModelData(id) } }));
let worldVrm: string | undefined;
vi.mock('@/contexts/GameDataContext', () => ({
  useGameData: () => ({ worldOverview: { customPlayerVRM: worldVrm ? { data: worldVrm } : undefined } }),
}));

import { usePlayerModelUrl } from './usePlayerModelUrl';

beforeEach(() => {
  getModelData.mockReset();
  worldVrm = undefined;
  vi.stubGlobal('URL', { createObjectURL: () => 'blob:model', revokeObjectURL: () => {} });
});

describe('usePlayerModelUrl', () => {
  it('resolves a library id: resolving true while fetching, then false with the blob URL', async () => {
    let resolve!: (v: { blob: Blob }) => void;
    getModelData.mockReturnValue(new Promise((r) => { resolve = r; }));

    const { result } = renderHook(() => usePlayerModelUrl('lib-123'));
    expect(result.current.resolving).toBe(true); // holds the loader while fetching
    expect(result.current.url).toBeUndefined();

    resolve({ blob: new Blob() });
    await waitFor(() => expect(result.current.resolving).toBe(false));
    expect(result.current.url).toBe('blob:model');
  });

  it('clears resolving even when the model is missing (deleted → falls back to default, no infinite loader)', async () => {
    getModelData.mockRejectedValue(new Error('not found'));

    const { result } = renderHook(() => usePlayerModelUrl('deleted-id'));
    await waitFor(() => expect(result.current.resolving).toBe(false));
    expect(result.current.url).toBeUndefined(); // fall back to the bundled default
  });

  it('never fetches or resolves for the default sentinel or an unset id', () => {
    const dflt = renderHook(() => usePlayerModelUrl('default'));
    expect(dflt.result.current).toEqual({ url: undefined, resolving: false });

    const unset = renderHook(() => usePlayerModelUrl(undefined));
    expect(unset.result.current.resolving).toBe(false);
    expect(getModelData).not.toHaveBeenCalled();
  });

  it("returns the world's custom VRM for an unset id without resolving", () => {
    worldVrm = 'data:model/world';
    const { result } = renderHook(() => usePlayerModelUrl('world'));
    expect(result.current).toEqual({ url: 'data:model/world', resolving: false });
  });
});
