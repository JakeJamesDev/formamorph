// @vitest-environment jsdom
// Must load before the services: their singleton constructors open IndexedDB.
import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ModelStorageService from '@/services/ModelStorageService';
import EntityStorageService from '@/services/EntityStorageService';
import DictionaryStorageService from '@/services/DictionaryStorageService';
import { promisifyRequest } from '@/lib/idb';
import { blobToDataUrl } from '@/lib/imageSource';
import { makeVrm1 } from '@/test/glbFixture';
import { saveCopyToLibrary } from './librarySources';
import { toLibraryPick } from './libraryVrm';
import { supporterCopyBlock } from './supporterCopy';
import type { Dictionary, Entity, LibrarySupporterCopyMarker, MediaAsset, WorldVrm } from '@/types';

vi.mock('@/services/AuthService', () => ({ default: { getCurrentUser: () => null } }));

const MARKER: LibrarySupporterCopyMarker = { listingId: 'L1', accountId: 'A1', revision: 3, sourceWorldId: 'w-source' };

const entity = { id: 'e1', name: 'Wren' } as Entity;
const book = { id: 'b1', name: 'Lore', entries: [] } as unknown as Dictionary;

const vrmFile = (title: string) => new File([makeVrm1({ title })], `${title}.vrm`, { type: 'model/vrm' });
const asset = async (file: File): Promise<MediaAsset> =>
  ({ data: await blobToDataUrl(file), type: 'model/vrm', name: file.name, size: file.size });

/** fake-indexeddb hands back a Blob jsdom's FileReader rejects, so a read gets the original file, as a browser would. */
const added = new Map<string, File>();

beforeEach(async () => {
  for (const row of await EntityStorageService.getEntityMetadata()) await EntityStorageService.deleteEntity(row.id);
  for (const row of await DictionaryStorageService.getDictionaryMetadata()) await DictionaryStorageService.deleteDictionary(row.id);
  await ModelStorageService.initialize();
  const db = await new Promise<IDBDatabase>((resolve) => {
    const req = indexedDB.open('FORMAMORPH_MODELS_DB');
    req.onsuccess = () => resolve(req.result);
  });
  await promisifyRequest(db.transaction(['models'], 'readwrite').objectStore('models').clear());
  (ModelStorageService as unknown as { migration: Promise<void> | null }).migration = null;
  added.clear();
  const read = ModelStorageService.getModelData.bind(ModelStorageService);
  vi.spyOn(ModelStorageService, 'getModelData').mockImplementation(async (id) => {
    const data = await read(id);
    return added.has(id) ? { ...data, blob: added.get(id)! } : data;
  });
});

afterEach(() => vi.restoreAllMocks());

describe('Save to Library from a Supporter Copy', () => {
  it('writes a marked entity and a marked dictionary that name the source world', async () => {
    await saveCopyToLibrary(entity, [], [], undefined, undefined, undefined, MARKER);
    await saveCopyToLibrary(book, [], [], undefined, undefined, undefined, MARKER);

    const [savedEntity] = await EntityStorageService.getEntityMetadata();
    const [savedBook] = await DictionaryStorageService.getDictionaryMetadata();
    expect(savedEntity.supporterCopy).toEqual(MARKER);
    expect(savedBook.supporterCopy).toEqual(MARKER);
  });

  it('writes no marker from a plain world', async () => {
    await saveCopyToLibrary(entity, [], []);
    await saveCopyToLibrary(book, [], []);

    const [savedEntity] = await EntityStorageService.getEntityMetadata();
    const [savedBook] = await DictionaryStorageService.getDictionaryMetadata();
    expect(savedEntity.supporterCopy).toBeUndefined();
    expect(savedBook.supporterCopy).toBeUndefined();
  });

  it('keeps the marker through an editor save that passes none', async () => {
    const source = await saveCopyToLibrary(entity, [], [], undefined, undefined, undefined, MARKER);

    await EntityStorageService.storeEntity({ id: source.id, name: 'Wren II', data: { ...entity, id: source.id, name: 'Wren II' }, dirty: true });

    const [saved] = await EntityStorageService.getEntityMetadata();
    expect(saved.name).toBe('Wren II');
    expect(saved.supporterCopy).toEqual(MARKER);
  });

  it('blocks export and publish of the saved entry, and allows add only to its source world', async () => {
    await saveCopyToLibrary(entity, [], [], undefined, undefined, undefined, MARKER);
    const [saved] = await EntityStorageService.getEntityMetadata();

    expect(supporterCopyBlock(saved, 'exportEntity')).not.toBeNull();
    expect(supporterCopyBlock(saved, 'publish')).not.toBeNull();
    expect(supporterCopyBlock(saved, { addToWorld: 'w-source' })).toBeNull();
    expect(supporterCopyBlock(saved, { addToWorld: 'w-other' })).not.toBeNull();
  });
});

describe('an Avatar carried with a Supporter Copy entity', () => {
  const worldStore = async (file: File): Promise<Record<string, WorldVrm>> => ({ w1: { name: 'Crane', file: await asset(file) } });

  it('is imported marked when the library lacks it', async () => {
    await toLibraryPick({ kind: 'world', id: 'w1' }, await worldStore(vrmFile('Crane')), MARKER);

    const [model] = await ModelStorageService.getModelMetadata();
    expect(model.supporterCopy).toEqual(MARKER);
    expect(supporterCopyBlock(model, 'publish')).not.toBeNull();
    expect(supporterCopyBlock(model, 'exportEntity')).not.toBeNull();
  });

  it('is imported unmarked from a plain world', async () => {
    await toLibraryPick({ kind: 'world', id: 'w1' }, await worldStore(vrmFile('Crane')));

    const [model] = await ModelStorageService.getModelMetadata();
    expect(model.supporterCopy).toBeUndefined();
  });

  it('stays marked when the same file is saved later from a plain world', async () => {
    const file = vrmFile('Crane');
    await toLibraryPick({ kind: 'world', id: 'w1' }, await worldStore(file), MARKER);
    await toLibraryPick({ kind: 'world', id: 'w1' }, await worldStore(file));

    const models = await ModelStorageService.getModelMetadata();
    expect(models).toHaveLength(1);
    expect(models[0].supporterCopy).toEqual(MARKER);
  });

  it('stays unmarked when the library already held the file', async () => {
    const file = vrmFile('Crane');
    const held = await ModelStorageService.addModel(file);
    added.set(held.id, file);

    await toLibraryPick({ kind: 'world', id: 'w1' }, await worldStore(file), MARKER);

    const models = await ModelStorageService.getModelMetadata();
    expect(models).toHaveLength(1);
    expect(models[0].supporterCopy).toBeUndefined();
  });
});
