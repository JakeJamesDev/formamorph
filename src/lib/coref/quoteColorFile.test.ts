import { describe, expect, it, vi } from 'vitest';
import type { Entity, World } from '@/types';
import { serializeWorldFile } from '@/lib/worldFile';
import { migrateWorld } from '@/lib/version';
import { buildEntityCardData, parseEntityCardData } from '@/lib/entityFile';

// The serializer runs in a worker the test environment lacks; this stand-in writes the same JSON text.
vi.mock('@/lib/jsonFileWorkerUtils', () => ({
  serializeJsonBlob: async (value: unknown, space?: number) => new Blob([JSON.stringify(value, null, space)]),
}));

describe('a pinned quote color in a world file', () => {
  it('survives export and import, and an entity without one stays without one', async () => {
    const entities = [{ id: 'a', name: 'A', quoteColor: 'teal' }, { id: 'b', name: 'B' }] as Entity[];
    const blob = await serializeWorldFile({ id: 'w', name: 'W', entities } as unknown as World);
    const text = await blob.text();
    const back = migrateWorld(JSON.parse(text));
    expect(back.entities.map((e) => e.quoteColor)).toEqual(['teal', undefined]);
    expect(JSON.parse(text).entities[1]).not.toHaveProperty('quoteColor');
  });
});

describe('a pinned quote color on a character card', () => {
  it('travels with the card', () => {
    const card = buildEntityCardData({ id: 'a', name: 'A', quoteColor: 'plum' }, []);
    expect(parseEntityCardData(card).quoteColor).toBe('plum');
  });

  it('is left off a card that has none', () => {
    const card = buildEntityCardData({ id: 'a', name: 'A' }, []);
    expect(card).not.toHaveProperty('quoteColor');
    expect(parseEntityCardData(card)).not.toHaveProperty('quoteColor');
  });

  it('drops a key that is not a swatch', () => {
    const card = { ...buildEntityCardData({ id: 'a', name: 'A' }, []), quoteColor: '#ff0000' };
    expect(parseEntityCardData(card)).not.toHaveProperty('quoteColor');
  });
});
