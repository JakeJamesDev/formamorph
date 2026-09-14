// Must load before the storage singletons, whose first use opens IndexedDB.
import 'fake-indexeddb/auto';
import { describe, expect, it, vi } from 'vitest';
import { buildDictionaryFile, parseDictionaryFile } from './dictionaryFile';
import { buildEntityCardData, parseEntityCardData } from './entityFile';
import { readComponentFileLinks } from './componentFileLinks';
import { resolveBundledLinks } from './worldBundle';
import type { ContentLink, Dictionary, Entity, World } from '@/types';

// The export path serializes off the main thread; the worker is the transport, not the shape under test.
const mocks = vi.hoisted(() => ({ files: [] as string[] }));
vi.mock('./jsonFileWorkerUtils', () => ({
  serializeJsonBlob: vi.fn(async (value: unknown, space?: number) => {
    const text = JSON.stringify(value, null, space);
    mocks.files.push(text);
    return new Blob([text]);
  }),
  parseJsonText: vi.fn(),
  terminateWorker: vi.fn(),
}));

vi.mock('@/services/AuthService', () => ({ default: { getCurrentUser: () => null } }));

const { migrateWorld, APP_VERSION } = await import('./version');
const { serializeWorldFile } = await import('./worldFile');

const link: ContentLink = {
  libraryId: 'lib-e', sourceId: 'listing-e', sourceRevision: 'r2', sourceName: 'Wren the Guide',
};

const entity: Entity = {
  id: 'e1', name: 'Wren', aiDescription: 'A marsh guide.', tags: ['guide'], link,
};

const book: Dictionary = {
  id: 'b1',
  name: 'Marsh Lore',
  description: 'What the reeds remember.',
  entries: [{ id: 'x1', name: 'Reeds', key: ['reeds'], value: 'They whisper.' } as Dictionary['entries'][number]],
  link: { libraryId: 'lib-d', sourceRevision: 'r5', sourceName: 'Marsh Lore', localReplacement: true },
};

const world = (over: Partial<Record<string, unknown>> = {}): unknown => ({
  id: 'w1',
  version: APP_VERSION,
  worldOverview: { name: 'Sedge Landing', description: 'Wet.', author: 'Ann', thumbnail: '' },
  stats: [],
  locations: [],
  entities: [entity],
  traits: [],
  statUpdates: [],
  dictionaries: [book],
  ...over,
});

/** Export a world to the text its file holds. */
async function worldFileText(value: unknown): Promise<string> {
  mocks.files.length = 0;
  await serializeWorldFile(value as World);
  return mocks.files[0];
}

/**
 * A reader built to the world-file shape as it stood before relationship metadata existed.
 *
 * It knows the sections a world had then, insists on the ones the store insists on, and keeps everything
 * else exactly as written — which is what the importer of that build did, and what has to stay true for a
 * file written by this build to open there.
 */
function previousWorldReader(text: string): Record<string, unknown> {
  const raw = JSON.parse(text) as Record<string, unknown>;
  const required = ['worldOverview', 'stats', 'locations', 'entities', 'traits', 'statUpdates'];
  for (const key of required) {
    if (!(key in raw)) throw new Error(`Invalid world data: missing ${key}`);
  }
  return { ...raw };
}

/** A reader built to the dictionary-file shape as it stood before relationship metadata existed. */
function previousDictionaryReader(raw: Record<string, unknown>): Record<string, unknown> {
  const known = [
    'formamorphKind', 'version', 'name', 'description', 'enabled', 'tags', 'thumbnail', 'entries',
    'placeholders', 'sharedPlaceholders',
  ];
  return Object.fromEntries(known.flatMap((key) => (key in raw ? [[key, raw[key]]] : [])));
}

/** A reader built to the character-card shape as it stood before relationship metadata existed. */
function previousCardReader(raw: Record<string, unknown>): Record<string, unknown> {
  const known = [
    'formamorphKind', 'version', 'name', 'aliases', 'type', 'playerDescription', 'aiDescription',
    'aiSummary', 'tags', 'imageTags', 'extraImages', 'placeholders', 'sharedPlaceholders',
  ];
  return Object.fromEntries(known.flatMap((key) => (key in raw ? [[key, raw[key]]] : [])));
}

