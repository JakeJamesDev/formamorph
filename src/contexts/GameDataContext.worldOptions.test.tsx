// World Options ride the world file: the export writes them in Options-tab order and an import reads them back whole.
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { ReactNode } from 'react';
import { GameDataProvider, useGameData } from './GameDataContext';
import { migrateWorld } from '@/lib/version';
import type { World, WorldOption } from '@/types';

vi.mock('../services/WorldStorageService', () => ({
  default: { initialize: vi.fn(), getWorldMetadata: vi.fn().mockResolvedValue([]) },
}));

const world = (id: string, extra: Partial<World> = {}): World => ({
  id,
  worldOverview: { name: id, description: '', author: '', thumbnail: null, bgm: null, systemPrompt: '', tags: [] },
  stats: [], locations: [], entities: [], traits: [], statUpdates: [], ...extra,
} as unknown as World);

const wrapper = ({ children }: { children: ReactNode }) => <GameDataProvider>{children}</GameDataProvider>;

const options: WorldOption[] = [
  {
    id: 'o-style', name: 'Style', type: 'choice', shownToPlayer: true, midGame: true, default: 'v-lush', playerDescription: 'How replies read',
    values: [
      { id: 'v-plain', name: 'Plain', placeholderPins: [{ placeholderId: 'tone', value: 'plain' }] },
      { id: 'v-lush', name: 'Lush', placeholderPins: [{ placeholderId: 'tone', value: 'lush', valueId: 'tone-lush' }] },
    ],
  },
  {
    id: 'o-brisk', name: 'Brisk', type: 'boolean', shownToPlayer: false, midGame: false, default: true,
    onPins: [{ placeholderId: 'pace', value: 'quick' }], offPins: [{ placeholderId: 'pace', value: 'slow' }],
  },
  { id: 'o-length', name: 'Length', type: 'number', shownToPlayer: true, midGame: false, min: 1, max: 9, step: 2, default: 5 },
];

describe('World Options in the world store', () => {
  it('round-trips one Option of each type through export and import unchanged', () => {
    const { result } = renderHook(() => useGameData(), { wrapper });
    act(() => { result.current.loadWorldData(world('w', { options })); });
    expect(result.current.isWorldDirty).toBe(false);
    const exported = JSON.parse(JSON.stringify({ ...result.current.getWorldData(), id: 'w' }));
    expect(exported.options).toEqual(options);

    act(() => { result.current.loadWorldData(world('other')); });
    expect(result.current.options).toEqual([]);
    act(() => { result.current.loadWorldData(migrateWorld(exported)); });
    expect(result.current.options).toEqual(options);
    expect(result.current.getWorldData().options).toEqual(options);
  });

  it('leaves the key out of a world with no Options', () => {
    const { result } = renderHook(() => useGameData(), { wrapper });
    act(() => { result.current.loadWorldData(world('w')); });
    expect('options' in result.current.getWorldData()).toBe(false);
  });

  it('marks the world dirty on an Option edit and writes it in place', () => {
    const { result } = renderHook(() => useGameData(), { wrapper });
    act(() => { result.current.loadWorldData(world('w', { options })); });
    act(() => { result.current.updateOption({ ...options[2], name: 'Reply Length' }); });
    expect(result.current.isWorldDirty).toBe(true);
    expect(result.current.getWorldData().options?.map((o) => o.name)).toEqual(['Style', 'Brisk', 'Reply Length']);
  });
});
