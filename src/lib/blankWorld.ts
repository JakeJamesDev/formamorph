import { randomUUID } from '@/lib/uuid';
import type { Entity, GameLocation, Stat, World } from '@/types';

/** The name New World gives a world. */
export const NEW_WORLD_NAME = 'New World';

/** The world New World opens in the editor. It is not stored until the author saves it. */
export function newBlankWorld(): World {
  return {
    id: `new-${randomUUID()}`,
    worldOverview: {
      name: NEW_WORLD_NAME,
      description: 'A blank world ready for editing',
      thumbnail: null,
      use3DModel: false,
      bgm: null,
      systemPrompt: '',
      author: '',
      tags: [],
    },
    stats: [],
    traits: [],
    // Seed the two default trait groups so authors start with World/Player folders.
    traitGroups: [
      { id: randomUUID(), name: 'World', parentId: null, order: 0 },
      { id: randomUUID(), name: 'Player', parentId: null, order: 1 },
    ],
    locations: [],
    entities: [],
    statUpdates: [], // This field is required by WorldStorageService
    // Seed one "Default" book so new worlds start with a dictionary (Foreground by default).
    dictionaries: [{ id: randomUUID(), name: 'Default', enabled: true, entries: [] }],
  };
}

/** A location as the editor's Add button makes it. */
export function newLocation(id: string, name = 'New Location'): GameLocation {
  return { id, name, playerDescription: '', aiDescription: '', aiSummary: '' };
}

/** How many entities and entity groups sit at the entity tree's root: the `order` a new root item takes. */
export function entityRootCount(world: Pick<World, 'entities' | 'entityGroups'>): number {
  return (world.entities ?? []).filter((e) => (e.groupId ?? null) === null).length
    + (world.entityGroups ?? []).filter((g) => (g.parentId ?? null) === null).length;
}

/** An entity as the editor's Add button makes it, placed `order`th among the ungrouped entities. */
export function newEntity(id: string, order: number, name = 'New Entity'): Entity {
  return { id, name, playerDescription: '', aiDescription: '', aiSummary: '', type: '', groupId: null, order };
}

/** A stat as the editor's Add button makes it, before the world gives it its default descriptors. */
export function newStat(id: string, name = 'New Stat'): Omit<Stat, 'descriptors'> {
  return { id, name, type: 'number', description: '', min: 0, max: 100, value: 0, regen: 0 };
}

/** The stat with the low, medium and high descriptors every added stat starts with. */
export function withDefaultDescriptors(stat: Omit<Stat, 'descriptors'>): Stat {
  return {
    ...stat,
    descriptors: [
      { id: randomUUID(), threshold: 30, description: `${stat.name} is low` },
      { id: randomUUID(), threshold: 60, description: `${stat.name} is medium` },
      { id: randomUUID(), threshold: 100, description: `${stat.name} is high` },
    ],
  };
}
