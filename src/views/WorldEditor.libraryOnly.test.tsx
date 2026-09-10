import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor, within } from '@testing-library/react';
import { benchEditorWorld, renderWorldEditorBench } from '@/test/worldEditorBench';
import type { Dictionary, Entity, World } from '@/types';

/**
 * What the World Editor's local library offers while `LINKING_ENABLED` is off: content saves out, copies
 * come back, and no copy follows anything.
 *
 * This file uses the real flag. It is the guard that the parked half stays parked, so it asserts both what
 * the editor draws and what it writes onto the world. `WorldEditor.libraryLinks.test.tsx` turns linking on
 * and proves the parked half still works.
 */

const library = vi.hoisted(() => ({
  dictionaries: new Map<string, { id: string; name: string; data: Dictionary; createdAt?: string; editedAt?: string }>(),
  entities: new Map<string, { id: string; name: string; data: Entity; createdAt?: string; editedAt?: string }>(),
}));

const meta = (record: { id: string; name: string; createdAt?: string; editedAt?: string; data: Dictionary | Entity }) => ({
  id: record.id,
  name: record.name,
  createdAt: record.createdAt,
  editedAt: record.editedAt,
  entryCount: 'entries' in record.data ? record.data.entries.length : 0,
});

vi.mock('@/services/DictionaryStorageService', () => ({
  default: {
    getDictionaryMetadata: () => Promise.resolve([...library.dictionaries.values()].map(meta)),
    getDictionaryData: (id: string) => {
      const found = library.dictionaries.get(id);
      return found ? Promise.resolve(found.data) : Promise.reject(new Error('Dictionary not found'));
    },
    storeDictionary: (record: { id: string; name: string; data: Dictionary; createdAt?: string }) => {
      library.dictionaries.set(record.id, { ...library.dictionaries.get(record.id), ...record });
      return Promise.resolve();
    },
  },
}));

vi.mock('@/services/EntityStorageService', () => ({
  default: {
    getEntityMetadata: () => Promise.resolve([...library.entities.values()].map(meta)),
    getEntityData: (id: string) => {
      const found = library.entities.get(id);
      return found ? Promise.resolve(found.data) : Promise.reject(new Error('Entity not found'));
    },
    storeEntity: (record: { id: string; name: string; data: Entity; createdAt?: string }) => {
      library.entities.set(record.id, { ...library.entities.get(record.id), ...record });
      return Promise.resolve();
    },
  },
}));

vi.mock('@/services/AuthService', () => ({
  default: { getCurrentUser: () => ({ id: 'me', username: 'Fen' }) },
}));

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

const PLAIN_WORLD = (): World => benchEditorWorld({
  entities: [{ id: 'e1', name: 'Wren', playerDescription: 'A ferryman.', locations: ['harbor'] }],
  dictionaries: [{ id: 'b1', name: 'Marsh Lore', entries: [{ id: 'x1', name: 'Sedge', key: ['sedge'], value: 'Reeds.' }] }],
});

// These tabs switch on mouseDown, not click.
const openTab = (name: RegExp) => fireEvent.mouseDown(screen.getByRole('tab', { name }));
const selectRow = (name: string) => fireEvent.click(screen.getByText(name));
const clickButton = (name: string | RegExp) => fireEvent.click(screen.getByRole('button', { name }));
const openActionsMenu = () => fireEvent.click(screen.getByRole('button', { name: 'More library actions' }));
const confirmPicker = (name: string) =>
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name }));

beforeEach(() => {
  localStorage.clear();
  library.dictionaries.clear();
  library.entities.clear();
});

