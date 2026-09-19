import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, cleanup, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { benchEditorWorld, renderWorldEditorBench } from '@/test/worldEditorBench';
import { markHelpSeen } from '@/lib/helpSeenStore';
import type { Dictionary, Entity, World } from '@/types';

/**
 * Moving content between a world and the local library through the real World Editor: saving a copy out,
 * adding copies back in with or without a link, reconnecting an independent copy, unlinking, and taking an
 * owned library save into the world's linked copies when the world opens.
 *
 * The libraries are in-memory stand-ins for the two IndexedDB services, so a test can read what the editor
 * actually wrote rather than only what it drew.
 *
 * The reference-connection step a copy goes through on the way in is `WorldEditor.connectReferences.test.tsx`.
 */


const library = vi.hoisted(() => ({
  /** Makes both metadata reads reject, standing in for a library that cannot be read. */
  unreadable: false,
  /** Makes both stores reject, standing in for a write the library refused. */
  storeFails: false,
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
    getDictionaryMetadata: () => (library.unreadable
      ? Promise.reject(new Error('Dictionary library unavailable'))
      : Promise.resolve([...library.dictionaries.values()].map(meta))),
    getDictionaryData: (id: string) => {
      const found = library.dictionaries.get(id);
      return found ? Promise.resolve(found.data) : Promise.reject(new Error('Dictionary not found'));
    },
    storeDictionary: (record: { id: string; name: string; data: Dictionary; createdAt?: string }) => {
      if (library.storeFails) return Promise.reject(new Error('Dictionary library is read-only'));
      const existing = library.dictionaries.get(record.id);
      library.dictionaries.set(record.id, { ...existing, ...record });
      return Promise.resolve();
    },
  },
}));

