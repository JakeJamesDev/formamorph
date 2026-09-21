// Must load before the storage singletons, whose first use opens IndexedDB.
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { saveDownloadToLibrary, libraryLines } from './librarySources';
import { buildEntityCardData } from './entityFile';
import { buildDictionaryFile } from './dictionaryFile';
import DictionaryStorageService from '@/services/DictionaryStorageService';
import EntityStorageService from '@/services/EntityStorageService';
import type { Dictionary, Entity } from '@/types';

vi.mock('@/services/AuthService', () => ({ default: { getCurrentUser: () => null } }));

const entity = (name: string): Entity => ({ id: 'from-the-publisher', name } as Entity);
const book = (name: string): Dictionary => ({ id: 'from-the-publisher', name, entries: [] } as unknown as Dictionary);

const listing = {
  sourceId: 'listing-1',
  name: 'Sedge',
  sourceUpdatedAt: 'T9',
  authorId: 'u-ann',
  authorName: 'ann',
};

/** Every stored character, straight from the library. */
const storedEntities = () => EntityStorageService.getEntityMetadata();

describe('saveDownloadToLibrary', () => {
  beforeEach(async () => {
    for (const row of await EntityStorageService.getEntityMetadata()) {
      await EntityStorageService.deleteEntity(row.id);
    }
    for (const row of await DictionaryStorageService.getDictionaryMetadata()) {
      await DictionaryStorageService.deleteDictionary(row.id);
    }
  });

  it('stores a downloaded character under its own record id, not the content\'s', async () => {
    // Two listings forked from one ancestor share a content id, as does a local original you published.
    // Writing there would silently replace a record this flow cannot see.
    const installed = await saveDownloadToLibrary('entity', entity('Sedge'), listing);

    expect(installed.libraryId).not.toBe('from-the-publisher');
    expect(installed.sourceId).toBe('listing-1');
    const rows = await storedEntities();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: installed.libraryId,
      sourceId: 'listing-1',
      sourceUpdatedAt: 'T9',
      sourceAuthorId: 'u-ann',
      sourceAuthorName: 'ann',
      dirty: false,
    });
  });

  it('gives the copy the revision a later library read computes, so it is not born behind', async () => {
    const installed = await saveDownloadToLibrary('entity', entity('Sedge'), listing);
    const [row] = await storedEntities();
    expect(installed.revision).toBe(row.downloadedAt);
  });

  it('refreshes the copy it already holds for that listing rather than making a second', async () => {
    const first = await saveDownloadToLibrary('entity', entity('Sedge'), listing);
    const second = await saveDownloadToLibrary('entity', entity('Sedge Renamed'), listing);

    expect(second.libraryId).toBe(first.libraryId);
    const rows = await storedEntities();
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe('Sedge Renamed');
  });

  it('keeps an edited copy as it is and follows that', async () => {
    // Replacing it would discard the player's own work with no warning. Taking the source's version is
    // an update review, which they drive.
    const first = await saveDownloadToLibrary('entity', entity('Sedge'), listing);
    await EntityStorageService.storeEntity({
      id: first.libraryId, name: 'My Sedge', data: entity('My Sedge'), dirty: true, editedAt: 'T-edit',
    });

    const second = await saveDownloadToLibrary('entity', entity('Sedge From The Server'), listing);

    expect(second.libraryId).toBe(first.libraryId);
    expect(second.revision).toBe('T-edit');
    const rows = await storedEntities();
    expect(rows[0].name).toBe('My Sedge');
  });

  it('stores a downloaded dictionary in its own library', async () => {
    const installed = await saveDownloadToLibrary('dictionary', book('Valley Lore'), {
      ...listing, sourceId: 'listing-2', name: 'Valley Lore',
    });

    const rows = await DictionaryStorageService.getDictionaryMetadata();
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe(installed.libraryId);
    expect(await storedEntities()).toHaveLength(0);
  });

  it.each(['entity', 'dictionary'] as const)('persists and exports %s credits from dependency downloads', async (kind) => {
    for (const author of [undefined, '  ', 'River Quill']) {
      const credit = author === 'River Quill' ? author : 'ann';
      const shared = { ...(kind === 'entity' ? entity('Sedge') : book('Lore')), author };
      const source = await saveDownloadToLibrary(kind, shared, listing);
      if (kind === 'entity') {
        const saved = await EntityStorageService.getEntityData(source.libraryId);
        const metadata = (await storedEntities())[0];
        expect(buildEntityCardData(saved, undefined, {}, metadata.libraryDetails).author).toBe(credit);
        expect(libraryLines(metadata).authorLine).toBe(credit);
        expect(saved).not.toHaveProperty('author');
      } else {
        const saved = await DictionaryStorageService.getDictionaryData(source.libraryId);
        const metadata = (await DictionaryStorageService.getDictionaryMetadata())[0];
        expect(buildDictionaryFile(saved, undefined, {}, metadata.libraryDetails).author).toBe(credit);
        expect(libraryLines(metadata).authorLine).toBe(credit);
        expect(saved).not.toHaveProperty('author');
      }
    }
  });

  it('falls back to the listing\'s name when the content carries none', async () => {
    const installed = await saveDownloadToLibrary('entity', { id: 'x', name: '  ' } as Entity, listing);
    expect(installed.name).toBe('Sedge');
  });
});
