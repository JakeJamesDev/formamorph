// @vitest-environment jsdom
// Must load before the services: their singleton constructors open IndexedDB.
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import EntityStorageService from '@/services/EntityStorageService';
import { clearLibraryModelPicks, deleteModelDescription, findModelUsage } from './libraryVrmDelete';
import type { Entity } from '@/types';

/** Deleting a library Avatar: the confirmation names who uses it, and the library entities lose their pick. */

// The save scan reads the save database; ticket 03 owns it and its tests.
const saves = vi.hoisted(() => ({ names: [] as string[] }));
vi.mock('@/lib/modelUsage', () => ({ findSavesUsingModel: () => Promise.resolve(saves.names) }));

const REVISION = '2026-01-01T00:00:00.000Z';

const store = (entity: Entity) =>
  EntityStorageService.storeEntity({ id: entity.id, name: entity.name, createdAt: REVISION, editedAt: REVISION, data: entity });

beforeEach(async () => {
  saves.names = [];
  for (const { id } of await EntityStorageService.getEntityMetadata()) await EntityStorageService.deleteEntity(id);
  await store({ id: 'wren', name: 'Wren', vrmPick: { kind: 'library', id: 'heron' } } as Entity);
  await store({ id: 'odd', name: 'Odd Wick', vrmPick: { kind: 'library', id: 'heron' } } as Entity);
  await store({ id: 'sedge', name: 'Sedge', vrmPick: { kind: 'library', id: 'crane' } } as Entity);
  await store({ id: 'pike', name: 'Pike', vrmPick: { kind: 'default' } } as Entity);
});

describe('findModelUsage', () => {
  it('names the library entities that pick the Avatar, and the saves', async () => {
    saves.names = ['Night One'];
    const usage = await findModelUsage('heron');
    expect(usage.saves).toEqual(['Night One']);
    expect([...usage.entities].sort()).toEqual(['Odd Wick', 'Wren']);
  });
});

describe('deleteModelDescription', () => {
  it('names entities and saves together', () => {
    expect(deleteModelDescription({ entities: ['Wren', 'Odd Wick'], saves: ['Night One'] })).toBe(
      '"Wren" and "Odd Wick" will show no Avatar. One save uses this Avatar: "Night One". It will fall back to the Default Avatar. This action cannot be undone.',
    );
  });

  it('names only entities when no save uses it', () => {
    expect(deleteModelDescription({ entities: ['Wren'], saves: [] })).toBe('"Wren" will show no Avatar. This action cannot be undone.');
  });

  it('asks plainly when nothing uses it, and waits while the scan runs', () => {
    expect(deleteModelDescription({ entities: [], saves: [] })).toBe('Are you sure you want to delete this Avatar? This action cannot be undone.');
    expect(deleteModelDescription(null)).toBe('Checking what uses this Avatar…');
  });
});

describe('clearLibraryModelPicks', () => {
  it('sets every pick of the Avatar to none as a new revision, and leaves other picks alone', async () => {
    await clearLibraryModelPicks('heron');

    const read = async (id: string) => EntityStorageService.getEntityData(id);
    expect(await read('wren')).not.toHaveProperty('vrmPick');
    expect(await read('odd')).not.toHaveProperty('vrmPick');
    expect((await read('sedge')).vrmPick).toEqual({ kind: 'library', id: 'crane' });
    expect((await read('pike')).vrmPick).toEqual({ kind: 'default' });

    const meta = await EntityStorageService.getEntityMetadata();
    const editedAt = (id: string) => meta.find((m) => m.id === id)?.editedAt;
    // A new revision is what carries the cleared pick to linked world copies.
    expect(editedAt('wren')).not.toBe(REVISION);
    expect(editedAt('sedge')).toBe(REVISION);
    expect(meta.find((m) => m.id === 'wren')?.vrmLibraryId).toBeUndefined();
    expect(meta.find((m) => m.id === 'sedge')?.vrmLibraryId).toBe('crane');
  });
});
