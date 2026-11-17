import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { renderMediaTab, undoMediaEdit } from '@/test/mediaTabBench';
import { mediaFixtureWorld } from '@/test/mediaFixture';
import { formatMediaBytes, mediaSections, sectionTitle, totalBytes, type MediaItem } from '@/lib/mediaIndex';
import type { useGameData } from '@/contexts/GameDataContext';
import { measureInWorker, encodeInWorker } from '@/lib/imageOptimWorkerClient';
import { locationImages } from '@/lib/locationImages';
import { coverData } from '@/lib/mediaImages';
import { resolveSound } from '@/lib/mediaSounds';

/** The Media tab's item panel: Replace and Remove, or a list slot's Remove From Slot, each one History Step. */
/** Sound and gallery slots offer no Replace (Q45); their Import is the slot's, tested with the slot. */

vi.mock('../services/WorldStorageService', () => ({
  default: {
    initialize: vi.fn(),
    getWorldMetadata: vi.fn().mockResolvedValue([]),
    storeWorld: vi.fn().mockResolvedValue(undefined),
  },
}));
vi.mock('@/lib/jsonFileWorkerUtils', () => ({
  serializeJsonBlob: vi.fn(), parseJsonText: vi.fn(), terminateWorker: vi.fn(),
}));
vi.mock('react-toastify', () => ({
  toast: Object.assign(vi.fn(() => 'toast'), { info: vi.fn(), success: vi.fn(), error: vi.fn(), update: vi.fn(), dismiss: vi.fn() }),
  ToastContainer: () => null,
}));
vi.mock('@/views/VRMViewer', () => import('@/test/stubs/vrmViewer'));
vi.mock('@/views/ModelViewer', () => ({ default: () => <div data-testid="model-viewer" /> }));
// The image codec runs in a worker jsdom has none of.
vi.mock('@/lib/imageOptimWorkerClient', () => ({ measureInWorker: vi.fn(), encodeInWorker: vi.fn() }));

const SMALL = { w: 64, h: 64, bytes: 200 };
const OVERSIZED = { w: 5000, h: 5000, bytes: 5_000_000 };

beforeEach(() => {
  localStorage.clear();
  vi.mocked(measureInWorker).mockReset().mockResolvedValue(SMALL);
  vi.mocked(encodeInWorker).mockReset().mockResolvedValue('data:image/webp;base64,c21hbGw=');
});

type Ctx = ReturnType<typeof useGameData>;
const section = (name: string) => screen.queryByRole('region', { name });
const cardsOf = (name: string, kind: string) =>
  Array.from(section(name)?.querySelectorAll<HTMLElement>(`[data-media-card="${kind}"]`) ?? []);
const card = (name: string, kind: string, index = 0) => cardsOf(name, kind)[index];
const panel = () => document.querySelector<HTMLElement>('[data-media-panel]');
const panelButton = (name: string) => within(panel()!).queryByRole('button', { name });

const step = (action: () => void) => act(async () => { action(); });
const undo = undoMediaEdit;

const openMedia = (mode: 'simple' | 'advanced' = 'simple') => {
  const bench = renderMediaTab(mediaFixtureWorld(), mode);
  return bench;
};

const pickFile = async (file: File) => {
  const input = panel()!.querySelector<HTMLInputElement>('input[data-media-replace]')!;
  await act(async () => { fireEvent.change(input, { target: { files: [file] } }); });
};

/** A slot the item panel acts on: where its card sits, how to read the field, and a file that replaces it. */
interface Slot {
  /** The control that clears it: the panel's Remove, or the list slot's Remove From Slot (Q45). */
  remove?: string;
  what: string;
  section: string;
  kind: string;
  id: string;
  read: (ctx: Ctx) => unknown;
  file: () => File;
  label: string;
}

const audio = () => new File(['new-sound'], 'new.ogg', { type: 'audio/ogg' });
const webp = () => new File(['new-image'], 'new.webp', { type: 'image/webp' });
const SLOTS: Slot[] = [
  { what: 'the world thumbnail', section: 'World', kind: 'image', id: 'world:world:thumbnail', read: (c) => coverData(c.worldOverview), file: webp, label: 'Thumbnail' },
  { what: 'Background Music', section: 'World', kind: 'sound', id: 'world:world:bgm', read: (c) => resolveSound(c.worldOverview.bgm, c.worldOverview.mediaList)?.data, file: audio, label: 'Background Music' },
  { what: 'an entity sound', section: 'Entities', kind: 'sound', id: 'entity:wick:sound', read: (c) => resolveSound(c.entities.find((e) => e.id === 'wick')!.sound, c.worldOverview.mediaList)?.data, file: audio, label: 'Sound: Odd Wick' },
  {
    what: 'an entity 3D Model', section: 'Entities', kind: 'model', id: 'entity:wick:model',
    read: (c) => c.entities.find((e) => e.id === 'wick')!.model?.data,
    file: () => new File(['new-model'], 'new.glb', { type: 'model/gltf-binary' }), label: '3D Model: Odd Wick',
  },
  { what: 'a location background', section: 'Locations', kind: 'image', id: 'location:marsh:image:0', read: (c) => locationImages(c.locations.find((l) => l.id === 'marsh')!, c.worldOverview.mediaList)[0]?.data, file: webp, label: 'Image 1: Marsh' },
  { what: 'a location ambient sound', section: 'Locations › Harbor Steps', kind: 'sound', id: 'location:lamp:ambientSound', read: (c) => resolveSound(c.locations.find((l) => l.id === 'lamp')!.ambientSound, c.worldOverview.mediaList)?.data, file: audio, label: 'Ambient Sound: Lamp Room' },
  { what: 'a dictionary cover', section: 'Dictionaries', kind: 'image', id: 'dictionary:lore:thumbnail', read: (c) => c.dictionaries.find((d) => d.id === 'lore')!.thumbnail, file: webp, label: 'Cover Image: Fen Lore' },
];

