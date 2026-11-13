// World Option values ride the save; a save without them loads every Option on its default.
import 'fake-indexeddb/auto';
import { describe, it, expect, vi } from 'vitest';
import { render, act } from '@testing-library/react';
import { GameplayProvider, useGameplay } from './GameplayContext';
import { GameDataProvider } from './GameDataContext';
import { PlaceholderSessionProvider } from './PlaceholderSessionContext';
import { optionValue } from '@/lib/worldOptions';
import type { GameState, WorldOption } from '@/types';

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

/** A snapshot as a save written before World Options stores it: no `worldOptionValues` key. */
const legacySnapshot = (): GameState => ({
  globalStats: [], globalTraits: [], visibleEntities: [], logEntries: [], gameplayText: '', gameTime: 0, characterData: null,
  choices: [], isGameStarted: true, timestamp: new Date().toISOString(), worldName: null, playerNotes: '', previousStateIndex: null,
  stateVersion: 2,
});

const style: WorldOption = {
  id: 'o-style', name: 'Style', type: 'choice', shownToPlayer: true, midGame: true, default: 'v-plain',
  values: [{ id: 'v-plain', name: 'Plain' }, { id: 'v-lush', name: 'Lush' }],
};

describe('World Option values on a history page', () => {
  it('reads the paged turn\'s values, and the live ones on the latest page', async () => {
    const live = mount();
    const turn = (n: number) => [
      { role: 'user' as const, content: `act ${n}` }, { role: 'assistant' as const, content: `told ${n}` },
    ];
    const first = { ...legacySnapshot(), worldOptionValues: { 'o-style': 'v-plain' } };
    const second = { ...legacySnapshot(), worldOptionValues: { 'o-style': 'v-lush' } };
    await act(async () => {
      live().setFullMessageHistory([...turn(1), ...turn(2)]);
      live().setGameStates([first, second]);
      live().setWorldOptionValues({ 'o-style': 'v-lush' });
    });
    await act(async () => { live().setUserPage(1); });
    expect(live().isViewingPast).toBe(true);
    expect(live().viewWorldOptionValues).toEqual({ 'o-style': 'v-plain' });
    await act(async () => { live().setUserPage(null); });
    expect(live().viewWorldOptionValues).toEqual({ 'o-style': 'v-lush' });
  });
});

describe('World Option values in the save', () => {
  it('writes them into the snapshot and reads them back through a JSON round trip', async () => {
    const live = mount();
    expect('worldOptionValues' in live().saveCurrentGameState()).toBe(false);
    await act(async () => { live().setWorldOptionValues({ 'o-style': 'v-lush', 'o-brisk': true, 'o-length': 7 }); });
    const saved = JSON.parse(JSON.stringify(live().saveCurrentGameState())) as GameState;
    expect(saved.worldOptionValues).toEqual({ 'o-style': 'v-lush', 'o-brisk': true, 'o-length': 7 });
    await act(async () => { live().setWorldOptionValues({}); });
    await act(async () => { expect(live().loadGameState(saved, [])).toBe(true); });
    expect(live().worldOptionValues).toEqual({ 'o-style': 'v-lush', 'o-brisk': true, 'o-length': 7 });
  });

  it('loads a save without the record with every Option on its default, even over live values', async () => {
    const live = mount();
    await act(async () => { live().setWorldOptionValues({ 'o-style': 'v-lush' }); });
    await act(async () => { expect(live().loadGameState(legacySnapshot(), [])).toBe(true); });
    expect(live().worldOptionValues).toEqual({});
    expect(optionValue(style, live().worldOptionValues)).toBe('v-plain');
  });
});
