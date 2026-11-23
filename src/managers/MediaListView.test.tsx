import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { renderMediaTab } from '@/test/mediaTabBench';
import { fakeDataUrl, mediaFixtureWorld } from '@/test/mediaFixture';
import { measureInWorker, encodeInWorker } from '@/lib/imageOptimWorkerClient';
import { entityImages } from '@/lib/entityImages';
import type { World } from '@/types';

/** The Media tab over the Media List: Group by Type once per entry with Used By, Unused, Delete and Import Media. */

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

beforeEach(() => {
  localStorage.clear();
  vi.mocked(measureInWorker).mockReset().mockResolvedValue({ w: 64, h: 64, bytes: 200 });
  vi.mocked(encodeInWorker).mockReset().mockResolvedValue('data:image/webp;base64,c21hbGw=');
});

// 400 base64 characters, so the bytes read back to the same text.
const UNUSED = fakeDataUrl('image/webp', 300, 'u');

/** The media fixture with Bram showing Odd Wick's first picture, and one entry nothing links. */
const listWorld = (): World => {
  const world = mediaFixtureWorld();
  const wick = world.entities.find((e) => e.id === 'wick')!;
  world.entities.find((e) => e.id === 'bram')!.images = [{ data: (wick.images![0] as { data: string }).data }];
  world.worldOverview.mediaList = { sketch: { id: 'sketch', name: 'Lantern Sketch', kind: 'image', data: UNUSED } };
  return world;
};

/** A minimal binary glTF holding only `json`, so a VRM reader sees its extensions. */
const glb = (json: object): Uint8Array<ArrayBuffer> => {
  let text = JSON.stringify(json);
  while (text.length % 4) text += ' ';
  const body = new TextEncoder().encode(text);
  const out = new Uint8Array(new ArrayBuffer(20 + body.length));
  const view = new DataView(out.buffer);
  view.setUint32(0, 0x46546c67, true); // "glTF"
  view.setUint32(4, 2, true);
  view.setUint32(8, out.length, true);
  view.setUint32(12, body.length, true);
  view.setUint32(16, 0x4e4f534a, true); // "JSON"
  out.set(body, 20);
  return out;
};

const header = () => document.querySelector<HTMLElement>('[data-media-header]')!;
const section = (name: string) => screen.queryByRole('region', { name });
const cardNamed = (sectionName: string, name: string) => Array.from(section(sectionName)?.querySelectorAll<HTMLElement>('[data-media-card]') ?? [])
  .filter((card) => card.textContent?.includes(name));
const panel = () => document.querySelector<HTMLElement>('[data-media-panel]');
const groupByType = () => fireEvent.click(within(header()).getByRole('button', { name: 'Group by Type' }));
const pickFilter = (name: string) => {
  fireEvent.click(within(header()).getByRole('button', { name: /^Filter/ }));
  fireEvent.click(screen.getByRole('button', { name }));
};
/** The name of the entry Odd Wick's first picture links. */
const sharedName = (bench: ReturnType<typeof renderMediaTab>) =>
  entityImages(bench.ctx().entities.find((e) => e.id === 'wick')!, bench.ctx().worldOverview.mediaList)[0].name!;

describe('Media tab Group by Type', () => {
  it('shows an image two entities link once, with both in Used By', () => {
    const bench = renderMediaTab(listWorld(), 'advanced');
    groupByType();
    const shared = cardNamed('Images', sharedName(bench));
    expect(shared).toHaveLength(1);

    fireEvent.click(shared[0]);

    const usedBy = panel()!.querySelector<HTMLElement>('[data-media-used-by]')!;
    expect(within(usedBy).getAllByRole('button').map((b) => b.textContent)).toEqual(['Odd Wick, Image 1', 'Bram, Image 1']);
  });

  it('keeps one card per use with Group by Type off', () => {
    const bench = renderMediaTab(listWorld(), 'advanced');
    const name = sharedName(bench);

    // By parent, the shared picture sits in both entities' stacks, and no card goes by its entry name.
    expect(section('Entities')!.querySelectorAll('[data-media-card="stack"]')).toHaveLength(1);
    expect(section('Entities › Crew › Deckhands')!.querySelectorAll('[data-media-card="image"]')).toHaveLength(1);
    expect(cardNamed('Entities', name)).toHaveLength(0);
  });
});

