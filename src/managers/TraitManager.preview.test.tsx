import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Entity, Stat, Trait } from '@/types';
import { EditorModeContext } from '@/lib/editorMode';
import { NO_AVATAR_PREVIEW_HINT, NO_MODEL_HINT } from '@/lib/useSliderPicker';
import type { VRMCapabilities } from '@/views/VRMViewer';
import TraitManager from './TraitManager';

const CAPS: VRMCapabilities = {
  headMorphs: ['Ear Shape'],
  bodyMorphs: ['Fat'],
  hairStyles: [],
  hairLength: false,
  colors: { hair: '#402010', skin: '#e8c8b0' },
  extras: [],
};

const elf: Trait = {
  id: 'elf', name: 'Elf', statChanges: [],
  morphPins: [{ name: 'Ear Shape', value: 0.6 }],
  colorPins: [{ channel: 'hair', color: '#ffffff' }],
};
// Another trait's rows on the same sliders and colors; the Preview never shows them.
const human: Trait = {
  id: 'human', name: 'Human', statChanges: [],
  morphPins: [{ name: 'Ear Shape', value: 0 }, { name: 'Fat', value: 0.9 }],
  colorPins: [{ channel: 'skin', color: '#000000' }],
};

// A stat bound to the same slider and color; the Preview never shows it either.
const growth = {
  id: 'growth', name: 'Growth', type: 'number', description: '', min: 0, max: 100, value: 100,
  morphBindings: [{ name: 'Fat', by: 1 }], colorBindings: [{ channel: 'skin', color: '#00ff00' }],
} as unknown as Stat;

const world = vi.hoisted(() => ({
  stats: [] as Stat[],
  traits: [] as Trait[],
  entities: [] as unknown[],
  writes: 0,
  rerender: () => {},
}));
vi.mock('@/contexts/GameDataContext', () => {
  const data = () => ({
    stats: world.stats, statGroups: [], traits: world.traits, traitGroups: [], entities: world.entities, locations: [],
    placeholders: [], worldOverview: { allowedPersonas: 'world' }, bodies: undefined,
    updateTrait: (next: Trait) => {
      world.writes += 1;
      world.traits = world.traits.map((t) => (t.id === next.id ? next : t));
      world.rerender();
    },
  });
  return { useGameData: data, useGameDataOptional: data };
});
vi.mock('@/components/prompt/PlaceholderField', () => ({
  default: (props: { label: string; value: string }) => <input readOnly aria-label={props.label} value={props.value} />,
  PlaceholderNameField: (props: { value: string }) => <input readOnly value={props.value} />,
}));
vi.mock('@/lib/vrmMorphLoader', () => ({
  loadMorphSplit: async () => ({ body: ['Fat'], head: ['Ear Shape'] }),
  loadMorphCatalog: async () => [{ name: 'Ear Shape', group: 'head' }, { name: 'Fat', group: 'body' }],
  loadVrmLook: async () => ({ catalog: [{ name: 'Ear Shape', group: 'head' }, { name: 'Fat', group: 'body' }], channels: ['skin', 'hair'], colors: CAPS.colors }),
}));
const storage = vi.hoisted(() => ({ read: [] as string[] }));
vi.mock('@/services/ModelStorageService', () => ({
  default: {
    getModelMetadata: async () => [{ id: 'aurelia', name: 'Aurelia' }],
    getModelData: async (id: string) => {
      storage.read.push(id);
      return { blob: new Blob(['x']) };
    },
  },
}));
// The viewer reports the model it loaded and keeps the look it was last given.
const viewer = vi.hoisted(() => ({ props: null as null | Record<string, unknown> }));
vi.mock('@/views/VRMViewer', async () => {
  const { useEffect } = await import('react');
  const FakeViewer = (props: { onCapabilities?: (caps: VRMCapabilities) => void } & Record<string, unknown>) => {
    viewer.props = props;
    const report = props.onCapabilities;
    useEffect(() => { report?.(CAPS); }, []); // eslint-disable-line react-hooks/exhaustive-deps
    return <div data-testid="avatar-viewer" />;
  };
  return { default: FakeViewer };
});

const Harness = ({ owner }: { owner?: Entity }) => {
  const [, setTick] = useState(0);
  world.rerender = () => setTick((n) => n + 1);
  const trait = owner ? owner.traits![0] : world.traits.find((t) => t.id === 'elf')!;
  return <TraitManager trait={trait} owner={owner} onOpenTrait={() => {}} tab="appearance" onTabChange={() => {}} />;
};

const renderTrait = (owner?: Entity) => render(
  <EditorModeContext.Provider value={{ mode: 'advanced', advanced: true, setMode: () => {} }}>
    <Harness owner={owner} />
  </EditorModeContext.Provider>,
);

const elfNow = () => world.traits.find((t) => t.id === 'elf')!;
const previewButton = () => screen.getByRole('button', { name: 'Preview' });
const dialog = () => screen.getByRole('dialog', { name: 'Preview Elf' });
const section = (heading: string) => within(dialog()).getByRole('heading', { name: heading }).parentElement as HTMLElement;
const undo = (name: string) => within(dialog()).getByRole('button', { name: `Undo ${name}` });
const saveButton = () => within(dialog()).getByRole('button', { name: 'Save' });

const openPreview = async () => {
  renderTrait();
  await waitFor(() => expect(previewButton()).toBeEnabled());
  await userEvent.click(previewButton());
  await within(dialog()).findByRole('heading', { name: 'Head Features' });
};

