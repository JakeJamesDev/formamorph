// The player's look is a viewing preference: rollback/regenerate restore a snapshot with `keepLiveHistory`
// and must keep the live look. Loading a save restores its own look, and a past page shows its snapshot's.
import 'fake-indexeddb/auto';
import { describe, it, expect, vi } from 'vitest';
import { render, act } from '@testing-library/react';
import { GameplayProvider, useGameplay } from './GameplayContext';
import { GameDataProvider } from './GameDataContext';
import { PlaceholderSessionProvider } from './PlaceholderSessionContext';
import type { CharacterData, GameState } from '@/types';

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

const look = (hairColor: string): CharacterData => ({
  bodyMorphs: { Bust: 0.4 },
  hairColor,
  currentHairStyle: 'bob',
  hairLength: 0.5,
});

const snapshotLook = look('#111111');
const editedLook = look('#ff00aa');

/** A turn snapshot as the rewind handlers feed it to loadGameState, carrying the look the turn started with. */
const snapshot = (): GameState => ({
  globalStats: [],
  globalTraits: [],
  visibleEntities: [],
  logEntries: [],
  gameplayText: '',
  gameTime: 0,
  characterData: snapshotLook,
  choices: [],
  isGameStarted: true,
  timestamp: new Date().toISOString(),
  worldName: null,
  playerNotes: '',
  previousStateIndex: null,
  stateVersion: 2,
});

const seedEdit = async (live: () => Gameplay) => {
  await act(async () => { live().setCharacterData(editedLook); });
};

describe('the live look across a restore', () => {
  it('survives rollback', async () => {
    const live = mount();
    await seedEdit(live);
    await act(async () => {
      expect(live().loadGameState(snapshot(), [], { keepLiveHistory: true })).toBe(true);
    });
    expect(live().characterData).toEqual(editedLook);
  });

  it('survives regenerate', async () => {
    const live = mount();
    await seedEdit(live);
    // Regenerate restores the same pre-turn snapshot through the same keepLiveHistory path.
    await act(async () => {
      expect(live().loadGameState(snapshot(), [], { keepLiveHistory: true, worldStats: [] })).toBe(true);
    });
    expect(live().characterData).toEqual(editedLook);
  });

  it('is replaced by the saved look when a save loads', async () => {
    const live = mount();
    await seedEdit(live);
    await act(async () => {
      expect(live().loadGameState(snapshot(), [])).toBe(true);
    });
    expect(live().characterData).toEqual(snapshotLook);
  });

  it('shows a past page its snapshot look while the live look differs', async () => {
    const live = mount();
    await seedEdit(live);
    await act(async () => {
      live().setFullMessageHistory([
        { role: 'user', content: 'a' }, { role: 'assistant', content: 'b' },
        { role: 'user', content: 'c' }, { role: 'assistant', content: 'd' },
      ]);
      live().setGameStates([snapshot(), snapshot()]);
      live().setUserPage(1);
    });
    expect(live().isViewingPast).toBe(true);
    expect(live().viewCharacterData).toEqual(snapshotLook);
    await act(async () => { live().setUserPage(null); });
    expect(live().viewCharacterData).toEqual(editedLook);
  });
});