describe('Media tab Unused', () => {
  it('marks an entry nothing links Unused, in a last section by parent and in its kind by type', () => {
    renderMediaTab(listWorld(), 'advanced');
    const regions = screen.getAllByRole('region').map((r) => r.getAttribute('aria-label'));
    expect(regions.at(-1)).toBe('Unused');
    expect(cardNamed('Unused', 'Lantern Sketch')[0]).toHaveTextContent('Unused');

    groupByType();
    expect(cardNamed('Images', 'Lantern Sketch')[0]).toHaveTextContent('Unused');
    expect(section('Unused')).toBeNull();
  });

  it('finds only Unused entries under the Unused filter, in both groupings', () => {
    renderMediaTab(listWorld(), 'advanced');
    pickFilter('Unused');
    const shown = () => Array.from(document.querySelectorAll<HTMLElement>('[data-media-card]')).map((c) => c.textContent);
    expect(shown()).toEqual([expect.stringContaining('Lantern Sketch')]);

    groupByType();
    expect(shown()).toEqual([expect.stringContaining('Lantern Sketch')]);
  });

  it('opens an Unused entry with nothing in Used By', () => {
    renderMediaTab(listWorld(), 'advanced');
    fireEvent.click(cardNamed('Unused', 'Lantern Sketch')[0]);

    expect(screen.getByLabelText('Image Name')).toHaveValue('Lantern Sketch');
    expect(within(panel()!).getByText('Nothing uses this image')).toBeInTheDocument();
  });
});

describe('Media tab Delete From World', () => {
  it('lists every use of a used entry first, then unlinks it everywhere', async () => {
    const bench = renderMediaTab(listWorld(), 'advanced');
    groupByType();
    const name = sharedName(bench);
    fireEvent.click(cardNamed('Images', name)[0]);

    fireEvent.click(within(panel()!).getByRole('button', { name: 'Delete From World' }));
    const dialog = await screen.findByRole('alertdialog');
    expect(within(dialog).getAllByRole('listitem').map((li) => li.textContent)).toEqual(['Odd Wick, Image 1', 'Bram, Image 1']);
    await act(async () => { fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' })); });

    const { entities, worldOverview } = bench.ctx();
    expect(Object.values(worldOverview.mediaList ?? {}).some((e) => e.name === name)).toBe(false);
    expect(entityImages(entities.find((e) => e.id === 'bram')!, worldOverview.mediaList)).toHaveLength(0);
    expect(cardNamed('Images', name)).toHaveLength(0);
  });
});

describe('Media tab Import Media', () => {
  it('adds an image and a sound as named entries and a VRM as an Avatar, and selects the first', async () => {
    const bench = renderMediaTab(listWorld(), 'advanced');
    const entries = Object.keys(bench.ctx().worldOverview.mediaList ?? {}).length;
    const avatars = Object.keys(bench.ctx().worldOverview.vrmStore ?? {}).length;
    const input = document.querySelector<HTMLInputElement>('input[data-media-import]')!;
    const files = [
      new File(['pier-picture'], 'Pier at Dusk.webp', { type: 'image/webp' }),
      new File(['tide-sound'], 'tide.ogg', { type: 'audio/ogg' }),
      // Browsers report no MIME type for a .vrm.
      new File(['gull-model'], 'Gull.vrm', { type: '' }),
    ];

    await act(async () => { fireEvent.change(input, { target: { files } }); });

    await waitFor(() => expect(Object.keys(bench.ctx().worldOverview.vrmStore ?? {})).toHaveLength(avatars + 1));
    const list = Object.values(bench.ctx().worldOverview.mediaList ?? {});
    expect(list).toHaveLength(entries + 2);
    expect(list).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'Pier at Dusk', kind: 'image' }),
      expect.objectContaining({ name: 'tide', kind: 'sound', type: 'audio/ogg' }),
    ]));
    expect(Object.values(bench.ctx().worldOverview.vrmStore ?? {}).map((v) => v.name)).toContain('Gull');
    // Nothing links them yet, so they land Unused, and the first is selected.
    expect(cardNamed('Unused', 'Pier at Dusk')).toHaveLength(1);
    expect(screen.getByLabelText('Image Name')).toHaveValue('Pier at Dusk');
  });

  it('adds a .glb with VRM data as an Avatar and refuses a plain 3D model .glb', async () => {
    const bench = renderMediaTab(listWorld(), 'advanced');
    const avatars = Object.keys(bench.ctx().worldOverview.vrmStore ?? {}).length;
    const input = document.querySelector<HTMLInputElement>('input[data-media-import]')!;
    const files = [
      new File([glb({ extensions: { VRMC_vrm: { meta: { name: 'Heron' } } } })], 'Heron.glb', { type: 'model/gltf-binary' }),
      new File([glb({ asset: { version: '2.0' } })], 'Crate.glb', { type: 'model/gltf-binary' }),
    ];

    await act(async () => { fireEvent.change(input, { target: { files } }); });

    await waitFor(() => expect(Object.keys(bench.ctx().worldOverview.vrmStore ?? {})).toHaveLength(avatars + 1));
    const names = Object.values(bench.ctx().worldOverview.vrmStore ?? {}).map((v) => v.name);
    expect(names).toContain('Heron');
    expect(names).not.toContain('Crate');
  });

  it('reuses the entry that holds the same bytes', async () => {
    const bench = renderMediaTab(listWorld(), 'advanced');
    const entries = Object.keys(bench.ctx().worldOverview.mediaList ?? {}).length;
    const bytes = Uint8Array.from(atob(UNUSED.split(',')[1]), (c) => c.charCodeAt(0));
    const input = document.querySelector<HTMLInputElement>('input[data-media-import]')!;

    await act(async () => { fireEvent.change(input, { target: { files: [new File([bytes], 'copy.webp', { type: 'image/webp' })] } }); });

    await waitFor(() => expect(screen.getByLabelText('Image Name')).toHaveValue('Lantern Sketch'));
    expect(Object.keys(bench.ctx().worldOverview.mediaList ?? {})).toHaveLength(entries);
  });

  it('reuses a held image before the downscale prompt, so a large copy asks nothing and adds nothing', async () => {
    vi.mocked(measureInWorker).mockResolvedValue({ w: 5000, h: 5000, bytes: 5_000_000 });
    const bench = renderMediaTab(listWorld(), 'advanced');
    const entries = Object.keys(bench.ctx().worldOverview.mediaList ?? {}).length;
    const bytes = Uint8Array.from(atob(UNUSED.split(',')[1]), (c) => c.charCodeAt(0));
    const input = document.querySelector<HTMLInputElement>('input[data-media-import]')!;

    await act(async () => { fireEvent.change(input, { target: { files: [new File([bytes], 'copy.webp', { type: 'image/webp' })] } }); });

    await waitFor(() => expect(screen.getByLabelText('Image Name')).toHaveValue('Lantern Sketch'));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(Object.keys(bench.ctx().worldOverview.mediaList ?? {})).toHaveLength(entries);
  });
});

