import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, within } from '@testing-library/react';
import { decodePlaceholderToken, encodePlaceholderToken } from '@/lib/placeholders';
import type { World } from '@/types';
import { renderLocationsTab } from '@/test/locationsTabBench';
import { panelWorld } from '@/test/panelBench';

/** The Locations tab's list: the tree, a flat search with drag grips, and the details beside it. */

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

const WORLD: World = panelWorld({
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

beforeEach(() => { localStorage.clear(); });

describe('the Locations tab', () => {
  it('draws the tree until a search is typed, then a flat list with drag grips', () => {
    renderLocationsTab(WORLD, 'advanced');

    expect(searchRows()).toEqual([]);
    expect(treeRow('Hollow')).toBeTruthy();
    searchLocations('H');
    expect(searchRows()).toEqual(['Harbor', 'Hollow']);
    expect(within(searchRow('Hollow')).queryByLabelText('Drag to reorder')).not.toBeNull();
    searchLocations('Marsh');
    expect(screen.getByText(/No locations match/)).toBeInTheDocument();
  });

  it('adds a location named from the search box and opens it', () => {
    const { ctx } = renderLocationsTab(WORLD, 'advanced');

    searchLocations('Marsh');
    fireEvent.click(screen.getByRole('button', { name: 'Add to Locations' }));
    expect(ctx().locations.map((l) => l.name)).toEqual(['Harbor', 'Wood', 'Hollow', 'Marsh']);
    expect(shownName()).toBe('Marsh');
  });

  it('duplicates a search row right after the original and opens the copy', () => {
    const { ctx } = renderLocationsTab(WORLD, 'advanced');

    searchLocations('Harbor');
    fireEvent.click(within(searchRow('Harbor')).getByRole('button', { name: 'Duplicate' }));
    expect(ctx().locations.map((l) => l.name)).toEqual(['Harbor', 'Harbor (Copy)', 'Wood', 'Hollow']);
    expect(shownName()).toBe('Harbor (Copy)');
  });

  it('gives a duplicated search row its own Unique-chip rolls', () => {
    const roll = encodePlaceholderToken({ id: 'eye', mode: 'unique', placementId: 'p1' });
    const world = panelWorld({
      locations: [{ id: 'harbor', name: 'Harbor', description: `Eyes ${roll}` }],
    } as Partial<World>);
    const { ctx } = renderLocationsTab(world, 'advanced');

    searchLocations('Harbor');
    fireEvent.click(within(searchRow('Harbor')).getByRole('button', { name: 'Duplicate' }));
    const [source, copy] = ctx().locations;
    expect(source.description).toBe(`Eyes ${roll}`);
    expect(decodePlaceholderToken(copy.description!.slice('Eyes '.length))!.placementId).not.toBe('p1');
  });

  it('deletes a search row and closes its details', () => {
    const { ctx } = renderLocationsTab(WORLD, 'advanced');

    fireEvent.click(treeRow('Harbor'));
    searchLocations('Harbor');
    fireEvent.click(within(searchRow('Harbor')).getByRole('button', { name: 'Delete' }));
    expect(ctx().locations.map((l) => l.name)).toEqual(['Wood', 'Hollow']);
    expect(shownName()).toBeNull();
  });

  // Drift log #2: kept until ruled.
  it('blanks the open location\'s details while a search leaves it out', () => {
    renderLocationsTab(WORLD, 'advanced');

    fireEvent.click(treeRow('Wood'));
    searchLocations('Harbor');
    expect(shownName()).toBeNull();
    searchLocations('');
    expect(shownName()).toBe('Wood');
  });


});
