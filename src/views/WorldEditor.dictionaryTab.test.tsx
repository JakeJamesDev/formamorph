import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, within, waitFor } from '@testing-library/react';
import { benchEditorWorld, openEditorTab, renderWorldEditorBench, pickEditorMode, searchWorldField } from '@/test/worldEditorBench';
import type { World } from '@/types';

/** How the view holds the Dictionary tab: the open entry across tabs, and the panels' tabs under a mode switch and a Find. */

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
/** Two books share an entry name, so a search row that dropped its book would read alike. */
const WORLD: World = benchEditorWorld({
  dictionaries: [
    {
      id: 'b1', name: 'Fen Lore', enabled: true,
      entries: [
        { id: 'e1', name: 'Hostile Forces', key: ['dragon'], value: 'A big lizard.' },
        { id: 'e2', name: 'Lamp Oil', key: ['reed'], value: 'Smells of the marsh.' },
      ],
    },
    {
      id: 'b2', name: 'Harbor Lore', enabled: true,
      entries: [{ id: 'e3', name: 'Lamp Oil', key: ['lamp'], value: 'Burns blue.' }],
    },
  ],
} as Partial<World>);

beforeEach(() => { localStorage.clear(); });



describe('the Dictionary tab selection', () => {
  it('reopens the entry after a trip to another tab', () => {
    renderWorldEditorBench(WORLD, 'advanced');
    openEditorTab(/Dictionary/);
    fireEvent.click(screen.getByText('Hostile Forces'));

    openEditorTab(/Stats/);
    openEditorTab(/Dictionary/);
    expect(screen.getByText('A big lizard.')).toBeInTheDocument();
  });
});
}

