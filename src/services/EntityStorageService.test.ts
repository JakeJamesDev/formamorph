// Must load before importing the service: its singleton constructor opens IndexedDB.
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import EntityStorageService, { type StoredEntityRecord } from './EntityStorageService';
import type { Entity } from '@/types';
import { encodePlaceholderToken } from '@/lib/placeholders';

import { phValues } from '@/test/placeholderValues';
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

  it('reads a 3.3.3 character’s diary calls in the entry form, by its own id too', async () => {
    const code = 'diary("e1", "Mine."); diary(who, "Theirs.");';
    const stored = {
      id: 'e1', name: 'Mara',
      stats: [{ id: 's', name: 'Mood', type: 'number', description: '', min: 0, max: 1, regen: 0, descriptors: [], scripts: [{ id: 'a', timing: 'after', code }] }],
      traits: [{ id: 't', name: 'Shy', statChanges: [], scripts: [{ id: 'b', timing: 'after', code }] }],
    } as unknown as StoredEntityRecord['data'];
    await EntityStorageService.storeEntity({ id: 'e1', name: 'Mara', data: stored });
    const read = await EntityStorageService.getEntityData('e1');
    const migrated = 'entities.Mara.diary("Mine."); entities[who].diary("Theirs.");';
    expect([read.stats![0].scripts![0].code, read.traits![0].scripts![0].code]).toEqual([migrated, migrated]);
  });

  it('reads a 3.2.x character’s flat trait gates as one row per entry, owned traits and link overrides', async () => {
    const paladin = { kind: 'trait' as const, id: 'w-paladin', name: 'Paladin' };
    // The flat list is what 3.2.x stored; the record type no longer allows it.
    const flat = {
      id: 'e1', name: 'Mara',
      traits: [{ id: 't-oath', name: 'Oath', statChanges: [], requires: [paladin, { kind: 'playingAs', id: 'aldric' }] }],
      traitLinks: [{
        id: 'l', originalId: 'smite', kind: 'trait', originalName: 'Smite', groupId: null,
        overrides: { smite: { requires: { value: [paladin], blueprint: [] } } },
      }],
    } as unknown as StoredEntityRecord['data'];
    await EntityStorageService.storeEntity({ id: 'e1', name: 'Mara', data: flat });
    const read = await EntityStorageService.getEntityData('e1');
    expect(read.traits![0].requires).toEqual([{ all: [paladin] }, { all: [{ kind: 'playingAs', id: 'aldric' }] }]);
    expect(read.traitLinks![0].overrides!.smite.requires).toEqual({ value: [{ all: [paladin] }], blueprint: [] });
  });

  it('reads a character stored before the rename with each Condition’s owner under `owner`', async () => {
    const ash = { kind: 'entity', id: 'w-ash', name: 'Ash' };
    const old = (bearer: object) => ({ kind: 'trait', id: 'w-paladin', bearer });
    const stored = {
      id: 'e1', name: 'Mara',
      traits: [{ id: 't-oath', name: 'Oath', statChanges: [], requires: [{ all: [old(ash), old({ kind: 'you' })] }] }],
      traitLinks: [{
        id: 'l', originalId: 'smite', kind: 'trait', originalName: 'Smite', groupId: null,
        overrides: { smite: { requires: { value: [{ all: [old(ash)] }], blueprint: [] } } },
      }],
    } as unknown as StoredEntityRecord['data'];
    await EntityStorageService.storeEntity({ id: 'e1', name: 'Mara', data: stored });
    const read = await EntityStorageService.getEntityData('e1');
    const owned = (owner: object) => ({ kind: 'trait', id: 'w-paladin', owner });
    expect(read.traits![0].requires).toEqual([{ all: [owned(ash), owned({ kind: 'you' })] }]);
    expect(read.traitLinks![0].overrides!.smite.requires).toEqual({ value: [{ all: [owned(ash)] }], blueprint: [] });
  });

  it('reads a character stored with `player` row targets as `global`, and keeps a stored owner (Q5, Q19)', async () => {
    const owner = { kind: 'entity', id: 'w-ash', name: 'Ash' };
    const stored = {
      id: 'e1', name: 'Mara',
      traits: [{ id: 't-oath', name: 'Oath', requires: [{ all: [{ kind: 'trait', id: 'w-brave', owner }] }],
        statChanges: [{ statId: 'rage', value: 2, target: 'player' }], statToggles: [{ statId: 'rage', enabled: false, target: 'player' }] }],
      traitLinks: [{
        id: 'l', originalId: 'smite', kind: 'trait', originalName: 'Smite', groupId: null,
        overrides: { smite: { statChanges: { value: [{ statId: 'rage', value: 1, target: 'player' }], blueprint: [] } } },
      }],
    } as unknown as StoredEntityRecord['data'];
    await EntityStorageService.storeEntity({ id: 'e1', name: 'Mara', data: stored });
    const read = await EntityStorageService.getEntityData('e1');
    expect(read.traits![0].statChanges).toEqual([{ statId: 'rage', value: 2, target: 'global' }]);
    expect(read.traits![0].statToggles).toEqual([{ statId: 'rage', enabled: false, target: 'global' }]);
    expect(read.traitLinks![0].overrides!.smite.statChanges).toEqual({ value: [{ statId: 'rage', value: 1, target: 'global' }], blueprint: [] });
    expect(read.traits![0].requires).toEqual([{ all: [{ kind: 'trait', id: 'w-brave', owner }] }]);
  });

  it('reads a stat’s two code boxes as scripts, and keeps a link’s box override for the world that binds it', async () => {
    const stored = {
      id: 'e1', name: 'Mara',
      stats: [{ id: 'grit', name: 'Grit', beforeCode: 'return 1;', code: 'return 2;' }],
      statLinks: [{ id: 'l', originalId: 'trust', overrides: { trust: { code: { value: 'return 3;', blueprint: 'return 4;' } } } }],
    } as unknown as StoredEntityRecord['data'];
    await EntityStorageService.storeEntity({ id: 'e1', name: 'Mara', data: stored });
    const read = await EntityStorageService.getEntityData('e1');
    expect(read.stats![0]).toEqual({
      id: 'grit', name: 'Grit',
      scripts: [{ id: 'grit:before', timing: 'before', code: 'return 1;' }, { id: 'grit:after', timing: 'after', code: 'return 2;' }],
    });
    // Off-world the original is out of reach, so the override waits unfolded for a world to bind it (Q36).
    expect(read.statLinks![0].overrides).toEqual({ trust: { code: { value: 'return 3;', blueprint: 'return 4;' } } });
  });

  it('reads a character that holds no stats as one with none, and keeps each stat list to the records it can hold', async () => {
    await EntityStorageService.storeEntity(record('e1'));
    expect(await EntityStorageService.getEntityData('e1')).not.toHaveProperty('stats');
    const messy = {
      id: 'e1', name: 'Mara', stats: [{ id: 'grit', name: 'Grit' }, null, { name: 'No Id' }], statGroups: 'feelings',
      statLinks: [{ id: 'l', originalId: 'trust' }, { id: 'no-original' }],
    } as unknown as StoredEntityRecord['data'];
    await EntityStorageService.storeEntity({ id: 'e1', name: 'Mara', data: messy });
    const read = await EntityStorageService.getEntityData('e1');
    expect(read.stats?.map((s) => s.id)).toEqual(['grit']);
    expect(read).not.toHaveProperty('statGroups');
    expect(read.statLinks?.map((l) => l.id)).toEqual(['l']);
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

  it('shows slot 0 on the library grid, its Visibility rule ignored', async () => {
    const images = [{ data: 'data:slot0', requires: [{ all: [{ kind: 'trait' as const, id: 'knight' }] }] }, { data: 'data:slot1' }];
    await EntityStorageService.storeEntity({ id: 'g1', name: 'Wren', data: { id: 'g1', name: 'Wren', images } });
    expect((await EntityStorageService.getEntityMetadata()).find((m) => m.id === 'g1')?.image).toBe('data:slot0');
  });

  it('reads a gallery stored as data strings as images, once', async () => {
    await EntityStorageService.storeEntity({ id: 'g2', name: 'Old', data: { id: 'g2', name: 'Old', images: ['data:a', 'data:b'] } as unknown as Entity });
    expect((await EntityStorageService.getEntityData('g2')).images).toEqual([{ data: 'data:a' }, { data: 'data:b' }]);
  });

  it('flags a persona on the metadata the Personas filter reads, and only a persona', async () => {
    await EntityStorageService.storeEntity({ id: 'p1', name: 'Mara', data: { id: 'p1', name: 'Mara', persona: true } });
    await EntityStorageService.storeEntity(record('e2'));
    const meta = await EntityStorageService.getEntityMetadata();
    expect(meta.find((m) => m.id === 'p1')?.persona).toBe(true);
    expect(meta.find((m) => m.id === 'e2')).not.toHaveProperty('persona');
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
        placeholders: [{ id: 'eye', name: 'eye', values: phValues(['amber']) }],
      },
    });

    const meta = (await EntityStorageService.getEntityMetadata()).find((m) => m.id === 'e1');
    expect(meta?.description).toBe('Her amber eyes.');
  });

  it('renders chips in the card title too, not only the blurb', async () => {
    // Names take placeholders as of the name-fields work; the card is the same world-less surface the
    // blurb is, so a chip left raw here shows the player a placement UUID where a name should be.
    const token = encodePlaceholderToken({ id: 'town', mode: 'world', placementId: 'p1' });
    await EntityStorageService.storeEntity({
      id: 'e2',
      name: `Keeper of ${token}`,
      data: {
        id: 'e2',
        name: `Keeper of ${token}`,
        placeholders: [{ id: 'town', name: 'Town', values: phValues(['Sedge', 'Marrow']) }],
      },
    });

    const meta = (await EntityStorageService.getEntityMetadata()).find((m) => m.id === 'e2');
    // A name reads by its chip, braced inside prose, the way every editor surface prints a name.
    expect(meta?.name).toBe('Keeper of {Town}');
    // The stored record keeps the real token; only the display metadata is flattened.
    expect((await readRaw('e2'))?.name).toContain('{{ph:town:');
  });

  it('rejects a character missing required fields', async () => {
    await expect(
      EntityStorageService.storeEntity({ id: 'e1' } as unknown as StoredEntityRecord),
    ).rejects.toThrow(/missing required/);
  });
});
