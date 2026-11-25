import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { renderMediaTab } from '@/test/mediaTabBench';
import { fakeDataUrl, mediaFixtureWorld } from '@/test/mediaFixture';
import { downloadBlob } from '@/lib/downloadBlob';
import { FLAT_LOSSLESS, pictureFile } from '@/lib/layeredFlatten';
import { formatMediaBytes, storedBytes } from '@/lib/mediaIndex';
import type { LayeredMediaEntry, MediaFileEntry, Stat, World } from '@/types';

/** A Layered Image chosen into a location slot, and drawn composed in the frame and the strip. */

vi.mock('../services/WorldStorageService', () => ({
  default: { initialize: vi.fn(), getWorldMetadata: vi.fn().mockResolvedValue([]), storeWorld: vi.fn().mockResolvedValue(undefined) },
}));
vi.mock('@/lib/jsonFileWorkerUtils', () => ({ serializeJsonBlob: vi.fn(), parseJsonText: vi.fn(), terminateWorker: vi.fn() }));
vi.mock('react-toastify', () => ({
  toast: Object.assign(vi.fn(() => 'toast'), { info: vi.fn(), success: vi.fn(), error: vi.fn(), update: vi.fn(), dismiss: vi.fn() }),
  ToastContainer: () => null,
}));
vi.mock('@/views/VRMViewer', () => import('@/test/stubs/vrmViewer'));
vi.mock('@/views/ModelViewer', () => ({ default: () => <div data-testid="model-viewer" /> }));
vi.mock('@/lib/imageOptimWorkerClient', () => ({ measureInWorker: vi.fn(), encodeInWorker: vi.fn() }));
const device = vi.hoisted(() => ({ mobile: false }));
vi.mock('@/lib/useIsMobile', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/useIsMobile')>()),
  useIsMobile: () => device.mobile,
}));
// jsdom has no canvas to flatten on, so the flatten returns a fixed file.
vi.mock('@/lib/layeredFlatten', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/layeredFlatten')>()),
  pictureFile: vi.fn().mockResolvedValue('data:image/webp;base64,RkxBVA=='),
}));
vi.mock('@/lib/downloadBlob', () => ({ downloadBlob: vi.fn() }));

beforeEach(() => { localStorage.clear(); device.mobile = false; });

const BASE: MediaFileEntry = { id: 'base-img', name: 'Fen Base', kind: 'image', data: fakeDataUrl('image/webp', 900, 'z') };
const RIG: LayeredMediaEntry = {
  id: 'rig', name: 'Fen Rig', kind: 'layered', layers: [{ id: 'l1', name: 'Base', variants: [{ mediaId: BASE.id }] }],
};

const rigWorld = (): World => {
  const world = mediaFixtureWorld();
  world.worldOverview.mediaList = { [BASE.id]: BASE, [RIG.id]: RIG };
  return world;
};

const panel = () => document.querySelector<HTMLElement>('[data-media-panel]')!;
const grid = () => document.querySelector<HTMLElement>('[data-media-choose]')!;

/** Opens Marsh's panel and Choose on its open slot. */
const openChoose = () => {
  const bench = renderMediaTab(rigWorld(), 'simple');
  fireEvent.click(screen.getByRole('region', { name: 'Locations' }).querySelector<HTMLElement>('[data-media-card="image"]')!);
  expect(panel()).toHaveAttribute('data-media-image-panel', 'location:marsh');
  fireEvent.click(within(panel()).getByLabelText('Add an Image'));
  fireEvent.click(within(panel()).getByRole('button', { name: 'Choose' }));
  return bench;
};

describe('Layered Images in a location slot', () => {
  it('lists the Layered Image in Choose and links it from the slot', () => {
    const bench = openChoose();
    const names = [...grid().querySelectorAll('[data-media-entry]')].map((b) => b.textContent);
    expect(names).toContain('Fen Rig');

    fireEvent.click([...grid().querySelectorAll<HTMLElement>('[data-media-entry]')].find((b) => b.textContent === 'Fen Rig')!);
    const marsh = bench.ctx().locations.find((l) => l.id === 'marsh')!;
    expect(marsh.images!.map((link) => ('mediaId' in link ? link.mediaId : '(embedded)'))).toContain('rig');
  });

  it('draws the linked Layered Image composed in the strip and the frame, not as the gray tile', () => {
    openChoose();
    fireEvent.click([...grid().querySelectorAll<HTMLElement>('[data-media-entry]')].find((b) => b.textContent === 'Fen Rig')!);

    const strip = within(panel()).getByRole('button', { name: 'Image 2' });
    expect(strip.querySelector('[data-layered-picture="rig"]')).not.toBeNull();
    expect(strip.querySelector('img[src^="data:image/svg+xml"]')).toBeNull();
    const frame = [...panel().querySelectorAll<HTMLElement>('[data-layered-picture="rig"]')].filter((el) => !el.closest('.hidden') && !strip.contains(el));
    expect(frame).toHaveLength(1);
  });
});

