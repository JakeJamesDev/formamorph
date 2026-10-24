import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { openEditorTab, renderWorldEditorBench } from '@/test/worldEditorBench';
import { fakeDataUrl, mediaFixtureWorld } from '@/test/mediaFixture';
import { measureInWorker, encodeInWorker } from '@/lib/imageOptimWorkerClient';
import ModelStorageService from '@/services/ModelStorageService';
import type { Entity, Stat, World } from '@/types';

/** The Media tab's image panel: one entity's or location's gallery, framed on one image, with its details below. */

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
// Spies only: restoring every mock would strip the module mocks' resolved values.
const spies: { mockRestore: () => void }[] = [];
afterEach(() => { spies.splice(0).forEach((s) => s.mockRestore()); });

const health: Stat = { id: 'health', name: 'Health', type: 'number', description: '', min: 0, max: 100, starting: 10, regen: 0, descriptors: [] };
const FOURTH = fakeDataUrl('image/webp', 900, 'q');

/** The media fixture with a fourth image on Odd Wick, and a stat its rules can read. */
const panelWorld = (edit: (w: World) => void = () => {}): World => {
  const world = mediaFixtureWorld();
  const wick = world.entities.find((e) => e.id === 'wick')!;
  wick.images = [...(wick.images ?? []), { data: FOURTH }];
  wick.stats = [health];
  edit(world);
  return world;
};

const open = (mode: 'simple' | 'advanced' = 'simple', world = panelWorld()) => {
  const bench = renderWorldEditorBench(world, mode);
  openEditorTab(/^Media$/);
  return bench;
};

const section = (name: string) => screen.getByRole('region', { name });
const card = (name: string, kind: string) => section(name).querySelector<HTMLElement>(`[data-media-card="${kind}"]`)!;
const panel = () => document.querySelector<HTMLElement>('[data-media-panel]');
const framed = () => panel()?.querySelector<HTMLElement>('[data-media-framed]') ?? null;
const inPanel = () => within(panel()!);
const tile = (name: string | RegExp) => inPanel().getByRole('button', { name });
const wick = (bench: ReturnType<typeof open>): Entity => bench.ctx().entities.find((e) => e.id === 'wick')!;
const lastLabel = (bench: ReturnType<typeof open>) => {
  const { steps, cursor } = bench.historyState();
  return steps[cursor - 1]?.label;
};
const step = (action: () => void) => act(async () => { action(); });
const undo = () => step(() => { fireEvent.keyDown(document.body, { key: 'z', ctrlKey: true }); });
const replaceWith = async (file: File) => {
  const input = framed()!.querySelector<HTMLInputElement>('input[data-media-replace]')!;
  await act(async () => { fireEvent.change(input, { target: { files: [file] } }); });
};
const webp = () => new File(['new-image'], 'new.webp', { type: 'image/webp' });

