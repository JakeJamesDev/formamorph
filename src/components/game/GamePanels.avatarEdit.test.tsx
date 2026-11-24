import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { LeftPanel } from './GamePanels';
import { EntityAvatar } from './EntityAvatar';
import { defaultSystemPrompt } from './GamePrompts';
import { renderInGame, worldFixture, type Gameplay } from '@/test/gamePanels';
import { resetVrmViewerStub, vrmViewerCaps, vrmViewerRenders } from '@/test/stubs/vrmViewer';
import ModelStorageService from '@/services/ModelStorageService';
import type { CharacterData, Entity, Trait } from '@/types';
import type { VRMCapabilities } from '@/views/VRMViewer';

vi.mock('@/views/VRMViewer', () => import('@/test/stubs/vrmViewer'));
vi.mock('@/lib/useTtsPlayback', () => import('@/test/stubs/ttsPlayback'));
vi.mock('@/services/ModelStorageService', () => ({
  default: {
    getModelMetadata: vi.fn(),
    getModelData: vi.fn(),
    seedBundledAvatars: vi.fn(),
    addModel: vi.fn(),
  },
}));

const OLD_AVATAR = { data: 'data:model/vrm;base64,Z2xURgIA', type: 'model/vrm', name: 'Wren.vrm' };
const wren: Entity = { id: 'wren', name: 'Wren', persona: true, locations: [] };

const CAPS: VRMCapabilities = {
  bodyMorphs: ['Belly'],
  headMorphs: [],
  hairStyles: ['ponytail', 'bobcut'],
  hairLength: true,
  colors: { hair: '#ffffff', eye: '#000000', skin: '#eeeeee' },
  extras: ['Shirt'],
};
const NO_CONTROLS: VRMCapabilities = { bodyMorphs: [], headMorphs: [], hairStyles: [], hairLength: false, colors: {}, extras: [] };

/** A look set at entry: a body slider, hair, one color the player changed, an extra color, and Reed. */
const STORED: CharacterData = {
  bodyMorphs: { Belly: 0.5 },
  hairColor: '#123456',
  currentHairStyle: 'bobcut',
  hairLength: 1.2,
  extraColors: { Shirt: '#abcdef' },
  chosenVrm: { pick: { kind: 'library', id: 'reed' } },
};

/** An old world as an older build stored it, loaded through the real migration. A world Avatar locks the pick. */
const oldWorld = (locked: boolean) => ({
  version: __APP_VERSION__,
  worldOverview: { ...worldFixture().worldOverview, use3DModel: true, customPlayerVRM: locked ? OLD_AVATAR : null },
  entities: [wren],
}) as never;

const show = ({ locked = false, look = STORED, turns, page, seed }: {
  locked?: boolean;
  look?: CharacterData;
  turns?: { narration: string }[];
  page?: number;
  seed?: (g: Gameplay) => void;
} = {}) => renderInGame(
  <LeftPanel entities={[wren]} onEntityClick={vi.fn()} narrationPrompt={defaultSystemPrompt} />,
  { world: oldWorld(locked), turns, page, seed: (g) => { g.setCharacterData(look); seed?.(g); } },
);

/** The in-game Avatar's latest props: the editor's viewer takes `animate`, the in-game one a color plan. */
const inGameProps = () => [...vrmViewerRenders].reverse().find((props) => 'colorPlan' in props);
const editorProps = () => [...vrmViewerRenders].reverse().find((props) => 'animate' in props);

