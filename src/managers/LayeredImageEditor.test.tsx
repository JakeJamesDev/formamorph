import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { MediaChooseButton } from './MediaPicker';
import { renderMediaTab } from '@/test/mediaTabBench';
import { asMobile } from '@/test/panelBench';
import { newBlankWorld } from '@/lib/blankWorld';
import type { ImageFacts } from '@/lib/imageFacts';
import type { LayeredMediaEntry, MediaList, World } from '@/types';

/** The Layered Image editor in the Media tab: create, build Layers and Variants, preview, and the size check. */

vi.mock('../services/WorldStorageService', () => ({
  default: { initialize: vi.fn(), getWorldMetadata: vi.fn().mockResolvedValue([]), storeWorld: vi.fn().mockResolvedValue(undefined) },
}));
vi.mock('@/lib/jsonFileWorkerUtils', () => ({ serializeJsonBlob: vi.fn(), parseJsonText: vi.fn(), terminateWorker: vi.fn() }));
vi.mock('react-toastify', () => ({ toast: { info: vi.fn(), success: vi.fn(), error: vi.fn() }, ToastContainer: () => null }));
vi.mock('@/views/VRMViewer', () => import('@/test/stubs/vrmViewer'));
vi.mock('@/views/ModelViewer', () => ({ default: () => <div /> }));

// jsdom decodes no image, so pixel sizes come from the data URL's tail: `…#WxH`.
vi.mock('@/lib/imageFacts', async (real) => ({
  ...(await real<typeof import('@/lib/imageFacts')>()),
  useImageFacts: (srcs: readonly string[]) => new Map(srcs.flatMap((src): [string, ImageFacts][] => {
    const m = /#(\d+)x(\d+)$/.exec(src);
    return m ? [[src, { size: { width: Number(m[1]), height: Number(m[2]) }, box: null }]] : [];
  })),
}));

beforeEach(() => { localStorage.clear(); });

const image = (id: string, size = '240x288') => ({ id, name: id, kind: 'image' as const, data: `data:image/png;base64,${id}#${size}` });
const HEALTH_LOW = [{ all: [{ kind: 'stat' as const, id: 'health', operator: '<' as const, value: 50, unit: 'raw' as const }] }];

/** A world whose list holds a body, two faces (one at twice the size) and, when given, a rig. */
function world(rig?: LayeredMediaEntry): World {
  const base = newBlankWorld();
  const mediaList: MediaList = { body: image('body'), calm: image('calm'), big: image('big', '480x576'), ...(rig ? { [rig.id]: rig } : {}) };
  return {
    ...base,
    worldOverview: { ...base.worldOverview, mediaList },
    entities: [
      { id: 'ash', name: 'Ash', playerDescription: '', aiDescription: '', locations: [], stats: [{ id: 'health', name: 'Health', value: 20, min: 0, max: 100 }] },
      { id: 'bram', name: 'Bram', playerDescription: '', aiDescription: '', locations: [], stats: [{ id: 'health', name: 'Health', value: 90, min: 0, max: 100 }] },
      // Lists only the fields the editor reads, hence the cast.
    ] as unknown as World['entities'],
  };
}

const RIG: LayeredMediaEntry = {
  id: 'rig', name: 'Scout Rig', kind: 'layered', layers: [
    { id: 'base', name: 'Body', variants: [{ mediaId: 'body' }] },
    { id: 'face', name: 'Face', variants: [{ mediaId: 'big', requires: HEALTH_LOW }, { mediaId: 'calm' }] },
  ],
};

type Bench = ReturnType<typeof renderMediaTab>;
const rigOf = (bench: Bench, id = 'rig') => bench.ctx().worldOverview.mediaList?.[id] as LayeredMediaEntry;
const dialog = () => screen.getByRole('dialog');
const selectCard = (name: string) => fireEvent.click(screen.getAllByText(name).find((el) => el.closest('[data-media-card]'))!);
/** The preview's Layers, bottom first, as the image id each draws. */
const drawn = () => Array.from(dialog().querySelectorAll<HTMLImageElement>('[data-layered-preview] [data-layer]'))
  .map((img) => /base64,(\w+)/.exec(img.getAttribute('src') ?? '')?.[1]);

async function pickPreviewAs(name: string) {
  fireEvent.click(within(dialog()).getByRole('combobox', { name: 'Preview As' }));
  fireEvent.click(await screen.findByRole('option', { name }));
}