/** Slots on the Media List act through their slot (Q45): no Replace, and Remove From Slot clears them. */
const onList = (slot: Slot) => slot.kind === 'sound' || slot.id.startsWith('location:marsh:image') || slot.id === 'world:world:thumbnail';
const PANEL_SLOTS = SLOTS.filter((slot) => !onList(slot));
const REMOVE_SLOTS = SLOTS.map((slot) => (onList(slot) ? { ...slot, remove: 'Remove From Slot' } : slot));

const SECTIONS = mediaSections(mediaFixtureWorld());
const sectionItems = (name: string) => SECTIONS.find((s) => sectionTitle(s) === name)!.items;
const sectionTotal = (name: string, items: MediaItem[]) => `${name} ${formatMediaBytes(totalBytes(items))}`;
const lastLabel = (bench: ReturnType<typeof openMedia>) => {
  const { steps, cursor } = bench.historyState();
  return steps[cursor - 1]?.label;
};

describe('Media tab Remove', () => {
  it.each(REMOVE_SLOTS)('clears $what, drops its card and total, and undoes in one step', async (slot) => {
    const bench = openMedia();
    const was = slot.read(bench.ctx());
    const others = sectionItems(slot.section).filter((i) => i.id !== slot.id);
    const kindCards = cardsOf(slot.section, slot.kind).length;
    fireEvent.click(card(slot.section, slot.kind));
    expect(panel()).toHaveAttribute('data-media-panel', slot.id);

    await step(() => fireEvent.click(panelButton(slot.remove ?? 'Remove')!));

    expect(slot.read(bench.ctx())).toBeFalsy();
    // A gallery slot's Remove From Slot is the field's own edit, which carries no step label.
    expect(lastLabel(bench)).toBe(slot.remove && slot.id.includes(':image:') ? undefined : `Remove ${slot.label}`);
    expect(cardsOf(slot.section, slot.kind)).toHaveLength(kindCards - 1);
    if (others.length) {
      expect(within(section(slot.section)!).getByRole('button', { name: sectionTotal(slot.section, others) })).toBeInTheDocument();
    } else {
      expect(section(slot.section)).toBeNull();
    }

    const steps = bench.historyState().cursor;
    await undo();
    expect(bench.historyState().cursor).toBe(steps - 1);
    expect(slot.read(bench.ctx())).toBe(was);
  });

  it.each([
    ['a sound', 'Entities', 'sound'],
    ['a gallery image', 'Locations', 'image'],
    ['the world cover', 'World', 'image'],
  ])('offers %s only its slot controls, with no Replace or Remove of its own', (_what, sectionName, kind) => {
    openMedia();
    fireEvent.click(card(sectionName, kind));
    expect(panelButton('Replace')).toBeNull();
    expect(panelButton('Remove')).toBeNull();
    expect(panelButton('Remove From Slot')).not.toBeNull();
    expect(panelButton('Delete From World')).not.toBeNull();
  });

  it('offers an Avatar Replace, Download and Delete in place of Remove', () => {
    openMedia();
    fireEvent.click(card('World › Avatars', 'avatar'));
    expect(panelButton('Remove')).toBeNull();
    expect(panelButton('Replace')).not.toBeNull();
    expect(panelButton('Download')).not.toBeNull();
    expect(panelButton('Delete')).not.toBeNull();
  });
});

describe('Media tab Replace', () => {
  it.each(PANEL_SLOTS)('writes the picked file into $what, keeps the card selected, and undoes in one step', async (slot) => {
    const bench = openMedia();
    const was = slot.read(bench.ctx());
    fireEvent.click(card(slot.section, slot.kind));
    const steps = bench.historyState().cursor;

    await pickFile(slot.file());

    await waitFor(() => expect(slot.read(bench.ctx())).not.toBe(was));
    const now = slot.read(bench.ctx()) as string;
    expect(now.startsWith(`data:${slot.file().type};base64,`)).toBe(true);
    expect(lastLabel(bench)).toBe(`Replace ${slot.label}`);
    expect(bench.historyState().cursor).toBe(steps + 1);
    expect(panel()).toHaveAttribute('data-media-panel', slot.id);

    await undo();
    expect(slot.read(bench.ctx())).toBe(was);
  });

  it('puts a replacing image through the downscale consent', async () => {
    vi.mocked(measureInWorker).mockResolvedValue(OVERSIZED);
    const bench = openMedia();
    // A dictionary cover keeps the panel's Replace; list slots consent through their own uploader.
    fireEvent.click(card('Dictionaries', 'image'));

    await pickFile(new File(['huge'], 'huge.png', { type: 'image/png' }));
    const dialog = await screen.findByRole('alertdialog');
    expect(dialog).toHaveTextContent('Large image');
    await step(() => fireEvent.click(within(dialog).getByRole('button', { name: 'Downscale' })));

    await waitFor(() => expect(bench.ctx().dictionaries.find((d) => d.id === 'lore')!.thumbnail).toBe('data:image/webp;base64,c21hbGw='));
    expect(lastLabel(bench)).toBe('Replace Cover Image: Fen Lore');
  });

});

describe('Media tab slot names', () => {
  it('names a dictionary cover Cover Image, as the book panel does', () => {
    openMedia();
    fireEvent.click(card('Dictionaries', 'image'));

    expect(within(panel()!).getByRole('heading')).toHaveTextContent('Fen LoreCover Image');
  });
});
