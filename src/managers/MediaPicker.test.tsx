import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { renderMediaTab, undoMediaEdit } from '@/test/mediaTabBench';
import { mediaFixtureWorld } from '@/test/mediaFixture';
import { measureInWorker, encodeInWorker } from '@/lib/imageOptimWorkerClient';
import { galleryLinks } from '@/lib/entityImages';
import type { Entity, GalleryLink } from '@/types';

/** The Media List image slot on a world gallery: Import, Choose and a link box when empty; name, Unlink and Delete from World when filled. */

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

beforeEach(() => {
  localStorage.clear();
  vi.mocked(measureInWorker).mockReset().mockResolvedValue({ w: 64, h: 64, bytes: 200 });
  vi.mocked(encodeInWorker).mockReset().mockResolvedValue('data:image/webp;base64,c21hbGw=');
});

type Bench = ReturnType<typeof renderMediaTab>;

const panel = () => document.querySelector<HTMLElement>('[data-media-panel]')!;
const section = (name: string) => screen.getByRole('region', { name });
const entity = (bench: Bench, id: string): Entity => bench.ctx().entities.find((e) => e.id === id)!;
const ids = (bench: Bench, id: string) => galleryLinks(entity(bench, id)).map((link) => ('mediaId' in link ? link.mediaId : '(embedded)'));
const list = (bench: Bench) => bench.ctx().worldOverview.mediaList ?? {};
const entryNamed = (bench: Bench, name: string) => Object.values(list(bench)).find((entry) => entry.name === name);
const nameFields = () => within(panel()).queryAllByRole('textbox', { name: 'Image Name' }) as HTMLInputElement[];

/** Odd Wick's panel, framed on his primary image. */
const openWick = () => {
  const bench = renderMediaTab(mediaFixtureWorld(), 'simple');
  fireEvent.click(section('Entities').querySelector<HTMLElement>('[data-media-card="stack"]')!);
  return bench;
};

/** Frames Odd Wick's open slot, the one past his last image. */
const frameOpenSlot = () => fireEvent.click(within(panel()).getByLabelText('Add an Image'));

const openChoose = () => fireEvent.click(within(panel()).getByRole('button', { name: 'Choose' }));
const grid = () => document.querySelector<HTMLElement>('[data-media-choose]')!;
const gridNames = () => [...grid().querySelectorAll('[data-media-entry]')].map((b) => b.textContent);