const FACE: MediaFileEntry = { id: 'face-img', name: 'Fen Face', kind: 'image', data: fakeDataUrl('image/webp', 3_000, 'f') };
const health: Stat = { id: 'health', name: 'Health', type: 'number', description: '', min: 0, max: 100, starting: 10, regen: 0, descriptors: [] };

/** Odd Wick's gallery with the rig as its fourth slot; its two Layers share the Fen Face part. */
const wickRigWorld = (): World => {
  const world = mediaFixtureWorld();
  world.worldOverview.mediaList = {
    [BASE.id]: BASE, [FACE.id]: FACE,
    [RIG.id]: { ...RIG, layers: [
      { id: 'l1', name: 'Base', variants: [{ mediaId: BASE.id }, { mediaId: FACE.id }] },
      { id: 'l2', name: 'Face', variants: [{ mediaId: FACE.id }] },
    ] },
  };
  const wick = world.entities.find((e) => e.id === 'wick')!;
  wick.images!.push({ mediaId: RIG.id });
  wick.stats = [health];
  return world;
};

/** Opens Odd Wick's stack framed on the rig's slot. */
const openRigSlot = () => {
  const bench = renderMediaTab(wickRigWorld(), 'advanced');
  fireEvent.click(screen.getByRole('region', { name: 'Entities' }).querySelector<HTMLElement>('[data-media-card="stack"]')!);
  fireEvent.click(within(panel()).getByRole('button', { name: 'Image 4' }));
  return bench;
};
const framed = () => panel().querySelector<HTMLElement>('[data-media-framed]')!;
/** The framed slot's own box in the gallery, which renders every slot and hides the rest. */
const framedSlot = () => [...panel().querySelectorAll<HTMLElement>('[data-media-entry-bar]')].find((bar) => !bar.parentElement!.classList.contains('hidden'))!;

describe('A Layered Image in an entity gallery slot', () => {
  it('shows the flat-slot panel titled by the rig, with its size line and Edit Layers beside Download', () => {
    openRigSlot();

    expect(panel()).toHaveAttribute('data-media-panel', 'entity:wick:image:3');
    expect(framedSlot()).toHaveAttribute('data-media-entry-bar', RIG.id);
    expect(within(framedSlot()).getByRole('button', { name: 'Remove From Slot' })).toBeInTheDocument();
    const size = formatMediaBytes(storedBytes(BASE.data) + storedBytes(FACE.data));
    expect(framed()).toHaveTextContent(new RegExp(`^Fen Rig·Layered Image·2 Layers·${size}`));
    const actions = within(framed()).getAllByRole('button').map((b) => b.textContent);
    expect(actions.slice(0, 2)).toEqual(['Download', 'Edit Layers']);
    expect(within(framed()).getByRole('button', { name: 'Add a requirement…' })).toBeInTheDocument();
    // The action row's Edit Layers is the only one; the gallery leaves its own to the host.
    expect(panel().querySelectorAll('[data-edit-layers]')).toHaveLength(1);
  });

  it('opens the full-screen editor on desktop, on that rig', () => {
    openRigSlot();
    fireEvent.click(within(framed()).getByRole('button', { name: 'Edit Layers' }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByRole('heading', { name: 'Fen Rig' })).toBeInTheDocument();
    expect(dialog.querySelector('[data-variant-panel]')).not.toBeNull();
  });

  it('opens the Layer panel in a dialog on mobile', () => {
    device.mobile = true;
    openRigSlot();
    fireEvent.click(within(framed()).getByRole('button', { name: 'Edit Layers' }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByRole('heading', { name: 'Fen Rig' })).toBeInTheDocument();
    expect(dialog.querySelector(`[data-layered-mobile="${RIG.id}"]`)).not.toBeNull();
  });

  it('downloads the flattened outside-play picture, lossless, named for the rig', async () => {
    openRigSlot();
    fireEvent.click(within(framed()).getByRole('button', { name: 'Download' }));

    await waitFor(() => expect(downloadBlob).toHaveBeenCalledWith(expect.any(Blob), 'Fen Rig.webp'));
    expect(pictureFile).toHaveBeenCalledWith(expect.objectContaining({ entryId: RIG.id }), undefined, FLAT_LOSSLESS);
  });

  it('removes the rig from this slot only and keeps it on the Media List', () => {
    const bench = openRigSlot();
    fireEvent.click(within(framedSlot()).getByRole('button', { name: 'Remove From Slot' }));

    const wick = bench.ctx().entities.find((e) => e.id === 'wick')!;
    expect(wick.images!.some((link) => 'mediaId' in link && link.mediaId === RIG.id)).toBe(false);
    expect(wick.images).toHaveLength(3);
    expect(bench.ctx().worldOverview.mediaList?.[RIG.id]).toBeDefined();
  });
});
