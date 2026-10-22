import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { ReactNode } from 'react';
import { GameDataProvider, useGameData } from './GameDataContext';
import type { Stat, World } from '@/types';

// The provider initializes IndexedDB storage on mount; stub it out so these tests exercise only the store.
vi.mock('../services/WorldStorageService', () => ({
  default: { initialize: vi.fn(), getWorldMetadata: vi.fn().mockResolvedValue([]) },
}));

const world = (id: string): World => ({
  id,
  worldOverview: {
    name: id, description: '', author: '', thumbnail: null, bgm: null, systemPrompt: '', tags: [],
  },
  stats: [], locations: [], entities: [], traits: [], statUpdates: [],
} as unknown as World);

const wrapper = ({ children }: { children: ReactNode }) => <GameDataProvider>{children}</GameDataProvider>;

const body = { id: 'g-body', name: 'Body', aiDescription: 'What the body can take.', parentId: null, order: 0 };
const inner = { id: 'g-inner', name: 'Reflexes', parentId: 'g-body', order: 0 };
const stat = (id: string, name: string, extra: Partial<Stat> = {}): Stat => ({
  id, name, type: 'number', description: '', min: 0, max: 10, value: 4, regen: 0, descriptors: [], ...extra,
});

describe('stat groups in the world store', () => {
  it('fills a world that has no stat groups with an empty list, and opens it clean', () => {
    const { result } = renderHook(() => useGameData(), { wrapper });
    act(() => { result.current.loadWorldData(world('w')); });
    expect(result.current.statGroups).toEqual([]);
    expect(result.current.getWorldData().statGroups).toEqual([]);
    expect(result.current.isWorldDirty).toBe(false);
  });

  it('fills a world whose stat groups are not a list', () => {
    const { result } = renderHook(() => useGameData(), { wrapper });
    act(() => { result.current.loadWorldData({ ...world('w'), statGroups: 'nope' } as unknown as World); });
    expect(result.current.statGroups).toEqual([]);
  });

  it('writes stat groups, and each stat\'s place in them, into the exported world and loads them whole', () => {
    const { result } = renderHook(() => useGameData(), { wrapper });
    act(() => { result.current.loadWorldData(world('w')); });
    act(() => {
      result.current.addStatGroup(body);
      result.current.addStatGroup(inner);
      result.current.addStat({ ...stat('s-grit', 'Grit', { groupId: 'g-inner', order: 0 }), descriptors: undefined } as never);
    });
    const exported = JSON.parse(JSON.stringify(result.current.getWorldData()));
    expect(exported.statGroups).toEqual([body, inner]);
    expect(exported.stats[0]).toMatchObject({ id: 's-grit', groupId: 'g-inner', order: 0 });

    // A different provider state stands in for the importing app.
    act(() => { result.current.loadWorldData(world('other')); });
    expect(result.current.statGroups).toEqual([]);
    act(() => { result.current.loadWorldData(exported); });
    expect(result.current.statGroups).toEqual([body, inner]);
    expect(result.current.stats[0]).toMatchObject({ id: 's-grit', groupId: 'g-inner', order: 0 });
    expect(result.current.isWorldDirty).toBe(false);
  });

  it('round-trips the groups an entity owns beside its stats', () => {
    const { result } = renderHook(() => useGameData(), { wrapper });
    act(() => { result.current.loadWorldData(world('w')); });
    act(() => { result.current.addEntity({ id: 'ash', name: 'Ash' }); });
    const bond = { id: 'g-bond', name: 'Bond', parentId: null, order: 0 };
    act(() => {
      result.current.editEntity('ash', (e) => ({ ...e, stats: [stat('s-trust', 'Trust', { groupId: 'g-bond', order: 0 })], statGroups: [bond] }));
    });
    const exported = JSON.parse(JSON.stringify(result.current.getWorldData()));
    act(() => { result.current.loadWorldData(world('other')); });
    act(() => { result.current.loadWorldData(exported); });
    const ash = result.current.entities.find((e) => e.id === 'ash');
    expect(ash?.statGroups).toEqual([bond]);
    expect(ash?.stats?.[0]).toMatchObject({ groupId: 'g-bond' });
    expect(result.current.statGroups).toEqual([]);
  });

  it('counts a group edit as an unsaved change', () => {
    const { result } = renderHook(() => useGameData(), { wrapper });
    act(() => { result.current.loadWorldData({ ...world('w'), statGroups: [body] } as unknown as World); });
    expect(result.current.isWorldDirty).toBe(false);
    act(() => { result.current.updateStatGroup({ ...body, name: 'Frame' }); });
    expect(result.current.isWorldDirty).toBe(true);
    expect(result.current.statGroups[0].name).toBe('Frame');
  });

  it('removes a group and moves its stats and subgroups up to its parent', () => {
    const { result } = renderHook(() => useGameData(), { wrapper });
    act(() => {
      result.current.loadWorldData({
        ...world('w'), statGroups: [body, inner], stats: [stat('s-grit', 'Grit', { groupId: 'g-inner' })],
      } as unknown as World);
    });
    act(() => { result.current.removeStatGroup('g-body'); });
    expect(result.current.statGroups).toEqual([{ ...inner, parentId: null }]);
    act(() => { result.current.removeStatGroup('g-inner'); });
    expect(result.current.statGroups).toEqual([]);
    expect(result.current.stats[0].groupId).toBeNull();
  });
});
