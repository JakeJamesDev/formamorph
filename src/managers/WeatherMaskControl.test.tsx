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
