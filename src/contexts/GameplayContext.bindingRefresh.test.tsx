// Real in-memory storage for saves; must load before anything touches `indexedDB`.
import 'fake-indexeddb/auto';
import { describe, it, expect, vi } from 'vitest';
import { render, act } from '@testing-library/react';
import { GameplayProvider, useGameplay } from './GameplayContext';
import { GameDataProvider, useGameData } from './GameDataContext';
import { PlaceholderSessionProvider } from './PlaceholderSessionContext';
import { worldFixture } from '@/test/gamePanels';
import type { Entity, GameLocation, PlayerStat, Stat } from '@/types';

vi.mock('@/lib/useTtsPlayback', () => import('@/test/stubs/ttsPlayback'));

interface Live {
  gameplay: ReturnType<typeof useGameplay>;
  gameData: ReturnType<typeof useGameData>;
}

const Expose = ({ expose }: { expose: (l: Live) => void }) => {
  expose({ gameplay: useGameplay(), gameData: useGameData() });
  return null;
};

const mount = () => {
  let live: Live | null = null;
  render(
    <GameDataProvider>
      <PlaceholderSessionProvider>
        <GameplayProvider>
          <Expose expose={(l) => { live = l; }} />
        </GameplayProvider>
      </PlaceholderSessionProvider>
    </GameDataProvider>,
  );
  return () => {
    if (!live) throw new Error('contexts not available (did the render throw?)');
    return live as Live;
  };
};

const cellar = { id: 'cellar', name: 'Cellar', description: '' } as GameLocation;
const statOf = (id: string, over: Partial<Stat> = {}): Stat =>
  ({ id, name: id, type: 'number', description: '', min: 0, max: 100, regen: 0, descriptors: [], ...over }) as Stat;

const hunger = statOf('hunger', { morphBindings: [{ name: 'Belly' }] });
const cracks = statOf('cracks', { morphBindings: [{ name: 'Cracks' }] });
const golem: Entity = { id: 'golem', name: 'Golem', locations: ['cellar'], stats: [cracks] };

describe('A loaded save reads its stat bindings from the world', () => {
  it('shows a Change By the author edited after the save was made, global and on an entity', async () => {
    const live = mount();
    await act(async () => {
      live().gameData.loadWorldData(worldFixture({ stats: [hunger], entities: [golem], locations: [cellar] }));
    });
    await act(async () => {
      live().gameplay.setGlobalStats([{ ...hunger, value: 40 } as PlayerStat]);
      live().gameplay.setEntityStats({ golem: [{ ...cracks, value: 10 } as PlayerStat] });
    });
    await act(async () => { await live().gameplay.saveGame('slot', 'World', 'w1', 'bindings'); });

    // The author changes both Change By amounts; the save still holds the old copies.
    const tuned = { ...hunger, morphBindings: [{ name: 'Belly', by: -0.5 }] };
    const tunedGolem = { ...golem, stats: [{ ...cracks, morphBindings: [{ name: 'Cracks', by: 3 }] }] };
    await act(async () => { await live().gameplay.loadGame('bindings', [cellar], [tuned], [tunedGolem]); });

    const [loaded] = live().gameplay.globalStats;
    expect(loaded).toMatchObject({ value: 40, morphBindings: [{ name: 'Belly', by: -0.5 }] });
    expect(live().gameplay.entityStats.golem[0]).toMatchObject({ value: 10, morphBindings: [{ name: 'Cracks', by: 3 }] });
  });
});