// jsdom has no canvas: the brush editor reads any mask as all black and saves a PNG named for its size.
vi.mock('./weatherMaskEditor/maskCanvas', () => ({
  readMaskRaster: vi.fn(async (_data: string, width: number, height: number) => new Uint8ClampedArray(width * height)),
  drawTint: vi.fn(),
  previewMaskPng: vi.fn(() => 'data:image/png;base64,cHJldmlldw=='),
  encodeMaskRaster: vi.fn((_raster: Uint8ClampedArray, width: number, height: number) => `data:image/png;base64,${width}x${height}`),
}));

describe('Media tab Masks', () => {
  const WINDOW = fakeDataUrl('image/png', 300, 'w');

  /** Loads the editor's measuring image at `width` × `height`, as the browser does once the picture decodes. */
  const loadPicture = async (width: number, height: number) => {
    const picture = document.querySelector<HTMLImageElement>('[data-mask-scene] img')!;
    Object.defineProperty(picture, 'naturalWidth', { value: width });
    Object.defineProperty(picture, 'naturalHeight', { value: height });
    await act(async () => { fireEvent.load(picture); });
    await waitFor(() => expect(document.querySelector('[data-mask-paint]')).not.toBeNull());
  };
  const editorDialog = () => screen.getByRole('dialog', { name: 'Weather Mask' });
  const maskWorld = (): World => {
    const world = listWorld();
    world.worldOverview.mediaList = {
      ...world.worldOverview.mediaList,
      day: { id: 'day', name: 'Dock Day', kind: 'image', data: fakeDataUrl('image/png', 30, 'd') },
      win: { id: 'win', name: 'Dock Window', kind: 'mask', data: WINDOW },
    };
    world.locations = [
      ...world.locations,
      { id: 'dock', name: 'Dock', images: [{ mediaId: 'day', weatherMask: 'win' }] },
      { id: 'pier', name: 'Pier', images: [{ mediaId: 'day', weatherMask: 'win' }] },
    ];
    return world;
  };

  it('lists each Mask with its size and the locations that keep it, in both groupings', () => {
    renderMediaTab(maskWorld(), 'advanced');
    const [card] = cardNamed('Masks', 'Dock Window');
    // The stored size, the measure the publish limit uses.
    expect(card).toHaveTextContent(`${WINDOW.length} B`);
    fireEvent.click(card);
    const usedBy = panel()!.querySelector<HTMLElement>('[data-media-used-by]')!;
    expect(within(usedBy).getAllByRole('button').map((b) => b.textContent)).toEqual(['Dock, Image 1 Weather Mask', 'Pier, Image 1 Weather Mask']);

    groupByType();
    expect(cardNamed('Masks', 'Dock Window')).toHaveLength(1);
    expect(cardNamed('Images', 'Dock Window')).toHaveLength(0);
  });

  it('opens a Mask in the brush editor over a picture that links it, and lists every linking picture', async () => {
    const bench = renderMediaTab(maskWorld(), 'advanced');
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    fireEvent.click(cardNamed('Masks', 'Dock Window')[0]);
    fireEvent.click(within(panel()!).getByRole('button', { name: 'Edit' }));
    await loadPicture(1600, 900);

    expect(within(editorDialog()).getByRole('combobox', { name: 'Picture' })).toHaveTextContent('Dock, Image 1');
    expect(document.querySelector('[data-mask-plain]')).toBeNull();
    expect(document.querySelector('[data-mask-shared]')).toHaveAttribute('data-mask-shared', '2');

    // One stroke, then Save writes the entry alone: the slots keep their links.
    const paint = document.querySelector<HTMLElement>('[data-mask-paint]')!;
    paint.getBoundingClientRect = () => ({ left: 0, top: 0, width: 800, height: 450, right: 800, bottom: 450, x: 0, y: 0, toJSON: () => ({}) });
    fireEvent.pointerDown(paint, { button: 0, pointerId: 1, clientX: 100, clientY: 100 });
    fireEvent.pointerUp(paint, { pointerId: 1, clientX: 100, clientY: 100 });
    await act(async () => { fireEvent.click(within(editorDialog()).getByRole('button', { name: 'Save' })); });
    const { worldOverview, locations } = bench.ctx();
    expect(worldOverview.mediaList?.win).toMatchObject({ id: 'win', name: 'Dock Window', kind: 'mask', data: 'data:image/png;base64,1600x900' });
    expect(locations.find((l) => l.id === 'pier')?.images).toEqual([{ mediaId: 'day', weatherMask: 'win' }]);
  });

  it('opens a Mask no slot links over a plain surface at the mask size and saves it', async () => {
    const world = maskWorld();
    world.locations = world.locations.map((l) => (l.images ? { ...l, images: l.images.map(({ weatherMask: _m, ...rest }) => rest) } : l));
    const bench = renderMediaTab(world, 'advanced');
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    fireEvent.click(cardNamed('Unused', 'Dock Window')[0]);
    fireEvent.click(within(panel()!).getByRole('button', { name: 'Edit' }));
    // The measured image is the mask itself.
    await loadPicture(640, 360);

    expect(document.querySelector('[data-mask-plain]')).not.toBeNull();
    expect(within(editorDialog()).queryByRole('combobox', { name: 'Picture' })).toBeNull();
    const paint = document.querySelector<HTMLElement>('[data-mask-paint]')!;
    paint.getBoundingClientRect = () => ({ left: 0, top: 0, width: 640, height: 360, right: 640, bottom: 360, x: 0, y: 0, toJSON: () => ({}) });
    fireEvent.pointerDown(paint, { button: 0, pointerId: 1, clientX: 50, clientY: 50 });
    fireEvent.pointerUp(paint, { pointerId: 1, clientX: 50, clientY: 50 });
    await act(async () => { fireEvent.click(within(editorDialog()).getByRole('button', { name: 'Save' })); });
    expect(bench.ctx().worldOverview.mediaList?.win).toMatchObject({ kind: 'mask', data: 'data:image/png;base64,640x360' });
  });

  it('unlinks every slot on Delete From World and keeps the images', async () => {
    const bench = renderMediaTab(maskWorld(), 'advanced');
    fireEvent.click(cardNamed('Masks', 'Dock Window')[0]);
    fireEvent.click(within(panel()!).getByRole('button', { name: 'Delete From World' }));
    const dialog = await screen.findByRole('alertdialog');
    await act(async () => { fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' })); });

    const { locations, worldOverview } = bench.ctx();
    expect(worldOverview.mediaList?.win).toBeUndefined();
    expect(locations.filter((l) => l.id === 'dock' || l.id === 'pier').map((l) => l.images)).toEqual([[{ mediaId: 'day' }], [{ mediaId: 'day' }]]);
  });
});
