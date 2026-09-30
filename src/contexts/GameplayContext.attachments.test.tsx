// Real in-memory storage for saves; must load before anything touches `indexedDB`.
import 'fake-indexeddb/auto';
import { describe, it, expect, vi } from 'vitest';
import { render, act } from '@testing-library/react';
import { GameplayProvider, useGameplay } from './GameplayContext';
import { GameDataProvider } from './GameDataContext';
import { PlaceholderSessionProvider } from './PlaceholderSessionContext';
import { getSaveRecord } from '@/components/modals/dbUtils';
import type { ImageAttachment, SaveRecord } from '@/types';

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

const image = (id: string): ImageAttachment => ({ id, mime: 'image/webp', dataUrl: `data:image/webp;base64,${id}` });

describe('action attachments across a save/load round trip', () => {
  it('loads every turn and image back in order', async () => {
    const live = mount();
    const map = { 'turn-1': [image('a'), image('b')], 'turn-2': [image('c')] };
    await act(async () => { live().setActionAttachments(map); });
    await act(async () => { await live().saveGame('slot', 'World', 'w1', 'attach-roundtrip'); });

    await act(async () => { live().setActionAttachments({}); });
    await act(async () => { await live().loadGame('attach-roundtrip', []); });
    expect(live().actionAttachments).toEqual(map);
  });

  it('writes the map into an autosave too, so every save is self-contained', async () => {
    const live = mount();
    await act(async () => { live().setActionAttachments({ 'turn-1': [image('a')] }); });
    await act(async () => { await live().saveGame('auto', 'World', 'w1', 'attach-auto', { isAutosave: true }); });
    const record = await getSaveRecord('attach-auto') as SaveRecord;
    expect(record.actionAttachments).toEqual({ 'turn-1': [image('a')] });
  });

  it('writes no field when there are none, and loads that save with none', async () => {
    const live = mount();
    await act(async () => { await live().saveGame('slot', 'World', 'w1', 'attach-absent'); });
    const record = await getSaveRecord('attach-absent') as SaveRecord;
    expect('actionAttachments' in record).toBe(false);

    // Images and pending files from an earlier playthrough must not survive the load.
    await act(async () => {
      live().setActionAttachments({ stale: [image('z')] });
      live().setPendingAttachments([image('p')]);
    });
    await act(async () => { await live().loadGame('attach-absent', []); });
    expect(live().actionAttachments).toEqual({});
    expect(live().pendingAttachments).toEqual([]);
  });
});
