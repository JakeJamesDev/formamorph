import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, within } from '@testing-library/react';
import { renderMediaTab } from '@/test/mediaTabBench';
import { fakeDataUrl, mediaFixtureWorld } from '@/test/mediaFixture';
import type { LayeredMediaEntry, MediaFileEntry, World } from '@/types';

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

beforeEach(() => { localStorage.clear(); });

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