{
/** Two books, so the persistence case can cross a book boundary the way an author reviewing values does. */
const WORLD: World = benchEditorWorld({
  dictionaries: [
    {
      id: 'b1', name: 'Fen Lore', enabled: true,
      entries: [
        {
          id: 'e1', name: 'Hostile Forces', key: ['dragon'], value: 'A big lizard.',
          secondaryKeys: ['scaled'], scanDepth: 3,
        },
        { id: 'e2', name: 'Quiet Folk', key: ['reed'], value: 'They keep to the water.' },
      ],
    },
    {
      id: 'b2', name: 'Harbor Lore', enabled: true,
      entries: [{ id: 'e3', name: 'Lamp Oil', key: ['lamp'], value: 'Burns blue.' }],
    },
  ],
} as Partial<World>);

/** The same books over a world that has a placeholder, so the keyword fields are chip-capable and the
 *  Regex switch has a vocabulary to take away. */
const CHIP_WORLD: World = benchEditorWorld({
  ...(WORLD as Partial<World>),
  placeholders: [{ id: 'p1', name: 'Hair Color', values: [{ id: 'v1', text: 'copper' }] }],
} as Partial<World>);

// These tabs switch on mouseDown, not click.
const openTab = (name: RegExp) => fireEvent.mouseDown(screen.getByRole('tab', { name }));

const FIELD_LABELS =
  /^(Name|Trigger Keywords|Value|Scan Depth|Secondary Keywords)$/;

/** Every field label the panel shows, in document order. The panel's own strip sits above them, so the
 *  match skips anything inside a tablist. */
const panelLabels = () =>
  screen.getAllByText(FIELD_LABELS)
    .filter((el) => !el.closest('[role="tablist"]'))
    .map((el) => el.textContent);

/** The entry panel's own strip. The editor's top-level strip is on the same screen, so every read and click
 *  here is taken from the named strip rather than by tab name. */
const panelStrip = () => screen.queryByRole('tablist', { name: 'Entry Fields' });

const panelTabNames = () => {
  const strip = panelStrip();
  return strip ? within(strip).getAllByRole('tab').map((el) => el.textContent) : [];
};

const panelTab = (name: string) =>
  within(screen.getByRole('tablist', { name: 'Entry Fields' })).getByRole('tab', { name });

const openPanelTab = (name: string) => fireEvent.mouseDown(panelTab(name));

const selectEntry = (name: string) => {
  openTab(/Dictionary/);
  fireEvent.click(screen.getByText(name));
};

beforeEach(() => { localStorage.clear(); });

describe('the World Editor dictionary entry panel tabs', () => {
  it('lands on Details when Simple mode takes Matching away, and restores the strip', () => {
    renderWorldEditorBench(WORLD, 'advanced');
    selectEntry('Hostile Forces');
    openPanelTab('Matching');

    pickEditorMode('Simple');
    expect(panelStrip()).toBeNull();
    expect(panelLabels()).toEqual(['Name', 'Trigger Keywords', 'Value']);

    // The switch wears the hidden-data marker, whose own label joins its accessible name.
    pickEditorMode('Advanced');
    expect(panelTabNames()).toEqual(['Details', 'Matching']);
    expect(panelTab('Details')).toHaveAttribute('aria-selected', 'true');
  });

  it('puts the placeholder palette bar above the strip, so chips insert on either tab', () => {
    renderWorldEditorBench(CHIP_WORLD, 'advanced');
    selectEntry('Hostile Forces');
    const palette = screen.getByRole('button', { name: 'Placeholders' });
    // Ahead of the strip in document order, which is what "above" means to the author.
    expect(palette.compareDocumentPosition(panelStrip()!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

});
}

{
/** Two books, so the persistence case can move from one book to another. The first book's description holds
 *  a word found nowhere else, so a Find query lands on that field. */
const WORLD: World = benchEditorWorld({
  dictionaries: [
    {
      id: 'b1', name: 'Fen Lore', enabled: true, description: 'Marsh sayings.',
      entries: [{ id: 'e1', name: 'Hostile Forces', key: ['dragon'], value: 'A big lizard.' }],
    },
    { id: 'b2', name: 'Harbor Lore', enabled: true, entries: [] },
  ],
} as Partial<World>);

// On mobile the editor's tabs sit behind the Sections bar, which the shared helper opens.
const openTab = openEditorTab;

/** The book panel's own strip, read by its name: the editor's top-level strip is on the same screen. */
const panelStrip = () => screen.queryByRole('tablist', { name: 'Dictionary Fields' });

const panelTab = (name: string) =>
  within(screen.getByRole('tablist', { name: 'Dictionary Fields' })).getByRole('tab', { name });

const openPanelTab = (name: string) => fireEvent.mouseDown(panelTab(name));

const selectBook = (name: string) => {
  openTab(/Dictionary/);
  fireEvent.click(screen.getByText(name));
};

/** What Details shows: the Name field, the Description box, the Enabled switch, and the count hint. */
const detailsShown = () => ({
  name: screen.queryByRole('textbox', { name: 'Name' }) !== null,
  description: screen.queryByRole('textbox', { name: 'Description' }) !== null,
  enabled: screen.queryByText('Enabled') !== null,
  count: screen.queryByText(/^\d+ (entry|entries)\./) !== null,
});

const ALL_DETAILS = { name: true, description: true, enabled: true, count: true };

beforeEach(() => { localStorage.clear(); });

describe('the World Editor dictionary book panel tabs', () => {
  it('opens Details for a Find hit in the book description', async () => {
    renderWorldEditorBench(WORLD, 'advanced');
    selectBook('Fen Lore');
    openPanelTab('Placeholders');

    fireEvent.change(searchWorldField(), { target: { value: 'Marsh sayings' } });

    await waitFor(() => expect(panelTab('Details')).toHaveAttribute('aria-selected', 'true'));
    await waitFor(() => expect(document.querySelector('.editor-find-target')).not.toBeNull());
  });

  it('lands on Details when Simple mode takes Placeholders away', () => {
    renderWorldEditorBench(WORLD, 'advanced');
    selectBook('Fen Lore');
    openPanelTab('Placeholders');

    pickEditorMode('Simple');
    expect(panelStrip()).toBeNull();
    expect(detailsShown()).toEqual({ ...ALL_DETAILS, enabled: false });

    // The switch wears the hidden-data marker, whose own label joins its accessible name.
    pickEditorMode('Advanced');
    expect(panelTab('Details')).toHaveAttribute('aria-selected', 'true');
  });
});

}
