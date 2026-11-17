import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { renderMediaTab, undoMediaEdit } from '@/test/mediaTabBench';
import { fakeDataUrl, mediaFixtureWorld } from '@/test/mediaFixture';
import { measureInWorker, encodeInWorker } from '@/lib/imageOptimWorkerClient';
import { firstMapFrame } from '@/lib/mapBackground';
import type { MapBackground, Stat, World } from '@/types';

/** The Media tab's World › Map Background cards: the stack, its image panel, its actions, and its blank card. */

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
vi.mock('@/lib/imageOptimWorkerClient', () => ({ measureInWorker: vi.fn(), encodeInWorker: vi.fn() }));
// jsdom loads no image, so the size a first frame is cut from comes from here: a 2:1 picture.
vi.mock('@/lib/imageAspect', () => ({ readImageAspect: vi.fn().mockResolvedValue(2) }));

beforeEach(() => {
  localStorage.clear();
  vi.mocked(measureInWorker).mockReset().mockResolvedValue({ w: 64, h: 64, bytes: 200 });
  vi.mocked(encodeInWorker).mockReset().mockResolvedValue('data:image/webp;base64,c21hbGw=');
});

const health: Stat = { id: 'health', name: 'Health', type: 'number', description: '', min: 0, max: 100, starting: 10, regen: 0, descriptors: [] };
const DRAWN = fakeDataUrl('image/webp', 1_200, 'd');
const RUINED = fakeDataUrl('image/webp', 900, 'r');
const FRAME = { x: -100, y: -60, width: 1200, height: 700 };

/** The media fixture with a two-image Map Background, and Odd Wick as a persona whose Health a rule can read. */
const mapWorld = (map: MapBackground | null = { images: [{ data: DRAWN }, { data: RUINED }], frame: FRAME, opacity: 0.6 }): World => {
  const world = mediaFixtureWorld();
  const wick = world.entities.find((e) => e.id === 'wick')!;
  wick.persona = true;
  wick.stats = [health];
  if (map) world.worldOverview.mapBackground = map;
  return world;
};

const open = (world = mapWorld()) => {
  const bench = renderMediaTab(world, 'simple');
  return bench;
};

const section = () => screen.getByRole('region', { name: 'World › Map Background' });
const panel = () => document.querySelector<HTMLElement>('[data-media-panel]');
const framed = () => panel()?.querySelector<HTMLElement>('[data-media-framed]') ?? null;
const inPanel = () => within(panel()!);
const map = (bench: ReturnType<typeof open>) => bench.ctx().worldOverview.mapBackground;
const step = (action: () => void) => act(async () => { action(); });
/** The framed slot's Remove From Slot (Q45): the gallery renders every slot and hides all but the framed one. */
const unlinkFramed = () => within(Array.from(panel()!.querySelectorAll<HTMLElement>('[data-media-entry-bar]'))
  .find((bar) => !bar.parentElement!.classList.contains('hidden'))!).getByRole('button', { name: 'Remove From Slot' });
const undo = undoMediaEdit;
const webp = () => new File(['new-map'], 'map.webp', { type: 'image/webp' });

describe('Media tab Map Background', () => {
  it('stacks two images under World › Map Background and opens the image panel framed on the primary', () => {
    open();
    const stack = section().querySelector<HTMLElement>('[data-media-card="stack"]')!;
    expect(stack).toHaveTextContent('Map Background');
    fireEvent.click(stack);

    expect(panel()).toHaveAttribute('data-media-image-panel', 'map:map');
    expect(panel()).toHaveAttribute('data-media-panel', 'map:map:image:0');
    expect(inPanel().getByRole('button', { name: 'Go to Locations' })).toBeInTheDocument();
  });

  it("edits the framed image's rule with the persona as host, keeping the frame", async () => {
    const bench = open();
    fireEvent.click(section().querySelector<HTMLElement>('[data-media-card="stack"]')!);
    fireEvent.click(inPanel().getByRole('button', { name: 'Image 2' }));
    fireEvent.click(within(framed()!).getByRole('button', { name: 'Add Requirement' }));

    expect(await screen.findByText('Persona Stats')).toBeInTheDocument();
    fireEvent.click((await screen.findAllByRole('option', { name: /^Health/ }))[0]);

    await waitFor(() => expect(map(bench)!.images[1].requires).toEqual([{ all: [expect.objectContaining({ kind: 'stat', id: 'health' })] }]));
    // Stored with no owner: an owner-less row reads the played persona, as on a location.
    expect(map(bench)!.images[1].requires![0].all[0]).not.toHaveProperty('owner');
    expect(map(bench)!.images[0].requires).toBeUndefined();
    expect(map(bench)!.frame).toEqual(FRAME);
  });

  it('removes one image as one step, and the field with the last one', async () => {
    const bench = open();
    const was = map(bench);
    fireEvent.click(section().querySelector<HTMLElement>('[data-media-card="stack"]')!);
    const steps = bench.historyState().cursor;

    await step(() => fireEvent.click(unlinkFramed()));
    expect(map(bench)).toEqual({ ...was, images: [was!.images[1]] });
    // The gallery's own edit: one step, with no label of its own.
    expect(bench.historyState().cursor).toBe(steps + 1);
    await undo();
    expect(map(bench)).toEqual(was);

    // Down to one image, a removal takes the frame and opacity with it (Q77).
    await step(() => fireEvent.click(unlinkFramed()));
    const single = section().querySelector<HTMLElement>('[data-media-card="image"]')!;
    fireEvent.click(single);
    await step(() => fireEvent.click(unlinkFramed()));
    expect(map(bench)).toBeUndefined();
  });
});

describe('Media tab Map Background under No Images', () => {
  const header = () => document.querySelector<HTMLElement>('[data-media-header]')!;
  const pickFilter = (name: string) => {
    fireEvent.click(within(header()).getByRole('button', { name: /^Filter/ }));
    fireEvent.click(screen.getByRole('button', { name }));
  };
  const blankCard = () => [...document.querySelectorAll<HTMLElement>('[data-media-card="blank"]')].find((c) => c.textContent === 'Map Background');

  it('shows a blank card, and its upload lands over the locations at full opacity as one undoable step', async () => {
    const world = mapWorld(null);
    const bench = open(world);
    expect(blankCard()).toBeUndefined();
    pickFilter('No Images');
    fireEvent.click(blankCard()!);

    expect(panel()).toHaveAttribute('data-media-image-panel', 'map:map');
    const input = document.getElementById('image-upload-media-map-background') as HTMLInputElement;
    await act(async () => { fireEvent.change(input, { target: { files: [webp()] } }); });

    await waitFor(() => expect(map(bench)).toBeDefined());
    expect(map(bench)).toEqual({
      images: [{ mediaId: expect.any(String) }],
      frame: firstMapFrame(world.locations, 2),
      opacity: 1,
    });
    // The picture joined the list under its file's name (Q23).
    const placed = bench.ctx().worldOverview.mediaList![(map(bench)!.images[0] as { mediaId: string }).mediaId];
    expect(placed).toMatchObject({ name: 'map', data: expect.stringMatching(/^data:image\//) });
    expect(blankCard()).toBeUndefined();

    await undo();
    expect(map(bench)).toBeUndefined();
  });
});