// The slider row labels its root, not the thumb.
const bellyThumb = (dialog: HTMLElement) => {
  const thumb = dialog.querySelector<HTMLElement>('#morph-Belly [role="slider"]');
  if (!thumb) throw new Error('no Belly slider');
  return thumb;
};
const pencil = () => screen.queryByRole('button', { name: 'Edit Avatar' });
const openEditor = async () => {
  fireEvent.click(await screen.findByRole('button', { name: 'Edit Avatar' }));
  const dialog = await screen.findByRole('dialog', { name: 'Edit Avatar' });
  // The model loads once the library list is read.
  await waitFor(() => expect(editorProps()?.modelUrl).toBeDefined());
  return dialog;
};
const saveButton = (dialog: HTMLElement) => within(dialog).getByRole('button', { name: 'Save' });
/** Moves the Belly slider one step, from the stored 0.5. */
const moveBelly = async (dialog: HTMLElement) => {
  await waitFor(() => bellyThumb(dialog));
  fireEvent.keyDown(bellyThumb(dialog), { key: 'ArrowRight' });
  await waitFor(() => expect(editorProps()?.bodyMorphValues).toEqual({ Belly: 0.55 }));
  await waitFor(() => expect(saveButton(dialog)).toBeEnabled());
};
const closed = () => waitFor(() => expect(screen.queryByRole('dialog', { name: 'Edit Avatar' })).toBeNull());

beforeEach(() => {
  resetVrmViewerStub();
  vrmViewerCaps.value = CAPS;
  vi.mocked(ModelStorageService.getModelMetadata).mockResolvedValue([
    { id: 'heron', name: 'Heron' }, { id: 'reed', name: 'Reed' },
  ] as never);
  vi.mocked(ModelStorageService.getModelData).mockResolvedValue({ blob: new Blob() } as never);
  vi.mocked(ModelStorageService.seedBundledAvatars).mockResolvedValue();
});

describe('the pencil on the played Avatar', () => {
  it('shows on the played Avatar in the entity view', async () => {
    show();
    expect(await screen.findByRole('button', { name: 'Edit Avatar' })).toBeInTheDocument();
  });

  it("never shows on another entity's Avatar", async () => {
    renderInGame(
      <EntityAvatar entity={wren} source={{ kind: 'library', id: 'heron' }} played={false} resolving={false} />,
      { world: oldWorld(false), seed: (g) => g.setCharacterData(STORED) },
    );
    await waitFor(() => expect(inGameProps()?.modelUrl).toBeDefined());
    expect(pencil()).toBeNull();
  });

  it('is hidden on a past turn', async () => {
    show({ turns: [{ narration: 'One.' }, { narration: 'Two.' }], page: 1 });
    await waitFor(() => expect(inGameProps()?.modelUrl).toBeDefined());
    expect(pencil()).toBeNull();
  });

  it('is hidden in a locked world when the model reports no slider or color', async () => {
    vrmViewerCaps.value = NO_CONTROLS;
    show({ locked: true });
    await waitFor(() => expect(inGameProps()?.modelUrl).toBe(OLD_AVATAR.data));
    expect(pencil()).toBeNull();
  });

  it('shows in a locked world once the model reports something to change', async () => {
    show({ locked: true });
    expect(await screen.findByRole('button', { name: 'Edit Avatar' })).toBeInTheDocument();
  });
});

