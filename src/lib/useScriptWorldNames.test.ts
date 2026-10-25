// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Connection, GameLocation } from '@/types';
import { useScriptWorldNames } from './useScriptWorldNames';

const locations: GameLocation[] = [{ id: 'mill', name: 'Old Mill' }, { id: 'inn', name: 'Inn' }];
const connections: Connection[] = [{ id: 'c', a: 'mill', b: 'inn', aToB: { hint: 'a trapdoor' } }];

vi.mock('@/contexts/GameDataContext', () => ({
  useGameDataOptional: () => ({ locations, connections, playStats: [], stats: [], statGroups: [], entities: [], worldPlaceholders: [] }),
}));
vi.mock('./useStatEditorWorld', () => ({
  useStatEditorWorld: () => ({
    placeholders: [], placeholderGroups: [], placeholderOwners: undefined, traits: [], traitGroups: [], playEntities: [], entityGroups: [], dictionaries: [],
  }),
}));

describe('useScriptWorldNames', () => {
  it('opens Test Code’s world with the editor’s Connections, so exits read as the router does', () => {
    const { result } = renderHook(() => useScriptWorldNames());
    expect(result.current.world).toMatchObject({ locations, connections });
  });
});
