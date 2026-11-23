// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { useGameData } from '@/contexts/GameDataContext';
import { panelWorld, renderPanelBench } from '@/test/panelBench';
import type { EditorMode } from '@/lib/editorMode';
import type { GameLocation, MediaList, World } from '@/types';
import { LocationImageField } from './LocationImageField';
import { EntityGalleryField } from './EntityFields';

vi.mock('react-toastify', () => ({ toast: { info: vi.fn(), success: vi.fn(), error: vi.fn() }, ToastContainer: () => null }));
// jsdom has no canvas: an upload stores this PNG.
const UPLOADED = 'data:image/png;base64,TUFTSw==';
vi.mock('@/lib/useDownscalePrompt', () => ({
  useDownscalePrompt: () => ({ promptImage: async (url: string) => url, promptImagesBatch: async () => 'off', dialog: null, promptWorld: vi.fn() }),
}));
vi.mock('../components/GenerateImageButton', () => ({ GenerateImageButton: () => null }));
vi.mock('@/components/AiGenerateButton', () => ({ default: () => null }));
vi.mock('@/lib/weatherMask', async (load) => ({ ...(await load<typeof import('@/lib/weatherMask')>()), encodeMaskPng: vi.fn(async () => UPLOADED) }));
// jsdom has no canvas: the brush editor reads a stored mask as all black and saves a PNG named for its size.
const canvasFake = vi.hoisted(() => ({ saved: [] as { width: number; height: number; raster: Uint8ClampedArray }[] }));
vi.mock('./weatherMaskEditor/maskCanvas', () => ({
  readMaskRaster: vi.fn(async (_data: string, width: number, height: number) => new Uint8ClampedArray(width * height)),
  drawTint: vi.fn(),
  encodeMaskRaster: vi.fn((raster: Uint8ClampedArray, width: number, height: number) => {
    canvasFake.saved.push({ width, height, raster: raster.slice() });
    return `data:image/png;base64,${width}x${height}`;
  }),
}));

const DAY = 'data:image/png;base64,REFZ';
const NIGHT = 'data:image/png;base64,TklHSFQ=';
const SHED = 'data:image/png;base64,U0hFRA==';
const WINDOW = 'data:image/png;base64,V0lORE9X';

const LIST: MediaList = {
  day: { id: 'day', name: 'Dock Day', kind: 'image', data: DAY },
  night: { id: 'night', name: 'Dock Night', kind: 'image', data: NIGHT },
  shed: { id: 'shed', name: 'Shed', kind: 'image', data: SHED },
  win: { id: 'win', name: 'Dock Window', kind: 'mask', data: WINDOW },
};

const dock = (images: GameLocation['images']): GameLocation => ({ id: 'dock', name: 'Dock', images });

const world = (images: GameLocation['images'], extra: GameLocation[] = []): World => panelWorld({
  worldOverview: { ...panelWorld({}).worldOverview, mediaList: LIST },
  locations: [dock(images), ...extra],
});

/** The location panel's gallery for `id`, writing through the world's own setter. */
function LocationHost({ id }: { id: string }) {
  const { locations, updateLocation, placeholders } = useGameData();
  const location = locations.find((l) => l.id === id);
  if (!location) return null;
  return (
    <LocationImageField
      location={location}
      placeholders={placeholders}
      onChange={(field, value) => updateLocation({ ...location, [field]: value })}
    />
  );
}

const mount = async (w: World, mode: EditorMode = 'advanced') => {
  const bench = renderPanelBench(w, mode, <LocationHost id="dock" />);
  await waitFor(() => expect(bench.ctx().worldLoaded).toBe(true));
  const stored = () => bench.ctx().locations.find((l) => l.id === 'dock')!.images!;
  return { ...bench, stored };
};

/** The control of the framed slot; the others render hidden. */
const control = () => {
  const shown = [...document.querySelectorAll<HTMLElement>('[data-weather-mask]')].filter((el) => !el.closest('.hidden'));
  expect(shown).toHaveLength(1);
  return shown[0];
};
const frameTile = (name: string) => fireEvent.click(screen.getByRole('button', { name }));
const upload = async () => {
  const input = control().querySelector<HTMLInputElement>('[data-weather-mask-file]')!;
  await act(async () => { fireEvent.change(input, { target: { files: [new File(['x'], 'Dock Rain.png', { type: 'image/png' })] } }); });
};

