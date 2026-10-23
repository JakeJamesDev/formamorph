// Real in-memory storage for saves; must load before anything touches `indexedDB`.
import 'fake-indexeddb/auto';
import { describe, it, expect, vi } from 'vitest';
import { render, act, waitFor } from '@testing-library/react';
import { GameplayProvider, useGameplay } from './GameplayContext';
import { GameDataProvider, useGameData } from './GameDataContext';
import { PlaceholderSessionProvider } from './PlaceholderSessionContext';
import { useResolvedWorld } from '@/lib/useResolvedWorld';
import { useSeedAvatarOnSaveLoad } from '@/lib/useLibraryAvatars';
import { LEGACY_VRM_ID, defaultCharacterData } from '@/lib/legacyVrm';
import { putSaveRecord } from '@/components/modals/dbUtils';
import { worldFixture } from '@/test/gamePanels';
import { APP_VERSION } from '@/lib/version';
import type { SaveRecord, World } from '@/types';

vi.mock('@/lib/useTtsPlayback', () => import('@/test/stubs/ttsPlayback'));

interface Live {
  gameplay: ReturnType<typeof useGameplay>;
  gameData: ReturnType<typeof useGameData>;
}

/** GameViewer's seeding hook, mounted as GameViewer mounts it. */
const Expose = ({ expose }: { expose: (l: Live) => void }) => {
  const gameplay = useGameplay();
  const { persona } = useResolvedWorld();
  useSeedAvatarOnSaveLoad(gameplay.saveLoads, !gameplay.personaPending, persona);
  expose({ gameplay, gameData: useGameData() });
  return null;
};

const mount = () => {
  let live: Live | null = null;
  render(
    <GameDataProvider>
      <PlaceholderSessionProvider>
        <GameplayProvider>
          <Expose expose={(l) => { live = l; }} />
        </GameplayProvider>
      </PlaceholderSessionProvider>
    </GameDataProvider>,
  );
  return () => {
    if (!live) throw new Error('contexts not available (did the render throw?)');
    return live as Live;
  };
};

const OLD_AVATAR = { data: 'data:model/vrm;base64,Z2xURgIA', type: 'model/vrm', name: 'Wren.vrm' };

/** A world an older build stored, with the 3D Player Avatar flag set as given. */
const oldWorld = (flag: boolean, vrm: typeof OLD_AVATAR | null = OLD_AVATAR) => worldFixture({
  version: APP_VERSION,
  worldOverview: { ...worldFixture().worldOverview, use3DModel: flag, customPlayerVRM: vrm } as unknown as World['worldOverview'],
});

/** A save an older build wrote: its character data names the old player model, or nothing. */
const oldSave = async (id: string, characterData: Record<string, unknown> | null) => {
  const state = { playerTraits: [], globalStats: [], logEntries: [], gameplayText: '', gameTime: 0, choices: [], isGameStarted: true, characterData };
  await putSaveRecord({ id, name: id, version: APP_VERSION, currentState: state, stateHistory: [state], messageHistory: [] } as unknown as SaveRecord);
};

const loadInto = async (live: () => Live, world: World, saveId: string) => {
  let loaded: World | undefined;
  await act(async () => { loaded = live().gameData.loadWorldData(world).world; });
  await act(async () => { await live().gameplay.loadGame(saveId, [], [], [], loaded?.worldOverview.vrmStore); });
};

describe('an old save at game load', () => {
  it("remaps an unset choice to the world's old Avatar, marked legacy", async () => {
    const live = mount();
    await oldSave('unset', { ...defaultCharacterData, chosenVrm: undefined });
    await loadInto(live, oldWorld(true), 'unset');
    expect(live().gameplay.characterData?.chosenVrm).toEqual({ pick: { kind: 'world', id: LEGACY_VRM_ID }, legacy: true });
    expect(live().gameplay.gameStates[0]?.characterData?.chosenVrm).toEqual({ pick: { kind: 'world', id: LEGACY_VRM_ID }, legacy: true });
  });

  it("remaps \"the world's\" to no choice when the world had no old Avatar", async () => {
    const live = mount();
    await oldSave('world-none', { ...defaultCharacterData, chosenVrm: undefined, playerModelId: 'world' });
    await loadInto(live, oldWorld(true, null), 'world-none');
    expect(live().gameplay.characterData?.chosenVrm).toBeNull();
  });

  it('keeps a library Avatar the save chose', async () => {
    const live = mount();
    await oldSave('library', { ...defaultCharacterData, chosenVrm: undefined, playerModelId: 'lib-a' });
    await loadInto(live, oldWorld(true), 'library');
    expect(live().gameplay.characterData?.chosenVrm).toEqual({ pick: { kind: 'library', id: 'lib-a' }, legacy: true });
  });

  it('seeds default customization when the played side shows an Avatar and the save holds none', async () => {
    const live = mount();
    await oldSave('bare', null);
    await loadInto(live, oldWorld(true), 'bare');
    await waitFor(() => expect(live().gameplay.characterData).toEqual(defaultCharacterData));
  });

  it('seeds nothing when the played side shows no Avatar', async () => {
    const live = mount();
    await oldSave('bare-off', null);
    await loadInto(live, oldWorld(false), 'bare-off');
    // The seed runs on the render that counts the load; one more tick lets any write land.
    await waitFor(() => expect(live().gameplay.saveLoads).toBe(1));
    await act(async () => {});
    expect(live().gameplay.characterData).toBeNull();
  });
});
