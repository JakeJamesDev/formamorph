// The rewind carve-out for the discovered cast: rollback/re-generate restore a frozen snapshot with
// `keepLiveHistory`, and the live discovered entities + suppressed names — which carry the player's
// edits — must survive that restore, exactly as the live narration and notes already do. Loading a
// save (no `keepLiveHistory`) must still adopt the snapshot's values wholesale.
import 'fake-indexeddb/auto';
import { describe, it, expect, vi } from 'vitest';
import { render, act } from '@testing-library/react';
import { GameplayProvider, useGameplay } from './GameplayContext';
import { GameDataProvider } from './GameDataContext';
import { PlaceholderSessionProvider } from './PlaceholderSessionContext';
import type { DiscoveredEntity, GameState } from '@/types';

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

const edited: DiscoveredEntity = {
  entity: { id: 'd1', name: 'Grey Mouse', aiDescription: 'The player-curated description.' },
  locationId: 'loc-1',
  sourceTurnId: 't1',
};

const stale: DiscoveredEntity = {
  entity: { id: 'd1', name: 'Grey Mouse', aiDescription: 'The pre-edit description.' },
  locationId: 'loc-1',
  sourceTurnId: 't1',
};

/** A snapshot as the rewind handlers feed it to loadGameState, carrying pre-edit entity state. */
const snapshot = (): GameState => ({
  playerStats: [],
  playerTraits: [],
  visibleEntities: [],
  discoveredEntities: [stale],
  suppressedCharacterNames: ['Snapshot Ghost'],
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

const seedLive = async (live: () => Gameplay) => {
  await act(async () => {
    live().setDiscoveredEntities([edited]);
    live().setSuppressedCharacterNames(['Deleted One']);
  });
};

describe('discovered entities across a keepLiveHistory restore (rollback / re-generate)', () => {
  it('keeps the live discovered entities and suppressed names instead of the snapshot copies', async () => {
    const live = mount();
    await seedLive(live);
    await act(async () => {
      expect(live().loadGameState(snapshot(), [], { keepLiveHistory: true })).toBe(true);
    });
    expect(live().discoveredEntities).toEqual([edited]);
    expect(live().suppressedCharacterNames).toEqual(['Deleted One']);
  });

  it('still adopts the snapshot values on a plain restore (the load-save path)', async () => {
    const live = mount();
    await seedLive(live);
    await act(async () => {
      expect(live().loadGameState(snapshot(), [])).toBe(true);
    });
    expect(live().discoveredEntities).toEqual([stale]);
    expect(live().suppressedCharacterNames).toEqual(['Snapshot Ghost']);
  });
});