describe('Media List image slot', () => {
  it('names the entry behind each filled slot', () => {
    openWick();
    expect(nameFields().map((input) => input.value)).toEqual(['Odd Wick 1', 'Odd Wick 2', 'Odd Wick 3']);
  });

  it('offers Import, Choose and an image URL in the open slot, and the + tile frames it without opening a file picker', () => {
    openWick();
    frameOpenSlot();
    expect(within(panel()).getByText('Import').closest('label')).toHaveAttribute('for', expect.stringMatching(/^image-upload-/));
    expect(within(panel()).getByRole('button', { name: 'Choose' })).toBeInTheDocument();
    expect(within(panel()).getByRole('textbox', { name: 'Image URL' })).toBeInTheDocument();
    expect(within(panel()).getByLabelText('Add an Image')).not.toHaveAttribute('for');
  });

  it('imports several files as named entries, linking the first into the open slot and the rest after it', async () => {
    const bench = openWick();
    frameOpenSlot();
    const input = within(panel()).getByText('Import').closest('label')!;
    const fileInput = document.getElementById(input.getAttribute('for')!) as HTMLInputElement;
    const files = [new File(['one'], 'lantern.webp', { type: 'image/webp' }), new File(['two'], 'tide chart.png', { type: 'image/png' })];

    await act(async () => { fireEvent.change(fileInput, { target: { files } }); });

    // The PNG could shrink, so the batch asks first, as it does for any import.
    fireEvent.click(await screen.findByRole('button', { name: 'Keep as-is' }));

    await waitFor(() => expect(ids(bench, 'wick')).toHaveLength(5));
    const names = ids(bench, 'wick').slice(3).map((id) => list(bench)[id]?.name);
    expect(names).toEqual(['lantern', 'tide chart']);
  });

  it('chooses an existing entry: links it with no new entry, and the search filters by name', () => {
    const bench = openWick();
    const entries = Object.keys(list(bench)).length;
    const bram = galleryLinks(entity(bench, 'bram'))[0] as Extract<GalleryLink, { mediaId: string }>;
    frameOpenSlot();
    openChoose();

    fireEvent.change(within(grid()).getByRole('textbox', { name: 'Search Images' }), { target: { value: 'harbor' } });
    expect(gridNames()).toEqual(['Harbor Steps 1']);
    fireEvent.change(within(grid()).getByRole('textbox', { name: 'Search Images' }), { target: { value: 'BRAM' } });
    fireEvent.click(within(grid()).getByRole('button', { name: 'Bram 1' }));

    expect(ids(bench, 'wick')[3]).toBe(bram.mediaId);
    expect(Object.keys(list(bench))).toHaveLength(entries);
    expect(document.querySelector('[data-media-choose]')).toBeNull();
  });

  it('dims the entries this subject already links, and still lets one be linked again', () => {
    const bench = openWick();
    frameOpenSlot();
    openChoose();

    const dimmed = [...grid().querySelectorAll<HTMLElement>('[data-media-entry]')]
      .filter((b) => b.className.includes('opacity-50')).map((b) => b.textContent);
    expect(dimmed).toEqual(['Odd Wick 1', 'Odd Wick 2', 'Odd Wick 3']);
    fireEvent.click(within(grid()).getByRole('button', { name: 'Odd Wick 1, already used here' }));
    expect(ids(bench, 'wick')[3]).toBe(ids(bench, 'wick')[0]);
  });

  it('adds a pasted image URL as a linked entry named after its last path segment, extension dropped', async () => {
    const bench = openWick();
    frameOpenSlot();
    const box = within(panel()).getByRole('textbox', { name: 'Image URL' });
    fireEvent.change(box, { target: { value: 'https://example.com/art/knight%20portrait.png' } });
    fireEvent.keyDown(box, { key: 'Enter' });

    await waitFor(() => expect(ids(bench, 'wick')).toHaveLength(4));
    const entry = list(bench)[ids(bench, 'wick')[3]];
    expect(entry).toMatchObject({ name: 'knight portrait', data: 'https://example.com/art/knight%20portrait.png' });
  });

  it('renames on blur, suffixing a taken name, and a blank name reverts', () => {
    const bench = openWick();
    const id = ids(bench, 'wick')[0];
    const [field] = nameFields();

    fireEvent.change(field, { target: { value: 'bram 1' } });
    fireEvent.blur(field);
    expect(list(bench)[id].name).toBe('bram 1 (2)');

    fireEvent.change(nameFields()[0], { target: { value: '   ' } });
    fireEvent.blur(nameFields()[0]);
    expect(list(bench)[id].name).toBe('bram 1 (2)');
    expect(nameFields()[0].value).toBe('bram 1 (2)');
  });

  describe('a rename of an entry a script names', () => {
    const scripted = () => {
      const world = { ...mediaFixtureWorld(), scripts: [{ id: 'w1', timing: 'after' as const, code: 'persona.image = "Odd Wick 1"; persona.name = "Odd Wick 1";' }] };
      const bench = renderMediaTab(world, 'simple');
      fireEvent.click(section('Entities').querySelector<HTMLElement>('[data-media-card="stack"]')!);
      return bench;
    };
    const rename = (to: string) => {
      const [field] = nameFields();
      fireEvent.change(field, { target: { value: to } });
      fireEvent.blur(field);
    };
    const code = (bench: Bench) => bench.ctx().worldScripts?.[0].code;

    it('offers to rewrite the script, and Update Code moves the media literal alone', async () => {
      const bench = scripted();
      rename('Wick Lit');
      expect(await screen.findByText(/names the image “Odd Wick 1” 1 time/)).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Update Code' }));
      await waitFor(() => expect(code(bench)).toBe('persona.image = "Wick Lit"; persona.name = "Odd Wick 1";'));
    });

    it('leaves the script as it is on Leave Code', async () => {
      const bench = scripted();
      rename('Wick Lit');
      fireEvent.click(await screen.findByRole('button', { name: 'Leave Code' }));
      expect(code(bench)).toBe('persona.image = "Odd Wick 1"; persona.name = "Odd Wick 1";');
    });

    it('offers the name the list kept when the new one was taken', async () => {
      const bench = scripted();
      rename('bram 1');
      expect(await screen.findByText(/to “bram 1 \(2\)”/)).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Update Code' }));
      await waitFor(() => expect(code(bench)).toBe('persona.image = "bram 1 (2)"; persona.name = "Odd Wick 1";'));
    });

    it('asks nothing when no script names the entry', async () => {
      openWick();
      rename('Wick Lit');
      await act(async () => {});
      expect(screen.queryByRole('button', { name: 'Update Code' })).toBeNull();
    });
  });

  it('unlinks the framed image and keeps its entry', () => {
    const bench = openWick();
    const [first, ...rest] = ids(bench, 'wick');

    fireEvent.click(panel().querySelector<HTMLElement>('[data-media-entry-bar] [aria-label="Remove From Slot"]')!);

    expect(ids(bench, 'wick')).toEqual(rest);
    expect(list(bench)[first]).toBeDefined();
  });

  it('Delete from World lists every use, then leaves no field linking the entry, as one undo step', async () => {
    const bench = openWick();
    const shared = ids(bench, 'wick')[0];
    // Bram links the same entry, so the delete reaches past this subject.
    act(() => bench.ctx().editEntity('bram', (e) => ({ ...e, images: [...(e.images ?? []), { mediaId: shared }] })));

    fireEvent.click(within(panel()).getAllByRole('button', { name: 'Delete From World' })[0]);
    const dialog = await screen.findByRole('alertdialog');
    expect(within(dialog).getByRole('heading')).toHaveTextContent('Delete Odd Wick 1 From the World?');
    expect([...dialog.querySelectorAll('[data-media-uses] li')].map((li) => li.textContent)).toEqual(['Odd Wick, Image 1', 'Bram, Image 2']);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(list(bench)[shared]).toBeUndefined());
    expect(ids(bench, 'wick')).not.toContain(shared);
    expect(ids(bench, 'bram')).not.toContain(shared);

    await undoMediaEdit();
    expect(list(bench)[shared]?.name).toBe('Odd Wick 1');
    expect(ids(bench, 'wick')[0]).toBe(shared);
    expect(ids(bench, 'bram')).toContain(shared);
    expect(entryNamed(bench, 'Odd Wick 1')).toBeDefined();
  });
});
