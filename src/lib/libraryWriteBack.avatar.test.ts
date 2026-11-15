// @vitest-environment jsdom
// Must load before the services: their singleton constructors open IndexedDB.
import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import EntityStorageService from '@/services/EntityStorageService';
import ModelStorageService from '@/services/ModelStorageService';
import { promisifyRequest } from '@/lib/idb';
import { blobToDataUrl } from '@/lib/imageSource';
import { makeVrm1 } from '@/test/glbFixture';
import { planOwnedWriteBack } from './libraryWriteBack';
import { saveCopyToLibrary } from './librarySources';
import type { Entity, LibrarySupporterCopyMarker, SupporterCopyMarker } from '@/types';

vi.mock('@/services/AuthService', () => ({ default: { getCurrentUser: () => null } }));
vi.mock('react-toastify', () => ({ toast: { info: vi.fn(), error: vi.fn(), success: vi.fn() } }));

const WORLD_MARKER: SupporterCopyMarker = { listingId: 'L1', accountId: 'A1', revision: 1 };
const ENTRY_MARKER: LibrarySupporterCopyMarker = { ...WORLD_MARKER, sourceWorldId: 'w-source' };

beforeEach(async () => {
  for (const row of await EntityStorageService.getEntityMetadata()) await EntityStorageService.deleteEntity(row.id);
  await ModelStorageService.initialize();
  const db = await new Promise<IDBDatabase>((resolve) => {
    const req = indexedDB.open('FORMAMORPH_MODELS_DB');
    req.onsuccess = () => resolve(req.result);
  });
  await promisifyRequest(db.transaction(['models'], 'readwrite').objectStore('models').clear());
  (ModelStorageService as unknown as { migration: Promise<void> | null }).migration = null;
});

afterEach(() => vi.restoreAllMocks());

describe('the write-back of a Supporter Copy world that gives its entity a new Avatar', () => {
  it('imports the Avatar into the library marked, so it never leaves through the library', async () => {
    const source = await saveCopyToLibrary({ id: 'e1', name: 'Wren' } as Entity, [], [], undefined, undefined, undefined, ENTRY_MARKER);
    const file = new File([makeVrm1({ title: 'Crane' })], 'Crane.vrm', { type: 'model/vrm' });
    const copy = {
      id: 'copy', name: 'Wren', vrmPick: { kind: 'world', id: 'w1' },
      link: { libraryId: source.id, sourceRevision: source.revision },
    } as Entity;
    const write = await planOwnedWriteBack({
      worldId: 'w-source', entities: [copy], dictionaries: [], placeholders: [], locations: [], traits: [], traitGroups: [],
      vrmStore: { w1: { name: 'Crane', file: { data: await blobToDataUrl(file), type: 'model/vrm', name: file.name, size: file.size } } },
      supporterCopy: WORLD_MARKER,
    });

    await write();

    const models = await ModelStorageService.getModelMetadata();
    expect(models).toHaveLength(1);
    expect(models[0].supporterCopy).toEqual(ENTRY_MARKER);
  });
});