describe('Save to Library without linking', () => {
  it('stores the item and leaves the world copy independent', async () => {
    const { ctx } = renderWorldEditorBench(PLAIN_WORLD(), 'advanced');
    openTab(/Dictionary/);
    selectRow('Marsh Lore');
    clickButton('Save to Library');

    await waitFor(() => expect(library.dictionaries.size).toBe(1));
    expect([...library.dictionaries.values()][0].name).toBe('Marsh Lore');
    expect(ctx().dictionaries[0].link).toBeUndefined();
  });

  it('keeps the face on Save to Library after the save, with Export as the only other action', async () => {
    renderWorldEditorBench(PLAIN_WORLD(), 'advanced');
    openTab(/Dictionary/);
    selectRow('Marsh Lore');
    clickButton('Save to Library');

    await waitFor(() => expect(library.dictionaries.size).toBe(1));
    expect(screen.getByRole('button', { name: 'Save to Library' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Open in Library' })).toBeNull();
    expect(screen.queryByText('Link pending save')).toBeNull();

    openActionsMenu();
    expect(await screen.findByRole('button', { name: /Export Dictionary/ })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Link to Library Item/ })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Unlink' })).toBeNull();
  });
});

describe('Add from Library without linking', () => {
  const seedBook = () => library.dictionaries.set('lib-a', {
    id: 'lib-a', name: 'Fen Lore', createdAt: '2026-01-01T00:00:00.000Z',
    data: { id: 'lib-a', name: 'Fen Lore', entries: [{ id: 'k1', name: 'Fen', key: ['fen'], value: 'Wetland.' }] },
  });

  it('offers no link choice and inserts an independent copy', async () => {
    seedBook();
    const { ctx } = renderWorldEditorBench(PLAIN_WORLD(), 'advanced');
    openTab(/Dictionary/);
    clickButton(/Add Dictionary/);
    fireEvent.click(await screen.findByText('Fen Lore'));
    expect(screen.queryByText('Link to Library')).toBeNull();
    confirmPicker('Add Dictionary');

    await waitFor(() => expect(ctx().dictionaries).toHaveLength(2));
    expect(ctx().dictionaries.find((b) => b.name === 'Fen Lore')!.link).toBeUndefined();
  });

  it("still names each row's author and source", async () => {
    seedBook();
    renderWorldEditorBench(PLAIN_WORLD(), 'advanced');
    openTab(/Dictionary/);
    clickButton(/Add Dictionary/);

    expect(await screen.findByText('You · Your library')).toBeTruthy();
  });
});

describe('A world that already holds link records', () => {
  const LINKED_WORLD = (): World => benchEditorWorld({
    entities: [{ id: 'e1', name: 'Wren', locations: ['harbor'], link: { libraryId: 'lib-a', sourceName: 'Wren the Guide' } }],
    dictionaries: [{
      id: 'b1', name: 'Fen Lore', entries: [{ id: 'own-1', name: 'Fen', key: ['fen'], value: 'Wetland.' }],
      link: { libraryId: 'lib-a', sourceName: 'Fen Lore', sourceRevision: '2026-01-01T00:00:00.000Z' },
    }],
  });

  it('shows no marker, no badge, and no source line', async () => {
    renderWorldEditorBench(LINKED_WORLD(), 'advanced');
    openTab(/Dictionary/);
    selectRow('Fen Lore');

    await screen.findByDisplayValue('Fen Lore');
    expect(screen.queryByText('Linked')).toBeNull();
    expect(screen.queryByText('Local replacement')).toBeNull();
    expect(screen.queryByText(/Source:/)).toBeNull();
    expect(screen.queryByLabelText('Linked')).toBeNull();
  });

  it('does not pull a newer owned library save into the copy', async () => {
    library.dictionaries.set('lib-a', {
      id: 'lib-a', name: 'Fen Lore', createdAt: '2026-01-01T00:00:00.000Z', editedAt: '2026-03-03T00:00:00.000Z',
      data: { id: 'lib-a', name: 'Fen Lore', entries: [{ id: 'k1', name: 'Fen', key: ['fen'], value: 'Wetland, and reed beds.' }] },
    });
    const { ctx } = renderWorldEditorBench(LINKED_WORLD(), 'advanced');
    openTab(/Dictionary/);
    await screen.findByText('Fen Lore');

    expect(ctx().dictionaries[0].entries[0].value).toBe('Wetland.');
    expect(ctx().dictionaries[0].link?.sourceRevision).toBe('2026-01-01T00:00:00.000Z');
  });

  it('does not mark a copy a local replacement when the author edits it', async () => {
    const { ctx } = renderWorldEditorBench(LINKED_WORLD(), 'advanced');
    openTab(/Dictionary/);
    selectRow('Fen Lore');
    fireEvent.change(await screen.findByDisplayValue('Fen Lore'), { target: { value: 'Fen Lore, revised' } });

    await waitFor(() => expect(ctx().dictionaries[0].name).toBe('Fen Lore, revised'));
    expect(ctx().dictionaries[0].link?.localReplacement).toBeUndefined();
  });
});
