// Must load before the storage singleton, whose first use opens IndexedDB.
import 'fake-indexeddb/auto';
import { describe, expect, it, vi } from 'vitest';
import { installReviewWorld } from './reviewWorldInstall';
import WorldStorageService from '@/services/WorldStorageService';

vi.mock('@/services/AuthService', () => ({ default: { getCurrentUser: () => null } }));

const pending = (over: Record<string, unknown> = {}) => ({
  worldOverview: { name: 'Sedge Harbor', description: 'The new pier.', ...over },
  stats: [], traits: [], statUpdates: [], entities: [], dictionaries: [], placeholders: [], locations: [],
});

const author = { id: 'a1', username: 'wren_hallow', role: null };

describe('installReviewWorld', () => {
  it('stores the pending content as a new world that follows no listing', async () => {
    const name = await installReviewWorld(pending(), { name: 'Sedge Landing', author });

    expect(name).toBe('Sedge Harbor (Pending Review)');
    const meta = (await WorldStorageService.getWorldMetadata()).find((world) => world.name === name);
    expect(meta).toBeDefined();
    expect(meta?.sourceId).toBeUndefined();
    expect(meta?.author).toBe('wren_hallow');

    const data = await WorldStorageService.getWorldData(meta!.id as string) as { worldOverview: { description: string; author?: string } };
    expect(data.worldOverview.description).toBe('The new pier.');
    expect(data.worldOverview.author).toBe('wren_hallow');
  });

  it('adds a second copy rather than replacing the first', async () => {
    await installReviewWorld(pending({ name: 'Twice' }), { name: 'Twice', author });
    await installReviewWorld(pending({ name: 'Twice' }), { name: 'Twice', author });

    const copies = (await WorldStorageService.getWorldMetadata()).filter((world) => world.name === 'Twice (Pending Review)');
    expect(copies).toHaveLength(2);
  });

  it('keeps an author the world names itself', async () => {
    const name = await installReviewWorld(pending({ name: 'Pen Name', author: 'Ferryman' }), { name: 'Pen Name', author });

    const meta = (await WorldStorageService.getWorldMetadata()).find((world) => world.name === name);
    const data = await WorldStorageService.getWorldData(meta!.id as string) as { worldOverview: { author?: string } };
    expect(data.worldOverview.author).toBe('Ferryman');
  });

  it('refuses content that is not a world', async () => {
    await expect(installReviewWorld({ name: 'just an entity' }, { name: 'X', author })).rejects.toThrow();
  });
});
