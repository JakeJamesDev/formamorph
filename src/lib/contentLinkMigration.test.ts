import { describe, it, expect, vi } from 'vitest';
import type { ContentLink, SaveObject, World } from '@/types';
import { contentLinkState } from './contentLink';

// The export path serializes off the main thread; the worker is the transport, not the behavior under
// test, so it is substituted with the same JSON the worker would write, kept as text so a test can import
// the actual file bytes back. `serializeWorldFile`'s own field selection and `migrateWorld`'s import
// handling are the real production code either side of the file.
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

const { migrateWorld, migrateSave, APP_VERSION } = await import('./version');
const { serializeWorldFile } = await import('./worldFile');

/** A world in the current shape, with whatever entity/dictionary link records the case needs. */
const worldWith = (entities: unknown[], dictionaries: unknown[]): unknown => ({
  id: 'w1',
  version: APP_VERSION,
  worldOverview: { name: 'Sedge Landing', description: '', author: '', thumbnail: '' },
  stats: [],
  locations: [],
  entities,
  traits: [],
  statUpdates: [],
  dictionaries,
});

/** Loose view of a migrated world, so assertions need no `any`. `link` stays typed: these tests read it
 *  through the same derivation the editor does. */
type LinkedItem = Record<string, unknown> & { link?: ContentLink };
type LinkedWorld = { entities?: LinkedItem[]; dictionaries?: LinkedItem[] };
const asLinked = (world: World): LinkedWorld => world as unknown as LinkedWorld;

const linkedEntity = {
  id: 'e1',
  name: 'Wren',
  link: { libraryId: 'lib-e', sourceId: 'listing-e', sourceRevision: 'r2', sourceName: 'Wren the Guide' },
};
const linkedBook = {
  id: 'b1',
  name: 'Marsh Lore',
  entries: [],
  link: { libraryId: 'lib-d', sourceRevision: 'r5', reviewedRevision: 'r4', sourceName: 'Marsh Lore' },
};

describe('migrateWorld and content links', () => {
  it('loads a world whose dictionary and entity each follow a source', () => {
    const out = asLinked(migrateWorld(worldWith([linkedEntity], [linkedBook])));
    expect(out.entities?.[0].link).toEqual(linkedEntity.link);
    expect(out.dictionaries?.[0].link).toEqual(linkedBook.link);
    expect(contentLinkState(out.entities?.[0].link)).toBe('linked');
    expect(contentLinkState(out.dictionaries?.[0].link)).toBe('linked');
  });

  it('reads a local replacement back as one', () => {
    const replaced = { ...linkedEntity, link: { ...linkedEntity.link, localReplacement: true } };
    const out = asLinked(migrateWorld(worldWith([replaced], [linkedBook])));
    expect(contentLinkState(out.entities?.[0].link)).toBe('local-replacement');
  });

  it('leaves a world with no link records without any, and shows no state', () => {
    const out = asLinked(migrateWorld(worldWith(
      [{ id: 'e1', name: 'Wren' }],
      [{ id: 'b1', name: 'Marsh Lore', entries: [] }],
    )));
    expect('link' in (out.entities?.[0] ?? {})).toBe(false);
    expect('link' in (out.dictionaries?.[0] ?? {})).toBe(false);
    expect(contentLinkState(out.entities?.[0].link)).toBeNull();
    expect(contentLinkState(out.dictionaries?.[0].link)).toBeNull();
  });

  // `migrateWorld` shallow-copies, so a second run shares the first's nested arrays. Comparing against a
  // snapshot taken before that run is what makes an in-place mutation show up instead of matching itself.
  const twiceMatchesOnce = (raw: unknown) => {
    const once = migrateWorld(raw);
    const snapshot = structuredClone(once);
    expect(migrateWorld(once)).toEqual(snapshot);
    expect(once).toEqual(snapshot);
  };

  it('yields identical data when a world with no link records is loaded twice', () => {
    twiceMatchesOnce(worldWith([{ id: 'e1', name: 'Wren' }], [{ id: 'b1', name: 'Marsh Lore', entries: [] }]));
  });

  it('yields identical data when a world holding link records is loaded twice', () => {
    twiceMatchesOnce(worldWith([linkedEntity], [linkedBook]));
  });

  it('drops a link that is not a record, leaving the rest of the item intact', () => {
    const out = asLinked(migrateWorld(worldWith(
      [{ id: 'e1', name: 'Wren', aiDescription: 'A marsh guide', link: 'lib-e' }],
      [{ id: 'b1', name: 'Marsh Lore', entries: [], link: null }],
    )));
    expect(out.entities?.[0]).toEqual({ id: 'e1', name: 'Wren', aiDescription: 'A marsh guide' });
    expect('link' in (out.dictionaries?.[0] ?? {})).toBe(false);
  });

  it('leaves every other authored section of a linked world alone', () => {
    const raw = worldWith([linkedEntity], [linkedBook]) as Record<string, unknown>;
    const out = migrateWorld(raw) as unknown as Record<string, unknown>;
    expect(out.worldOverview).toEqual(raw.worldOverview);
    expect(out.stats).toEqual(raw.stats);
    expect(out.traits).toEqual(raw.traits);
  });
});

