import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { clickFlask, openEditorTab, renderWorldEditorBench, shownEditorTab } from '@/test/worldEditorBench';
import { PUBLISH_LIMITS } from '@/lib/publishLimits';
import { fakeDataUrl, mediaFixtureWorld } from '@/test/mediaFixture';
import { measureInWorker, encodeInWorker } from '@/lib/imageOptimWorkerClient';
import type { Entity, MapBackground, Stat, World } from '@/types';

/** The Media tab inside the editor: what only the view's wiring makes pass. The gallery and panel cases run on the tab alone. */

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

describe('the Media tab and the editor', () => {
  const section = (name: string) => screen.getByRole('region', { name });

  const card = (name: string, kind: string, index = 0) =>
    section(name).querySelectorAll<HTMLElement>(`[data-media-card="${kind}"]`)[index];
  const panel = () => document.querySelector<HTMLElement>('[data-media-panel]');
  /** The open panel's Name field: a chip field on entities and locations, a plain input on a dictionary. */
  const shownName = () => {
    const field = screen.getByLabelText('Name');
    return field instanceof HTMLInputElement ? field.value : field.textContent;
  };

  const openMedia = (mode: 'simple' | 'advanced') => {
    const bench = renderWorldEditorBench(mediaFixtureWorld(), mode);
    openEditorTab(/^Media$/);
    return bench;
  };

  describe('Media tab Go to', () => {
    it.each([
      ['an entity', 'Entities', 'model', 'Go to Odd Wick', 'Entities', 'Odd Wick'],
      ['a location', 'Locations › Harbor Steps', 'sound', 'Go to Lamp Room', 'Locations', 'Lamp Room'],
      ['a dictionary', 'Dictionaries', 'image', 'Go to Fen Lore', 'Dictionary', 'Fen Lore'],
    ])('lands on %s that holds the item', (_what, sectionName, kind, label, tab, name) => {
      openMedia('advanced');
      fireEvent.click(card(sectionName, kind));
      fireEvent.click(within(panel()!).getByRole('button', { name: label }));

      expect(shownEditorTab()).toBe(tab);
      expect(shownName()).toBe(name);
    });

    it('lands on the Overview for world media', () => {
      openMedia('advanced');
      fireEvent.click(card('World', 'sound'));
      fireEvent.click(within(panel()!).getByRole('button', { name: 'Go to Overview' }));

      expect(shownEditorTab()).toBe('Overview');
    });
  });

  describe('Media tab header', () => {
    const header = () => document.querySelector<HTMLElement>('[data-media-header]')!;
    const headerMeter = () => within(header()).getByRole('meter', { name: 'Publish Size' });
    const pickFilter = (name: string) => {
      fireEvent.click(within(header()).getByRole('button', { name: /^Filter/ }));
      fireEvent.click(screen.getByRole('button', { name }));
    };

    it("reads the same figure and band as the World Doctor's bar for the same world", async () => {
      const limit = PUBLISH_LIMITS.world;
      // A lowered limit puts the fixture world in the red band.
      PUBLISH_LIMITS.world = 20_000;
      try {
        openMedia('advanced');
        await waitFor(() => expect(Number(headerMeter().getAttribute('aria-valuenow'))).toBeGreaterThan(0));
        await clickFlask();
        const doctor = (await screen.findAllByRole('meter', { name: 'Publish Size' })).find((m) => !header().contains(m))!;

        expect(headerMeter().getAttribute('aria-valuetext')).toBe(doctor.getAttribute('aria-valuetext')!.replace(' of ', ' / '));
        expect(headerMeter()).toHaveAttribute('data-band', 'red');
        expect(doctor).toHaveAttribute('data-band', 'red');
      } finally {
        PUBLISH_LIMITS.world = limit;
      }
    });

    it('keeps grouping and Largest First when the editor reopens, resets the filter, and leaves the world alone', () => {
      const bench = openMedia('advanced');
      const before = JSON.stringify(bench.ctx().getWorldData());
      fireEvent.click(screen.getByRole('button', { name: 'Group by Type' }));
      fireEvent.click(screen.getByRole('button', { name: 'Largest First' }));
      pickFilter('Linked');

      bench.reopen();
      openEditorTab(/^Media$/);

      expect(screen.getByRole('button', { name: 'Group by Type' })).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByRole('button', { name: 'Largest First' })).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByRole('button', { name: 'Filter' })).toBeInTheDocument();
      expect(JSON.stringify(bench.ctx().getWorldData())).toBe(before);
    });

    it('opens the Media tab from the over-limit finding', async () => {
      const limit = PUBLISH_LIMITS.world;
      PUBLISH_LIMITS.world = 2_000;
      try {
        renderWorldEditorBench(mediaFixtureWorld(), 'advanced');
        await clickFlask();
        expect(shownEditorTab()).not.toBe('Media');
        fireEvent.click(await screen.findByRole('button', { name: 'Sedge Landing' }));

        expect(shownEditorTab()).toBe('Media');
      } finally {
        PUBLISH_LIMITS.world = limit;
      }
    });
  });
});

