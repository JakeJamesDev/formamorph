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

describe('memory changes in a released save', () => {
  it('load onto the text edit layer and save back as that layer only', async () => {
    const live = mount();
    await act(async () => { await live().saveGame('slot', 'World', 'w1', 'released'); });
    // The record a released build wrote: the memory changes in their two old fields.
    const written = await getSaveRecord('released') as SaveRecord;
    await putSaveRecord({
      ...written,
      memoryEdits: { t1: { text: 'Rewritten.', source: 'player' }, t2: { text: 'Regenerated.', source: 'ai' } },
      memoryDeleted: ['t2', 't3', 'note-1'],
    } as SaveRecord);

    await act(async () => { await live().loadGame('released', []); });
    expect(live().turnTextEdits).toEqual({
      t1: { memory: { text: 'Rewritten.', source: 'player' } },
      t2: { memory: { text: 'Regenerated.', source: 'ai', deleted: true } },
      t3: { memory: { source: 'player', deleted: true } },
      'note-1': { memory: { source: 'player', deleted: true } },
    });

    await act(async () => { await live().saveGame('slot', 'World', 'w1', 'released'); });
    const resaved = await getSaveRecord('released') as SaveRecord & Record<string, unknown>;
    expect(resaved.turnTextEdits).toEqual(live().turnTextEdits);
    expect('memoryEdits' in resaved).toBe(false);
    expect('memoryDeleted' in resaved).toBe(false);
  });
});
