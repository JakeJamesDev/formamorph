// Must load before the storage singletons, whose first use opens IndexedDB.
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { linkBundledContent, resolveImportedWorld, type BundleWorld } from './worldBundleRun';
import { libraryItems } from './librarySources';
import EntityStorageService from '@/services/EntityStorageService';
import type { ContentLink, Entity } from '@/types';

vi.mock('@/services/AuthService', () => ({ default: { getCurrentUser: () => null } }));

const entity = (id: string, link?: ContentLink, over: Partial<Entity> = {}): Entity => ({
  id, name: 'Sedge', aiDescription: 'What the file holds.', ...(link ? { link } : {}), ...over,
});

const worldWith = (entities: Entity[]): BundleWorld => ({
  entities, dictionaries: [], placeholders: [], locations: [],
});

/** Put one character in the library, optionally as a copy downloaded from a listing. */
async function storeLibraryEntity(id: string, data: Entity, over: { sourceId?: string } = {}) {
  await EntityStorageService.storeEntity({
    id, name: data.name, createdAt: '2026-01-01T00:00:00.000Z', data, ...over,
  });
}

async function clearLibrary() {
  for (const item of await libraryItems('entity')) await EntityStorageService.deleteEntity(item.id);
}

describe('resolveImportedWorld', () => {
  beforeEach(clearLibrary);

  it('restores a link whose library item is on this machine', async () => {
    await storeLibraryEntity('lib-1', entity('lib-1'));
    const link: ContentLink = { libraryId: 'lib-1', sourceName: 'Sedge', sourceRevision: 'r1' };

    const resolved = await resolveImportedWorld(worldWith([entity('e1', link)]));

    expect(resolved.entities?.[0].link).toEqual(link);
  });

  it('sets a link to another machine\'s item aside as bundled content', async () => {
    const resolved = await resolveImportedWorld(worldWith([
      entity('e1', { libraryId: 'their-lib', sourceName: 'Sedge' }),
    ]));

    expect(resolved.entities?.[0].link).toEqual({ bundledFrom: 'their-lib', sourceName: 'Sedge' });
  });

  it('repoints a copy at the local item downloaded from the same listing, keeping the file content', async () => {
    await storeLibraryEntity('lib-1', entity('lib-1', undefined, { aiDescription: "The author's." }), {
      sourceId: 'listing-1',
    });

    const resolved = await resolveImportedWorld(worldWith([
      entity('e1', { libraryId: 'their-lib', sourceId: 'listing-1' }),
    ]));

    expect(resolved.entities?.[0].link).toMatchObject({ libraryId: 'lib-1', localReplacement: true });
    expect(resolved.entities?.[0].aiDescription).toBe('What the file holds.');
  });
});

describe('linkBundledContent', () => {
  beforeEach(clearLibrary);

  it('places one library item for a bundled source and links every copy of it', async () => {
    const world = worldWith([
      entity('e1', { bundledFrom: 'their-lib', sourceName: 'Sedge' }),
      entity('e2', { bundledFrom: 'their-lib', sourceName: 'Sedge' }),
    ]);

    const { world: linked, placed } = await linkBundledContent(world);
    const library = await libraryItems('entity');

    expect(placed).toBe(1);
    expect(library).toHaveLength(1);
    expect(linked.entities?.[0].link?.libraryId).toBe(library[0].id);
    expect(linked.entities?.[1].link?.libraryId).toBe(library[0].id);
  });

  it('leaves the world\'s own content exactly as it was', async () => {
    const world = worldWith([entity('e1', { bundledFrom: 'their-lib' }, { aiDescription: 'Mine.' })]);

    const { world: linked } = await linkBundledContent(world);

    expect(linked.entities?.[0].aiDescription).toBe('Mine.');
    expect(linked.entities?.[0].id).toBe('e1');
  });

  it('follows the item a second run finds rather than placing another copy of it', async () => {
    const world = worldWith([entity('e1', { bundledFrom: 'their-lib' })]);

    const first = await linkBundledContent(world);
    const libraryId = first.world.entities![0].link!.libraryId!;
    // Embedding clears the link and keeps the bundle, which is what the second run reads.
    const embedded = worldWith([entity('e1', { bundledFrom: libraryId })]);
    const second = await linkBundledContent(embedded);

    expect(second.placed).toBe(0);
    expect(second.world.entities?.[0].link?.libraryId).toBe(libraryId);
    expect(await libraryItems('entity')).toHaveLength(1);
  });

  it('does nothing for a world with no bundled content', async () => {
    const world = worldWith([entity('e1', { libraryId: 'lib-1' })]);

    const { world: linked, placed } = await linkBundledContent(world);

    expect(placed).toBe(0);
    expect(linked).toBe(world);
    expect(await libraryItems('entity')).toHaveLength(0);
  });
});