describe('the Media tab image panel and the editor', () => {
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

  const step = (action: () => void) => act(async () => { action(); });
  const undo = () => step(() => { fireEvent.keyDown(document.body, { key: 'z', ctrlKey: true }); });

  const webp = () => new File(['new-image'], 'new.webp', { type: 'image/webp' });

  describe('Media tab image panel framing', () => {
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
});

describe('the Media tab history and the editor', () => {
  const section = (name: string) => screen.queryByRole('region', { name });
  const cardsOf = (name: string, kind: string) =>
    Array.from(section(name)?.querySelectorAll<HTMLElement>(`[data-media-card="${kind}"]`) ?? []);
  const card = (name: string, kind: string, index = 0) => cardsOf(name, kind)[index];
  const panel = () => document.querySelector<HTMLElement>('[data-media-panel]');
  const panelButton = (name: string) => within(panel()!).queryByRole('button', { name });

  const step = (action: () => void) => act(async () => { action(); });
  const undo = () => step(() => { fireEvent.keyDown(document.body, { key: 'z', ctrlKey: true }); });
  const redo = () => step(() => { fireEvent.keyDown(document.body, { key: 'y', ctrlKey: true }); });

  const openMedia = (mode: 'simple' | 'advanced' = 'simple') => {
    const bench = renderWorldEditorBench(mediaFixtureWorld(), mode);
    openEditorTab(/^Media$/);
    return bench;
  };

  describe('Media tab history reveal', () => {
    it('returns to the Media tab with the card selected when its edit is undone from another tab', async () => {
      openMedia();
      fireEvent.click(card('Locations › Harbor Steps', 'sound'));
      await step(() => fireEvent.click(panelButton('Remove')!));
      openEditorTab(/^Overview$/);

      await undo();

      expect(shownEditorTab()).toBe('Media');
      expect(panel()).toHaveAttribute('data-media-panel', 'location:lamp:ambientSound');
    });

    it('opens the Media tab with no card when the redo takes the card away', async () => {
      openMedia();
      fireEvent.click(card('Locations › Harbor Steps', 'sound'));
      await step(() => fireEvent.click(panelButton('Remove')!));
      await undo();
      openEditorTab(/^Overview$/);

      await redo();

      expect(shownEditorTab()).toBe('Media');
      expect(panel()).toBeNull();
      expect(cardsOf('Locations › Harbor Steps', 'sound')).toHaveLength(0);
    });
  });
});

describe('the Map Background and the editor', () => {
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
    const bench = renderWorldEditorBench(world, 'simple');
    openEditorTab(/^Media$/);
    return bench;
  };

  const section = () => screen.getByRole('region', { name: 'World › Map Background' });
  const panel = () => document.querySelector<HTMLElement>('[data-media-panel]');

  const inPanel = () => within(panel()!);

  describe('Media tab Map Background', () => {
    it('jumps to the Locations canvas from Go to Locations', () => {
      open();
      fireEvent.click(section().querySelector<HTMLElement>('[data-media-card="stack"]')!);
      fireEvent.click(inPanel().getByRole('button', { name: 'Go to Locations' }));

      expect(screen.getByRole('radio', { name: 'Canvas' })).toHaveAttribute('aria-checked', 'true');
    });
  });
});
