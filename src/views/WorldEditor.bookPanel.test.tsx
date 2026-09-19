import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor, within } from '@testing-library/react';
import { benchEditorWorld, renderWorldEditorBench } from '@/test/worldEditorBench';
import type { World } from '@/types';

/**
 * What the World Editor's dictionary book panel puts on screen, driven through the real editor.
 *
 * Details holds the book's own fields and Placeholders its scoped editor. Placeholders is Advanced only, so
 * Simple mode keeps one tab and no strip at all.
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

// These tabs switch on mouseDown, not click.
const openTab = (name: RegExp) => fireEvent.mouseDown(screen.getByRole('tab', { name }));

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
  openTab(/Dictionary/);
  fireEvent.click(screen.getByText(name));
};

/** What Details shows: the Name field, the Description box, the Enabled switch, and the count hint. */
const detailsShown = () => ({
  name: screen.queryByRole('textbox', { name: 'Name' }) !== null,
  description: screen.queryByPlaceholderText('Notes for you, not injected into the prompt') !== null,
  enabled: screen.queryByText('Enabled') !== null,
  count: screen.queryByText(/^\d+ (entry|entries)\./) !== null,
});

const ALL_DETAILS = { name: true, description: true, enabled: true, count: true };
const NO_DETAILS = { name: false, description: false, enabled: false, count: false };

const placeholderEditorShown = () => screen.queryByText(/Placeholders of this dictionary/) !== null;

beforeEach(() => { localStorage.clear(); });

describe('the World Editor dictionary book panel tabs', () => {
  it('offers Details and Placeholders in Advanced mode and opens on Details', () => {
    renderWorldEditorBench(WORLD, 'advanced');
    selectBook('Fen Lore');
    expect(panelTabNames()).toEqual(['Details', 'Placeholders']);
    expect(panelTab('Details')).toHaveAttribute('aria-selected', 'true');
    expect(detailsShown()).toEqual(ALL_DETAILS);
    expect(placeholderEditorShown()).toBe(false);
  });

  it('puts the scoped placeholder editor on Placeholders, and nothing from Details', () => {
    renderWorldEditorBench(WORLD, 'advanced');
    selectBook('Fen Lore');
    openPanelTab('Placeholders');
    expect(placeholderEditorShown()).toBe(true);
    expect(detailsShown()).toEqual(NO_DETAILS);
  });

  it('leaves Simple mode one tab, so no strip and no placeholder editor', () => {
    renderWorldEditorBench(WORLD, 'simple');
    selectBook('Fen Lore');
    expect(panelStrip()).toBeNull();
    // Enabled is Advanced only, as it was before the split.
    expect(detailsShown()).toEqual({ ...ALL_DETAILS, enabled: false });
    expect(placeholderEditorShown()).toBe(false);
  });

  it('keeps the chosen tab when the author selects another book', () => {
    renderWorldEditorBench(WORLD, 'advanced');
    selectBook('Fen Lore');
    openPanelTab('Placeholders');
    fireEvent.click(screen.getByText('Harbor Lore'));
    expect(panelTab('Placeholders')).toHaveAttribute('aria-selected', 'true');
    expect(placeholderEditorShown()).toBe(true);
  });

  it('opens Details for a Find hit in the book description', async () => {
    renderWorldEditorBench(WORLD, 'advanced');
    selectBook('Fen Lore');
    openPanelTab('Placeholders');

    fireEvent.keyDown(window, { key: 'f', ctrlKey: true });
    await screen.findByRole('search', { name: 'Find and replace in world' });
    fireEvent.change(screen.getByLabelText('Find'), { target: { value: 'Marsh sayings' } });

    await waitFor(() => expect(panelTab('Details')).toHaveAttribute('aria-selected', 'true'));
    await waitFor(() => expect(document.querySelector('.editor-find-target')).not.toBeNull());
  });

  it('lands on Details when Simple mode takes Placeholders away', () => {
    renderWorldEditorBench(WORLD, 'advanced');
    selectBook('Fen Lore');
    openPanelTab('Placeholders');

    fireEvent.click(screen.getByRole('radio', { name: 'Simple' }));
    expect(panelStrip()).toBeNull();
    expect(detailsShown()).toEqual({ ...ALL_DETAILS, enabled: false });

    // The switch wears the hidden-data marker, whose own label joins its accessible name.
    fireEvent.click(screen.getByRole('radio', { name: /^Advanced/ }));
    expect(panelTab('Details')).toHaveAttribute('aria-selected', 'true');
  });
});
