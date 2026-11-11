import { describe, expect, it, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { LeftPanel } from './GamePanels';
import { defaultSystemPrompt } from './GamePrompts';
import { renderInGame, worldFixture } from '@/test/gamePanels';
import { lastVrmViewerProps, resetVrmViewerStub } from '@/test/stubs/vrmViewer';
import { defaultCharacterData } from '@/lib/legacyVrm';
import ModelStorageService from '@/services/ModelStorageService';
import type { CharacterData, Entity, PersonaRef } from '@/types';

vi.mock('@/views/VRMViewer', () => import('@/test/stubs/vrmViewer'));
vi.mock('@/lib/useTtsPlayback', () => import('@/test/stubs/ttsPlayback'));
vi.mock('@/services/ModelStorageService', () => ({
  default: { getModelMetadata: vi.fn().mockResolvedValue([]), getModelData: vi.fn().mockRejectedValue(new Error('none')) },
}));

const OLD_AVATAR = { data: 'data:model/vrm;base64,Z2xURgIA', type: 'model/vrm', name: 'Wren.vrm' };
const wren: Entity = { id: 'wren', name: 'Wren', persona: true, locations: [] };

/** An old world as an older build stored it, loaded through the real migration. */
const oldWorld = (overview: Record<string, unknown>) => ({
  version: __APP_VERSION__,
  worldOverview: { ...worldFixture().worldOverview, ...overview },
  entities: [wren],
}) as never;

const show = (overview: Record<string, unknown>, persona?: PersonaRef, characterData: CharacterData | null = defaultCharacterData) =>
  renderInGame(
    <LeftPanel entities={[wren]} onEntityClick={vi.fn()} narrationPrompt={defaultSystemPrompt} />,
    { world: oldWorld(overview), seed: (g) => { g.setCharacterData(characterData); if (persona) g.setPersonaRef(persona); } },
  );

beforeEach(() => {
  resetVrmViewerStub();
  vi.mocked(ModelStorageService.getModelMetadata).mockClear();
  vi.mocked(ModelStorageService.getModelData).mockClear();
});

describe("an old world's player Avatar in play", () => {
  it('shows the old world Avatar under None', async () => {
    show({ use3DModel: true, customPlayerVRM: OLD_AVATAR });
    await waitFor(() => expect(lastVrmViewerProps()?.modelUrl).toBe(OLD_AVATAR.data));
  });

  it('shows the old world Avatar under a world persona whose pick is none', async () => {
    show({ use3DModel: true, customPlayerVRM: OLD_AVATAR }, { source: 'world', entityId: 'wren' });
    await waitFor(() => expect(lastVrmViewerProps()?.modelUrl).toBe(OLD_AVATAR.data));
  });

  it("shows no Avatar when the flag was on with no old Avatar and the library is empty", async () => {
    show({ use3DModel: true, customPlayerVRM: null });
    await waitFor(() => expect(ModelStorageService.getModelMetadata).toHaveBeenCalled());
    await waitFor(() => expect(document.querySelector('.animate-spin')).toBeNull());
    expect(screen.queryByTestId('vrm-viewer')).toBeNull();
    expect(ModelStorageService.getModelData).not.toHaveBeenCalled();
  });

  it("holds a loader for User's Default while the library list is read", async () => {
    vi.mocked(ModelStorageService.getModelMetadata).mockReturnValueOnce(new Promise(() => undefined));
    show({ use3DModel: true, customPlayerVRM: null });
    await waitFor(() => expect(document.querySelector('.animate-spin')).not.toBeNull());
    expect(screen.queryByTestId('vrm-viewer')).toBeNull();
  });

  it("shows no Avatar when User's Default's library Avatar fails to load", async () => {
    vi.mocked(ModelStorageService.getModelMetadata).mockResolvedValueOnce([{ id: 'heron' } as never]);
    show({ use3DModel: true, customPlayerVRM: null });
    await waitFor(() => expect(ModelStorageService.getModelData).toHaveBeenCalledWith('heron'));
    await waitFor(() => expect(screen.getByTestId('vrm-viewer')).toBeInTheDocument());
    expect(lastVrmViewerProps()?.modelUrl).toBeUndefined();
  });

  it('shows no player Avatar when the flag was off, even with customization in the save', async () => {
    show({ use3DModel: false, customPlayerVRM: OLD_AVATAR });
    // The view holds a loader while the library list loads; once the read settles, no viewer mounts.
    await waitFor(() => expect(ModelStorageService.getModelMetadata).toHaveBeenCalled());
    await waitFor(() => expect(document.querySelector('.animate-spin')).toBeNull());
    expect(screen.queryByTestId('vrm-viewer')).toBeNull();
  });
});
