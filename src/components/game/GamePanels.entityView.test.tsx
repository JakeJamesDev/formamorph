import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { LeftPanel } from './GamePanels';
import { defaultSystemPrompt } from './GamePrompts';
import { renderInGame, statFixture, worldFixture, type Gameplay } from '@/test/gamePanels';
import { resetVrmViewerStub, vrmViewerRenders } from '@/test/stubs/vrmViewer';
import type { CharacterData, Entity, EntityStatValues, SceneEntity, WorldVrmStore } from '@/types';

vi.mock('@/views/VRMViewer', () => import('@/test/stubs/vrmViewer'));
vi.mock('@/lib/useTtsPlayback', () => import('@/test/stubs/ttsPlayback'));
vi.mock('@/views/ModelViewer', () => ({ default: () => <div data-testid="model-viewer" /> }));
vi.mock('@/services/ModelStorageService', () => ({
  default: { getModelMetadata: vi.fn().mockResolvedValue([]), getModelData: vi.fn().mockRejectedValue(new Error('none')) },
}));
const mobile = vi.hoisted(() => ({ value: false }));
vi.mock('@/lib/useIsMobile', () => ({ useIsMobile: () => mobile.value }));

const vrm = (name: string) => ({ name, file: { data: `data:model/vrm;base64,${name}`, type: 'model/vrm', name: `${name}.vrm` } });
const store: WorldVrmStore = { wren: vrm('Wren'), golem: vrm('Golem') };
const MODEL = { name: 'golem.glb', type: 'model/gltf-binary', data: 'data:model/gltf-binary;base64,AAAA' };
const PICTURE = 'data:image/png;base64,AAAA';
const PICTURE_B = 'data:image/png;base64,BBBB';

const cracks = statFixture('Wounds', 0, { morphBindings: ['Cracks'] });
const golem: Entity = {
  id: 'golem', name: 'Golem', locations: [], model: MODEL, images: [{ data: PICTURE }],
  vrmPick: { kind: 'world', id: 'golem' }, stats: [cracks],
} as Entity;
const heron = { id: 'heron', name: 'Heron', locations: [], images: [{ data: PICTURE_B }] } as unknown as Entity;
const wren = { id: 'wren', name: 'Wren', persona: true, locations: [], vrmPick: { kind: 'world', id: 'wren' } } as unknown as Entity;
const plainWren = { ...wren, vrmPick: undefined } as Entity;

const custom: CharacterData = { bodyMorphs: { Belly: 0.1 }, currentHairStyle: 'long', hairLength: 0.5, hairColor: '#ff0000' };
const golemStats = (value: number): EntityStatValues => ({ golem: [{ ...cracks, value }] });

const show = ({ cast, scene, overview = {}, seed }: {
  cast: Entity[];
  scene: SceneEntity[];
  overview?: Record<string, unknown>;
  seed?: (g: Gameplay) => void;
}) => {
  const onEntityClick = vi.fn();
  const view = renderInGame(
    <LeftPanel entities={cast} onEntityClick={onEntityClick} narrationPrompt={defaultSystemPrompt} />,
    {
      world: { entities: cast, worldOverview: { ...worldFixture().worldOverview, vrmStore: store, ...overview } } as never,
      seed: (g) => {
        g.setVisibleEntities(scene);
        g.setCharacterData(custom);
        g.setBodyMorphValues({ Belly: 0.3 });
        g.setEntityStats(golemStats(40));
        seed?.(g);
      },
    },
  );
  return { ...view, onEntityClick };
};

const lastAvatarUrl = () => vrmViewerRenders[vrmViewerRenders.length - 1]?.modelUrl;
const entityRow = (name: string) => {
  fireEvent.mouseDown(screen.getByRole('tab', { name: /Entities/i }));
  return within(screen.getByRole('tabpanel')).getByText(name);
};

beforeEach(() => {
  resetVrmViewerStub();
  mobile.value = false;
});