describe('the in-game Avatar editor', () => {
  it('opens on the stored look and chosen Avatar, and the first model load keeps the seeded values', async () => {
    show();
    const dialog = await openEditor();
    // The stub reported the model's own hair color on load; the seeded one stays.
    expect(editorProps()).toMatchObject({
      bodyMorphValues: { Belly: 0.5 },
      hairColor: '#123456',
      eyeColor: undefined,
      skinColor: undefined,
      currentHairStyle: 'bobcut',
      hairLength: 1.2,
      extraColors: { Shirt: '#abcdef' },
    });
    expect(within(dialog).getByText('Reed')).toBeInTheDocument();
  });

  it('keeps untouched colors absent and the rest of the look as stored after Save', async () => {
    const view = show();
    const dialog = await openEditor();
    await moveBelly(dialog);
    fireEvent.click(saveButton(dialog));
    await closed();
    const saved = view.gameplay().characterData;
    expect(saved).toMatchObject({
      hairColor: '#123456', currentHairStyle: 'bobcut', hairLength: 1.2, extraColors: { Shirt: '#abcdef' }, chosenVrm: STORED.chosenVrm,
    });
    expect(saved?.eyeColor).toBeUndefined();
    expect(saved?.skinColor).toBeUndefined();
  });

  it('keeps a null chosen Avatar null after Save with no switch', async () => {
    const view = show({ look: { ...STORED, chosenVrm: null } });
    const dialog = await openEditor();
    await moveBelly(dialog);
    fireEvent.click(saveButton(dialog));
    await closed();
    expect(view.gameplay().characterData?.chosenVrm).toBeNull();
  });

  it('offers Save only once something changed', async () => {
    show();
    const dialog = await openEditor();
    await waitFor(() => bellyThumb(dialog));
    expect(saveButton(dialog)).toBeDisabled();
    await moveBelly(dialog);
  });

  it('Save changes the in-game Avatar at once and writes no turn snapshot', async () => {
    const view = show({ turns: [{ narration: 'One.' }] });
    const states = view.gameplay().gameStates.length;
    const dialog = await openEditor();
    await moveBelly(dialog);
    fireEvent.click(saveButton(dialog));
    await waitFor(() => expect(inGameProps()?.bodyMorphValues).toMatchObject({ Belly: 0.55 }));
    expect(view.gameplay().characterData?.bodyMorphs).toEqual({ Belly: 0.55 });
    expect(view.gameplay().gameStates.length).toBe(states);
  });

  it('Cancel with no changes closes at once', async () => {
    show();
    const dialog = await openEditor();
    await waitFor(() => bellyThumb(dialog));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await closed();
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('Cancel closes at once after Quick Start, when the model replaces the empty hairstyle', async () => {
    show({ look: { bodyMorphs: {}, currentHairStyle: '', hairLength: 0, chosenVrm: null } });
    const dialog = await openEditor();
    await waitFor(() => expect(editorProps()?.currentHairStyle).toBe('ponytail'));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await closed();
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('Escape, as the back button sends it, asks first when something changed', async () => {
    show();
    const dialog = await openEditor();
    await moveBelly(dialog);
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(await screen.findByRole('alertdialog', { name: 'Discard Changes?' })).toBeInTheDocument();
    expect(dialog).toBeInTheDocument();
  });

  it('Cancel with changes asks first, and Discard leaves the stored look as it was', async () => {
    const view = show();
    const dialog = await openEditor();
    await moveBelly(dialog);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    const confirm = await screen.findByRole('alertdialog', { name: 'Discard Changes?' });
    // Still open under the confirm, which hides it from the accessibility tree.
    expect(dialog).toBeInTheDocument();
    fireEvent.click(within(confirm).getByRole('button', { name: 'Discard' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Edit Avatar' })).toBeNull());
    expect(view.gameplay().characterData).toEqual(STORED);
  });

  it('saves a switched Avatar in an unlocked world', async () => {
    const view = show();
    const dialog = await openEditor();
    const picker = await waitFor(() => {
      const box = within(dialog).getAllByRole('combobox').find((b) => b.textContent === 'Reed');
      if (!box) throw new Error('no picker on Reed');
      return box;
    });
    fireEvent.click(picker);
    fireEvent.click(await screen.findByRole('option', { name: 'Heron' }));
    await waitFor(() => expect(saveButton(dialog)).toBeEnabled());
    fireEvent.click(saveButton(dialog));
    await waitFor(() => expect(view.gameplay().characterData?.chosenVrm).toEqual({ pick: { kind: 'library', id: 'heron' } }));
  });

  it('shows no Avatar picker in a locked world', async () => {
    show({ locked: true });
    const dialog = await openEditor();
    await waitFor(() => bellyThumb(dialog));
    expect(within(dialog).queryByText('Player Avatar')).toBeNull();
  });

  it('shows trait-held sliders as locked', async () => {
    show({
      seed: (g) => {
        g.setGlobalTraits([{ id: 'tall', name: 'Tall' } as Trait]);
        g.setPlayerLookStats({
          stats: [], authored: [],
          traits: { on: [], active: [{ ownerId: null, traitId: 'tall', morphPins: [{ name: 'Belly', value: 1 }] }] },
        });
      },
    });
    const dialog = await openEditor();
    await waitFor(() => expect(bellyThumb(dialog)).toHaveAttribute('data-disabled'));
    expect(within(dialog).getByText(/Set by Tall/)).toBeInTheDocument();
  });
});
