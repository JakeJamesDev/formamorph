import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { benchEditorWorld, renderWorldEditorBench } from '@/test/worldEditorBench';
import type { World } from '@/types';

/**
 * The link state a world's copy carries, shown through the real World Editor.
 *
 * No action creates a link yet, so these worlds are authored with the records already on them — which is
 * also how an imported or hand-edited world arrives. What is under test is that the editor reads the record
 * off the entity and the book and says so, in the list and in the selected item's header.
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

const ENTITY_LINK = { libraryId: 'lib-e', sourceRevision: 'r2', sourceName: 'Wren the Guide' };
// The source name differs from the book's own name on purpose: printing `book.name` instead of the record's
// `sourceName` would otherwise pass the header assertion.
const BOOK_LINK = { libraryId: 'lib-d', sourceRevision: 'r5', sourceName: 'Fen Lorebook' };

/** One entity and one book following a source, beside one of each that follows nothing. */
const LINKED_WORLD: World = benchEditorWorld({
  entities: [
    { id: 'e1', name: 'Wren', locations: ['harbor'], link: ENTITY_LINK },
    { id: 'e2', name: 'Odd Wick', locations: ['harbor'] },
  ],
  dictionaries: [
    { id: 'b1', name: 'Marsh Lore', entries: [], link: BOOK_LINK },
    { id: 'b2', name: 'Harbor Notes', entries: [] },
  ],
});

/** The same world with nothing linked at all. */
const PLAIN_WORLD: World = benchEditorWorld({
  entities: [{ id: 'e1', name: 'Wren', locations: ['harbor'] }],
  dictionaries: [{ id: 'b1', name: 'Marsh Lore', entries: [] }],
});

// These tabs switch on mouseDown, not click.
const openTab = (name: RegExp) => fireEvent.mouseDown(screen.getByRole('tab', { name }));
const selectRow = (name: string) => fireEvent.click(screen.getByText(name));
/** The list row the marker sits on, so a marker drawn against the wrong item fails. */
const markedRow = (label: string) => screen.getByLabelText(label).parentElement;

beforeEach(() => { localStorage.clear(); });

describe('World Editor shows what a copy follows', () => {
  it('marks the linked entity in the list and leaves the independent one unmarked', () => {
    renderWorldEditorBench(LINKED_WORLD, 'advanced');
    openTab(/Entities/);
    expect(screen.getAllByLabelText('Linked')).toHaveLength(1);
    // The marker belongs to the linked row, not merely to the tab.
    expect(markedRow('Linked')?.textContent).toContain('Wren');
    expect(markedRow('Linked')?.textContent).not.toContain('Odd Wick');
  });

  it('names the source in the selected entity header', () => {
    renderWorldEditorBench(LINKED_WORLD, 'advanced');
    openTab(/Entities/);
    selectRow('Wren');
    expect(screen.getByText('Linked')).toBeTruthy();
    expect(screen.getByText(/Source:\s*Wren the Guide/)).toBeTruthy();
  });

  it('shows no state for a selected entity that follows nothing', () => {
    renderWorldEditorBench(LINKED_WORLD, 'advanced');
    openTab(/Entities/);
    selectRow('Odd Wick');
    expect(screen.queryByText(/^Source:/)).toBeNull();
    // The other row's marker is still on screen; only the header is empty.
    expect(screen.queryByText('Local replacement')).toBeNull();
  });

  it('marks the linked dictionary in the list and names its source in the header', () => {
    renderWorldEditorBench(LINKED_WORLD, 'advanced');
    openTab(/Dictionary/);
    expect(screen.getAllByLabelText('Linked')).toHaveLength(1);
    selectRow('Marsh Lore');
    expect(screen.getByText(/Source:\s*Fen Lorebook/)).toBeTruthy();
  });

  it('calls an edited copy a Local replacement rather than Linked', () => {
    renderWorldEditorBench(benchEditorWorld({
      entities: [{ id: 'e1', name: 'Wren', locations: ['harbor'], link: { ...ENTITY_LINK, localReplacement: true } }],
      dictionaries: [{ id: 'b1', name: 'Marsh Lore', entries: [] }],
    }), 'advanced');
    openTab(/Entities/);
    expect(screen.getAllByLabelText('Local replacement')).toHaveLength(1);
    selectRow('Wren');
    expect(screen.getByText('Local replacement')).toBeTruthy();
    expect(screen.queryByText('Linked')).toBeNull();
  });

  it('shows the marker in Simple mode too', () => {
    renderWorldEditorBench(LINKED_WORLD, 'simple');
    openTab(/Entities/);
    expect(screen.getAllByLabelText('Linked')).toHaveLength(1);
    openTab(/Dictionary/);
    expect(screen.getAllByLabelText('Linked')).toHaveLength(1);
  });

  it('keeps the marker on a searched entity row', () => {
    renderWorldEditorBench(LINKED_WORLD, 'advanced');
    openTab(/Entities/);
    fireEvent.change(screen.getByPlaceholderText(/search/i), { target: { value: 'Wren' } });
    expect(screen.getAllByLabelText('Linked')).toHaveLength(1);
  });

  it('shows nothing at all for a world with no link records', () => {
    renderWorldEditorBench(PLAIN_WORLD, 'advanced');
    openTab(/Entities/);
    expect(screen.queryByLabelText('Linked')).toBeNull();
    selectRow('Wren');
    expect(screen.queryByText(/^Source:/)).toBeNull();
    openTab(/Dictionary/);
    expect(screen.queryByLabelText('Linked')).toBeNull();
    selectRow('Marsh Lore');
    expect(screen.queryByText(/^Source:/)).toBeNull();
  });
});
