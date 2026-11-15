// Must load before the storage singletons, whose first use opens IndexedDB.
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import EntityStorageService from '@/services/EntityStorageService';
import { planOwnedWriteBack } from './libraryWriteBack';
import { saveCopyToLibrary } from './librarySources';
import type { Entity, LibrarySupporterCopyMarker, SupporterCopyMarker } from '@/types';

vi.mock('@/services/AuthService', () => ({ default: { getCurrentUser: () => null } }));
vi.mock('react-toastify', () => ({ toast: { info: vi.fn(), error: vi.fn(), success: vi.fn() } }));

const WORLD_MARKER: SupporterCopyMarker = { listingId: 'L1', accountId: 'A1', revision: 1 };
const ENTRY_MARKER: LibrarySupporterCopyMarker = { ...WORLD_MARKER, sourceWorldId: 'w-source' };

const original = { id: 'e1', name: 'Wren', aiDescription: 'Original.' } as Entity;

/** Saves `original` to the library, then plays the world save of an edited copy that follows it. */
async function editAndSave(libraryMarker: LibrarySupporterCopyMarker | undefined, worldMarker: SupporterCopyMarker | null | undefined, worldId = 'w-source') {
  const source = await saveCopyToLibrary(original, [], [], undefined, undefined, undefined, libraryMarker);
  const copy = {
    ...original, id: 'copy', aiDescription: 'Edited in the world.',
    link: { libraryId: source.id, sourceRevision: source.revision },
  } as Entity;
  const write = await planOwnedWriteBack({
    worldId, entities: [copy], dictionaries: [], placeholders: [], locations: [], traits: [], traitGroups: [], supporterCopy: worldMarker,
  });
  const written = await write();
  return { written, library: (await EntityStorageService.getEntityData(source.id)).aiDescription };
}

beforeEach(async () => {
  for (const row of await EntityStorageService.getEntityMetadata()) await EntityStorageService.deleteEntity(row.id);
});

describe('the write-back of a world save to the library items its copies follow', () => {
  it('writes an edited copy to its item from a plain world', async () => {
    const { written, library } = await editAndSave(undefined, null);

    expect(written).toHaveLength(1);
    expect(library).toBe('Edited in the world.');
  });

  it('keeps a Supporter Copy world from writing into an unmarked item', async () => {
    const { written, library } = await editAndSave(undefined, WORLD_MARKER);

    expect(written).toHaveLength(0);
    expect(library).toBe('Original.');
  });

  it('writes nothing while the world marker is unread', async () => {
    const { written, library } = await editAndSave(undefined, undefined);

    expect(written).toHaveLength(0);
    expect(library).toBe('Original.');
  });

  it('lets a Supporter Copy world write into an item saved from it', async () => {
    const { written, library } = await editAndSave(ENTRY_MARKER, WORLD_MARKER);

    expect(written).toHaveLength(1);
    expect(library).toBe('Edited in the world.');
  });

  it('keeps a Supporter Copy world from writing into an item marked for another source world', async () => {
    const { written, library } = await editAndSave(ENTRY_MARKER, WORLD_MARKER, 'w-other');

    expect(written).toHaveLength(0);
    expect(library).toBe('Original.');
  });
});