describe('Media tab image panel framing', () => {
  it('opens a stack framed on its primary, with the count and total in the header', () => {
    open();
    fireEvent.click(card('Entities', 'stack'));

    expect(panel()).toHaveAttribute('data-media-image-panel', 'entity:wick');
    expect(panel()).toHaveAttribute('data-media-panel', 'entity:wick:image:0');
    expect(tile('Primary image')).toHaveAttribute('aria-pressed', 'true');
    expect(inPanel().getByRole('heading')).toHaveTextContent('Odd Wick');
    expect(panel()).toHaveTextContent(/4 images · /);
    expect(framed()).toHaveTextContent(/^Image 1/);
  });

  it('opens an image picked from a summary framed on that image', () => {
    open();
    fireEvent.click(within(section('Entities')).getByRole('button', { name: /^Entities/ }));
    fireEvent.click(screen.getByRole('button', { name: /Odd Wick › Image 2/ }));

    expect(panel()).toHaveAttribute('data-media-panel', 'entity:wick:image:1');
    expect(tile('Image 2, has a Visibility rule')).toHaveAttribute('aria-pressed', 'true');
  });

  it('frames the pressed strip tile and switches the details to it', () => {
    open();
    fireEvent.click(card('Entities', 'stack'));
    fireEvent.click(tile('Image 3'));

    expect(panel()).toHaveAttribute('data-media-panel', 'entity:wick:image:2');
    expect(framed()).toHaveTextContent(/^Image 3·Linked/);
    expect(inPanel().getByRole('link', { name: 'Open Link' })).toBeInTheDocument();
  });

  it('frames the empty slot from the add tile and follows the upload that lands there', async () => {
    const bench = open();
    fireEvent.click(card('Entities', 'stack'));
    fireEvent.click(inPanel().getByLabelText('Add an Image'));
    expect(framed()).toBeNull();

    const input = document.getElementById('image-upload-media-entity-image-wick-4') as HTMLInputElement;
    await act(async () => { fireEvent.change(input, { target: { files: [webp()] } }); });

    await waitFor(() => expect(wick(bench).images).toHaveLength(5));
    await waitFor(() => expect(panel()).toHaveAttribute('data-media-panel', 'entity:wick:image:4'));
    expect(framed()).toHaveTextContent(/^Image 5/);

    // The new image holds the selection, so an edit to it returns here on undo.
    fireEvent.click(within(framed()!).getByRole('button', { name: 'Add Requirement' }));
    fireEvent.click(await screen.findByRole('option', { name: /^Health/ }));
    openEditorTab(/^Overview$/);
    await undo();
    expect(panel()).toHaveAttribute('data-media-panel', 'entity:wick:image:4');
    expect(wick(bench).images![4].requires).toBeUndefined();
  });
});

describe('Media tab image panel actions', () => {
  it('replaces the framed image in place, keeps its rule, and undoes in one step', async () => {
    const bench = open();
    const was = wick(bench).images![1];
    fireEvent.click(card('Entities', 'stack'));
    fireEvent.click(tile(/^Image 2/));
    const steps = bench.historyState().cursor;

    await replaceWith(webp());

    await waitFor(() => expect(wick(bench).images![1].data).toMatch(/^data:image\/webp;base64,/));
    expect(wick(bench).images![1].data).not.toBe(was);
    expect(wick(bench).images![1].requires).toEqual(was.requires);
    expect(wick(bench).images).toHaveLength(4);
    expect(lastLabel(bench)).toBe('Replace Image 2: Odd Wick');
    expect(bench.historyState().cursor).toBe(steps + 1);

    await undo();
    expect(wick(bench).images![1]).toEqual(was);
  });

  it('removes the framed image with its rule, keeps the frame on its position, and undoes in one step', async () => {
    const bench = open();
    const before = wick(bench).images!;
    fireEvent.click(card('Entities', 'stack'));
    fireEvent.click(tile(/^Image 2/));
    const steps = bench.historyState().cursor;

    await step(() => fireEvent.click(within(framed()!).getByRole('button', { name: 'Remove' })));

    expect(wick(bench).images!.map((i) => i.data)).toEqual([before[0], before[2], before[3]].map((i) => i.data));
    expect(wick(bench).images!.some((i) => i.requires)).toBe(false);
    expect(lastLabel(bench)).toBe('Remove Image 2: Odd Wick');
    expect(panel()).toHaveAttribute('data-media-panel', 'entity:wick:image:1');

    await undo();
    expect(bench.historyState().cursor).toBe(steps);
    expect(wick(bench).images).toEqual(before);
  });

  it('moves the frame back onto the new last image when the last one is removed', async () => {
    const bench = open();
    fireEvent.click(card('Entities', 'stack'));
    fireEvent.click(tile('Image 4'));

    await step(() => fireEvent.click(within(framed()!).getByRole('button', { name: 'Remove' })));

    expect(wick(bench).images).toHaveLength(3);
    expect(panel()).toHaveAttribute('data-media-panel', 'entity:wick:image:2');
  });

  it('writes a reorder to the gallery order, follows the moved image, and undoes in one step', async () => {
    // jsdom lays nothing out; set the tiles 100px apart in a row so the keyboard sensor finds a neighbor.
    spies.push(vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      const box = [...this.children].some((child) => child.matches('[aria-roledescription="sortable"]')) ? this : null;
      if (!box?.parentElement) return DOMRect.fromRect({ x: 0, y: 0, width: 10000, height: 300 });
      return DOMRect.fromRect({ x: [...box.parentElement.children].indexOf(box) * 100, y: 0, width: 90, height: 90 });
    }));
    const user = userEvent.setup();
    const bench = open();
    const before = wick(bench).images!;
    fireEvent.click(card('Entities', 'stack'));
    fireEvent.click(tile('Image 3'));
    const steps = bench.historyState().cursor;

    // Image 3 to the front is the Make Primary gesture.
    tile('Image 3').focus();
    await user.keyboard('[Space]');
    await user.keyboard('[ArrowLeft]');
    await user.keyboard('[ArrowLeft]');
    await user.keyboard('[Space]');

    await waitFor(() => expect(wick(bench).images![0]).toEqual(before[2]));
    expect(wick(bench).images).toEqual([before[2], before[0], before[1], before[3]]);
    expect(bench.historyState().cursor).toBe(steps + 1);
    expect(panel()).toHaveAttribute('data-media-panel', 'entity:wick:image:0');

    await undo();
    expect(wick(bench).images).toEqual(before);
  });
});

