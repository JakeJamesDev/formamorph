import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { openEditorTab, renderWorldEditorBench, shownEditorTab } from '@/test/worldEditorBench';
import { mediaFixtureWorld } from '@/test/mediaFixture';
import { formatMediaBytes, mediaSections, sectionTitle, totalBytes, type MediaItem } from '@/lib/mediaIndex';
import type { useGameData } from '@/contexts/GameDataContext';
import { measureInWorker, encodeInWorker } from '@/lib/imageOptimWorkerClient';

/** The Media tab's item panel: Replace and Remove, each one History Step, and the reveal that returns to the tab. */

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
const undo = () => step(() => { fireEvent.keyDown(document.body, { key: 'z', ctrlKey: true }); });
const redo = () => step(() => { fireEvent.keyDown(document.body, { key: 'y', ctrlKey: true }); });

const openMedia = (mode: 'simple' | 'advanced' = 'simple') => {
  const bench = renderWorldEditorBench(mediaFixtureWorld(), mode);
  openEditorTab(/^Media$/);
  return bench;
};

const pickFile = async (file: File) => {
  const input = panel()!.querySelector<HTMLInputElement>('input[data-media-replace]')!;
  await act(async () => { fireEvent.change(input, { target: { files: [file] } }); });
};

/** A slot the item panel acts on: where its card sits, how to read the field, and a file that replaces it. */
interface Slot {
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
  { what: 'the world thumbnail', section: 'World', kind: 'image', id: 'world:world:thumbnail', read: (c) => c.worldOverview.thumbnail, file: webp, label: 'Thumbnail' },
  { what: 'Background Music', section: 'World', kind: 'sound', id: 'world:world:bgm', read: (c) => c.worldOverview.bgm, file: audio, label: 'Background Music' },
  { what: 'an entity sound', section: 'Entities', kind: 'sound', id: 'entity:wick:sound', read: (c) => c.entities.find((e) => e.id === 'wick')!.sound?.data, file: audio, label: 'Sound: Odd Wick' },
  {
    what: 'an entity 3D Model', section: 'Entities', kind: 'model', id: 'entity:wick:model',
    read: (c) => c.entities.find((e) => e.id === 'wick')!.model?.data,
    file: () => new File(['new-model'], 'new.glb', { type: 'model/gltf-binary' }), label: '3D Model: Odd Wick',
  },
  { what: 'a location background', section: 'Locations', kind: 'image', id: 'location:marsh:image:0', read: (c) => c.locations.find((l) => l.id === 'marsh')!.images?.[0]?.data, file: webp, label: 'Image 1: Marsh' },
  { what: 'a location ambient sound', section: 'Locations › Harbor Steps', kind: 'sound', id: 'location:lamp:ambientSound', read: (c) => c.locations.find((l) => l.id === 'lamp')!.ambientSound?.data, file: audio, label: 'Ambient Sound: Lamp Room' },
  { what: 'a dictionary cover', section: 'Dictionaries', kind: 'image', id: 'dictionary:lore:thumbnail', read: (c) => c.dictionaries.find((d) => d.id === 'lore')!.thumbnail, file: webp, label: 'Cover Image: Fen Lore' },
];

const SECTIONS = mediaSections(mediaFixtureWorld());
const sectionItems = (name: string) => SECTIONS.find((s) => sectionTitle(s) === name)!.items;
const sectionTotal = (name: string, items: MediaItem[]) => `${name} ${formatMediaBytes(totalBytes(items))}`;
const lastLabel = (bench: ReturnType<typeof openMedia>) => {
  const { steps, cursor } = bench.historyState();
  return steps[cursor - 1]?.label;
};

describe('Media tab Remove', () => {
  it.each(SLOTS)('clears $what, drops its card and total, and undoes in one step', async (slot) => {
    const bench = openMedia();
    const was = slot.read(bench.ctx());
    const others = sectionItems(slot.section).filter((i) => i.id !== slot.id);
    const kindCards = cardsOf(slot.section, slot.kind).length;
    fireEvent.click(card(slot.section, slot.kind));
    expect(panel()).toHaveAttribute('data-media-panel', slot.id);

    await step(() => fireEvent.click(panelButton('Remove')!));

    expect(slot.read(bench.ctx())).toBeFalsy();
    expect(lastLabel(bench)).toBe(`Remove ${slot.label}`);
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
  it.each(SLOTS)('writes the picked file into $what, keeps the card selected, and undoes in one step', async (slot) => {
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

  it("keeps a replaced sound's field a media record with the new file's name", async () => {
    const bench = openMedia();
    fireEvent.click(card('Entities', 'sound'));
    await pickFile(audio());

    await waitFor(() => expect(bench.ctx().entities.find((e) => e.id === 'wick')!.sound).toMatchObject({ name: 'new.ogg', type: 'audio/ogg' }));
  });

  it('puts a replacing image through the downscale consent', async () => {
    vi.mocked(measureInWorker).mockResolvedValue(OVERSIZED);
    const bench = openMedia();
    fireEvent.click(card('World', 'image'));

    await pickFile(new File(['huge'], 'huge.png', { type: 'image/png' }));
    const dialog = await screen.findByRole('alertdialog');
    expect(dialog).toHaveTextContent('Large image');
    await step(() => fireEvent.click(within(dialog).getByRole('button', { name: 'Downscale' })));

    await waitFor(() => expect(bench.ctx().worldOverview.thumbnail).toBe('data:image/webp;base64,c21hbGw='));
    expect(lastLabel(bench)).toBe('Replace Thumbnail');
  });

  it('embeds a file over a linked image', async () => {
    const world = mediaFixtureWorld();
    world.locations.find((l) => l.id === 'marsh')!.images = [{ data: 'https://example.com/marsh.png' }];
    const bench = renderWorldEditorBench(world, 'simple');
    openEditorTab(/^Media$/);
    fireEvent.click(card('Locations', 'image'));
    expect(panel()!.querySelector('a[href="https://example.com/marsh.png"]')).toHaveTextContent('Open Link');

    await pickFile(webp());

    await waitFor(() => expect(bench.ctx().locations.find((l) => l.id === 'marsh')!.images?.[0]?.data).toMatch(/^data:image\/webp;base64,/));
  });
});

describe('Media tab history reveal', () => {
  it('returns to the Media tab with the card selected when its edit is undone from another tab', async () => {
    openMedia();
    fireEvent.click(card('Locations › Harbor Steps', 'sound'));
    await step(() => fireEvent.click(panelButton('Remove')!));
    openEditorTab(/^Overview$/);

    await undo();

    expect(shownEditorTab()).toBe('Media');
    expect(panel()).toHaveAttribute('data-media-panel', 'location:lamp:ambientSound');
  });

  it('opens the Media tab with no card when the redo takes the card away', async () => {
    openMedia();
    fireEvent.click(card('Locations › Harbor Steps', 'sound'));
    await step(() => fireEvent.click(panelButton('Remove')!));
    await undo();
    openEditorTab(/^Overview$/);

    await redo();

    expect(shownEditorTab()).toBe('Media');
    expect(panel()).toBeNull();
    expect(cardsOf('Locations › Harbor Steps', 'sound')).toHaveLength(0);
  });
});

describe('Media tab slot names', () => {
  it('names a dictionary cover Cover Image, as the book panel does', () => {
    openMedia();
    fireEvent.click(card('Dictionaries', 'image'));

    expect(within(panel()!).getByRole('heading')).toHaveTextContent('Fen LoreCover Image');
  });
});
