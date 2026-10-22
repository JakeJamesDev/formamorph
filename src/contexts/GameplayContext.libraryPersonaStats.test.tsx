// A library persona is read live from the library each time, so its stat Links must resolve against the
// world's Blueprints in the context, not only when the player picks it at Enter World.
import 'fake-indexeddb/auto';
import { describe, it, expect, vi } from 'vitest';
import { render, act } from '@testing-library/react';
import { GameplayProvider, useGameplay } from './GameplayContext';
import { GameDataProvider, useGameData } from './GameDataContext';
import { PlaceholderSessionProvider } from './PlaceholderSessionContext';
import type { Entity, Stat, World } from '@/types';

vi.mock('@/lib/useTtsPlayback', () => import('@/test/stubs/ttsPlayback'));

const ash: Entity = {
  id: 'lib-ash', name: 'Ash',
  stats: [{ id: 'grit', name: 'Grit', type: 'number', description: '', min: 0, max: 10, value: 4, regen: 0, descriptors: [] }],
  statLinks: [{
    id: 'l1', originalId: 'bp-trust', kind: 'stat', originalName: 'Trust', groupId: null,
    overrides: { 'bp-trust': { value: { value: 9, blueprint: 5 } } },
  }],
};
vi.mock('@/lib/useLibraryEntity', () => ({ useLibraryEntity: (id: string | null) => ({ entity: id ? ash : null, pending: false }) }));

const trust: Stat = { id: 'bp-trust', name: 'Trust', type: 'number', description: '', min: 0, max: 10, value: 5, regen: 0, descriptors: [], groupId: 'bp' };
const world = {
  id: 'w',
  worldOverview: { name: 'w', description: '', author: '', thumbnail: null, bgm: null, systemPrompt: '', tags: [] },
  stats: [trust],
  statGroups: [{ id: 'bp', name: 'Blueprints', parentId: null, system: 'blueprints' }],
  entities: [], locations: [], traits: [], statUpdates: [],
} as unknown as World;

describe('the library persona in play', () => {
  it('plays with its own stats and each linked Blueprint stat, the link’s override over the Blueprint', () => {
    let gameplay: ReturnType<typeof useGameplay> | null = null;
    let data: ReturnType<typeof useGameData> | null = null;
    const Expose = () => {
      gameplay = useGameplay();
      data = useGameData();
      return null;
    };
    render(
      <GameDataProvider>
        <PlaceholderSessionProvider>
          <GameplayProvider><Expose /></GameplayProvider>
        </PlaceholderSessionProvider>
      </GameDataProvider>,
    );
    act(() => { data!.loadWorldData(world); });
    act(() => { gameplay!.setPersonaRef({ source: 'library', entityId: 'lib-ash' }); });
    const persona = gameplay!.libraryPersona!;
    expect(persona.statLinks).toBeUndefined();
    expect(persona.stats?.map((s) => [s.id, s.value])).toEqual([['grit', 4], ['bp-trust', 9]]);
  });
});