/** Moves a section's slider by keyboard steps of 0.05. */
const nudge = async (heading: string, keys: string) => {
  within(section(heading)).getByRole('slider').focus();
  await userEvent.keyboard(keys);
};

const pickHex = async (label: string, hex: string) => {
  fireEvent.click(within(dialog()).getByRole('button', { name: label }));
  fireEvent.change(await screen.findByRole('textbox', { name: 'Hex Color' }), { target: { value: hex } });
  fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });
  await waitFor(() => expect(screen.queryByRole('textbox', { name: 'Hex Color' })).toBeNull());
};

beforeEach(() => {
  URL.createObjectURL = vi.fn(() => 'blob:avatar');
  URL.revokeObjectURL = vi.fn();
  world.traits = [elf, human];
  world.stats = [growth];
  world.entities = [{ id: 'p1', name: 'P', persona: true, locations: [], vrmPick: { kind: 'library', id: 'aurelia' } }];
  world.writes = 0;
  storage.read = [];
  viewer.props = null;
});

describe("a trait's Preview", () => {
  it("opens the trait's resolved Avatar with only this trait's pins applied", async () => {
    renderTrait();
    await waitFor(() => expect(previewButton()).toBeEnabled());
    // The viewer mounts only while the dialog is open.
    expect(screen.queryByTestId('avatar-viewer')).toBeNull();
    await userEvent.click(previewButton());
    await within(dialog()).findByRole('heading', { name: 'Head Features' });

    expect(storage.read).toContain('aurelia');
    expect(viewer.props).toMatchObject({ bodyMorphValues: { 'Ear Shape': 0.6, Fat: 0 }, hairColor: '#ffffff', skinColor: undefined });
    expect(within(dialog()).getByRole('button', { name: 'Hair Color' })).toHaveAccessibleDescription('#ffffff');
  });

  it('writes a drag on a pinned slider to the same row, in one write', async () => {
    await openPreview();
    expect(saveButton()).toBeDisabled();
    await nudge('Head Features', '{ArrowRight}{ArrowRight}');
    await userEvent.click(saveButton());

    expect(world.writes).toBe(1);
    expect(elfNow().morphPins).toEqual([{ name: 'Ear Shape', value: 0.7 }]);
    expect(elfNow().colorPins).toEqual(elf.colorPins);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('adds a row for a dragged slider with none, and none for an untouched one', async () => {
    world.traits = [{ ...elf, morphPins: undefined }, human];
    await openPreview();
    await nudge('Body Sliders', '{ArrowRight}');
    await userEvent.click(saveButton());

    expect(elfNow().morphPins).toEqual([{ name: 'Fat', value: 0.05 }]);
  });

  it("returns a slider to the trait's saved value with its undo, which leaves nothing to save", async () => {
    await openPreview();
    expect(undo('Ear Shape')).toBeDisabled();
    await nudge('Body Sliders', '{ArrowRight}');
    expect(saveButton()).toBeEnabled();
    fireEvent.click(undo('Fat'));

    expect(undo('Fat')).toBeDisabled();
    expect(saveButton()).toBeDisabled();

    await nudge('Head Features', '{ArrowLeft}');
    fireEvent.click(undo('Ear Shape'));
    await waitFor(() => expect(viewer.props).toMatchObject({ bodyMorphValues: { 'Ear Shape': 0.6 } }));
    expect(undo('Ear Shape')).toBeDisabled();
  });

  it("writes a picked color, and its undo returns to the trait's color, not the model's", async () => {
    await openPreview();
    await pickHex('Hair Color', 'AA11CC');
    expect(viewer.props).toMatchObject({ hairColor: '#aa11cc' });
    fireEvent.click(undo('Hair Color'));
    expect(within(dialog()).getByRole('button', { name: 'Hair Color' })).toHaveAccessibleDescription('#ffffff');
    expect(undo('Hair Color')).toBeDisabled();

    await pickHex('Skin Color', '112233');
    await userEvent.click(saveButton());
    expect(elfNow().colorPins).toEqual([{ channel: 'hair', color: '#ffffff' }, { channel: 'skin', color: '#112233' }]);
  });

  it('asks before closing with a change, and Discard leaves the trait as it was', async () => {
    await openPreview();
    await nudge('Head Features', '{ArrowLeft}');
    await userEvent.click(within(dialog()).getByRole('button', { name: 'Cancel' }));
    const confirm = await screen.findByRole('alertdialog', { name: 'Discard Changes?' });
    await userEvent.click(within(confirm).getByRole('button', { name: 'Discard' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(world.writes).toBe(0);
    expect(elfNow()).toBe(elf);
  });

  it('closes at once with no change', async () => {
    await openPreview();
    await userEvent.click(within(dialog()).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('the Preview button without an Avatar', () => {
  const ownerTrait: Trait = { id: 'scaled', name: 'Scaled', statChanges: [] };

  it('is disabled beside the no-model hint when the row has no model', async () => {
    renderTrait({ id: 'e1', name: 'Wick', traits: [ownerTrait] });
    expect(await screen.findByText(NO_MODEL_HINT)).toBeInTheDocument();
    expect(previewButton()).toBeDisabled();
    expect(screen.queryByText(NO_AVATAR_PREVIEW_HINT)).toBeNull();
  });

  it('is disabled beside its own hint when the entity has only a 3D model', async () => {
    renderTrait({ id: 'e1', name: 'Wick', traits: [ownerTrait], model: { type: 'model/gltf-binary', data: 'data:model/gltf', name: 'wick.glb' } });
    expect(await screen.findByText(NO_AVATAR_PREVIEW_HINT)).toBeInTheDocument();
    expect(previewButton()).toBeDisabled();
  });
});
