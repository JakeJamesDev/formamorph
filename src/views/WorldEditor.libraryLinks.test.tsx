import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor, within } from '@testing-library/react';
import { benchEditorWorld, renderWorldEditorBench } from '@/test/worldEditorBench';
import type { Dictionary, Entity, World } from '@/types';

/**
 * Moving content between a world and the local library through the real World Editor: saving a copy out,
 * adding copies back in with or without a link, reconnecting an independent copy, unlinking, and taking an
 * owned library save into the world's linked copies when the world opens.
 *
 * The libraries are in-memory stand-ins for the two IndexedDB services, so a test can read what the editor
 * actually wrote rather than only what it drew.
 *
 * Linking does not ship yet, so this file turns it on and proves the parked half still works. What the
 * editor offers with it off is `WorldEditor.libraryOnly.test.tsx`.
 */

vi.mock('@/lib/linkingFlag', () => ({ LINKING_ENABLED: true }));

const library = vi.hoisted(() => ({
  dictionaries: new Map<string, { id: string; name: string; data: Dictionary; createdAt?: string; editedAt?: string; sourceId?: string; sourceAuthorId?: string; sourceAuthorName?: string }>(),
  entities: new Map<string, { id: string; name: string; data: Entity; createdAt?: string; editedAt?: string; sourceId?: string; sourceAuthorId?: string; sourceAuthorName?: string }>(),
}));

const meta = (record: { id: string; name: string; createdAt?: string; editedAt?: string; sourceId?: string; sourceAuthorId?: string; sourceAuthorName?: string; data: Dictionary | Entity }) => ({
  id: record.id,
  name: record.name,
  createdAt: record.createdAt,
  editedAt: record.editedAt,
  sourceId: record.sourceId,
  sourceAuthorId: record.sourceAuthorId,
  sourceAuthorName: record.sourceAuthorName,
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
      const existing = library.dictionaries.get(record.id);
      library.dictionaries.set(record.id, { ...existing, ...record });
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
      const existing = library.entities.get(record.id);
      library.entities.set(record.id, { ...existing, ...record });
      return Promise.resolve();
    },
  },
}));

const signedInAs = vi.hoisted(() => ({ id: 'me' as string | null }));

vi.mock('@/services/AuthService', () => ({
  default: { getCurrentUser: () => (signedInAs.id ? { id: signedInAs.id, username: 'Fen' } : null) },
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
/** The picker's own confirm. It shares its label with the footer button that opened it, so this scopes to
 *  the dialog rather than matching both. */
const confirmPicker = (name: string) =>
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name }));

beforeEach(() => {
  localStorage.clear();
  library.dictionaries.clear();
  library.entities.clear();
  signedInAs.id = 'me';
});

