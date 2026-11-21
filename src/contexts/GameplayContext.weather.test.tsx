// Real in-memory storage for saves; must load before anything touches `indexedDB`.
import 'fake-indexeddb/auto';
import { describe, it, expect, vi } from 'vitest';
import { render, act } from '@testing-library/react';
import { GameplayProvider, useGameplay } from './GameplayContext';
import { GameDataProvider } from './GameDataContext';
import { PlaceholderSessionProvider } from './PlaceholderSessionContext';
import { getSaveRecord } from '@/components/modals/dbUtils';
import type { SaveRecord } from '@/types';

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