describe('LeftPanel — one entity view', () => {
  it('shows the Avatar before the 3D model and the image', async () => {
    show({ cast: [golem], scene: [{ name: 'Golem', revealed: true }] });
    await waitFor(() => expect(lastAvatarUrl()).toBe(store.golem.file.data));
    expect(screen.queryByTestId('model-viewer')).toBeNull();
    expect(screen.getByRole('button', { name: 'View 3D Model' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'View Image' })).toBeInTheDocument();
  });

  it('shows the model before the image when the entity has no Avatar', () => {
    show({ cast: [{ ...golem, vrmPick: undefined }], scene: [{ name: 'Golem', revealed: true }] });
    expect(screen.getByTestId('model-viewer')).toBeInTheDocument();
    expect(screen.queryByTestId('vrm-viewer')).toBeNull();
  });

  it('lets the stored preference override the order', () => {
    show({
      cast: [golem], scene: [{ name: 'Golem', revealed: true }],
      seed: (g) => g.setEntityVisualPreference({ golem: 'image' }),
    });
    expect(screen.getByAltText('Golem')).toBeInTheDocument();
    expect(screen.queryByTestId('vrm-viewer')).toBeNull();
    expect(screen.getByRole('button', { name: 'View Avatar' })).toBeInTheDocument();
  });

  it('swaps the view to the entity the player selects', async () => {
    const { onEntityClick } = show({
      cast: [heron, golem], scene: [{ name: 'Heron', revealed: true }, { name: 'Golem', revealed: true }],
    });
    expect(screen.getByAltText('Heron')).toBeInTheDocument();

    fireEvent.click(entityRow('Golem'));
    expect(screen.queryByAltText('Heron')).toBeNull();
    expect(await screen.findByTestId('vrm-viewer')).toBeInTheDocument();
    expect(onEntityClick).not.toHaveBeenCalled();
  });

  it("opens on the played entity's Avatar, in the save's customization with the player's stat morphs", async () => {
    show({
      cast: [heron, wren], scene: [{ name: 'Heron', revealed: true }],
      seed: (g) => g.setPersonaRef({ source: 'world', entityId: 'wren' }),
    });
    await waitFor(() => expect(lastAvatarUrl()).toBe(store.wren.file.data));
    const props = vrmViewerRenders[vrmViewerRenders.length - 1];
    expect(props.hairColor).toBe('#ff0000');
    expect(props.currentHairStyle).toBe('long');
    expect(props.bodyMorphValues).toEqual({ Belly: 0.4 });
  });

  it('opens on the first scene entity with a visual when the played entity has none', () => {
    show({
      cast: [heron, plainWren], scene: [{ name: 'Heron', revealed: true }],
      seed: (g) => g.setPersonaRef({ source: 'world', entityId: 'wren' }),
    });
    expect(screen.getByAltText('Heron')).toBeInTheDocument();
    expect(screen.queryByTestId('vrm-viewer')).toBeNull();
  });

  it("drives an NPC's Avatar from its own stats, with no customization", async () => {
    show({
      cast: [golem, wren], scene: [{ name: 'Golem', revealed: true }],
      seed: (g) => g.setPersonaRef({ source: 'world', entityId: 'wren' }),
    });
    fireEvent.click(entityRow('Golem'));
    await waitFor(() => expect(lastAvatarUrl()).toBe(store.golem.file.data));
    const props = vrmViewerRenders[vrmViewerRenders.length - 1];
    expect(props.bodyMorphValues).toEqual({ Cracks: 0.4 });
    expect(props.hairColor).toBeUndefined();
    expect(props.currentHairStyle).toBeUndefined();
    expect(props.hairLength).toBeUndefined();
  });

  it('moves the played Avatar and an NPC Avatar each with its own stat changes', async () => {
    const { gameplay } = show({
      cast: [golem, wren], scene: [{ name: 'Golem', revealed: true }],
      seed: (g) => g.setPersonaRef({ source: 'world', entityId: 'wren' }),
    });
    await waitFor(() => expect(lastAvatarUrl()).toBe(store.wren.file.data));
    gameplay().setBodyMorphValues({ Belly: 0.6 });
    await waitFor(() => expect(vrmViewerRenders[vrmViewerRenders.length - 1].bodyMorphValues).toEqual({ Belly: 0.7 }));

    fireEvent.click(entityRow('Golem'));
    gameplay().setEntityStats(golemStats(90));
    await waitFor(() => expect(vrmViewerRenders[vrmViewerRenders.length - 1].bodyMorphValues).toEqual({ Cracks: 0.9 }));
  });

  it('drops the Avatar/Entities toggle and names the view in the hide control', () => {
    show({ cast: [golem], scene: [{ name: 'Golem', revealed: true }] });
    expect(screen.queryByRole('radiogroup')).toBeNull();
    expect(screen.getByRole('button', { name: 'Hide Entity View' })).toBeInTheDocument();
  });
});

describe('LeftPanel — one entity view on mobile', () => {
  beforeEach(() => { mobile.value = true; });

  it('replaces the Avatar tab with the View tab, which shows the entity view', async () => {
    show({
      cast: [heron, wren], scene: [{ name: 'Heron', revealed: true }],
      seed: (g) => g.setPersonaRef({ source: 'world', entityId: 'wren' }),
    });
    expect(screen.queryByRole('tab', { name: 'Avatar' })).toBeNull();
    expect(screen.getByRole('tab', { name: 'View' })).toHaveAttribute('data-state', 'active');
    await waitFor(() => expect(lastAvatarUrl()).toBe(store.wren.file.data));
  });

  it('selects a clicked entity for the View tab and still opens its popup', () => {
    const { onEntityClick } = show({
      cast: [heron, wren], scene: [{ name: 'Heron', revealed: true }],
      seed: (g) => g.setPersonaRef({ source: 'world', entityId: 'wren' }),
    });
    fireEvent.click(entityRow('Heron'));
    expect(onEntityClick).toHaveBeenCalledWith('Heron');
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'View' }));
    expect(screen.getByAltText('Heron')).toBeInTheDocument();
  });
});

describe('LeftPanel — the You row in a legacy-fallback world', () => {
  const fallback = { legacyVrmFallback: { kind: 'world', id: 'wren' } };

  it('shows the fallback Avatar under no persona and selects it again from a select-only You row', async () => {
    const { onEntityClick } = show({ cast: [heron], scene: [{ name: 'Heron', revealed: true }], overview: fallback });
    await waitFor(() => expect(lastAvatarUrl()).toBe(store.wren.file.data));

    fireEvent.click(entityRow('Heron'));
    expect(screen.getByAltText('Heron')).toBeInTheDocument();

    fireEvent.click(entityRow('You'));
    await waitFor(() => expect(lastAvatarUrl()).toBe(store.wren.file.data));
    expect(screen.queryByAltText('Heron')).toBeNull();
    expect(onEntityClick).not.toHaveBeenCalled();
  });

  it('shows no You row when the world has no fallback', () => {
    show({ cast: [heron], scene: [{ name: 'Heron', revealed: true }] });
    fireEvent.mouseDown(screen.getByRole('tab', { name: /Entities/i }));
    expect(within(screen.getByRole('tabpanel')).queryByText('You')).toBeNull();
  });
});
