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

describe('script tells across a save/load round trip', () => {
  it('loads every turn’s tells back in order', async () => {
    const live = mount();
    const map = {
      'turn-1': [{ text: 'The bell tolls.', timing: 'before' as const }, { text: 'Twice.', timing: 'after' as const }],
      'turn-2': [{ text: 'Quiet.', timing: 'switch' as const }],
    };
    await act(async () => { live().setScriptTells(map); });
    await act(async () => { await live().saveGame('slot', 'World', 'w1', 'tells-roundtrip'); });

    await act(async () => { live().setScriptTells({}); });
    await act(async () => { await live().loadGame('tells-roundtrip', []); });
    expect(live().scriptTells).toEqual(map);
  });

  it('writes no field when there are none, and loads that save with none', async () => {
    const live = mount();
    await act(async () => { await live().saveGame('slot', 'World', 'w1', 'tells-absent'); });
    const record = await getSaveRecord('tells-absent') as SaveRecord;
    expect('scriptTells' in record).toBe(false);

    await act(async () => { live().setScriptTells({ stale: [{ text: 'Old.', timing: 'before' }] }); });
    await act(async () => { await live().loadGame('tells-absent', []); });
    expect(live().scriptTells).toEqual({});
  });

  it('starts a legacy nested save with none, too', async () => {
    const live = mount();
    await putSaveRecord({ id: 'tells-legacy', name: 'old' } as unknown as SaveRecord);
    await act(async () => { live().setScriptTells({ stale: [{ text: 'Old.', timing: 'before' }] }); });
    await act(async () => { expect(await live().loadGame('tells-legacy', [])).toBe(true); });
    expect(live().scriptTells).toEqual({});
  });
});
