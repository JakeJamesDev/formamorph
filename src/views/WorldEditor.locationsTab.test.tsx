import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { namedPlacesOf } from '@/lib/entityPlaces';
import { screen, fireEvent, within } from '@testing-library/react';
import { asMobile, benchEditorWorld, openEditorTab, renderWorldEditorBench, pickEditorMode } from '@/test/worldEditorBench';
import type { World } from '@/types';

/** How the view holds the Locations tab: the open location across tabs, the List and Canvas switch, the mobile push, the panel under a mode switch, and Exit Without Saving after a delete. */

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
  toast: { info: vi.fn(), success: vi.fn(), error: vi.fn() },
  ToastContainer: () => null,
}));


{
const WORLD: World = benchEditorWorld({
  locations: [
    { id: 'harbor', name: 'Harbor' },
    { id: 'wood', name: 'Wood' },
    { id: 'hollow', name: 'Hollow', parentId: 'wood' },
  ],
  stats: [{ id: 's-warmth', name: 'Warmth', type: 'number', description: '', min: 0, max: 10, value: 4, regen: 0, descriptors: [] }],
} as Partial<World>);

const searchLocations = (term: string) =>
  fireEvent.change(screen.getByPlaceholderText('Filter Locations'), { target: { value: term } });

/** The flat search list's rows, by the label each one shows. */
const searchRows = () => screen.queryAllByRole('button', { name: /^Select / }).map((b) => b.getAttribute('aria-label')!.slice('Select '.length));

/** A tree row, the clickable list row holding the name. */
const treeRow = (name: string) => {
  const row = screen.getAllByText(name).map((el) => el.closest<HTMLElement>('[class*="cursor-pointer"]')).find(Boolean);
  if (!row) throw new Error(`No tree row named ${name}`);
  return row;
};

const shownName = () => {
  const field = screen.queryByLabelText('Name');
  if (!field) return null;
  return field instanceof HTMLInputElement ? field.value : field.textContent;
};

const canvasShown = () => document.querySelector('.react-flow') !== null;
const openCanvas = () => fireEvent.click(screen.getByRole('radio', { name: 'Canvas' }));

const detailPushed = () => document.querySelector('[data-list-detail] > [aria-hidden]')?.getAttribute('aria-hidden') === 'false';

beforeEach(() => { localStorage.clear(); });

describe('the Locations tab', () => {
  // Drift log #2: kept until ruled.
  it('reopens its own location after a visit to another tab', () => {
    renderWorldEditorBench(WORLD, 'advanced');
    openEditorTab(/Locations/);

    fireEvent.click(treeRow('Hollow'));
    openEditorTab(/Stats/);
    openEditorTab(/Locations/);
    expect(shownName()).toBe('Hollow');
  });

  it('closes the details on a click in the list\'s empty space', () => {
    renderWorldEditorBench(WORLD, 'advanced');
    openEditorTab(/Locations/);

    fireEvent.click(treeRow('Wood'));
    fireEvent.click(document.querySelector('[role="tabpanel"] > div')!);
    expect(shownName()).toBeNull();
  });

  describe('the view switch', () => {
    /** The toolbar's controls in DOM order: the +, the search box, Collapse All, then each view button by its name. */
    const toolbarOrder = () => {
      const box = screen.getByPlaceholderText('Filter Locations');
      const row = screen.getByRole('button', { name: 'Add to Locations' }).parentElement!;
      return [...row.querySelectorAll<HTMLElement>('button, input')].map((el) =>
        el === box ? 'search' : el.getAttribute('aria-label') ?? el.textContent);
    };
    const viewButtons = () => ['List', 'Canvas'].map((name) => screen.getByRole('radio', { name }));

    const expectIconSwitch = () => {
      expect(toolbarOrder().slice(0, 5)).toEqual(['Add to Locations', 'search', 'Collapse all locations', 'List', 'Canvas']);
      for (const b of viewButtons()) {
        expect(b.textContent).toBe('');
        expect(b.querySelector('svg')).not.toBeNull();
      }
    };

    it('draws List and Canvas as named icon buttons past the search box', () => {
      renderWorldEditorBench(WORLD, 'advanced');
      openEditorTab(/Locations/);
      expectIconSwitch();
    });

    it('draws the same switch on mobile', () => {
      const restore = asMobile();
      try {
        renderWorldEditorBench(WORLD, 'advanced');
        openEditorTab(/Locations/);
        expectIconSwitch();
      } finally { restore(); }
    });

    it('switches to the canvas and back to the list', () => {
      renderWorldEditorBench(WORLD, 'advanced');
      openEditorTab(/Locations/);
      openCanvas();
      expect(canvasShown()).toBe(true);
      fireEvent.click(screen.getByRole('radio', { name: 'List' }));
      expect(canvasShown()).toBe(false);
      expect(treeRow('Hollow')).toBeTruthy();
    });
  });

  describe('in the Canvas view', () => {
    it('keeps the view toggle in a toolbar row apart from the tab strip', () => {
      renderWorldEditorBench(WORLD, 'advanced');
      openEditorTab(/Locations/);

      const box = screen.getByPlaceholderText('Filter Locations');
      let row: HTMLElement = screen.getByRole('radio', { name: 'Canvas' });
      while (!row.contains(box)) row = row.parentElement!;
      expect(row.querySelector('[role="tablist"]')).toBeNull();
    });

    it('ignores the search and keeps the canvas', () => {
      renderWorldEditorBench(WORLD, 'advanced');
      openEditorTab(/Locations/);
      openCanvas();

      searchLocations('Harbor');
      expect(canvasShown()).toBe(true);
      expect(searchRows()).toEqual([]);
    });

    it('keeps the details open on a click in the canvas\'s slot', () => {
      renderWorldEditorBench(WORLD, 'advanced');
      openEditorTab(/Locations/);
      fireEvent.click(treeRow('Wood'));
      openCanvas();

      fireEvent.click(document.querySelector('[role="tabpanel"] > div')!);
      expect(shownName()).toBe('Wood');
    });
  });

  describe('on mobile', () => {
    let restore: () => void;
    beforeEach(() => { restore = asMobile(); });
    afterEach(() => restore());

    it('pushes the details over the list and goes back to it', () => {
      renderWorldEditorBench(WORLD, 'advanced');
      openEditorTab(/Locations/);

      fireEvent.click(treeRow('Wood'));
      expect(detailPushed()).toBe(true);
      expect(shownName()).toBe('Wood');
      fireEvent.click(screen.getByRole('button', { name: 'Back to Locations' }));
      expect(detailPushed()).toBe(false);
    });
  });
});
}