vi.mock('@/services/EntityStorageService', () => ({
  default: {
    getEntityMetadata: () => (library.unreadable
      ? Promise.reject(new Error('Entity library unavailable'))
      : Promise.resolve([...library.entities.values()].map(meta))),
    getEntityData: (id: string) => {
      const found = library.entities.get(id);
      return found ? Promise.resolve(found.data) : Promise.reject(new Error('Entity not found'));
    },
    storeEntity: (record: { id: string; name: string; data: Entity; createdAt?: string }) => {
      if (library.storeFails) return Promise.reject(new Error('Entity library is read-only'));
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

const toast = vi.hoisted(() => ({ info: vi.fn(), success: vi.fn(), error: vi.fn() }));

vi.mock('react-toastify', () => ({ toast, ToastContainer: () => null }));

const PLAIN_WORLD = (): World => benchEditorWorld({
  entities: [{ id: 'e1', name: 'Wren', playerDescription: 'A ferryman.', locations: ['harbor'] }],
  dictionaries: [{ id: 'b1', name: 'Marsh Lore', entries: [{ id: 'x1', name: 'Sedge', key: ['sedge'], value: 'Reeds.' }] }],
});

// These tabs switch on mouseDown, not click.
const openTab = (name: RegExp) => fireEvent.mouseDown(screen.getByRole('tab', { name }));
const selectRow = (name: string) => fireEvent.click(screen.getByText(name));
const clickButton = (name: string | RegExp) => fireEvent.click(screen.getByRole('button', { name }));
const openActionsMenu = () => fireEvent.click(screen.getByRole('button', { name: 'More library actions' }));
/** The linked copy's state and source live in the footer button's tip, which focus opens. */
const focusLinkFace = () => act(() => screen.getByRole('button', { name: 'Open in Library' }).focus());
/** The picker's own confirm. It shares its label with the footer button that opened it, so this scopes to
 *  the dialog rather than matching both. */
const confirmPicker = (name: string) =>
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name }));
/** Let the editor's library lookup answer. The in-memory services resolve at once, so two turns of the
 *  event loop cover the metadata read and the content read that follows it. */
const awaitLibraryLookup = async () => {
  for (let i = 0; i < 2; i += 1) await act(() => new Promise<void>((r) => { setTimeout(r, 0); }));
};

beforeEach(() => {
  localStorage.clear();
  // The first link of a fresh profile opens the Linked Content help over the editor; these tests read the
  // editor underneath it, so they start as a profile that has read it. The nudge has its own describe.
  markHelpSeen('library.linkedContent');
  library.dictionaries.clear();
  library.entities.clear();
  library.unreadable = false;
  library.storeFails = false;
  signedInAs.id = 'me';
  toast.info.mockClear();
  toast.error.mockClear();
});

describe('Linked Content help', () => {
  it('opens once on the first link a profile makes, and marks the topic read', async () => {
    localStorage.clear();
    renderWorldEditorBench(PLAIN_WORLD(), 'advanced');
    openTab(/Dictionary/);
    selectRow('Marsh Lore');
    expect(screen.queryByRole('dialog', { name: 'Linked Content' })).toBeNull();
    clickButton('Save to Library');

    const help = await screen.findByRole('dialog', { name: 'Linked Content' });
    expect(within(help).getByRole('tab', { name: 'Linked Copies' })).toBeTruthy();
    expect(JSON.parse(localStorage.getItem('FORMAMORPH_helpSeen') ?? '[]')).toContain('library.linkedContent');
  });

  it('stays closed on a link when the topic has been read', async () => {
    renderWorldEditorBench(PLAIN_WORLD(), 'advanced');
    openTab(/Dictionary/);
    selectRow('Marsh Lore');
    clickButton('Save to Library');
    await screen.findByRole('button', { name: 'Open in Library' });
    expect(screen.queryByRole('dialog', { name: 'Linked Content' })).toBeNull();
  });

  it('opens from the linked copy’s menu', async () => {
    renderWorldEditorBench(PLAIN_WORLD(), 'advanced');
    openTab(/Dictionary/);
    selectRow('Marsh Lore');
    clickButton('Save to Library');
    await screen.findByRole('button', { name: 'Open in Library' });
    openActionsMenu();
    clickButton('About Linked Content…');
    expect(await screen.findByRole('dialog', { name: 'Linked Content' })).toBeTruthy();
  });
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

    await screen.findByRole('button', { name: 'Open in Library' });
    focusLinkFace();
    expect(await screen.findByText('Link pending save · Marsh Lore')).toBeTruthy();

    clickButton('Save');
    expect(await screen.findByText('Linked · Marsh Lore')).toBeTruthy();
    expect(screen.queryByText('Link pending save · Marsh Lore')).toBeNull();
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
    focusLinkFace();
    expect(await screen.findByText('Link pending save · Marsh Lore')).toBeTruthy();
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
    focusLinkFace();
    expect(await screen.findByText('Linked · Fen Lorebook')).toBeTruthy();
    // The library has answered, so this is the other-author path, not the unknown-owner one.
    await awaitLibraryLookup();

    fireEvent.change(screen.getByDisplayValue('Marsh Lore'), { target: { value: 'Marsh Lore, revised' } });

    await waitFor(() => expect(ctx().dictionaries[0].link?.localReplacement).toBe(true));
    focusLinkFace();
    expect(await screen.findByText('Local replacement · Fen Lorebook')).toBeTruthy();
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
    expect(screen.queryByRole('button', { name: 'Open in Library' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Save to Library' })).toBeTruthy();
  });
});

describe('Editing a copy of your own library item', () => {
  const REVISION = '2026-01-01T00:00:00.000Z';

  const seedOwnedBook = () => library.dictionaries.set('lib-a', {
    id: 'lib-a', name: 'Fen Lore', createdAt: REVISION,
    data: { id: 'lib-a', name: 'Fen Lore', entries: [{ id: 'k1', name: 'Fen', key: ['fen'], value: 'Wetland.' }] },
  });

  const OWN_LINK = { libraryId: 'lib-a', sourceName: 'Fen Lore', sourceRevision: REVISION };

  const worldHolding = (link: Record<string, unknown> = OWN_LINK): World => benchEditorWorld({
    entities: [],
    dictionaries: [{
      id: 'b1', name: 'Fen Lore', entries: [{ id: 'own-1', name: 'Fen', key: ['fen'], value: 'Wetland.' }], link,
    }],
  });

  const renameBook = (to: string) =>
    fireEvent.change(screen.getByDisplayValue('Fen Lore'), { target: { value: to } });

  /** Open the world on its book, let the library answer, and rename the book. */
  const openAndRename = async (world: World) => {
    const bench = renderWorldEditorBench(world, 'advanced');
    openTab(/Dictionary/);
    selectRow('Fen Lore');
    await awaitLibraryLookup();
    renameBook('Fen Lore, revised');
    await waitFor(() => expect(bench.ctx().dictionaries[0].name).toBe('Fen Lore, revised'));
    return bench;
  };

  it('keeps the copy Linked while you edit it', async () => {
    seedOwnedBook();
    const { ctx } = await openAndRename(worldHolding());

    expect(ctx().dictionaries[0].link?.localReplacement).toBeUndefined();
    focusLinkFace();
    expect(await screen.findByText('Linked · Fen Lore')).toBeTruthy();
  });

  it('writes the edit to the library item when the world saves, and the copy holds the revision it wrote', async () => {
    seedOwnedBook();
    const { ctx } = await openAndRename(worldHolding());

    clickButton('Save');

    await waitFor(() => expect(library.dictionaries.get('lib-a')?.name).toBe('Fen Lore, revised'));
    const stored = library.dictionaries.get('lib-a')!;
    expect(stored.data.entries[0].value).toBe('Wetland.');
    // The item is edited: a new revision, flagged as changed since its listing.
    expect(stored.editedAt).toBeTruthy();
    expect(stored.editedAt).not.toBe(REVISION);
    expect((stored as { dirty?: boolean }).dirty).toBe(true);
    // The world's own fields stay out of the item.
    expect('link' in stored.data).toBe(false);
    await waitFor(() => expect(ctx().dictionaries[0].link?.sourceRevision).toBe(stored.editedAt));
    expect(ctx().dictionaries[0].link?.sourceName).toBe('Fen Lore, revised');
    expect(ctx().isWorldDirty).toBe(false);
    expect(toast.info).toHaveBeenCalledWith('Formamorph saved one linked copy to your library.');
    focusLinkFace();
    expect(await screen.findByText('Linked · Fen Lore, revised')).toBeTruthy();
  });

  it('reaches a second world holding a copy the next time it opens', async () => {
    seedOwnedBook();
    await openAndRename(worldHolding());
    clickButton('Save');
    await waitFor(() => expect(library.dictionaries.get('lib-a')?.name).toBe('Fen Lore, revised'));
    cleanup();

    const second = renderWorldEditorBench(worldHolding(), 'advanced');
    await waitFor(() => expect(second.ctx().dictionaries[0].name).toBe('Fen Lore, revised'));
    expect(second.ctx().dictionaries[0].link?.sourceRevision).toBe(library.dictionaries.get('lib-a')!.editedAt);
  });

  it('writes nothing when the copy still matches its item', async () => {
    seedOwnedBook();
    const { ctx } = renderWorldEditorBench(worldHolding(), 'advanced');
    openTab(/Dictionary/);
    selectRow('Fen Lore');
    await awaitLibraryLookup();
    // A change elsewhere in the world, so Save has something to do.
    act(() => ctx().updateLocation({ ...ctx().locations[0], name: 'Harbor Stair' }));
    await waitFor(() => expect(ctx().isWorldDirty).toBe(true));

    clickButton('Save');

    await waitFor(() => expect(ctx().isWorldDirty).toBe(false));
    expect(library.dictionaries.get('lib-a')?.editedAt).toBeUndefined();
    expect(ctx().dictionaries[0].link?.sourceRevision).toBe(REVISION);
    expect(toast.info).not.toHaveBeenCalled();
  });

  it('writes nothing on Discard Changes', async () => {
    seedOwnedBook();
    const { ctx } = await openAndRename(worldHolding());

    act(() => ctx().discardChanges());

    await waitFor(() => expect(ctx().dictionaries[0].name).toBe('Fen Lore'));
    expect(library.dictionaries.get('lib-a')?.name).toBe('Fen Lore');
    expect(library.dictionaries.get('lib-a')?.editedAt).toBeUndefined();
  });

  it('leaves an owned copy you already made a local replacement as one', async () => {
    seedOwnedBook();
    const { ctx } = await openAndRename(worldHolding({ ...OWN_LINK, localReplacement: true }));
    clickButton('Save');

    await waitFor(() => expect(ctx().isWorldDirty).toBe(false));
    expect(ctx().dictionaries[0].link?.localReplacement).toBe(true);
    expect(library.dictionaries.get('lib-a')?.name).toBe('Fen Lore');
  });

  it('saves the world and names the item when the library refuses the write', async () => {
    seedOwnedBook();
    const { ctx } = await openAndRename(worldHolding());
    library.storeFails = true;

    clickButton('Save');

    await waitFor(() => expect(ctx().isWorldDirty).toBe(false));
    expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('“Fen Lore”'));
    expect(library.dictionaries.get('lib-a')?.name).toBe('Fen Lore');
    // The copy did not write, so it still holds the revision it opened with and stays Linked.
    expect(ctx().dictionaries[0].link?.sourceRevision).toBe(REVISION);
    expect(ctx().dictionaries[0].link?.localReplacement).toBeUndefined();
  });

  it('marks an edit made while the library cannot be read, which is not the same as owned', async () => {
    seedOwnedBook();
    library.unreadable = true;
    const { ctx } = await openAndRename(worldHolding());

    expect(ctx().dictionaries[0].link?.localReplacement).toBe(true);
  });

  it('keeps an edited entity Linked the same way', async () => {
    library.entities.set('lib-e', {
      id: 'lib-e', name: 'Wren', createdAt: REVISION,
      data: { id: 'lib-e', name: 'Wren', playerDescription: 'A ferryman.' },
    });
    const { ctx } = renderWorldEditorBench(benchEditorWorld({
      entities: [{
        id: 'e1', name: 'Wren', playerDescription: 'A ferryman.', locations: ['harbor'],
        link: { libraryId: 'lib-e', sourceName: 'Wren', sourceRevision: REVISION },
      }],
      dictionaries: [{ id: 'b1', name: 'Marsh Lore', entries: [] }],
    }), 'advanced');
    openTab(/Entities/);
    await screen.findByText('Wren');
    await awaitLibraryLookup();

    act(() => ctx().updateEntity({ ...ctx().entities[0], playerDescription: 'A smuggler.' }));
    await waitFor(() => expect(ctx().entities[0].playerDescription).toBe('A smuggler.'));
    expect(ctx().entities[0].link?.localReplacement).toBeUndefined();

    clickButton('Save');
    await waitFor(() => expect(library.entities.get('lib-e')?.data.playerDescription).toBe('A smuggler.'));
    // The world's location membership stays out of the item.
    expect(library.entities.get('lib-e')?.data.locations).toBeUndefined();
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

  it('makes a copy of a deleted library item independent, with its content kept', async () => {
    // Nothing is seeded, so the library holds no item under this id: the player deleted it.
    const { ctx } = renderWorldEditorBench(
      worldHolding({ libraryId: 'lib-a', sourceName: 'Fen Lore', sourceRevision: '2026-01-01T00:00:00.000Z' }),
      'advanced',
    );
    openTab(/Dictionary/);
    selectRow('Fen Lore');

    await waitFor(() => expect(ctx().dictionaries[0].link).toBeUndefined());
    expect(ctx().dictionaries[0].entries[0].value).toBe('Wetland.');
    expect(screen.queryByRole('button', { name: 'Open in Library' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Save to Library' })).toBeTruthy();
    expect(toast.info).toHaveBeenCalledWith('Formamorph unlinked “Fen Lore” because its library item is gone.');
  });

  it('says it once when Exit Without Saving restores the link and the pass lets go again', async () => {
    const { ctx } = renderWorldEditorBench(
      worldHolding({ libraryId: 'lib-a', sourceName: 'Fen Lore', sourceRevision: '2026-01-01T00:00:00.000Z' }),
      'advanced',
    );
    await waitFor(() => expect(ctx().dictionaries[0].link).toBeUndefined());

    act(() => ctx().discardChanges());
    expect(ctx().dictionaries[0].link?.libraryId).toBe('lib-a');
    await waitFor(() => expect(ctx().dictionaries[0].link).toBeUndefined());
    expect(toast.info).toHaveBeenCalledTimes(1);
  });

  it('counts the copies instead of naming them when it unlinks more than one', async () => {
    const link = { libraryId: 'lib-a', sourceName: 'Fen Lore', sourceRevision: '2026-01-01T00:00:00.000Z' };
    const { ctx } = renderWorldEditorBench(benchEditorWorld({
      entities: [],
      dictionaries: [
        { id: 'b1', name: 'Fen Lore', entries: [], link },
        { id: 'b2', name: 'Reed Lore', entries: [], link: { ...link, libraryId: 'lib-b' } },
      ],
    } as unknown as Partial<World>), 'advanced');

    await waitFor(() => expect(ctx().dictionaries.every((book) => !book.link)).toBe(true));
    expect(toast.info).toHaveBeenCalledWith('Formamorph unlinked 2 copies whose library items are gone.');
    expect(toast.info).toHaveBeenCalledTimes(1);
  });

  it('keeps every link when the library cannot be read, which is not the same as deleted', async () => {
    library.unreadable = true;
    const { ctx } = renderWorldEditorBench(
      worldHolding({ libraryId: 'lib-a', sourceName: 'Fen Lore', sourceRevision: '2026-01-01T00:00:00.000Z' }),
      'advanced',
    );
    openTab(/Dictionary/);
    selectRow('Fen Lore');

    await screen.findByRole('button', { name: 'Open in Library' });
    focusLinkFace();
    expect(await screen.findByText('Linked · Fen Lore')).toBeTruthy();
    expect(ctx().dictionaries[0].link?.libraryId).toBe('lib-a');
    expect(toast.info).not.toHaveBeenCalled();
  });

  it('keeps a copy of a deleted library item following the listing it also came from', async () => {
    const { ctx } = renderWorldEditorBench(
      worldHolding({ libraryId: 'lib-a', sourceId: 'listing-9', sourceName: 'Fen Lore', sourceRevision: 'r1' }),
      'advanced',
    );
    openTab(/Dictionary/);
    selectRow('Fen Lore');

    await waitFor(() => expect(ctx().dictionaries[0].link?.libraryId).toBeUndefined());
    expect(ctx().dictionaries[0].link?.sourceId).toBe('listing-9');
    expect(toast.info).toHaveBeenCalledWith('Formamorph unlinked “Fen Lore” because its library item is gone.');
    focusLinkFace();
    expect(await screen.findByText('Linked · Fen Lore')).toBeTruthy();
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

  /** The item `LINKED_ENTITY` follows. Another account's, so opening the world reviews its saves rather
   *  than pushing them, which leaves the copy for the test to edit. */
  const seedFollowedEntity = () => library.entities.set('lib-e', {
    id: 'lib-e', name: 'Wren the Guide', createdAt: '2026-01-01T00:00:00.000Z',
    sourceId: 'listing-7', sourceAuthorId: 'reed', sourceAuthorName: 'Reed',
    data: { id: 'lib-e', name: 'Wren the Guide', playerDescription: 'A ferryman.' },
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
    seedFollowedEntity();
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
    seedFollowedEntity();
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
