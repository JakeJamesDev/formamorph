import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, fireEvent, within } from '@testing-library/react';
import { asMobile, benchEditorWorld, openEditorTab, renderWorldEditorBench } from '@/test/worldEditorBench';
import type { World } from '@/types';

/** The top-level Locations tab on the List Editor: the tree, a flat sortable search, and the Canvas view. */

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

const WORLD: World = benchEditorWorld({
  locations: [
    { id: 'harbor', name: 'Harbor' },
    { id: 'wood', name: 'Wood' },
    { id: 'hollow', name: 'Hollow', parentId: 'wood' },
  ],
  stats: [{ id: 's-warmth', name: 'Warmth', type: 'number', description: '', min: 0, max: 10, value: 4, regen: 0, descriptors: [] }],
} as Partial<World>);

const searchLocations = (term: string) =>
  fireEvent.change(screen.getByPlaceholderText('Search or add new locations'), { target: { value: term } });

/** The flat search list's rows, by the label each one shows. */
const searchRows = () => screen.queryAllByRole('button', { name: /^Select / }).map((b) => b.getAttribute('aria-label')!.slice('Select '.length));

const searchRow = (name: string) => screen.getByRole('button', { name: `Select ${name}` }).parentElement as HTMLElement;

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
  it('draws the tree until a search is typed, then a flat list with drag grips', () => {
    renderWorldEditorBench(WORLD, 'advanced');
    openEditorTab(/Locations/);

    expect(searchRows()).toEqual([]);
    expect(treeRow('Hollow')).toBeTruthy();
    searchLocations('H');
    expect(searchRows()).toEqual(['Harbor', 'Hollow']);
    expect(within(searchRow('Hollow')).queryByLabelText('Drag to reorder')).not.toBeNull();
    searchLocations('Marsh');
    expect(screen.getByText(/No locations match/)).toBeInTheDocument();
  });

  it('adds a location named from the search box and opens it', () => {
    const { ctx } = renderWorldEditorBench(WORLD, 'advanced');
    openEditorTab(/Locations/);

    searchLocations('Marsh');
    fireEvent.click(screen.getByRole('button', { name: 'Add to Locations' }));
    expect(ctx().locations.map((l) => l.name)).toEqual(['Harbor', 'Wood', 'Hollow', 'Marsh']);
    expect(shownName()).toBe('Marsh');
  });

  it('duplicates a search row right after the original and opens the copy', () => {
    const { ctx } = renderWorldEditorBench(WORLD, 'advanced');
    openEditorTab(/Locations/);

    searchLocations('Harbor');
    fireEvent.click(within(searchRow('Harbor')).getByRole('button', { name: 'Duplicate' }));
    expect(ctx().locations.map((l) => l.name)).toEqual(['Harbor', 'Harbor (Copy)', 'Wood', 'Hollow']);
    expect(shownName()).toBe('Harbor (Copy)');
  });

  it('deletes a search row and closes its details', () => {
    const { ctx } = renderWorldEditorBench(WORLD, 'advanced');
    openEditorTab(/Locations/);

    fireEvent.click(treeRow('Harbor'));
    searchLocations('Harbor');
    fireEvent.click(within(searchRow('Harbor')).getByRole('button', { name: 'Delete' }));
    expect(ctx().locations.map((l) => l.name)).toEqual(['Wood', 'Hollow']);
    expect(shownName()).toBeNull();
  });

  // Drift log #2: kept until ruled.
  it('blanks the open location\'s details while a search leaves it out', () => {
    renderWorldEditorBench(WORLD, 'advanced');
    openEditorTab(/Locations/);

    fireEvent.click(treeRow('Wood'));
    searchLocations('Harbor');
    expect(shownName()).toBeNull();
    searchLocations('');
    expect(shownName()).toBe('Wood');
  });

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

  describe('in the Canvas view', () => {
    it('keeps the view toggle in the toolbar and draws the canvas', () => {
      renderWorldEditorBench(WORLD, 'advanced');
      openEditorTab(/Locations/);

      // The toggle and the search box share a row that holds nothing else of the editor, not its tab strip.
      const box = screen.getByPlaceholderText('Search or add new locations');
      let row: HTMLElement = screen.getByRole('radio', { name: 'Canvas' });
      while (!row.contains(box)) row = row.parentElement!;
      expect(row.querySelector('[role="tablist"]')).toBeNull();
      openCanvas();
      expect(canvasShown()).toBe(true);
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