beforeEach(() => { localStorage.clear(); });

describe('Weather Mask control', () => {
  it('uploads a file as one new Mask entry and links it to the slot', async () => {
    const { ctx, stored } = await mount(world([{ mediaId: 'day' }]));
    await upload();
    await waitFor(() => expect(stored()[0].weatherMask).toBeDefined());
    const masks = Object.values(ctx().worldOverview.mediaList!).filter((e) => e.kind === 'mask');
    expect(masks).toHaveLength(2);
    const added = masks.find((m) => m.id === stored()[0].weatherMask)!;
    expect(added).toMatchObject({ name: 'Dock Rain', kind: 'mask', data: UPLOADED, type: 'image/png' });
    expect(within(control()).getByText('Dock Rain')).toBeTruthy();
  });

  it('uploads the same file twice as two entries, so two slots share nothing unasked', async () => {
    const { ctx, stored } = await mount(world([{ mediaId: 'day' }, { mediaId: 'night' }]));
    await upload();
    frameTile('Image 2');
    await upload();
    await waitFor(() => expect(stored()[1].weatherMask).toBeDefined());
    expect(stored()[0].weatherMask).not.toBe(stored()[1].weatherMask);
    expect(Object.values(ctx().worldOverview.mediaList!).filter((e) => e.kind === 'mask')).toHaveLength(3);
  });

  it('lists only Masks under Choose and links the chosen one', async () => {
    const { stored } = await mount(world([{ mediaId: 'day' }]));
    fireEvent.click(within(control()).getByRole('button', { name: 'Choose' }));
    const grid = screen.getByRole('searchbox', { name: 'Search Masks' }).closest('[data-media-choose]') as HTMLElement;
    expect([...grid.querySelectorAll('[data-media-entry]')].map((b) => b.getAttribute('data-media-entry'))).toEqual(['win']);
    fireEvent.click(within(grid).getByRole('button', { name: 'Dock Window' }));
    expect(stored()[0]).toEqual({ mediaId: 'day', weatherMask: 'win' });
  });

  it('never lists a Mask under the image slot Choose', async () => {
    await mount(world([]));
    fireEvent.click(screen.getAllByRole('button', { name: 'Choose' })[0]);
    const grid = screen.getByRole('searchbox', { name: 'Search Images' }).closest('[data-media-choose]') as HTMLElement;
    const ids = [...grid.querySelectorAll('[data-media-entry]')].map((b) => b.getAttribute('data-media-entry'));
    expect(ids).toEqual(expect.arrayContaining(['day', 'night', 'shed']));
    expect(ids).not.toContain('win');
  });

  it('names the shared count when two images link one Mask, and not for one', async () => {
    await mount(world([{ mediaId: 'day', weatherMask: 'win' }, { mediaId: 'night', weatherMask: 'win' }]));
    expect(control().getAttribute('data-weather-mask')).toBe('win');
    expect(within(control()).getByText('Shared by 2 images · Dock Window')).toBeTruthy();
  });

  it('counts slots on other locations too', async () => {
    const shedLoc: GameLocation = { id: 'shedLoc', name: 'Shed', images: [{ mediaId: 'shed', weatherMask: 'win' }] };
    await mount(world([{ mediaId: 'day', weatherMask: 'win' }], [shedLoc]));
    expect(within(control()).getByText('Shared by 2 images · Dock Window')).toBeTruthy();
  });

  it('shows only the name for a Mask one image links', async () => {
    await mount(world([{ mediaId: 'day', weatherMask: 'win' }]));
    expect(within(control()).getByText('Dock Window')).toBeTruthy();
  });

  it('replaces the Mask picture for every slot that shares it', async () => {
    const { ctx, stored } = await mount(world([{ mediaId: 'day', weatherMask: 'win' }, { mediaId: 'night', weatherMask: 'win' }]));
    await upload();
    await waitFor(() => expect(ctx().worldOverview.mediaList!.win).toMatchObject({ kind: 'mask', data: UPLOADED, name: 'Dock Window' }));
    expect(stored().map((s) => s.weatherMask)).toEqual(['win', 'win']);
  });

  it('removes the link from one slot and keeps the entry and the other link', async () => {
    const { ctx, stored } = await mount(world([{ mediaId: 'day', weatherMask: 'win' }, { mediaId: 'night', weatherMask: 'win' }]));
    await act(async () => { fireEvent.click(within(control()).getByRole('button', { name: 'Remove Weather Mask' })); });
    expect(stored()).toEqual([{ mediaId: 'day' }, { mediaId: 'night', weatherMask: 'win' }]);
    expect(ctx().worldOverview.mediaList!.win).toBeDefined();
  });

  it('keeps the slot Mask when the slot image is replaced, and follows its image on reorder', async () => {
    const { ctx, stored } = await mount(world([{ mediaId: 'day', weatherMask: 'win' }, { mediaId: 'night' }]));
    const location = () => ctx().locations.find((l) => l.id === 'dock')!;
    // The widget's own replace path: a new file into the framed slot.
    const slot = control().parentElement!;
    const input = slot.querySelector<HTMLInputElement>('input[type="file"]:not([data-weather-mask-file])')!;
    await act(async () => { fireEvent.change(input, { target: { files: [new File(['y'], 'Dock Redraw.png', { type: 'image/png' })] } }); });
    const linked = () => { const first = stored()[0]; return 'mediaId' in first ? first.mediaId : undefined; };
    await waitFor(() => expect(linked()).not.toBe('day'));
    expect(stored()[0].weatherMask).toBe('win');
    // Reorder: the Mask moves with its image.
    act(() => { ctx().updateLocation({ ...location(), images: [stored()[1], stored()[0]] }); });
    expect(stored().map((s) => s.weatherMask)).toEqual([undefined, 'win']);
  });

  it('undoes and redoes each link change', async () => {
    const { history, stored } = await mount(world([{ mediaId: 'day' }]));
    fireEvent.click(within(control()).getByRole('button', { name: 'Choose' }));
    fireEvent.click(screen.getByRole('button', { name: 'Dock Window' }));
    await waitFor(() => expect(stored()[0].weatherMask).toBe('win'));
    await act(async () => { fireEvent.click(within(control()).getByRole('button', { name: 'Remove Weather Mask' })); });
    expect(stored()[0].weatherMask).toBeUndefined();
    await act(async () => { history().undo(); });
    expect(stored()[0].weatherMask).toBe('win');
    await act(async () => { history().undo(); });
    expect(stored()[0].weatherMask).toBeUndefined();
    await act(async () => { history().redo(); });
    expect(stored()[0].weatherMask).toBe('win');
  });

  it('undoes an upload: the link and the new entry go together', async () => {
    const { ctx, history, stored } = await mount(world([{ mediaId: 'day' }]));
    await upload();
    await waitFor(() => expect(stored()[0].weatherMask).toBeDefined());
    const id = stored()[0].weatherMask!;
    await act(async () => { history().undo(); });
    expect(stored()[0].weatherMask).toBeUndefined();
    expect(ctx().worldOverview.mediaList![id]).toBeUndefined();
  });

  it('is absent in Simple mode', async () => {
    await mount(world([{ mediaId: 'day', weatherMask: 'win' }]), 'simple');
    expect(document.querySelector('[data-weather-mask]')).toBeNull();
  });

  it('draws disabled on the open slot, so the row keeps its place', async () => {
    await mount(world([{ mediaId: 'day' }]));
    fireEvent.click(screen.getByTitle('Add an Image'));
    const open = control();
    for (const button of within(open).getAllByRole('button')) expect((button as HTMLButtonElement).disabled).toBe(true);
  });
});

