// Real in-memory storage for saves; must load before anything touches `indexedDB`.
import 'fake-indexeddb/auto';
import { describe, it, expect, vi } from 'vitest';
import { render, act } from '@testing-library/react';
import { GameplayProvider, useGameplay } from './GameplayContext';
import { GameDataProvider } from './GameDataContext';
import { PlaceholderSessionProvider } from './PlaceholderSessionContext';
import { getSaveRecord, putSaveRecord } from '@/components/modals/dbUtils';
import type { SaveRecord } from '@/types';

vi.mock('@/lib/useTtsPlayback', () => import('@/test/stubs/ttsPlayback'));
// jsdom has no module workers. The stub stands in for the worker that converts a deep-nested legacy save.
vi.mock('@/lib/saveConversionWorkerUtils', () => ({
  convertSaveFile: async () => ({
    flattenedStates: [],
    convertedData: {
      playerStats: [], playerTraits: [], visibleEntities: [], logEntries: [], gameplayText: '', gameTime: 0,
      characterData: null, choices: [], isGameStarted: true, timestamp: '2020-01-01T00:00:00.000Z',
      worldName: null, playerNotes: '', previousStateIndex: null, stateVersion: 2,
    },
  }),
  terminateWorker: () => {},
}));

const Expose = ({ expose }: { expose: (g: ReturnType<typeof useGameplay>) => void }) => {
  expose(useGameplay());
  return null;
};

const mount = () => {
  let live: ReturnType<typeof useGameplay> | null = null;
  render(
    <GameDataProvider>
      <PlaceholderSessionProvider>
        <GameplayProvider>
          <Expose expose={(g) => { live = g; }} />
        </GameplayProvider>
      </PlaceholderSessionProvider>
    </GameDataProvider>,
  );
  return () => {
    if (!live) throw new Error('contexts not available (did the render throw?)');
    return live;
  };
};

describe('opening cue across a save/load round trip', () => {
  it.each([['an Opening Action', 'I walk the pier.'], ['an Opening Narration', '']])('keeps the cue of %s', async (_, cue) => {
    const live = mount();
    await act(async () => { live().setOpeningCue(cue); });
    await act(async () => { await live().saveGame('slot', 'World', 'w1', `cue-${cue.length}`); });
    expect((await getSaveRecord(`cue-${cue.length}`) as SaveRecord).openingCue).toBe(cue);

    await act(async () => { live().setOpeningCue('Stale.'); });
    await act(async () => { await live().loadGame(`cue-${cue.length}`, []); });
    expect(live().openingCue).toBe(cue);
  });

  it('writes no field before the opening turn, and loads that save with none', async () => {
    const live = mount();
    await act(async () => { await live().saveGame('slot', 'World', 'w1', 'cue-absent'); });
    expect('openingCue' in (await getSaveRecord('cue-absent') as SaveRecord)).toBe(false);

    await act(async () => { live().setOpeningCue('Stale.'); });
    await act(async () => { await live().loadGame('cue-absent', []); });
    expect(live().openingCue).toBeNull();
  });

  it('starts a legacy nested save with none, too', async () => {
    const live = mount();
    await putSaveRecord({ id: 'cue-legacy', name: 'old' } as unknown as SaveRecord);
    await act(async () => { live().setOpeningCue('Stale.'); });
    await act(async () => { expect(await live().loadGame('cue-legacy', [])).toBe(true); });
    expect(live().openingCue).toBeNull();
  });
});
