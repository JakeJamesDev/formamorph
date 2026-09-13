import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import type { DependencyRow } from '@/lib/worldDependencies';

const fetchDependencies = vi.fn(async (_id: string): Promise<DependencyRow[]> => []);
const fetchAddons = vi.fn(async (_id: string): Promise<Record<string, unknown>[]> => []);

vi.mock('@/services/WorldStorageService', () => ({
  default: {
    fetchDependencies: (id: string) => fetchDependencies(id),
    fetchAddons: (id: string) => fetchAddons(id),
  },
}));

import { useWorldDownloadPlan } from './useWorldDownloadPlan';

const world = { _id: 'w-1', name: 'A World', kind: 'world' };
const required: DependencyRow[] = [
  { id: 'r1', status: 'ok', listing: { _id: 'r1', name: 'Shared Lore', kind: 'dictionary' } },
];
const offered = [
  { _id: 'a1', name: 'Blessed', kind: 'entity', reviewState: 'approved' },
  { _id: 'a2', name: 'Wild', kind: 'entity' },
  { _id: 'a3', name: 'Turned Away', kind: 'entity', reviewState: 'declined' },
];

describe('useWorldDownloadPlan', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    fetchDependencies.mockResolvedValue(required);
    fetchAddons.mockResolvedValue(offered);
  });

  it('reads both routes for the open listing and splits the offerings', async () => {
    const { result } = renderHook(() => useWorldDownloadPlan(world, true));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(fetchDependencies).toHaveBeenCalledWith('w-1');
    expect(result.current.dependencies).toEqual(required);
    expect(result.current.tabs.approved.map((a) => a._id)).toEqual(['a1']);
    expect(result.current.tabs.community.map((a) => a._id)).toEqual(['a2']);
    expect(result.current.hasLinkedContent).toBe(true);
  });

  it('reads nothing while the listing is closed', () => {
    renderHook(() => useWorldDownloadPlan(world, false));
    expect(fetchDependencies).not.toHaveBeenCalled();
    expect(fetchAddons).not.toHaveBeenCalled();
  });

  it('reads nothing for a listing that is not a world', () => {
    // A character listing has no required set and is not offered add-ons of its own.
    renderHook(() => useWorldDownloadPlan({ _id: 'e-1', kind: 'entity' }, true));
    expect(fetchDependencies).not.toHaveBeenCalled();
  });

  it('keeps the required list when the add-on route refuses', async () => {
    // One route failing must not blank the other's tab.
    fetchAddons.mockRejectedValue(new Error('Server said no'));
    const { result } = renderHook(() => useWorldDownloadPlan(world, true));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.dependencies).toEqual(required);
    expect(result.current.tabs.approved).toEqual([]);
  });

  it('counts the required sources plus the add-ons the player ticks', async () => {
    const { result } = renderHook(() => useWorldDownloadPlan(world, true));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.count).toBe(1);

    act(() => result.current.toggle({ id: 'a1', name: 'Blessed' }, true));
    expect(result.current.count).toBe(2);
    expect(result.current.plan.addons).toEqual([{ id: 'a1', name: 'Blessed' }]);

    act(() => result.current.toggle({ id: 'a1', name: 'Blessed' }, false));
    expect(result.current.count).toBe(1);
    expect(result.current.plan.addons).toEqual([]);
  });

  it('does not count a required source the server could not resolve', async () => {
    // Counting it would promise an install the download cannot complete.
    fetchDependencies.mockResolvedValue([...required, { id: 'gone', status: 'not_found' }]);
    const { result } = renderHook(() => useWorldDownloadPlan(world, true));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.dependencies).toHaveLength(2);
    expect(result.current.count).toBe(1);
  });

  it('drops the selection when the player opens a different listing', async () => {
    const { result, rerender } = renderHook(({ w }) => useWorldDownloadPlan(w, true), {
      initialProps: { w: world },
    });
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => result.current.toggle({ id: 'a1', name: 'Blessed' }, true));
    expect(result.current.plan.addons).toEqual([{ id: 'a1', name: 'Blessed' }]);

    rerender({ w: { _id: 'w-2', name: 'Another', kind: 'world' } });

    expect(result.current.plan.addons).toEqual([]);
    await waitFor(() => expect(fetchDependencies).toHaveBeenCalledWith('w-2'));
  });
});