{
/** A parent with every field filled and a child under it, so the persistence case can cross the tree rather
 *  than only step between siblings. The connection gives Presence something authored to draw. */
const WORLD: World = benchEditorWorld({
  locations: [
    {
      id: 'veil', name: 'The Veilwood', isStarting: true,
      playerDescription: 'Moss over standing stones.',
      aiDescription: 'An old wood the fen grew around.',
      aiSummary: 'A drowned wood.',
      imageTags: 'forest, mist',
    },
    { id: 'hollow', name: 'The Hollow', parentId: 'veil', aiDescription: 'A dip below the roots.' },
  ],
  connections: [{ id: 'c1', a: 'veil', b: 'hollow', aToB: {}, bToA: {} }],
  entities: [{ id: 'resident', name: 'Odd Wick', aiDescription: 'Keeps the lamps.', locations: ['veil'] }],
});

/** Every field label the panel shows, in document order. Two of these are also editor tab names, so the
 *  match is taken from the panel body rather than from the whole editor. */
const FIELD_LABELS =
  /^(Name|Player-Facing Description|AI-Facing Description|AI-Facing Summary|Entities|Background Image|Image Tags|Ambient Sound|Placeholder Pins)$/;

const panelLabels = () =>
  screen.getAllByText(FIELD_LABELS)
    .filter((el) => !el.closest('[role="tablist"]'))
    .map((el) => el.textContent);

/** The location panel's own strip. The editor's top-level one carries a Locations tab, so every read and
 *  click here is taken from the named strip rather than by tab name. */
const panelStrip = () => screen.queryByRole('tablist', { name: 'Location Fields' });

const panelTabNames = () => {
  const strip = panelStrip();
  return strip ? within(strip).getAllByRole('tab').map((el) => el.textContent) : [];
};

const panelTab = (name: string) =>
  within(screen.getByRole('tablist', { name: 'Location Fields' })).getByRole('tab', { name });

// These tabs switch on mouseDown, not click.
const openPanelTab = (name: string) => fireEvent.mouseDown(panelTab(name));

/** One row of the tree. A location's name is drawn as meta elsewhere on the page, so the row is picked as
 *  the match sitting inside a clickable list row. */
const treeRow = (name: string) => {
  const row = screen.getAllByText(name)
    .map((el) => el.closest<HTMLElement>('[class*="cursor-pointer"]'))
    .find(Boolean);
  if (!row) throw new Error(`No tree row named ${name}`);
  return row;
};

const openLocations = () => fireEvent.mouseDown(screen.getByRole('tab', { name: /^Locations/ }));

const selectLocation = (name: string) => {
  openLocations();
  fireEvent.click(treeRow(name));
};

beforeEach(() => { localStorage.clear(); });

describe('the World Editor location panel tabs', () => {
  it('falls back to Details when Simple mode takes the chosen tab away', () => {
    renderWorldEditorBench(WORLD, 'advanced');
    selectLocation('The Veilwood');
    openPanelTab('Pins');
    pickEditorMode('Simple');
    expect(panelTabNames()).toEqual(['Details', 'Presence', 'Connections', 'Items', 'Media']);
    expect(panelTab('Details')).toHaveAttribute('aria-selected', 'true');
    expect(panelLabels()).toEqual(['Name', 'Player-Facing Description', 'AI-Facing Description']);
  });

  it('gives the Canvas view the same panel as the tree', () => {
    renderWorldEditorBench(WORLD, 'advanced');
    selectLocation('The Veilwood');
    openPanelTab('Media');
    fireEvent.click(screen.getByRole('radio', { name: 'Canvas' }));
    expect(panelTabNames()).toEqual(['Details', 'Presence', 'Connections', 'Items', 'Media', 'Pins', 'Openings']);
    expect(panelTab('Media')).toHaveAttribute('aria-selected', 'true');
  });
});
}

