import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor, within } from '@testing-library/react';
import { asMobile, benchEditorWorld, clickFlask, openEditorTab, renderWorldEditorBench, searchWorldField } from '@/test/worldEditorBench';
import type { World } from '@/types';

/**
 * Where the editor lands when something else picks the location: a Find hit or a Bench finding.
 *
 * The location panel hides most of its fields behind its own tabs, so text alone can no longer reach a hit —
 * whatever navigates has to open the owning tab first, and early enough that the reveal finds the field
 * mounted. These cases drive the real editor, so they fail the same way an author would see it.
 */

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

/** One location whose every searchable field holds a word found nowhere else, so a query names its field. */
const WORLD: World = benchEditorWorld({
  locations: [
    {
      id: 'veil', name: 'The Veilwood', isStarting: true,
      playerDescription: 'Moss over standing stones.',
      aiDescription: 'An old wood the fen grew around beacons.',
      aiSummary: 'A drowned causeway.',
      imageTags: 'oilskin, lantern',
    },
    // A second location carrying one Bench finding of its own: it is described to the player but not to the
    // AI, which the rules warn about. That finding is what the Bench case opens.
    { id: 'hollow', name: 'The Hollow', playerDescription: 'A dip below the roots.' },
  ],
  entities: [{ id: 'resident', name: 'Odd Wick', aiDescription: 'Keeps the lamps.', locations: ['veil'] }],
});

const setup = (mode: 'advanced' | 'simple' = 'advanced') => renderWorldEditorBench(WORLD, mode);

/** The location panel's own strip, named apart from the editor's top-level one. */
const panelStrip = () => screen.getByRole('tablist', { name: 'Location Fields' });

const panelTab = (name: string) => within(panelStrip()).getByRole('tab', { name });

/** Which of the panel's tabs is showing. Radix marks it on the trigger. */
const shownPanelTab = () =>
  within(panelStrip()).getAllByRole('tab').find((t) => t.getAttribute('aria-selected') === 'true')?.textContent;

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

/** Select the location from the Locations list, the way an author reaches its panel. */
const selectLocation = async (name = 'The Veilwood') => {
  // The rail or, on mobile, the Sections bar; either one may still be mounting.
  await waitFor(() => openEditorTab(/^Locations/));
  fireEvent.click(treeRow(name));
  await screen.findByRole('tablist', { name: 'Location Fields' });
};

/** Press Ctrl+F and wait for Search World to take focus. */
const openFind = async () => {
  fireEvent.keyDown(window, { key: 'f', ctrlKey: true });
  await waitFor(() => expect(document.activeElement).toBe(searchWorldField()));
};

/** Press Ctrl+H on mobile, where the floating bar opens with its replace row, and wait for its focus. */
const openReplace = async () => {
  fireEvent.keyDown(window, { key: 'h', ctrlKey: true });
  await screen.findByRole('search', { name: 'Find and replace in world' });
  await waitFor(() => expect(document.activeElement).toBe(screen.getByLabelText('Find')));
};

/** Type a query and wait for the search to land on its first hit, which it does on its own. */
const findFirst = async (query: string, field = searchWorldField()) => {
  fireEvent.change(field, { target: { value: query } });
  await waitFor(() => expect(screen.getByText(/^1 \/ \d+$/)).toBeInTheDocument());
};

/** The element the reveal ringed, whichever kind of field it turned out to be. */
const ringed = async () =>
  await waitFor(() => {
    const el = document.querySelector('.editor-find-target');
    expect(el).not.toBeNull();
    return el as HTMLElement;
  });

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

describe('World Editor — a Find hit opens the location tab holding it', () => {
  it('leaves Media for Details when the hit is in the AI-Facing Description', async () => {
    setup();
    await selectLocation();
    openPanelTab('Media');
    await waitFor(() => expect(shownPanelTab()).toBe('Media'));

    await openFind();
    await findFirst('beacons');

    await waitFor(() => expect(shownPanelTab()).toBe('Details'));
    expect((await ringed()).closest('[data-find-field]')?.getAttribute('data-find-field')).toMatch(/AI-Facing Description/);
  });

  it('leaves Details for Media when the hit is in Image Tags', async () => {
    setup();
    await selectLocation();
    expect(shownPanelTab()).toBe('Details');

    await openFind();
    await findFirst('oilskin');

    await waitFor(() => expect(shownPanelTab()).toBe('Media'));
    const field = await ringed();
    expect((field as HTMLInputElement).value ?? field.textContent).toContain('oilskin');
  });

  it('stays put for a hit it cannot place, rather than snapping back to Details', async () => {
    setup();
    await selectLocation();
    openPanelTab('Presence');
    await waitFor(() => expect(shownPanelTab()).toBe('Presence'));

    // A hit outside the location entirely: the editor moves to that tab, and the location panel keeps its
    // own choice for when the author comes back. The bar stays open, so the hint is still live — it names
    // another item's field, which is not this panel's to answer.
    await openFind();
    await findFirst('Keeps the lamps');
    await waitFor(() => expect(screen.queryByRole('tablist', { name: 'Location Fields' })).toBeNull());

    await selectLocation();
    expect(shownPanelTab()).toBe('Presence');
  });
});

describe('World Editor — Replace reaches a location field on a tab that is not showing', () => {
  // Mobile's floating bar holds the replace row.
  let restoreViewport: () => void;
  beforeEach(() => { restoreViewport = asMobile(); });
  afterEach(() => restoreViewport());

  it('changes the record for a match the panel never mounted', async () => {
    const { ctx } = setup();
    await selectLocation();
    expect(shownPanelTab()).toBe('Details');

    // 'causeway' is only in the summary, which is on Details, so the panel never leaves it. The tags line on
    // Media is replaced in the same pass without ever being rendered.
    await openReplace();
    await findFirst('lantern', screen.getByLabelText('Find'));
    await waitFor(() => expect(shownPanelTab()).toBe('Media'));
    openPanelTab('Details');
    await waitFor(() => expect(shownPanelTab()).toBe('Details'));

    fireEvent.change(screen.getByRole('textbox', { name: 'Replace with' }), { target: { value: 'beacon' } });
    fireEvent.click(screen.getByRole('button', { name: 'Replace all' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Replace All' }));

    await waitFor(() => expect(ctx().locations[0].imageTags).toBe('oilskin, beacon'));
    // The panel stayed on Details, so Media was never mounted for that edit.
    expect(shownPanelTab()).toBe('Details');
  });
});

describe('World Editor — a Bench finding lands on the persisted tab', () => {
  it('leaves the panel on whichever tab the author was last on', async () => {
    setup();
    await selectLocation();
    openPanelTab('Presence');
    await waitFor(() => expect(shownPanelTab()).toBe('Presence'));

    await clickFlask();
    // The popover names the finding's location on both its row and its dismiss control; the row is first.
    fireEvent.click((await screen.findAllByRole('button', { name: 'The Hollow' }))[0]);

    await screen.findByRole('tablist', { name: 'Location Fields' });
    expect(shownPanelTab()).toBe('Presence');
    // The finding's own location is what opened, not the one the author had selected.
    openPanelTab('Details');
    expect(screen.getByText('A dip below the roots.')).toBeInTheDocument();
  });
});
