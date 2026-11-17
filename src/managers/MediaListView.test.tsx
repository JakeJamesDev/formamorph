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