{
const WORLD = benchEditorWorld({
  locations: [
    { id: 'harbor', name: 'Harbor Steps', isStarting: true },
    { id: 'wood', name: 'The Veilwood' },
    { id: 'hollow', name: 'The Hollow', parentId: 'wood' },
  ],
  entities: [{
    id: 'resident', name: 'Odd Wick', playerDescription: 'The lamp-keeper.',
    aiDescription: 'Keeps the harbor lamps lit.', locations: ['harbor', 'wood'],
  }],
  connections: [
    { id: 'c1', a: 'harbor', b: 'wood', aToB: {}, bToA: {} },
    { id: 'c2', a: 'hollow', b: 'harbor', aToB: {}, bToA: {} },
  ],
} as never);

const row = (name: string) => {
  const found = screen.getAllByText(name)
    .map((el) => el.closest<HTMLElement>('[class*="cursor-pointer"]'))
    .find(Boolean);
  if (!found) throw new Error(`No row named ${name}`);
  return found;
};

const openLocations = async () => {
  fireEvent.mouseDown(await screen.findByRole('tab', { name: /^Locations/ }));
  await screen.findAllByText('The Veilwood');
};

const deleteRow = (name: string) => fireEvent.click(within(row(name)).getByRole('button', { name: 'Delete' }));

describe('World Editor — deleting a location', () => {
  it('restores the location, its membership, and its Connections on Exit Without Saving', async () => {
    const { ctx } = renderWorldEditorBench(WORLD, 'advanced');
    await openLocations();
    deleteRow('The Veilwood');

    fireEvent.click(document.querySelector('.lucide-arrow-left')!.closest('button')!);
    fireEvent.click(await screen.findByRole('button', { name: 'Exit Without Saving' }));

    expect(ctx().locations.map((l) => l.id)).toEqual(['harbor', 'wood', 'hollow']);
    expect(ctx().locations.find((l) => l.id === 'hollow')?.parentId).toBe('wood');
    expect(namedPlacesOf(ctx().entities[0])).toEqual(['harbor', 'wood']);
    expect(ctx().connections.map((c) => c.id)).toEqual(['c1', 'c2']);
    expect(ctx().isWorldDirty).toBe(false);
  });
});
}