describe('Media tab image panel Visibility rules', () => {
  it('shows a rule set in the panel on the Profile tab', async () => {
    const bench = open();
    fireEvent.click(card('Entities', 'stack'));
    fireEvent.click(inPanel().getByRole('button', { name: 'Add Requirement' }));
    fireEvent.click(await screen.findByRole('option', { name: /^Health/ }));
    expect(wick(bench).images![0].requires).toHaveLength(1);

    fireEvent.click(inPanel().getByRole('button', { name: 'Go to Odd Wick' }));

    expect(screen.getByRole('button', { name: 'Primary image, has a Visibility rule' })).toBeInTheDocument();
  });

  it("shows a rule cleared on the Profile tab in the panel's editor", async () => {
    const bench = open();
    fireEvent.click(card('Entities', 'stack'));
    fireEvent.click(inPanel().getByRole('button', { name: 'Go to Odd Wick' }));
    const cog = within(screen.getByRole('button', { name: 'Image 2, has a Visibility rule' }).parentElement!)
      .getByRole('button', { name: 'Visibility Rule' });
    fireEvent.click(cog);
    fireEvent.click(await screen.findByRole('button', { name: /^Remove row/ }));
    expect(wick(bench).images![1].requires).toBeUndefined();
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });

    openEditorTab(/^Media$/);
    fireEvent.click(card('Entities', 'stack'));
    fireEvent.click(tile('Image 2'));

    expect(within(framed()!).queryByRole('button', { name: /^Remove row/ })).toBeNull();
    expect(within(framed()!).getByRole('button', { name: 'Add Requirement' })).toBeInTheDocument();
  });

  it('hides the strip cog and the framed summary in the panel, and keeps both on the Profile tab', () => {
    open();
    fireEvent.click(card('Entities', 'stack'));
    fireEvent.click(tile(/^Image 2/));
    expect(panel()!.querySelector('[data-image-rule-cog]')).toBeNull();
    expect(panel()!.querySelector('[data-image-rule-summary]')).toBeNull();
    expect(within(framed()!).getByRole('button', { name: /^Remove row/ })).toBeInTheDocument();

    fireEvent.click(inPanel().getByRole('button', { name: 'Go to Odd Wick' }));
    fireEvent.click(screen.getByRole('button', { name: 'Image 2, has a Visibility rule' }));

    expect(document.querySelectorAll('[data-image-rule-cog]')).toHaveLength(4);
    expect(document.querySelector('[data-image-rule-summary]')).toHaveTextContent('Shown while');
  });
});

