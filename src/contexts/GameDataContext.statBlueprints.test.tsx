import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { ReactNode } from 'react';
import { GameDataProvider, useGameData } from './GameDataContext';
import { seedEntityStats } from '@/lib/entityStats';
import { entityCodeStats } from '@/lib/statCodeTraits';
import { statCodeNames } from '@/lib/statCodeTestRun';
import type { Stat, StatLink, World } from '@/types';

// The provider initializes IndexedDB storage on mount; stub it out so these tests exercise only the store.
vi.mock('../services/WorldStorageService', () => ({
  default: { initialize: vi.fn(), getWorldMetadata: vi.fn().mockResolvedValue([]) },
}));

const stat = (id: string, name: string, extra: Partial<Stat> = {}): Stat => ({
  id, name, type: 'number', description: '', min: 0, max: 10, value: 4, regen: 0, descriptors: [], ...extra,
});
const link = (id: string, extra: Partial<StatLink> = {}): StatLink =>
  ({ id, originalId: 'bp-trust', kind: 'stat', originalName: 'Trust', groupId: null, ...extra });

const world = {
  id: 'w',
  worldOverview: {
    name: 'w', description: '', author: '', thumbnail: null, bgm: null, systemPrompt: '', tags: [],
  },
  stats: [stat('health', 'Health'), stat('bp-trust', 'Trust', { groupId: 'bp', value: 5 })],
  statGroups: [{ id: 'bp', name: 'Blueprints', parentId: null, system: 'blueprints' }],
  entities: [
    { id: 'bram', name: 'Bram', statLinks: [link('l1', { overrides: { 'bp-trust': { value: { value: 20, blueprint: 5 } } } })] },
    { id: 'odette', name: 'Odette', stats: [stat('stock', 'Stock')], statLinks: [link('l2')] },
  ],
  locations: [], traits: [], statUpdates: [],
} as unknown as World;

const wrapper = ({ children }: { children: ReactNode }) => <GameDataProvider>{children}</GameDataProvider>;

describe('the world as play reads it', () => {
  it('leaves the Blueprints out of the global stats and resolves each entity\'s links', () => {
    const { result } = renderHook(() => useGameData(), { wrapper });
    act(() => { result.current.loadWorldData(world); });
    expect(result.current.playStats.map((s) => s.id)).toEqual(['health']);
    expect(result.current.stats.map((s) => s.id)).toEqual(['health', 'bp-trust']);
    const [bram, odette] = result.current.playEntities;
    expect(bram.stats?.map((s) => [s.id, s.value])).toEqual([['bp-trust', 20]]);
    expect(odette.stats?.map((s) => [s.id, s.value])).toEqual([['stock', 4], ['bp-trust', 5]]);
  });

  it('seeds each owner\'s own value of one Blueprint, and stat code reads it under the entity', () => {
    const { result } = renderHook(() => useGameData(), { wrapper });
    act(() => { result.current.loadWorldData(world); });
    const seeded = seedEntityStats(result.current.playEntities);
    // Bram's override sits above Trust's 0–10 range, so the seed opens it at the max (Q8).
    expect(seeded.bram.map((s) => [s.id, s.value])).toEqual([['bp-trust', 10]]);
    expect(seeded.odette.find((s) => s.id === 'bp-trust')?.value).toBe(5);
    expect(entityCodeStats(result.current.playEntities, []).bram.map((s) => s.name)).toEqual(['Trust']);
  });

  it('names stats for code as play does: no Blueprint as a player stat, each entity with its links', () => {
    const names = statCodeNames({ ...world, placeholders: [], dictionaries: [] });
    expect(names.statNames).toEqual(['Health']);
    expect(names.entityStats.bram.map((s) => s.name)).toEqual(['Trust']);
    expect(names.entities.find((e) => e.name === 'Odette')?.stats).toEqual(['Stock', 'Trust']);
  });

  it('drops the links to a deleted Blueprint stat', () => {
    const { result } = renderHook(() => useGameData(), { wrapper });
    act(() => { result.current.loadWorldData(world); });
    act(() => { result.current.removeStat('bp-trust'); });
    expect(result.current.entities.map((e) => e.statLinks)).toEqual([undefined, undefined]);
  });

  it('turns each link into the entity\'s own stat when Blueprints goes, keeping the id and the override', () => {
    const { result } = renderHook(() => useGameData(), { wrapper });
    act(() => { result.current.loadWorldData(world); });
    act(() => { result.current.removeStatGroup('bp'); });
    expect(result.current.statGroups).toEqual([]);
    expect(result.current.stats.map((s) => s.id)).toEqual(['health']);
    expect(result.current.entities[0].stats?.map((s) => [s.id, s.value])).toEqual([['bp-trust', 20]]);
    expect(result.current.entities[0].statLinks).toBeUndefined();
  });
});
