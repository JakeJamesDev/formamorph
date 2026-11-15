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
import type { MentionCorrectionMap } from '@/lib/coref/mentionCorrections';

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
    reading: { mentions: [{ start: 0, end: 4, entityId: 'mira' }], quotes: [{ start: 10, end: 12, speaker: 'mira' }] },
  },
};
const CORRECTIONS: MentionCorrectionMap = {
  'turn-1': { textHash: '12:abc', corrections: [{ kind: 'mention', start: 0, end: 4, entityId: null }, { kind: 'quote', start: 10, end: 12, entityId: 'kessa' }] },
};

describe('mention corrections across a save/load round trip', () => {
  it('loads every correction back and overlays it on the turn’s reading', async () => {
    const live = mount();
    await act(async () => { live().setMentionReadings(READINGS); live().setMentionCorrections(CORRECTIONS); });
    await act(async () => { await live().saveGame('slot', 'World', 'w1', 'corrections-roundtrip'); });

    await act(async () => { live().setMentionCorrections({}); });
    expect(live().correctedReadings['turn-1'].reading.quotes[0].speaker).toBe('mira');
    await act(async () => { await live().loadGame('corrections-roundtrip', []); });
    expect(live().mentionCorrections).toEqual(CORRECTIONS);
    expect(live().correctedReadings['turn-1'].reading).toEqual({
      mentions: [{ start: 0, end: 4, entityId: null }], quotes: [{ start: 10, end: 12, speaker: 'kessa' }],
    });
    expect(live().mentionReadings).toEqual(READINGS);
  });

  it('writes no field when there are none', async () => {
    const live = mount();
    await act(async () => { await live().saveGame('slot', 'World', 'w1', 'corrections-absent'); });
    const record = await getSaveRecord('corrections-absent') as SaveRecord;
    expect('mentionCorrections' in record).toBe(false);

    await act(async () => { live().setMentionCorrections(CORRECTIONS); });
    await act(async () => { await live().loadGame('corrections-absent', []); });
    expect(live().mentionCorrections).toEqual({});
  });
});