describe('Media tab image panel location rules', () => {
  const SECOND = fakeDataUrl('image/webp', 700, 'w');
  /** Marsh with two images, and Odd Wick as a persona whose Health a rule can read. */
  const locationWorld = () => panelWorld((w) => {
    w.entities.find((e) => e.id === 'wick')!.persona = true;
    const marsh = w.locations.find((l) => l.id === 'marsh')!;
    marsh.images = [...(marsh.images ?? []), { data: SECOND }];
  });
  const marsh = (bench: ReturnType<typeof open>) => bench.ctx().locations.find((l) => l.id === 'marsh')!;

  it("stacks a multi-image location and edits the framed image's rule with the persona as host", async () => {
    const bench = open('simple', locationWorld());
    fireEvent.click(card('Locations', 'stack'));
    fireEvent.click(tile('Image 2'));
    fireEvent.click(within(framed()!).getByRole('button', { name: 'Add Requirement' }));

    expect(await screen.findByText('Persona Stats')).toBeInTheDocument();
    // Persona Stats lists first; Odd Wick Stats offers the same stat under its name.
    fireEvent.click((await screen.findAllByRole('option', { name: /^Health/ }))[0]);

    const [first, second] = marsh(bench).images!;
    expect(first.requires).toBeUndefined();
    // Stored with no owner: a location rule's owner-less Condition reads the played persona.
    expect(second.requires).toEqual([{ all: [expect.objectContaining({ kind: 'stat', id: 'health' })] }]);
    expect(second.requires![0].all[0]).not.toHaveProperty('owner');
    expect(within(framed()!).getByText(/^Persona: Health/)).toBeInTheDocument();
  });

  it("shows the location panel's gallery with a rule cog on each image", () => {
    open('simple', locationWorld());
    fireEvent.click(card('Locations', 'stack'));
    fireEvent.click(inPanel().getByRole('button', { name: 'Go to Marsh' }));
    // Radix tabs switch on mouse down.
    fireEvent.mouseDown(within(screen.getByRole('tablist', { name: 'Location Fields' })).getByRole('tab', { name: 'Media' }));

    expect(screen.getByRole('button', { name: 'Primary image' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Image 2' })).toBeInTheDocument();
    expect(document.querySelectorAll('[data-image-rule-cog]')).toHaveLength(2);
  });
});

describe('Media tab image panel modes and parents', () => {
  it.each([
    ['simple', false],
    ['advanced', true],
  ] as const)('in %s mode shows Generate with AI, and Image Tags only in Advanced', (mode, tags) => {
    open(mode);
    fireEvent.click(card('Entities', 'stack'));

    expect(inPanel().getByRole('button', { name: /Generate with AI/ })).toBeInTheDocument();
    expect(inPanel().queryByText('Image Tags') !== null).toBe(tags);
  });

  it("opens a location's image in the same panel, with its actions and rule editor", () => {
    open('advanced');
    fireEvent.click(card('Locations', 'image'));

    expect(panel()).toHaveAttribute('data-media-image-panel', 'location:marsh');
    expect(panel()).toHaveAttribute('data-media-panel', 'location:marsh:image:0');
    expect(framed()).toHaveTextContent(/^Image 1/);
    expect(within(framed()!).getByRole('button', { name: 'Replace' })).toBeInTheDocument();
    expect(within(framed()!).getByRole('button', { name: 'Add Requirement' })).toBeInTheDocument();
    expect(inPanel().getByRole('button', { name: 'Go to Marsh' })).toBeInTheDocument();
  });

  it("links the entity's world Avatar and opens that Avatar's card", () => {
    open();
    fireEvent.click(card('Entities', 'stack'));

    fireEvent.click(inPanel().getByRole('button', { name: 'Fen Walker' }));

    expect(panel()).toHaveAttribute('data-media-panel', 'world:world:avatar:walker');
  });

  it('names a library Avatar without a link, and shows nothing for the default pick', async () => {
    spies.push(vi.spyOn(ModelStorageService, 'getModelMetadata').mockResolvedValue([{ id: 'lib-1', name: 'Marsh Guide' }] as never));
    open('simple', panelWorld((w) => {
      w.entities.find((e) => e.id === 'wick')!.vrmPick = { kind: 'library', id: 'lib-1' };
      w.entities.find((e) => e.id === 'bram')!.vrmPick = { kind: 'default' };
    }));
    fireEvent.click(card('Entities', 'stack'));

    expect(await within(panel()!).findByText(/Avatar: Marsh Guide/)).toBeInTheDocument();
    expect(inPanel().queryByRole('button', { name: 'Marsh Guide' })).toBeNull();

    fireEvent.click(card('Entities › Crew › Deckhands', 'image'));
    expect(panel()).toHaveAttribute('data-media-image-panel', 'entity:bram');
    expect(panel()).not.toHaveTextContent('Avatar:');
  });
});

describe('Media tab No Images filter', () => {
  const header = () => document.querySelector<HTMLElement>('[data-media-header]')!;
  const pickFilter = (name: string) => {
    fireEvent.click(within(header()).getByRole('button', { name: /^Filter/ }));
    fireEvent.click(screen.getByRole('button', { name }));
  };
  const blankEls = () => [...document.querySelectorAll<HTMLElement>('[data-media-card="blank"]')];
  const blankCards = () => blankEls().map((c) => c.textContent);
  const noThumbnail = () => panelWorld((w) => { w.worldOverview.thumbnail = ''; });

  it('shows blank cards under No Images only, with the parent name and no size', () => {
    open('simple', noThumbnail());
    expect(blankCards()).toEqual([]);

    pickFilter('No Images');
    expect(blankCards()).toEqual(['Thumbnail', 'Map Background', 'Hollow', 'Bare Flat']);

    pickFilter('Linked');
    expect(blankCards()).toEqual([]);
    pickFilter('All Media');
    expect(blankCards()).toEqual([]);
  });

  it('applies search to blank cards', () => {
    open('simple', noThumbnail());
    pickFilter('No Images');
    fireEvent.change(screen.getByPlaceholderText('Search media'), { target: { value: 'Hollow' } });

    expect(blankCards()).toEqual(['Hollow']);
  });

  it('opens a blank entity card on the add slot, and an upload lands in slot 0 as one undoable step', async () => {
    const bench = open('simple', noThumbnail());
    pickFilter('No Images');
    fireEvent.click(blankEls()[2]);

    expect(panel()).toHaveAttribute('data-media-image-panel', 'entity:empty');
    expect(framed()).toBeNull();
    const input = document.getElementById('image-upload-media-entity-image-empty') as HTMLInputElement;
    await act(async () => { fireEvent.change(input, { target: { files: [webp()] } }); });

    await waitFor(() => expect(bench.ctx().entities.find((e) => e.id === 'empty')!.images).toHaveLength(1));
    expect(blankCards()).toEqual(['Thumbnail', 'Map Background', 'Bare Flat']);
    expect(panel()).toHaveAttribute('data-media-image-panel', 'entity:empty');
    expect(panel()).toHaveAttribute('data-media-panel', 'entity:empty:image:0');

    await undo();
    expect(bench.ctx().entities.find((e) => e.id === 'empty')!.images ?? []).toHaveLength(0);
    expect(blankCards()).toEqual(['Thumbnail', 'Map Background', 'Hollow', 'Bare Flat']);
  });

  it('uploads into a blank world slot from its item panel', async () => {
    const bench = open('simple', noThumbnail());
    pickFilter('No Images');
    fireEvent.click(blankEls()[0]);

    expect(inPanel().queryByRole('button', { name: 'Remove' })).toBeNull();
    const input = panel()!.querySelector<HTMLInputElement>('input[data-media-replace]')!;
    await act(async () => { fireEvent.change(input, { target: { files: [webp()] } }); });

    await waitFor(() => expect(bench.ctx().worldOverview.thumbnail).toMatch(/^data:/));
    expect(blankCards()).toEqual(['Map Background', 'Hollow', 'Bare Flat']);
    expect(lastLabel(bench)).toBe('Add Thumbnail');
  });
});