/** Opens the brush editor from the framed slot and loads its picture at `width` × `height`. */
const openEditor = async (button: 'Paint' | 'Edit', width = 3840, height = 2160) => {
  fireEvent.click(within(control()).getByRole('button', { name: button }));
  const picture = document.querySelector<HTMLImageElement>('[data-mask-scene] img')!;
  Object.defineProperty(picture, 'naturalWidth', { value: width });
  Object.defineProperty(picture, 'naturalHeight', { value: height });
  await act(async () => { fireEvent.load(picture); });
  await waitFor(() => expect(document.querySelector('[data-mask-paint]')).not.toBeNull());
  const paint = document.querySelector<HTMLElement>('[data-mask-paint]')!;
  paint.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1280, height: 720, right: 1280, bottom: 720, x: 0, y: 0, toJSON: () => ({}) });
  return paint;
};
const editor = () => screen.getByRole('dialog', { name: 'Weather Mask' });
const groups = () => [...document.querySelectorAll<HTMLElement>('[data-mask-group]')];
const stroke = (paint: HTMLElement) => {
  fireEvent.pointerDown(paint, { button: 0, pointerId: 1, clientX: 600, clientY: 300 });
  fireEvent.pointerMove(paint, { pointerId: 1, clientX: 700, clientY: 320 });
  fireEvent.pointerUp(paint, { pointerId: 1, clientX: 700, clientY: 320 });
};
const press = async (name: string) => { await act(async () => { fireEvent.click(within(editor()).getByRole('button', { name })); }); };
const masks = (list: MediaList) => Object.values(list).filter((e) => e.kind === 'mask');

