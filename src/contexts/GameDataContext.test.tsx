import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { ReactNode } from 'react';
import { GameDataProvider, useGameData } from './GameDataContext';
import type { World } from '@/types';

// The provider initializes IndexedDB storage on mount; stub it out so these tests exercise only
// loadWorldData's normalization.
vi.mock('../services/WorldStorageService', () => ({
  default: { initialize: vi.fn(), getWorldMetadata: vi.fn().mockResolvedValue([]) },
}));

const world = (id: string, overview: Record<string, unknown>): World => ({
  id,
  worldOverview: {
    name: id, description: '', author: '', thumbnail: null, bgm: null,
    systemPrompt: '', use3DModel: true, tags: [], ...overview,
  },
  stats: [], locations: [], entities: [], traits: [], statUpdates: [],
} as unknown as World);

const wrapper = ({ children }: { children: ReactNode }) => <GameDataProvider>{children}</GameDataProvider>;

describe('loadWorldData', () => {
  it("loads the world's own readme", () => {
    const { result } = renderHook(() => useGameData(), { wrapper });
    act(() => { result.current.loadWorldData(world('a', { readme: '# Hello' })); });
    expect(result.current.worldOverview.readme).toBe('# Hello');
  });

  it('replaces the overview rather than merging, so no field leaks between worlds', () => {
    const { result } = renderHook(() => useGameData(), { wrapper });

    act(() => { result.current.loadWorldData(world('a', { readme: "A's readme" })); });
    expect(result.current.worldOverview.readme).toBe("A's readme");

    // B has no readme; it must not inherit A's.
    act(() => { result.current.loadWorldData(world('b', {})); });
    expect(result.current.worldOverview.readme).toBeFalsy();
    expect(result.current.worldOverview.name).toBe('b');
  });

  it('keeps the readme out of the dirty baseline, so a freshly loaded world is clean', () => {
    const { result } = renderHook(() => useGameData(), { wrapper });
    act(() => { result.current.loadWorldData(world('a', { readme: '# Hello' })); });
    expect(result.current.isWorldDirty).toBe(false);
  });
});
