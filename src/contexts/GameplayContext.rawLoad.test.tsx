// Real in-memory storage for saves; must load before anything touches `indexedDB`.
import 'fake-indexeddb/auto';
import { describe, it, expect, vi } from 'vitest';
import { render, act } from '@testing-library/react';
import { GameplayProvider, useGameplay } from './GameplayContext';
import { GameDataProvider } from './GameDataContext';
import { PlaceholderSessionProvider } from './PlaceholderSessionContext';
import { putSaveRecord } from '@/components/modals/dbUtils';
import { LEGACY_VRM_ID } from '@/lib/legacyVrm';
import type { SaveRecord } from '@/types';

vi.mock('@/lib/useTtsPlayback', () => import('@/test/stubs/ttsPlayback'));
// A conversion that throws sends the load down the best-effort raw path.
vi.mock('@/lib/saveConversionWorkerUtils', () => ({
  convertSaveFile: async () => { throw new Error('conversion failed'); },
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

// A pre-flat save shape that SaveRecord no longer types.
const legacySave = (id: string, playerModelId: string) => ({
  id, name: 'old', isGameStarted: true, playerStats: [], playerTraits: [], visibleEntities: [], logEntries: [],
  characterData: { bodyMorphs: {}, currentHairStyle: '', hairLength: 0, hairTypes: {}, playerModelId },
}) as unknown as SaveRecord;

const store = { [LEGACY_VRM_ID]: { name: 'Wren', file: { data: 'data:model/vrm;base64,Z2xURgIA', type: 'model/vrm', name: 'Wren.vrm' } } };

describe('raw load after a failed save conversion', () => {
  it('remaps the chosen library Avatar', async () => {
    const live = mount();
    await putSaveRecord(legacySave('raw-library', 'heron'));
    await act(async () => { expect(await live().loadGame('raw-library', [], [], undefined, store)).toBe(true); });
    expect(live().characterData?.chosenVrm).toEqual({ pick: { kind: 'library', id: 'heron' }, legacy: true });
    expect(live().characterData).not.toHaveProperty('playerModelId');
  });

  it('remaps the no-choice form to the world Avatar', async () => {
    const live = mount();
    await putSaveRecord(legacySave('raw-world', 'world'));
    await act(async () => { await live().loadGame('raw-world', [], [], undefined, store); });
    expect(live().characterData?.chosenVrm).toEqual({ pick: { kind: 'world', id: LEGACY_VRM_ID }, legacy: true });
  });

  it('keeps an already-remapped choice', async () => {
    const live = mount();
    const chosenVrm = { pick: { kind: 'library', id: 'heron' } };
    await putSaveRecord({ ...legacySave('raw-current', 'ignored'), characterData: { bodyMorphs: {}, chosenVrm } } as unknown as SaveRecord);
    await act(async () => { await live().loadGame('raw-current', [], [], undefined, store); });
    expect(live().characterData?.chosenVrm).toEqual(chosenVrm);
  });
});
