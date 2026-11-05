import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, within } from '@testing-library/react';
import type { World } from '@/types';
import { renderDictionaryTab } from '@/test/dictionaryTabBench';
import { asMobile, panelWorld, panelTabLayout } from '@/test/panelBench';

/** What the dictionary book panel puts on screen, in its own tabs. Placeholders is Advanced only, so Simple mode keeps one tab and no strip. */

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

/** Two books, so the persistence case can move from one book to another. The first book's description holds
 *  a word found nowhere else, so a Find query lands on that field. */
const WORLD: World = panelWorld({
  dictionaries: [
    {
      id: 'b1', name: 'Fen Lore', enabled: true, description: 'Marsh sayings.',
      entries: [{ id: 'e1', name: 'Hostile Forces', key: ['dragon'], value: 'A big lizard.' }],
    },
    { id: 'b2', name: 'Harbor Lore', enabled: true, entries: [] },
  ],
} as Partial<World>);

/** The book panel's own strip, read by its name: the editor's top-level strip is on the same screen. */
const panelStrip = () => screen.queryByRole('tablist', { name: 'Dictionary Fields' });

const panelTabNames = () => {
  const strip = panelStrip();
  return strip ? within(strip).getAllByRole('tab').map((el) => el.textContent) : [];
};

const panelTab = (name: string) =>
  within(screen.getByRole('tablist', { name: 'Dictionary Fields' })).getByRole('tab', { name });

const openPanelTab = (name: string) => fireEvent.mouseDown(panelTab(name));

const selectBook = (name: string) => {
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
const NO_DETAILS = { name: false, description: false, enabled: false, count: false };

const placeholderEditorShown = () => screen.queryByText(/These placeholders belong to this dictionary/) !== null;

beforeEach(() => { localStorage.clear(); });

describe('the World Editor dictionary book panel tabs', () => {
  it('offers Details and Placeholders in Advanced mode and opens on Details', () => {
    renderDictionaryTab(WORLD, 'advanced');
    selectBook('Fen Lore');
    expect(panelTabNames()).toEqual(['Details', 'Placeholders']);
    expect(panelTab('Details')).toHaveAttribute('aria-selected', 'true');
    expect(detailsShown()).toEqual(ALL_DETAILS);
    expect(placeholderEditorShown()).toBe(false);
  });

  it('puts the scoped placeholder editor on Placeholders, and nothing from Details', () => {
    renderDictionaryTab(WORLD, 'advanced');
    selectBook('Fen Lore');
    openPanelTab('Placeholders');
    expect(placeholderEditorShown()).toBe(true);
    expect(detailsShown()).toEqual(NO_DETAILS);
  });

  it('leaves Simple mode one tab, so no strip and no placeholder editor', () => {
    renderDictionaryTab(WORLD, 'simple');
    selectBook('Fen Lore');
    expect(panelStrip()).toBeNull();
    // Enabled is Advanced only, as it was before the split.
    expect(detailsShown()).toEqual({ ...ALL_DETAILS, enabled: false });
    expect(placeholderEditorShown()).toBe(false);
  });

  it('keeps the chosen tab when the author selects another book', () => {
    renderDictionaryTab(WORLD, 'advanced');
    selectBook('Fen Lore');
    openPanelTab('Placeholders');
    fireEvent.click(screen.getByText('Harbor Lore'));
    expect(panelTab('Placeholders')).toHaveAttribute('aria-selected', 'true');
    expect(placeholderEditorShown()).toBe(true);
  });

});

const layout = () => panelTabLayout('Dictionary Fields');

describe('the World Editor dictionary book panel height', () => {
  it.each([
    ['desktop', () => () => {}],
    ['mobile', asMobile],
  ])('keeps the strip fixed, fills the pane for Placeholders, and scrolls Details on %s', (_, setUp) => {
    const undo = setUp();
    try {
      renderDictionaryTab(WORLD, 'advanced');
      selectBook('Fen Lore');
      expect(layout()).toEqual({ strip: 'fixed', body: 'scroll' });
      openPanelTab('Placeholders');
      expect(layout()).toEqual({ strip: 'fixed', body: 'fill' });
      openPanelTab('Details');
      expect(layout()).toEqual({ strip: 'fixed', body: 'scroll' });
    } finally {
      undo();
    }
  });
});
