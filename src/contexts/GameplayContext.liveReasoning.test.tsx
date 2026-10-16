// The live thought belongs to one playthrough: a loaded save or a closed game drops it, a rewind keeps it.
import 'fake-indexeddb/auto';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, act, cleanup } from '@testing-library/react';
import { GameplayProvider, useGameplay } from './GameplayContext';
import { GameDataProvider } from './GameDataContext';
import { PlaceholderSessionProvider } from './PlaceholderSessionContext';
import { getLiveReasoning, setLiveReasoning } from '@/lib/reasoningStreamStore';
import type { GameState } from '@/types';

vi.mock('@/lib/useTtsPlayback', () => import('@/test/stubs/ttsPlayback'));

type Gameplay = ReturnType<typeof useGameplay>;

const Expose = ({ expose }: { expose: (g: Gameplay) => void }) => {
  expose(useGameplay());
  return null;
};

const mount = () => {
  let gameplay: Gameplay | null = null;
  const view = render(
    <GameDataProvider>
      <PlaceholderSessionProvider>
        <GameplayProvider>
          <Expose expose={(g) => { gameplay = g; }} />
        </GameplayProvider>
      </PlaceholderSessionProvider>
    </GameDataProvider>,
  );
  const live = () => {
    if (!gameplay) throw new Error('gameplay context not available (did the render throw?)');
    return gameplay as Gameplay;
  };
  return { live, unmount: view.unmount };
};

const snapshot = (): GameState => ({
  globalStats: [],
  globalTraits: [],
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

const THOUGHT = { text: 'The guard is lying.', ms: 1200, active: false };

afterEach(() => {
  cleanup();
  setLiveReasoning({ text: '', ms: 0, active: false });
});

describe('the live thought across games', () => {
  it('clears when a save loads', async () => {
    const { live } = mount();
    setLiveReasoning(THOUGHT);
    await act(async () => { expect(live().loadGameState(snapshot(), [])).toBe(true); });
    expect(getLiveReasoning().text).toBe('');
  });

  it('stays through a rewind, which clears it on its own terms', async () => {
    const { live } = mount();
    setLiveReasoning(THOUGHT);
    await act(async () => { expect(live().loadGameState(snapshot(), [], { keepLiveHistory: true })).toBe(true); });
    expect(getLiveReasoning()).toEqual(THOUGHT);
  });

  it('clears when the game closes', () => {
    const { unmount } = mount();
    setLiveReasoning(THOUGHT);
    unmount();
    expect(getLiveReasoning().text).toBe('');
  });
});
