import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { benchEditorWorld, openEditorTab, renderWorldEditorBench, searchWorldField } from '@/test/worldEditorBench';
import type { World } from '@/types';

/** The Collapse All button right of a tree's search, and the collapsed groups the World Editor keeps per tab. */

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

/** Three depths under Wood, and Harbor at the top with no children. */
const WORLD: World = benchEditorWorld({
  locations: [
    { id: 'harbor', name: 'Harbor' },
    { id: 'wood', name: 'Wood' },
    { id: 'hollow', name: 'Hollow', parentId: 'wood' },
    { id: 'den', name: 'Den', parentId: 'hollow', playerDescription: 'A badger sett under thornroot.' },
  ],
} as Partial<World>);

const FLAT: World = benchEditorWorld({
  locations: [{ id: 'harbor', name: 'Harbor' }, { id: 'wood', name: 'Wood' }],
} as Partial<World>);

const collapseAll = () => screen.getByRole('button', { name: 'Collapse all locations' });
const expandAll = () => screen.getByRole('button', { name: 'Expand all locations' });
/** Either face of the button. */
const collapseButton = () => screen.getByRole('button', { name: /^(Collapse|Expand) all locations$/ });

/** The tree rows an author sees, by name, in order. */
const rows = () => Array.from(document.querySelectorAll<HTMLElement>('[class*="cursor-pointer"]'))
  .map((row) => row.textContent?.trim())
  .filter((name): name is string => ['Harbor', 'Wood', 'Hollow', 'Den'].includes(name ?? ''));

const searchLocations = (term: string) =>
  fireEvent.change(screen.getByPlaceholderText('Filter Locations'), { target: { value: term } });

const openLocations = () => openEditorTab(/Locations/);

beforeEach(() => { localStorage.clear(); });

describe('Collapse All on the Locations tab', () => {
  it('sits right of the search and before the view switch', () => {
    renderWorldEditorBench(WORLD, 'advanced');
    openLocations();
    const search = screen.getByPlaceholderText('Filter Locations');
    const button = collapseAll();
    const canvas = screen.getByRole('radio', { name: 'Canvas' });
    expect(search.compareDocumentPosition(button) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(button.compareDocumentPosition(canvas) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('closes every depth, then opens every depth', () => {
    renderWorldEditorBench(WORLD, 'advanced');
    openLocations();
    expect(rows()).toEqual(['Harbor', 'Wood', 'Hollow', 'Den']);

    fireEvent.click(collapseAll());
    expect(rows()).toEqual(['Harbor', 'Wood']);
    // Opening Wood by hand shows Hollow still closed: the press closed the inner group too.
    fireEvent.click(screen.getByRole('button', { name: 'Expand sub-locations' }));
    expect(rows()).toEqual(['Harbor', 'Wood', 'Hollow']);

    // One group is open, so the button still collapses.
    fireEvent.click(collapseAll());
    expect(rows()).toEqual(['Harbor', 'Wood']);
    fireEvent.click(expandAll());
    expect(rows()).toEqual(['Harbor', 'Wood', 'Hollow', 'Den']);
    expect(collapseAll()).toBeEnabled();
  });

  it('keeps the groups closed across a visit to another tab', () => {
    renderWorldEditorBench(WORLD, 'advanced');
    openLocations();
    fireEvent.click(collapseAll());

    openEditorTab(/Stats/);
    openLocations();
    expect(rows()).toEqual(['Harbor', 'Wood']);
    expect(expandAll()).toBeInTheDocument();
  });

  it('keeps the groups closed across a visit when a hidden location is selected', () => {
    renderWorldEditorBench(WORLD, 'advanced');
    openLocations();
    fireEvent.click(screen.getByText('Den'));
    fireEvent.click(collapseAll());

    openEditorTab(/Stats/);
    openLocations();
    expect(rows()).toEqual(['Harbor', 'Wood']);
  });

  it('opens them again when the editor closes and opens', () => {
    const bench = renderWorldEditorBench(WORLD, 'advanced');
    openLocations();
    fireEvent.click(collapseAll());

    bench.reopen();
    openLocations();
    expect(rows()).toEqual(['Harbor', 'Wood', 'Hollow', 'Den']);
  });

  it('is disabled while a search is typed, and clearing it brings back the closed groups', () => {
    renderWorldEditorBench(WORLD, 'advanced');
    openLocations();
    fireEvent.click(collapseAll());

    searchLocations('o');
    // Disabled, and its label still says what the next press would do.
    expect(expandAll()).toBeDisabled();

    searchLocations('');
    expect(expandAll()).toBeEnabled();
    expect(rows()).toEqual(['Harbor', 'Wood']);
  });

  it('is disabled in the Canvas view', () => {
    renderWorldEditorBench(WORLD, 'advanced');
    openLocations();
    fireEvent.click(screen.getByRole('radio', { name: 'Canvas' }));
    expect(collapseButton()).toBeDisabled();
  });

  it('is disabled on a tree with no parent rows', () => {
    renderWorldEditorBench(FLAT, 'advanced');
    openLocations();
    expect(collapseAll()).toBeDisabled();
  });

  it('opens the closed groups above a location selected from outside the tree', async () => {
    renderWorldEditorBench(WORLD, 'advanced');
    openLocations();
    fireEvent.click(collapseAll());
    expect(rows()).toEqual(['Harbor', 'Wood']);

    openEditorTab(/Stats/);
    fireEvent.keyDown(window, { key: 'f', ctrlKey: true });
    await waitFor(() => expect(document.activeElement).toBe(searchWorldField()));
    fireEvent.change(searchWorldField(), { target: { value: 'thornroot' } });

    await waitFor(() => expect(rows()).toEqual(['Harbor', 'Wood', 'Hollow', 'Den']));
  });

  it('opens them again for a location that is already selected', async () => {
    renderWorldEditorBench(WORLD, 'advanced');
    openLocations();
    fireEvent.click(screen.getByText('Den'));
    fireEvent.click(collapseAll());
    expect(rows()).toEqual(['Harbor', 'Wood']);

    fireEvent.keyDown(window, { key: 'f', ctrlKey: true });
    await waitFor(() => expect(document.activeElement).toBe(searchWorldField()));
    fireEvent.change(searchWorldField(), { target: { value: 'thornroot' } });

    await waitFor(() => expect(rows()).toEqual(['Harbor', 'Wood', 'Hollow', 'Den']));
  });
});
