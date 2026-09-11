// Code Pins ride the per-turn snapshot: saving writes them, a load or a rewind restores them, and a save
// written before they existed loads with none.
import 'fake-indexeddb/auto';
import { describe, it, expect, vi } from 'vitest';
import { render, act } from '@testing-library/react';
import { GameplayProvider, useGameplay } from './GameplayContext';
import { GameDataProvider } from './GameDataContext';
import { PlaceholderSessionProvider } from './PlaceholderSessionContext';
import type { GameState } from '@/types';

vi.mock('@/lib/useTtsPlayback', () => import('@/test/stubs/ttsPlayback'));

type Gameplay = ReturnType<typeof useGameplay>;

const Expose = ({ expose }: { expose: (g: Gameplay) => void }) => {
  expose(useGameplay());
  return null;
};

const mount = () => {
  let gameplay: Gameplay | null = null;
  render(
    <GameDataProvider>
      <PlaceholderSessionProvider>
        <GameplayProvider>
          <Expose expose={(g) => { gameplay = g; }} />
        </GameplayProvider>
      </PlaceholderSessionProvider>
    </GameDataProvider>,
  );
  return () => {
    if (!gameplay) throw new Error('gameplay context not available (did the render throw?)');
    return gameplay as Gameplay;
  };
};

/** A snapshot as a save written before Code Pins stores it: no `codePins` key at all. */
const legacySnapshot = (): GameState => ({
  playerStats: [],
  playerTraits: [],
  visibleEntities: [],
  logEntries: [],
  gameplayText: '',
  gameTime: 0,
  characterData: null,
  choices: [],
  isGameStarted: true,
  timestamp: new Date().toISOString(),
  worldName: null,
  playerNotes: '',
  previousStateIndex: null,
  stateVersion: 2,
});

describe('Code Pins in the gameplay snapshot', () => {
  it('writes them into the snapshot, and leaves the key out when there are none', async () => {
    const live = mount();
    expect('codePins' in live().saveCurrentGameState()).toBe(false);
    await act(async () => { live().setCodePins({ mood: 'Furious' }); });
    expect(live().saveCurrentGameState().codePins).toEqual({ mood: 'Furious' });
  });

  it('loads a save without Code Pins with none, even over live ones', async () => {
    const live = mount();
    await act(async () => { live().setCodePins({ mood: 'Furious' }); });
    await act(async () => { expect(live().loadGameState(legacySnapshot(), [])).toBe(true); });
    expect(live().codePins).toEqual({});
  });

  it('restores the pre-write pins on a rewind', async () => {
    const live = mount();
    await act(async () => { live().setCodePins({ mood: 'Calm' }); });
    const before = live().saveCurrentGameState();
    await act(async () => { live().setCodePins({ mood: 'Furious', town: 'Fen' }); });
    await act(async () => { expect(live().loadGameState(before, [], { keepLiveHistory: true })).toBe(true); });
    expect(live().codePins).toEqual({ mood: 'Calm' });
  });
});