describe('Layered Image editor', () => {
  it('creates a rig from the Media tab and builds it: a Layer, a Variant picked from the list, a rule', async () => {
    const bench = renderMediaTab(world(), 'simple');
    fireEvent.click(screen.getByRole('button', { name: 'New Layered Image' }));
    const id = Object.values(bench.ctx().worldOverview.mediaList!).find((e) => e.kind === 'layered')!.id;
    expect(rigOf(bench, id)).toMatchObject({ name: 'Layered Image', layers: [] });
    expect(screen.getAllByText('No Layers yet').length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: 'Edit Layers' }));
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Add Layer' }));
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Add Layer' }));
    expect(rigOf(bench, id).layers.map((l) => l.name)).toEqual(['Layer', 'Layer (2)']);

    // The new top Layer is selected; Choose adds a Media List image to it.
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Choose' }));
    fireEvent.click(await screen.findByRole('button', { name: 'calm' }));
    expect(rigOf(bench, id).layers[1].variants).toEqual([{ mediaId: 'calm' }]);
    await waitFor(() => expect(drawn()).toEqual(['calm']));
    expect(within(dialog()).getByText('Always shown')).toBeTruthy();
  });

  it('draws Layers in list order, and a Layer moved down draws under the one above it', async () => {
    const reordered: LayeredMediaEntry = { ...RIG, layers: [RIG.layers[1], RIG.layers[0]] };
    renderMediaTab(world(reordered), 'simple');
    selectCard('Scout Rig');
    fireEvent.click(screen.getByRole('button', { name: 'Edit Layers' }));
    expect(Array.from(dialog().querySelectorAll('[data-layer-row]')).map((r) => r.getAttribute('data-layer-row'))).toEqual(['base', 'face']);
    expect(drawn()).toEqual(['big', 'body']);
  });

  it('previews as a picked entity, reading its rules at the starting state', async () => {
    renderMediaTab(world(RIG), 'simple');
    selectCard('Scout Rig');
    fireEvent.click(screen.getByRole('button', { name: 'Edit Layers' }));
    expect(drawn()).toEqual(['body', 'big']);
    await pickPreviewAs('Bram');
    expect(drawn()).toEqual(['body', 'calm']);
    await pickPreviewAs('Ash');
    expect(drawn()).toEqual(['body', 'big']);
  });

  it('hides a Layer in the editor only with its eye', () => {
    const bench = renderMediaTab(world(RIG), 'simple');
    selectCard('Scout Rig');
    fireEvent.click(screen.getByRole('button', { name: 'Edit Layers' }));
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Hide Face in Editor' }));
    expect(drawn()).toEqual(['body']);
    expect(rigOf(bench)).toEqual(RIG);
  });

  it('warns on a Variant whose size differs from the picture', () => {
    renderMediaTab(world(RIG), 'simple');
    selectCard('Scout Rig');
    fireEvent.click(screen.getByRole('button', { name: 'Edit Layers' }));
    fireEvent.click(within(dialog()).getByRole('button', { name: /^Face/ }));
    const strip = dialog().querySelector('[data-variant-strip="face"]')!;
    expect(strip.querySelector('[data-variant="big"] [data-variant-size-warning]')).not.toBeNull();
    expect(strip.querySelector('[data-variant="calm"] [data-variant-size-warning]')).toBeNull();
    expect(dialog().querySelector('[data-variant-size-line]')?.textContent).toContain('480 × 576, not the picture\'s 240 × 288');
  });

  it('writes a dragged opacity once, on release', () => {
    const bench = renderMediaTab(world(RIG), 'simple');
    selectCard('Scout Rig');
    fireEvent.click(screen.getByRole('button', { name: 'Edit Layers' }));
    const slider = within(dialog()).getByRole('slider', { name: 'Opacity' });
    act(() => { slider.focus(); });
    fireEvent.keyDown(slider, { key: 'ArrowLeft' });
    expect(rigOf(bench).layers[1].opacity).toBe(0.99);
  });

  it('lists a Variant use in Used By and in the delete confirm, and deleting the image empties that Variant', async () => {
    const bench = renderMediaTab(world(RIG), 'simple');
    selectCard('body');
    const usedBy = document.querySelector('[data-media-used-by]')!;
    expect(within(usedBy as HTMLElement).getByRole('button', { name: 'Scout Rig · Body' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Delete From World' }));
    expect(document.querySelector('[data-media-uses]')?.textContent).toContain('Scout Rig · Body');
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(rigOf(bench).layers[0].variants).toEqual([]));
    expect(rigOf(bench).layers.map((l) => l.name)).toEqual(['Body', 'Face']);
  });

  it('lays out master–detail in the pane on mobile, with Variants and Look tabs', () => {
    const undo = asMobile();
    try {
      renderMediaTab(world(RIG), 'simple');
      selectCard('Scout Rig');
      const pane = document.querySelector<HTMLElement>('[data-layered-mobile]')!;
      expect(screen.queryByRole('button', { name: 'Edit Layers' })).toBeNull();
      expect(Array.from(pane.querySelectorAll('[data-layer-row]')).map((r) => r.textContent)).toEqual(['Facebig', 'Bodybody']);
      expect(within(pane).getAllByRole('tab').map((t) => t.textContent)).toEqual(['Variants', 'Look']);
    } finally {
      undo();
    }
  });
});

describe('Choose with Layered Images', () => {
  const list = world(RIG).worldOverview.mediaList!;
  const open = (onPickLayered?: (entry: LayeredMediaEntry) => void) => {
    const onPick = vi.fn();
    render(<TooltipProvider><MediaChooseButton list={list} linkedIds={new Set()} onPick={onPick} onPickLayered={onPickLayered} /></TooltipProvider>);
    fireEvent.click(screen.getByRole('button', { name: 'Choose' }));
    return onPick;
  };

  it('lists a rig beside the images as its composed picture, and hands the pick back as the rig', () => {
    const onPickLayered = vi.fn();
    const onPick = open(onPickLayered);
    const grid = document.querySelector<HTMLElement>('[data-media-choose]')!;
    expect(within(grid).getAllByRole('button').map((b) => b.getAttribute('aria-label'))).toEqual(['big', 'body', 'calm', 'Scout Rig']);
    expect(grid.querySelector('[data-media-entry="rig"] [data-layered-picture="rig"]')).not.toBeNull();
    fireEvent.click(within(grid).getByRole('button', { name: 'Scout Rig' }));
    expect(onPickLayered).toHaveBeenCalledWith(RIG);
    expect(onPick).not.toHaveBeenCalled();
  });

  it('lists no rig for a slot that takes images only', () => {
    open();
    expect(screen.queryByRole('button', { name: 'Scout Rig' })).toBeNull();
  });
});
