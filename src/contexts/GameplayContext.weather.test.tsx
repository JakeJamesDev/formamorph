// Real in-memory storage for saves; must load before anything touches `indexedDB`.
import 'fake-indexeddb/auto';
import { describe, it, expect, vi } from 'vitest';
import { render, act } from '@testing-library/react';
import { GameplayProvider, useGameplay } from './GameplayContext';
import { GameDataProvider } from './GameDataContext';
import { PlaceholderSessionProvider } from './PlaceholderSessionContext';
import { getSaveRecord } from '@/components/modals/dbUtils';
import type { GameState, SaveRecord } from '@/types';

vi.mock('@/lib/useTtsPlayback', () => import('@/test/stubs/ttsPlayback'));

const mount = () => {
  let live: ReturnType<typeof useGameplay> | null = null;
  const Expose = () => { live = useGameplay(); return null; };
  render(
    <GameDataProvider>
      <PlaceholderSessionProvider>
        <GameplayProvider><Expose /></GameplayProvider>
      </PlaceholderSessionProvider>
    </GameDataProvider>,
  );
  return () => {
    if (!live) throw new Error('contexts not available');
    return live;
  };
};

describe('the World Weather across a save/load round trip', () => {
  it('keeps a Storm through save and load', async () => {
    const live = mount();
    await act(async () => { live().setWeather('storm'); });
    await act(async () => { await live().saveGame('slot', 'World', 'w1', 'weather-storm'); });
    expect((await getSaveRecord('weather-storm') as SaveRecord).currentState.weather).toBe('storm');

    await act(async () => { live().setWeather('rain'); });
    await act(async () => { await live().loadGame('weather-storm', []); });
    expect(live().weather).toBe('storm');
  });

  it('stores Clear as no field, and a save with none loads as Clear', async () => {
    const live = mount();
    await act(async () => { live().setWeather('snow'); });
    await act(async () => { await live().saveGame('slot', 'World', 'w1', 'weather-clear'); });
    await act(async () => { live().setWeather('clear'); });
    await act(async () => { await live().saveGame('slot', 'World', 'w1', 'weather-clear'); });
    expect('weather' in (await getSaveRecord('weather-clear') as SaveRecord).currentState).toBe(false);

    await act(async () => { live().setWeather('storm'); });
    await act(async () => { await live().loadGame('weather-clear', []); });
    expect(live().weather).toBe('clear');
  });
});

const snapshot = (weather?: GameState['weather']): GameState => ({
  globalStats: [], globalTraits: [], visibleEntities: [], logEntries: [], gameplayText: '', gameTime: 0, characterData: null,
  choices: [], isGameStarted: true, timestamp: new Date().toISOString(), worldName: null, playerNotes: '', previousStateIndex: null,
  stateVersion: 2, ...(weather ? { weather } : {}),
});

describe('the World Weather on a history page', () => {
  it('reads the paged turn’s weather, Clear when it recorded none, and the live weather on the latest page', async () => {
    const live = mount();
    const turn = (n: number) => [
      { role: 'user' as const, content: `act ${n}` }, { role: 'assistant' as const, content: `told ${n}` },
    ];
    await act(async () => {
      live().setFullMessageHistory([...turn(1), ...turn(2), ...turn(3)]);
      live().setGameStates([snapshot('snow'), snapshot(), snapshot('storm')]);
      live().setWeather('storm');
    });
    await act(async () => { live().setUserPage(1); });
    expect(live().viewWeather).toBe('snow');
    await act(async () => { live().setUserPage(2); });
    expect(live().viewWeather).toBe('clear');
    await act(async () => { live().setUserPage(null); });
    expect(live().viewWeather).toBe('storm');
  });
});
