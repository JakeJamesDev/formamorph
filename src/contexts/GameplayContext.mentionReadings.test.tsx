// Real in-memory storage for saves; must load before anything touches `indexedDB`.
import 'fake-indexeddb/auto';
import { describe, it, expect, vi } from 'vitest';
import { render, act } from '@testing-library/react';
import { GameplayProvider, useGameplay } from './GameplayContext';
import { GameDataProvider } from './GameDataContext';
import { PlaceholderSessionProvider } from './PlaceholderSessionContext';
import { getSaveRecord } from '@/components/modals/dbUtils';
import type { SaveRecord } from '@/types';
import type { MentionReadingMap } from '@/lib/coref/mentionReadings';

vi.mock('@/lib/useTtsPlayback', () => import('@/test/stubs/ttsPlayback'));

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

const READINGS: MentionReadingMap = {
  'turn-1': {
    model: 'small', version: 3, textHash: '12:abc',
    reading: { mentions: [{ start: 0, end: 4, entityId: 'mira' }, { start: 6, end: 9, entityId: null }], quotes: [{ start: 10, end: 12, speaker: 'mira' }] },
  },
};

describe('mention readings across a save/load round trip', () => {
  it('loads every turn’s reading back', async () => {
    const live = mount();
    await act(async () => { live().setMentionReadings(READINGS); });
    await act(async () => { await live().saveGame('slot', 'World', 'w1', 'readings-roundtrip'); });

    await act(async () => { live().setMentionReadings({}); });
    await act(async () => { await live().loadGame('readings-roundtrip', []); });
    expect(live().mentionReadings).toEqual(READINGS);
  });

  it('writes no field when there are none, so a save with the feature off is unchanged', async () => {
    const live = mount();
    await act(async () => { await live().saveGame('slot', 'World', 'w1', 'readings-absent'); });
    const record = await getSaveRecord('readings-absent') as SaveRecord;
    expect('mentionReadings' in record).toBe(false);

    await act(async () => { live().setMentionReadings(READINGS); });
    await act(async () => { await live().loadGame('readings-absent', []); });
    expect(live().mentionReadings).toEqual({});
  });
});