describe('Weather Mask brush editor', () => {
  beforeEach(() => { canvasFake.saved.length = 0; });

  it('Paint on a slot with no mask creates and links a new Mask on Save', async () => {
    const { ctx, stored } = await mount(world([{ mediaId: 'day' }]));
    stroke(await openEditor('Paint'));
    await press('Save');
    await waitFor(() => expect(stored()[0].weatherMask).toBeDefined());
    const added = ctx().worldOverview.mediaList![stored()[0].weatherMask!];
    expect(added).toMatchObject({ kind: 'mask', name: 'Dock Mask 1', data: 'data:image/png;base64,1920x1080', type: 'image/png' });
    expect(masks(ctx().worldOverview.mediaList!)).toHaveLength(2);
    expect(screen.queryByRole('dialog', { name: 'Weather Mask' })).toBeNull();
  });

  it('saves the painted pixels, white where the stroke went', async () => {
    await mount(world([{ mediaId: 'day' }]));
    stroke(await openEditor('Paint', 1280, 720));
    await press('Save');
    const [saved] = canvasFake.saved;
    expect(saved.raster[300 * 1280 + 600]).toBe(255);
    expect(saved.raster[10 * 1280 + 10]).toBe(0);
  });

  it('saves at the picture aspect ratio, capped like uploads', async () => {
    await mount(world([{ mediaId: 'day' }]));
    stroke(await openEditor('Paint', 3000, 4000));
    await press('Save');
    expect(canvasFake.saved[0]).toMatchObject({ width: 1440, height: 1920 });
  });

  it('Cancel with nothing painted closes at once and creates nothing', async () => {
    const { ctx, stored } = await mount(world([{ mediaId: 'day' }]));
    await openEditor('Paint');
    expect((within(editor()).getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled).toBe(true);
    await press('Cancel');
    expect(screen.queryByRole('dialog', { name: 'Weather Mask' })).toBeNull();
    expect(stored()[0].weatherMask).toBeUndefined();
    expect(masks(ctx().worldOverview.mediaList!)).toHaveLength(1);
  });

  it('Cancel after painting asks first, and Discard creates nothing', async () => {
    const { ctx, stored } = await mount(world([{ mediaId: 'day' }]));
    stroke(await openEditor('Paint'));
    await press('Cancel');
    const confirm = screen.getByRole('alertdialog', { name: 'Discard Changes?' });
    await act(async () => { fireEvent.click(within(confirm).getByRole('button', { name: 'Discard' })); });
    expect(screen.queryByRole('dialog', { name: 'Weather Mask' })).toBeNull();
    expect(stored()[0].weatherMask).toBeUndefined();
    expect(masks(ctx().worldOverview.mediaList!)).toHaveLength(1);
    expect(canvasFake.saved).toHaveLength(0);
  });

  it('Escape acts as Cancel, with the same question after painting', async () => {
    await mount(world([{ mediaId: 'day' }]));
    stroke(await openEditor('Paint'));
    fireEvent.keyDown(editor(), { key: 'Escape' });
    expect(screen.getByRole('alertdialog', { name: 'Discard Changes?' })).toBeTruthy();
  });

  it('Edit on a shared mask names the count, and Save changes the mask on every slot that links it', async () => {
    const { ctx, stored } = await mount(world([{ mediaId: 'day', weatherMask: 'win' }, { mediaId: 'night', weatherMask: 'win' }]));
    stroke(await openEditor('Edit'));
    expect(within(editor()).getByText('Shared by 2 images. Saving changes all of them.')).toBeTruthy();
    await press('Save');
    await waitFor(() => expect(ctx().worldOverview.mediaList!.win).toMatchObject({ name: 'Dock Window', kind: 'mask', data: 'data:image/png;base64,1920x1080' }));
    expect(stored().map((s) => s.weatherMask)).toEqual(['win', 'win']);
    expect(masks(ctx().worldOverview.mediaList!)).toHaveLength(1);
  });

  it('names no count for a mask one image links', async () => {
    await mount(world([{ mediaId: 'day', weatherMask: 'win' }]));
    await openEditor('Edit');
    expect(document.querySelector('[data-mask-shared]')).toBeNull();
  });

  it('undoes a painted new mask in one step: the link and the entry go together', async () => {
    const { ctx, history, stored } = await mount(world([{ mediaId: 'day' }]));
    stroke(await openEditor('Paint'));
    await press('Save');
    await waitFor(() => expect(stored()[0].weatherMask).toBeDefined());
    const id = stored()[0].weatherMask!;
    await act(async () => { history().undo(); });
    expect(stored()[0].weatherMask).toBeUndefined();
    expect(ctx().worldOverview.mediaList![id]).toBeUndefined();
  });

  it('undoes an edit back to the old picture', async () => {
    const { ctx, history } = await mount(world([{ mediaId: 'day', weatherMask: 'win' }]));
    stroke(await openEditor('Edit'));
    await press('Save');
    await waitFor(() => expect(ctx().worldOverview.mediaList!.win).toMatchObject({ data: 'data:image/png;base64,1920x1080' }));
    await act(async () => { history().undo(); });
    expect(ctx().worldOverview.mediaList!.win).toEqual(LIST.win);
  });

  it('undo and redo inside the editor step through strokes and tools, by button and by key', async () => {
    await mount(world([{ mediaId: 'day' }]));
    const paint = await openEditor('Paint', 1280, 720);
    stroke(paint);
    await press('Invert');
    const save = () => within(editor()).getByRole('button', { name: 'Save' }) as HTMLButtonElement;
    await press('Undo');
    fireEvent.keyDown(editor(), { key: 'z', ctrlKey: true });
    expect(save().disabled).toBe(true);
    fireEvent.keyDown(editor(), { key: 'y', ctrlKey: true });
    await press('Redo');
    fireEvent.keyDown(editor(), { key: 'z', ctrlKey: true, shiftKey: true });
    await press('Save');
    // Stroke then invert: black under the stroke, white elsewhere.
    const [saved] = canvasFake.saved;
    expect(saved.raster[300 * 1280 + 600]).toBe(0);
    expect(saved.raster[10 * 1280 + 10]).toBe(255);
  });

  it('every control hides and takes no input while a stroke is in progress', async () => {
    await mount(world([{ mediaId: 'day' }]));
    const paint = await openEditor('Paint');
    expect(groups().map((g) => g.dataset.maskGroup)).toEqual(['tools', 'card', 'actions']);
    fireEvent.pointerDown(paint, { button: 0, pointerId: 1, clientX: 600, clientY: 300 });
    for (const group of groups()) expect(group.style).toMatchObject({ opacity: '0', visibility: 'hidden', pointerEvents: 'none' });
    fireEvent.pointerUp(paint, { pointerId: 1, clientX: 600, clientY: 300 });
    for (const group of groups()) expect(group.style.visibility).toBe('');
  });

  it('a second finger neither starts a stroke nor draws into the first, and undo takes the stroke back whole', async () => {
    await mount(world([{ mediaId: 'day' }]));
    const paint = await openEditor('Paint', 1280, 720);
    fireEvent.pointerDown(paint, { button: 0, pointerId: 1, clientX: 100, clientY: 100 });
    fireEvent.pointerDown(paint, { button: 0, pointerId: 2, clientX: 1100, clientY: 600 });
    fireEvent.pointerMove(paint, { pointerId: 2, clientX: 1150, clientY: 650 });
    fireEvent.pointerUp(paint, { pointerId: 2, clientX: 1150, clientY: 650 });
    fireEvent.pointerUp(paint, { pointerId: 1, clientX: 100, clientY: 100 });
    await press('Invert');
    await press('Undo');
    await press('Undo');
    expect((within(editor()).getByRole('button', { name: 'Undo' }) as HTMLButtonElement).disabled).toBe(true);
    await press('Redo');
    await press('Save');
    const [saved] = canvasFake.saved;
    expect(saved.raster[100 * 1280 + 100]).toBe(255);
    expect(saved.raster[600 * 1280 + 1100]).toBe(0);
    expect(saved.raster[650 * 1280 + 1150]).toBe(0);
  });

  /** Media queries answer from `matches`; the rest report no match. */
  const stubMedia = (matches: (query: string) => boolean) => vi.spyOn(window, 'matchMedia').mockImplementation((query: string) => ({
    matches: matches(query), media: query, onchange: null,
    addListener: () => {}, removeListener: () => {}, addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false,
  }) as MediaQueryList);

  it('stacks the controls, solid, on a narrow screen, and hides them there too while painting', async () => {
    stubMedia((query) => query.includes('max-width: 1023px'));
    try {
      await mount(world([{ mediaId: 'day' }]));
      const paint = await openEditor('Paint');
      expect(editor().getAttribute('data-mask-editor')).toBe('stacked');
      expect(groups().map((g) => g.dataset.maskGroup)).toEqual(['actions', 'panel']);
      for (const group of groups()) expect(group.className).not.toContain('opacity-25');
      fireEvent.pointerDown(paint, { button: 0, pointerId: 1, clientX: 600, clientY: 300 });
      for (const group of groups()) expect(group.style.visibility).toBe('hidden');
    } finally {
      vi.restoreAllMocks();
    }
  });

  it('stacks the controls on a wide touch screen, which has no hover to bring faded ones back', async () => {
    stubMedia((query) => query.includes('pointer: coarse'));
    try {
      await mount(world([{ mediaId: 'day' }]));
      await openEditor('Paint');
      expect(editor().getAttribute('data-mask-editor')).toBe('stacked');
    } finally {
      vi.restoreAllMocks();
    }
  });
});

describe('a world exported and imported again', () => {
  it('keeps its Masks and every slot link', async () => {
    const first = await mount(world([{ mediaId: 'day', weatherMask: 'win' }, { mediaId: 'night', weatherMask: 'win' }]));
    const exported = JSON.parse(JSON.stringify({ id: 'w2', version: '3.7.0', ...first.ctx().getWorldData() })) as World;
    first.unmount();
    const second = await mount(exported);
    expect(second.ctx().worldOverview.mediaList!.win).toEqual(LIST.win);
    expect(second.stored()).toEqual([{ mediaId: 'day', weatherMask: 'win' }, { mediaId: 'night', weatherMask: 'win' }]);
  });
});

describe('Weather Mask on other galleries', () => {
  it('is absent on an entity gallery', async () => {
    const w = panelWorld({ worldOverview: { ...panelWorld({}).worldOverview, mediaList: LIST } });
    renderPanelBench(w, 'advanced', <EntityHost />);
    await waitFor(() => expect(document.querySelector('[data-slot-frame]')).not.toBeNull());
    expect(document.querySelector('[data-weather-mask]')).toBeNull();
  });
});

function EntityHost() {
  const { entities, updateEntity, worldLoaded } = useGameData();
  const entity = entities[0];
  if (!worldLoaded || !entity) return null;
  return <EntityGalleryField value={entity} onChange={(field, value) => updateEntity({ ...entity, [field]: value })} />;
}