describe('a world file carries its relationships', () => {
  it('writes each linked copy\'s source and each local replacement\'s marker', async () => {
    const written = JSON.parse(await worldFileText(world())) as {
      entities: Entity[]; dictionaries: Dictionary[];
    };

    expect(written.entities[0].link).toEqual(link);
    expect(written.dictionaries[0].link?.localReplacement).toBe(true);
  });

  it('restores both when the file is imported on the machine that wrote it', async () => {
    const library = [
      { id: 'lib-e', name: 'Wren the Guide', revision: 'r2' },
      { id: 'lib-d', name: 'Marsh Lore', revision: 'r5' },
    ];

    const read = migrateWorld(previousWorldReader(await worldFileText(world())));
    const resolved = resolveBundledLinks(read as unknown as {
      entities: Entity[]; dictionaries: Dictionary[];
    }, library);

    expect(resolved.entities[0].link).toEqual(link);
    expect(resolved.dictionaries[0].link?.localReplacement).toBe(true);
  });

  it('bundles the content in the world\'s own collections, not behind a fetch', async () => {
    const written = JSON.parse(await worldFileText(world())) as {
      entities: Entity[]; dictionaries: Dictionary[];
    };

    expect(written.entities[0].aiDescription).toBe('A marsh guide.');
    expect(written.dictionaries[0].entries).toHaveLength(1);
  });
});

describe('a reader built to the previous shape loses nothing', () => {
  it('keeps every section and every field of a world file, relationships included', async () => {
    const source = world() as Record<string, unknown>;

    const read = previousWorldReader(await worldFileText(source));

    // Compared against the world that was exported, not against the file's own JSON: the point is that
    // nothing the world held is missing after the old reader, whatever the file happens to carry.
    for (const [key, value] of Object.entries(source)) {
      // The exporter drops the local record id and stamps its own version; every other field is the world's.
      if (key === 'id' || key === 'version') continue;
      expect(read[key]).toEqual(value);
    }
    expect((read.entities as Entity[])[0].link).toEqual(link);
    expect((read.dictionaries as Dictionary[])[0].link?.localReplacement).toBe(true);
  });

  it('still loads a world file whose copies carry bundled markers', async () => {
    const bundled = world({
      entities: [{ ...entity, link: { bundledFrom: 'their-lib', sourceName: 'Wren the Guide' } }],
    });

    const read = previousWorldReader(await worldFileText(bundled));

    expect((read.entities as Entity[])[0].name).toBe('Wren');
    expect((read.entities as Entity[])[0].link).toEqual({
      bundledFrom: 'their-lib', sourceName: 'Wren the Guide',
    });
  });

  it('reads every field of a dictionary file it knows, ignoring the relationship blocks', () => {
    const file = buildDictionaryFile(book, [], {
      source: { sourceId: 'listing-d', sourceName: 'Marsh Lore' },
      associations: [{ id: 'listing-w', name: 'Sedge Landing' }],
    }) as unknown as Record<string, unknown>;

    const read = previousDictionaryReader(file);
    const now = parseDictionaryFile(file);
    const then = parseDictionaryFile({ ...read, formamorphKind: 'dictionary' });

    expect(read.name).toBe('Marsh Lore');
    expect(read.description).toBe('What the reeds remember.');
    expect(read.entries).toHaveLength(1);
    // Ids are minted per import, so the content either side is compared without them.
    expect({ ...then, id: '', entries: [] }).toEqual({ ...now, id: '', entries: [] });
  });

  it('reads every field of a character card it knows, ignoring the relationship blocks', () => {
    const card = buildEntityCardData(entity, [], {
      source: { sourceId: 'listing-e', sourceName: 'Wren the Guide' },
      associations: [{ id: 'listing-w', name: 'Sedge Landing' }],
    }) as unknown as Record<string, unknown>;

    const read = previousCardReader(card);
    const then = parseEntityCardData({ ...read, formamorphKind: 'entity' });

    expect(then.name).toBe('Wren');
    expect(then.aiDescription).toBe('A marsh guide.');
    expect(then.tags).toEqual(['guide']);
  });
});

describe('a component file carries its associations and no world', () => {
  it('writes the source and the worlds it suits', () => {
    const file = buildDictionaryFile(book, [], {
      source: { sourceId: 'listing-d', sourceName: 'Marsh Lore' },
      associations: [{ id: 'listing-w', name: 'Sedge Landing' }],
    });

    expect(readComponentFileLinks(file)).toEqual({
      source: { sourceId: 'listing-d', sourceName: 'Marsh Lore' },
      associations: [{ id: 'listing-w', name: 'Sedge Landing' }],
    });
  });

  it('writes no world content, only the listings the worlds are named by', () => {
    const file = buildEntityCardData(entity, [], {
      associations: [{ id: 'listing-w', name: 'Sedge Landing' }],
    }) as unknown as Record<string, unknown>;

    expect(file.worldOverview).toBeUndefined();
    expect(file.stats).toBeUndefined();
    expect(file.locations).toBeUndefined();
    expect(JSON.stringify(file.associations)).toBe('[{"id":"listing-w","name":"Sedge Landing"}]');
  });

  it('writes nothing about relationships for a component that has none', () => {
    expect(readComponentFileLinks(buildEntityCardData(entity, []))).toEqual({});
  });
});
