import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { ReactNode } from 'react';
import { GameDataProvider, useGameData } from './GameDataContext';
import { holdUnsavedWorld, readUnsavedWorld } from '@/lib/unsavedWorld';
import type { World } from '@/types';

vi.mock('../services/WorldStorageService', () => ({
  default: { initialize: vi.fn(), getWorldMetadata: vi.fn().mockResolvedValue([]) },
}));

const sample = {
  id: 'w1',
  worldOverview: {
    name: 'Sedge Landing', description: '', author: '', thumbnail: null, bgm: null,
    systemPrompt: '', use3DModel: true, tags: [],
  },
  stats: [], locations: [], entities: [], traits: [], statUpdates: [],
} as unknown as World;

const wrapper = ({ children }: { children: ReactNode }) => <GameDataProvider>{children}</GameDataProvider>;

beforeEach(() => holdUnsavedWorld(null));

describe('the unsaved world the crash screen reads', () => {
  it('holds nothing before a world is loaded and while a loaded world is clean', () => {
    const { result } = renderHook(() => useGameData(), { wrapper });
    expect(readUnsavedWorld()).toBeNull();

    act(() => { result.current.loadWorldData(sample); });
    expect(readUnsavedWorld()).toBeNull();
  });

  it('holds the edited world with its id while edits are unsaved, and lets go on discard', () => {
    const { result } = renderHook(() => useGameData(), { wrapper });
    act(() => { result.current.loadWorldData(sample); });

    act(() => { result.current.updateWorldOverview({ name: 'Edited Name' }); });
    expect(readUnsavedWorld()).toMatchObject({ id: 'w1', worldOverview: { name: 'Edited Name' } });

    act(() => { result.current.discardChanges(); });
    expect(readUnsavedWorld()).toBeNull();
  });

  it('shares the committed records instead of copying them', () => {
    const { result } = renderHook(() => useGameData(), { wrapper });
    act(() => { result.current.loadWorldData(sample); });
    act(() => { result.current.updateWorldOverview({ name: 'Edited Name' }); });

    expect(readUnsavedWorld()?.locations).toBe(result.current.getWorldData().locations);
  });

  it('keeps the world when the provider unmounts, for the crash screen that replaces it', () => {
    const { result, unmount } = renderHook(() => useGameData(), { wrapper });
    act(() => { result.current.loadWorldData(sample); });
    act(() => { result.current.updateWorldOverview({ name: 'Edited Name' }); });

    unmount();
    expect(readUnsavedWorld()).toMatchObject({ worldOverview: { name: 'Edited Name' } });
  });
});
