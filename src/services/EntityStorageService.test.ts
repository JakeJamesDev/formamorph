// Must load before importing the service: its singleton constructor opens IndexedDB.
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import EntityStorageService, { type StoredEntityRecord } from './EntityStorageService';
import { encodePlaceholderToken } from '@/lib/placeholders';

const record = (id: string, name = 'Mara'): StoredEntityRecord => ({ id, name, data: { id, name } });

/** The shape the character editor saves with — id, name, data, and nothing else. */
const editorSave = (id: string, name: string): StoredEntityRecord => ({
  ...record(id, name),
  dirty: true,
  editedAt: '2026-07-16T00:00:00.000Z',
});

/** Read the raw record: `getEntityMetadata` doesn't expose the community link. */
const readRaw = (id: string): Promise<StoredEntityRecord | undefined> =>
  new Promise((resolve, reject) => {
    const open = indexedDB.open('entitiesDB');
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result;
      const req = db.transaction(['entities'], 'readonly').objectStore('entities').get(id);
      req.onsuccess = () => { resolve(req.result); db.close(); };
      req.onerror = () => { reject(req.error); db.close(); };
    };
  });

const downloaded: Partial<StoredEntityRecord> = {
  sourceId: 'listing-1',
  dirty: false,
  downloadedAt: '2026-07-01T00:00:00.000Z',
  sourceUpdatedAt: '2026-07-01T00:00:00.000Z',
};

describe('EntityStorageService', () => {
  beforeEach(async () => {
    await EntityStorageService.deleteEntity('e1').catch(() => {});
  });

  it('stores and reads back a character', async () => {
    await EntityStorageService.storeEntity(record('e1'));
    expect((await EntityStorageService.getEntityData('e1')).name).toBe('Mara');
  });

  it('leaves the community link unset on a hand-made character', async () => {
    await EntityStorageService.storeEntity(record('e1'));
    const stored = await readRaw('e1');
    expect(stored?.sourceId).toBeUndefined();
    expect(stored?.dirty).toBeUndefined();
  });

  it('keeps the community link sticky across an editor save that omits it', async () => {
    await EntityStorageService.storeEntity({ ...record('e1'), ...downloaded });

    // The editor saves with only id/name/data (+ dirty) — the link must survive it.
    await EntityStorageService.storeEntity(editorSave('e1', 'Mara the Edited'));

    const stored = await readRaw('e1');
    expect(stored?.sourceId).toBe('listing-1');
    expect(stored?.downloadedAt).toBe('2026-07-01T00:00:00.000Z');
    expect(stored?.sourceUpdatedAt).toBe('2026-07-01T00:00:00.000Z');
    expect(stored?.name).toBe('Mara the Edited');
  });

  it('marks an edited copy dirty and stamps the edit time', async () => {
    await EntityStorageService.storeEntity({ ...record('e1'), ...downloaded });
    await EntityStorageService.storeEntity(editorSave('e1', 'Mara'));

    const stored = await readRaw('e1');
    expect(stored?.dirty).toBe(true);
    expect(stored?.editedAt).toBe('2026-07-16T00:00:00.000Z');
  });

  it('lets a re-download clear dirty on an edited copy', async () => {
    await EntityStorageService.storeEntity(editorSave('e1', 'Mara'));
    expect((await readRaw('e1'))?.dirty).toBe(true);

    // `dirty: false` is deliberate here, so it has to win over the stored `true` — the reason the merge
    // uses `??` rather than `||`.
    await EntityStorageService.storeEntity({ ...record('e1'), ...downloaded });

    const stored = await readRaw('e1');
    expect(stored?.dirty).toBe(false);
    expect(stored?.sourceId).toBe('listing-1');
  });

  it('keeps createdAt sticky while refreshing lastAccessed', async () => {
    await EntityStorageService.storeEntity({ ...record('e1'), createdAt: '2020-01-01T00:00:00.000Z' });
    await EntityStorageService.storeEntity(record('e1'));

    const stored = await readRaw('e1');
    expect(stored?.createdAt).toBe('2020-01-01T00:00:00.000Z');
    expect(stored?.lastAccessed).not.toBe('2020-01-01T00:00:00.000Z');
  });

  it('exposes the community link on the metadata the download flow reads', async () => {
    // Not just stored — readable via the getter. Without these, getDownloadState sees no held version and
    // silently never offers an update for a character you already have.
    await EntityStorageService.storeEntity({ ...record('e1'), ...downloaded });

    const meta = (await EntityStorageService.getEntityMetadata()).find((m) => m.id === 'e1');
    expect(meta).toMatchObject({
      sourceId: 'listing-1',
      dirty: false,
      downloadedAt: '2026-07-01T00:00:00.000Z',
      sourceUpdatedAt: '2026-07-01T00:00:00.000Z',
    });
  });

  it('renders placeholder chips in the blurb the library card draws', async () => {
    // The card has no world or playthrough behind it, so an unrendered chip reaches the player as raw
    // `{{ph…}}` token text.
    const token = encodePlaceholderToken({ id: 'eye', mode: 'world', placementId: 'p1' });
    await EntityStorageService.storeEntity({
      id: 'e1',
      name: 'Mara',
      data: {
        id: 'e1',
        name: 'Mara',
        playerDescription: `Her ${token} eyes.`,
        placeholders: [{ id: 'eye', name: 'eye', values: ['amber'] }],
      },
    });

    const meta = (await EntityStorageService.getEntityMetadata()).find((m) => m.id === 'e1');
    expect(meta?.description).toBe('Her amber eyes.');
  });

  it('rejects a character missing required fields', async () => {
    await expect(
      EntityStorageService.storeEntity({ id: 'e1' } as unknown as StoredEntityRecord),
    ).rejects.toThrow(/missing required/);
  });
});
