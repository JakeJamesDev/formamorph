import { randomUUID } from '@/lib/uuid';
import type { GameLocation, World } from '@/types';

/** The world New World opens in the editor. It is not stored until the author saves it. */
export function newBlankWorld(): World {
  return {
    id: `new-${randomUUID()}`,
    worldOverview: {
      name: 'New World',
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