describe('Save to Library', () => {
  it('creates a library item, shows the link as pending, and settles on Linked after the world saves', async () => {
    renderWorldEditorBench(PLAIN_WORLD(), 'advanced');
    openTab(/Dictionary/);
    selectRow('Marsh Lore');
    clickButton('Save to Library');

    await waitFor(() => expect(library.dictionaries.size).toBe(1));
    const stored = [...library.dictionaries.values()][0];
    expect(stored.name).toBe('Marsh Lore');
    // The library item is its own record: the world keeps the copy it already had.
    expect(stored.id).not.toBe('b1');

    expect(await screen.findByText('Link pending save')).toBeTruthy();
    expect(screen.getByText(/Source:\s*Marsh Lore/)).toBeTruthy();

    clickButton('Save');
    await waitFor(() => expect(screen.getByText('Linked')).toBeTruthy());
    expect(screen.queryByText('Link pending save')).toBeNull();
    expect(screen.getByText(/Source:\s*Marsh Lore/)).toBeTruthy();
  });

  it('offers the linked copy the library item instead of a second save', async () => {
    renderWorldEditorBench(PLAIN_WORLD(), 'advanced');
    openTab(/Dictionary/);
    selectRow('Marsh Lore');
    clickButton('Save to Library');

    expect(await screen.findByRole('button', { name: 'Open in Library' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Save to Library' })).toBeNull();
    expect(library.dictionaries.size).toBe(1);
  });
});

describe('Add from Library', () => {
  const seedBooks = () => {
    library.dictionaries.set('lib-a', {
      id: 'lib-a', name: 'Fen Lore', createdAt: '2026-01-01T00:00:00.000Z',
      data: { id: 'lib-a', name: 'Fen Lore', entries: [{ id: 'k1', name: 'Fen', key: ['fen'], value: 'Wetland.' }] },
    });
  };

  it('inserts a Linked copy while the link choice is on', async () => {
    seedBooks();
    const { ctx } = renderWorldEditorBench(PLAIN_WORLD(), 'advanced');
    openTab(/Dictionary/);
    clickButton(/Add Dictionary/);
    fireEvent.click(await screen.findByText('Fen Lore'));
    confirmPicker('Add Dictionary');

    await waitFor(() => expect(ctx().dictionaries).toHaveLength(2));
    const added = ctx().dictionaries.find((b) => b.name === 'Fen Lore')!;
    expect(added.link).toMatchObject({ libraryId: 'lib-a', sourceName: 'Fen Lore' });
    expect(added.link?.localReplacement).toBeUndefined();
    // Picking an existing item never mints a second library record.
    expect(library.dictionaries.size).toBe(1);
  });

  it('inserts an independent copy once the link choice is turned off', async () => {
    seedBooks();
    const { ctx } = renderWorldEditorBench(PLAIN_WORLD(), 'advanced');
    openTab(/Dictionary/);
    clickButton(/Add Dictionary/);
    fireEvent.click(await screen.findByText('Fen Lore'));
    fireEvent.click(screen.getByText('Link to Library'));
    confirmPicker('Add Dictionary');

    await waitFor(() => expect(ctx().dictionaries).toHaveLength(2));
    expect(ctx().dictionaries.find((b) => b.name === 'Fen Lore')!.link).toBeUndefined();
  });

  it('tells two library items of the same name apart by their author and source lines', async () => {
    seedBooks();
    library.dictionaries.set('lib-b', {
      id: 'lib-b', name: 'Fen Lore', createdAt: '2026-02-02T00:00:00.000Z',
      sourceId: 'listing-9', sourceAuthorId: 'someone-else', sourceAuthorName: 'Reed',
      data: { id: 'lib-b', name: 'Fen Lore', entries: [] },
    });
    renderWorldEditorBench(PLAIN_WORLD(), 'advanced');
    openTab(/Dictionary/);
    clickButton(/Add Dictionary/);

    await waitFor(() => expect(screen.getAllByText('Fen Lore')).toHaveLength(2));
    expect(screen.getByText('You · Your library')).toBeTruthy();
    expect(screen.getByText('Reed · Community Creations')).toBeTruthy();
  });
});

describe('Link to Library Item', () => {
  const seedMatching = (value: string) => {
    library.dictionaries.set('lib-a', {
      id: 'lib-a', name: 'Marsh Lore', createdAt: '2026-01-01T00:00:00.000Z',
      data: { id: 'lib-a', name: 'Marsh Lore', entries: [{ id: 'k1', name: 'Sedge', key: ['sedge'], value }] },
    });
  };

  it('links a copy whose content still matches', async () => {
    seedMatching('Reeds.');
    const { ctx } = renderWorldEditorBench(PLAIN_WORLD(), 'advanced');
    openTab(/Dictionary/);
    selectRow('Marsh Lore');
    openActionsMenu();
    clickButton('Link to Library Item…');
    fireEvent.click(await screen.findByText('You · Your library'));
    clickButton('Link');

    await waitFor(() => expect(ctx().dictionaries[0].link?.libraryId).toBe('lib-a'));
    expect(ctx().dictionaries[0].link?.localReplacement).toBeUndefined();
    expect(await screen.findByText('Link pending save')).toBeTruthy();
  });

  it('links a copy whose content differs as a local replacement and leaves the world content alone', async () => {
    seedMatching('Rushes, not reeds.');
    const { ctx } = renderWorldEditorBench(PLAIN_WORLD(), 'advanced');
    openTab(/Dictionary/);
    selectRow('Marsh Lore');
    openActionsMenu();
    clickButton('Link to Library Item…');
    fireEvent.click(await screen.findByText('You · Your library'));
    clickButton('Link');

    await waitFor(() => expect(ctx().dictionaries[0].link?.localReplacement).toBe(true));
    // Nothing is overwritten: the world still holds its own text.
    expect(ctx().dictionaries[0].entries[0].value).toBe('Reeds.');
  });
});

describe('Editing and unlinking a followed copy', () => {
  /** A world holding a copy that follows a book another account published. */
  const OTHER_AUTHORS_COPY = (): World => benchEditorWorld({
    entities: [],
    dictionaries: [{
      id: 'b1', name: 'Marsh Lore', entries: [{ id: 'x1', name: 'Sedge', key: ['sedge'], value: 'Reeds.' }],
      link: { libraryId: 'lib-a', sourceId: 'listing-3', sourceName: 'Fen Lorebook', sourceRevision: 'r1' },
    }],
  });

  const seedOtherAuthorsBook = () => library.dictionaries.set('lib-a', {
    id: 'lib-a', name: 'Fen Lorebook', createdAt: '2026-01-01T00:00:00.000Z',
    sourceId: 'listing-3', sourceAuthorId: 'reed', sourceAuthorName: 'Reed',
    data: { id: 'lib-a', name: 'Fen Lorebook', entries: [] },
  });

  it('turns an edited copy into a local replacement', async () => {
    seedOtherAuthorsBook();
    const { ctx } = renderWorldEditorBench(OTHER_AUTHORS_COPY(), 'advanced');
    openTab(/Dictionary/);
    selectRow('Marsh Lore');
    expect(screen.getByText('Linked')).toBeTruthy();

    fireEvent.change(screen.getByDisplayValue('Marsh Lore'), { target: { value: 'Marsh Lore, revised' } });

    await waitFor(() => expect(ctx().dictionaries[0].link?.localReplacement).toBe(true));
    expect(await screen.findByText('Local replacement')).toBeTruthy();
  });

  it('keeps the content and clears the record on Unlink', async () => {
    seedOtherAuthorsBook();
    const { ctx } = renderWorldEditorBench(OTHER_AUTHORS_COPY(), 'advanced');
    openTab(/Dictionary/);
    selectRow('Marsh Lore');
    openActionsMenu();
    clickButton('Unlink');

    await waitFor(() => expect(ctx().dictionaries[0].link).toBeUndefined());
    expect(ctx().dictionaries[0].entries[0].value).toBe('Reeds.');
    expect(screen.queryByText('Linked')).toBeNull();
    expect(screen.queryByText('Local replacement')).toBeNull();
    expect(screen.getByRole('button', { name: 'Save to Library' })).toBeTruthy();
  });
});

describe('Opening a world after a library save', () => {
  const seedOwnedBook = (value: string, editedAt: string) => {
    library.dictionaries.set('lib-a', {
      id: 'lib-a', name: 'Fen Lore', createdAt: '2026-01-01T00:00:00.000Z', editedAt,
      data: { id: 'lib-a', name: 'Fen Lore', entries: [{ id: 'k1', name: 'Fen', key: ['fen'], value }] },
    });
  };

  const worldHolding = (link: Record<string, unknown>): World => benchEditorWorld({
    entities: [],
    dictionaries: [{
      id: 'b1', name: 'Fen Lore', entries: [{ id: 'own-1', name: 'Fen', key: ['fen'], value: 'Wetland.' }], link,
    }],
  });

  it('takes an owned library save into the world’s linked copy', async () => {
    seedOwnedBook('Wetland, and reed beds.', '2026-03-03T00:00:00.000Z');
    const { ctx } = renderWorldEditorBench(
      worldHolding({ libraryId: 'lib-a', sourceName: 'Fen Lore', sourceRevision: '2026-01-01T00:00:00.000Z' }),
      'advanced',
    );

    await waitFor(() => expect(ctx().dictionaries[0].entries[0].value).toBe('Wetland, and reed beds.'));
    // The world's own entry id survives, so a selected entry is still the selected entry.
    expect(ctx().dictionaries[0].entries[0].id).toBe('own-1');
    expect(ctx().dictionaries[0].link?.sourceRevision).toBe('2026-03-03T00:00:00.000Z');
  });

  it('leaves a local replacement untouched', async () => {
    seedOwnedBook('Wetland, and reed beds.', '2026-03-03T00:00:00.000Z');
    const { ctx } = renderWorldEditorBench(
      worldHolding({
        libraryId: 'lib-a', sourceName: 'Fen Lore', sourceRevision: '2026-01-01T00:00:00.000Z', localReplacement: true,
      }),
      'advanced',
    );

    openTab(/Dictionary/);
    await screen.findByText('Fen Lore');
    expect(ctx().dictionaries[0].entries[0].value).toBe('Wetland.');
    expect(ctx().dictionaries[0].link?.sourceRevision).toBe('2026-01-01T00:00:00.000Z');
  });

  it('leaves a copy that follows another author alone', async () => {
    library.dictionaries.set('lib-a', {
      id: 'lib-a', name: 'Fen Lore', createdAt: '2026-01-01T00:00:00.000Z', editedAt: '2026-03-03T00:00:00.000Z',
      sourceId: 'listing-4', sourceAuthorId: 'reed', sourceAuthorName: 'Reed',
      data: { id: 'lib-a', name: 'Fen Lore', entries: [{ id: 'k1', name: 'Fen', key: ['fen'], value: 'Reed beds.' }] },
    });
    const { ctx } = renderWorldEditorBench(
      worldHolding({ libraryId: 'lib-a', sourceName: 'Fen Lore', sourceRevision: '2026-01-01T00:00:00.000Z' }),
      'advanced',
    );

    openTab(/Dictionary/);
    await screen.findByText('Fen Lore');
    expect(ctx().dictionaries[0].entries[0].value).toBe('Wetland.');
  });
});

describe('Entities follow a source the same way', () => {
  const LINKED_ENTITY = (link?: Record<string, unknown>): World => benchEditorWorld({
    entities: [{ id: 'e1', name: 'Wren', playerDescription: 'A ferryman.', locations: ['harbor'], ...(link ? { link } : {}) }],
    dictionaries: [{ id: 'b1', name: 'Marsh Lore', entries: [] }],
  });

  it('saves an entity to the library and links the world copy to it', async () => {
    const { ctx } = renderWorldEditorBench(LINKED_ENTITY(), 'advanced');
    openTab(/Entities/);
    selectRow('Wren');
    clickButton('Save to Library');

    await waitFor(() => expect(library.entities.size).toBe(1));
    const stored = [...library.entities.values()][0];
    expect(stored.name).toBe('Wren');
    expect(stored.id).not.toBe('e1');
    await waitFor(() => expect(ctx().entities[0].link?.libraryId).toBe(stored.id));
    expect(await screen.findByRole('button', { name: 'Open in Library' })).toBeTruthy();
  });

  // The entity name field is a chip editor, so the edit goes through the store's own seam — which is where
  // the guard lives. A content edit carries the entity's own link object through untouched.
  it('turns an edited linked entity into a local replacement', async () => {
    const { ctx } = renderWorldEditorBench(
      LINKED_ENTITY({ libraryId: 'lib-e', sourceName: 'Wren the Guide', sourceRevision: 'r1' }),
      'advanced',
    );
    openTab(/Entities/);
    await screen.findByText('Wren');

    const before = ctx().entities[0];
    ctx().updateEntity({ ...before, playerDescription: 'A smuggler.' });

    await waitFor(() => expect(ctx().entities[0].link?.localReplacement).toBe(true));
    expect(ctx().entities[0].playerDescription).toBe('A smuggler.');
  });

  it('leaves the record alone when the caller hands over a new link', async () => {
    const { ctx } = renderWorldEditorBench(
      LINKED_ENTITY({ libraryId: 'lib-e', sourceName: 'Wren the Guide', sourceRevision: 'r1' }),
      'advanced',
    );
    openTab(/Entities/);
    await screen.findByText('Wren');

    // What taking a source update looks like: new content AND a new link in one write.
    const before = ctx().entities[0];
    ctx().updateEntity({ ...before, name: 'Wren the Elder', link: { ...before.link, sourceRevision: 'r2' } });

    await waitFor(() => expect(ctx().entities[0].link?.sourceRevision).toBe('r2'));
    expect(ctx().entities[0].link?.localReplacement).toBeUndefined();
  });

  it('leaves an independent entity independent when it is edited', async () => {
    const { ctx } = renderWorldEditorBench(LINKED_ENTITY(), 'advanced');
    openTab(/Entities/);
    await screen.findByText('Wren');

    const before = ctx().entities[0];
    ctx().updateEntity({ ...before, playerDescription: 'A smuggler.' });

    await waitFor(() => expect(ctx().entities[0].playerDescription).toBe('A smuggler.'));
    expect(ctx().entities[0].link).toBeUndefined();
  });
});