describe('world export and import carry the link record', () => {
  /** Export a world to its file text, then import that text the way a world file is imported. */
  const roundTrip = async (world: unknown): Promise<LinkedWorld> => {
    mocks.files.length = 0;
    await serializeWorldFile(world as World);
    return asLinked(migrateWorld(JSON.parse(mocks.files[0])));
  };

  it('writes the link record to the file and restores it on import', async () => {
    const out = await roundTrip(worldWith([linkedEntity], [linkedBook]));
    expect(out.entities?.[0].link).toEqual(linkedEntity.link);
    expect(out.dictionaries?.[0].link).toEqual(linkedBook.link);
  });

  it('preserves link fields this version does not know rather than stripping them', async () => {
    // A world written by a later version: its record carries a field this build has never heard of, and
    // round-tripping through here must not be what loses it.
    const future = { ...linkedEntity, link: { ...linkedEntity.link, pinnedRevision: 'r9', trustLevel: 3 } };
    const futureBook = { ...linkedBook, link: { ...linkedBook.link, pinnedRevision: 'r1' } };
    const out = await roundTrip(worldWith([future], [futureBook]));
    expect(out.entities?.[0].link).toEqual(future.link);
    expect(out.dictionaries?.[0].link).toEqual(futureBook.link);
  });

  it('exports a world with no link records without inventing any', async () => {
    const out = await roundTrip(worldWith(
      [{ id: 'e1', name: 'Wren' }],
      [{ id: 'b1', name: 'Marsh Lore', entries: [] }],
    ));
    expect('link' in (out.entities?.[0] ?? {})).toBe(false);
    expect('link' in (out.dictionaries?.[0] ?? {})).toBe(false);
  });
});

describe('saves are untouched by link records', () => {
  const saveWith = (books: unknown[]): SaveObject => ({
    version: APP_VERSION,
    currentState: {},
    stateHistory: [],
    messageHistory: [],
    dictionaries: books,
  } as unknown as SaveObject);

  it('loads a save written before link records existed unchanged', () => {
    const save = saveWith([{ id: 'b1', name: 'Marsh Lore', entries: [] }]);
    expect(migrateSave(save)).toEqual(save);
  });

  it('does not add a link to a save-carried book', () => {
    const out = migrateSave(saveWith([{ id: 'b1', name: 'Marsh Lore', entries: [] }]));
    expect('link' in (out.dictionaries?.[0] ?? {})).toBe(false);
  });

  it('carries a save-carried book link through verbatim', () => {
    // Gameplay never reads the record, but a book copied into a save carries whatever the world's did, and
    // dropping it here would lose provenance the world still holds.
    const out = migrateSave(saveWith([linkedBook]));
    expect((out.dictionaries?.[0] as unknown as Record<string, unknown>).link).toEqual(linkedBook.link);
  });
});
