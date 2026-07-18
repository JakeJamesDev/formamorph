// Must load before importing the service: its singleton constructor opens IndexedDB.
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import DictionaryStorageService, { type StoredDictionaryRecord } from './DictionaryStorageService';

const record = (id: string, name = 'Lore'): StoredDictionaryRecord => ({
  id, name, data: { id, name, entries: [] },
});

/** The shape the dictionary editor saves with — id, name, data, and nothing else. */
const editorSave = (id: string, name: string): StoredDictionaryRecord => ({
  ...record(id, name),
  dirty: true,
  editedAt: '2026-07-16T00:00:00.000Z',
});

/** Read the raw record: `getDictionaryMetadata` doesn't expose the community link. */
const readRaw = (id: string): Promise<StoredDictionaryRecord | undefined> =>
  new Promise((resolve, reject) => {
    const open = indexedDB.open('dictionariesDB');
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result;
      const req = db.transaction(['dictionaries'], 'readonly').objectStore('dictionaries').get(id);
      req.onsuccess = () => { resolve(req.result); db.close(); };
      req.onerror = () => { reject(req.error); db.close(); };
    };
  });

const downloaded: Partial<StoredDictionaryRecord> = {
  sourceId: 'listing-1',
  dirty: false,
  downloadedAt: '2026-07-01T00:00:00.000Z',
  sourceUpdatedAt: '2026-07-01T00:00:00.000Z',
};

describe('DictionaryStorageService', () => {
  beforeEach(async () => {
    await DictionaryStorageService.deleteDictionary('d1').catch(() => {});
  });

  it('stores and reads back a book', async () => {
    await DictionaryStorageService.storeDictionary(record('d1'));
    expect((await DictionaryStorageService.getDictionaryData('d1')).name).toBe('Lore');
  });

  it('leaves the community link unset on a hand-made book', async () => {
    await DictionaryStorageService.storeDictionary(record('d1'));
    const stored = await readRaw('d1');
    expect(stored?.sourceId).toBeUndefined();
    expect(stored?.dirty).toBeUndefined();
  });

  it('keeps the community link sticky across an editor save that omits it', async () => {
    await DictionaryStorageService.storeDictionary({ ...record('d1'), ...downloaded });

    // The editor saves with only id/name/data (+ dirty) — the link must survive it.
    await DictionaryStorageService.storeDictionary(editorSave('d1', 'Lore, expanded'));

    const stored = await readRaw('d1');
    expect(stored?.sourceId).toBe('listing-1');
    expect(stored?.downloadedAt).toBe('2026-07-01T00:00:00.000Z');
    expect(stored?.sourceUpdatedAt).toBe('2026-07-01T00:00:00.000Z');
    expect(stored?.name).toBe('Lore, expanded');
  });

  it('marks an edited copy dirty and stamps the edit time', async () => {
    await DictionaryStorageService.storeDictionary({ ...record('d1'), ...downloaded });
    await DictionaryStorageService.storeDictionary(editorSave('d1', 'Lore'));

    const stored = await readRaw('d1');
    expect(stored?.dirty).toBe(true);
    expect(stored?.editedAt).toBe('2026-07-16T00:00:00.000Z');
  });

  it('lets a re-download clear dirty on an edited copy', async () => {
    await DictionaryStorageService.storeDictionary(editorSave('d1', 'Lore'));
    expect((await readRaw('d1'))?.dirty).toBe(true);

    // `dirty: false` is deliberate here, so it has to win over the stored `true` — the reason the merge
    // uses `??` rather than `||`.
    await DictionaryStorageService.storeDictionary({ ...record('d1'), ...downloaded });

    const stored = await readRaw('d1');
    expect(stored?.dirty).toBe(false);
    expect(stored?.sourceId).toBe('listing-1');
  });

  it('keeps createdAt sticky while refreshing lastAccessed', async () => {
    await DictionaryStorageService.storeDictionary({ ...record('d1'), createdAt: '2020-01-01T00:00:00.000Z' });
    await DictionaryStorageService.storeDictionary(record('d1'));

    const stored = await readRaw('d1');
    expect(stored?.createdAt).toBe('2020-01-01T00:00:00.000Z');
    expect(stored?.lastAccessed).not.toBe('2020-01-01T00:00:00.000Z');
  });

  it('exposes the community link on the metadata the download flow reads', async () => {
    // Not just stored — readable via the getter. Without these, getDownloadState sees no held version and
    // silently never offers an update for a book you already have.
    await DictionaryStorageService.storeDictionary({ ...record('d1'), ...downloaded });

    const meta = (await DictionaryStorageService.getDictionaryMetadata()).find((m) => m.id === 'd1');
    expect(meta).toMatchObject({
      sourceId: 'listing-1',
      dirty: false,
      downloadedAt: '2026-07-01T00:00:00.000Z',
      sourceUpdatedAt: '2026-07-01T00:00:00.000Z',
    });
  });

  it('rejects a book missing its entries array', async () => {
    await expect(
      DictionaryStorageService.storeDictionary({ id: 'd1', name: 'X', data: {} } as unknown as StoredDictionaryRecord),
    ).rejects.toThrow(/missing required/);
  });
});
