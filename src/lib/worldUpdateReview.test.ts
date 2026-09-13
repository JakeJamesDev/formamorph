import { describe, it, expect } from 'vitest';
import {
  buildWorldUpdateReview, defaultWorldUpdateAction, keepInstalledCopies, protectedCopies,
  type HeldSource, type ProtectedCopy, type WorldUpdateRow,
} from './worldUpdateReview';
import type { DependencyRow } from './worldDependencies';
import type { Dictionary, Entity, Placeholder, World } from '@/types';

/** A required source the server still resolves, as a dependency row. */
const dependency = (id: string, name: string, updatedAt: string): DependencyRow => ({
  id, status: 'ok', listing: { _id: id, name, kind: 'entity', updated_at: updatedAt },
});

const held = (sourceId: string, revision: string, sourceUpdatedAt: string): HeldSource =>
  ({ sourceId, revision, sourceUpdatedAt });

/** Two listing versions, as real stamps: the comparison parses them as dates. */
const T1 = '2026-09-01T00:00:00.000Z';
const T2 = '2026-09-08T00:00:00.000Z';

const entity = (id: string, name: string, link?: Entity['link']): Entity =>
  ({ id, name, ...(link ? { link } : {}) }) as Entity;

const row = (rows: WorldUpdateRow[], sourceId: string) => rows.find((r) => r.sourceId === sourceId);

describe('buildWorldUpdateReview', () => {
  it('lists a component whose listing republished after the library took its copy', () => {
    const world = {
      entities: [entity('e1', 'Marsh Warden', { libraryId: 'lib-a', sourceId: 'src-a', sourceRevision: 'R1' })],
    };
    const rows = buildWorldUpdateReview(world, [dependency('src-a', 'Marsh Warden', T2)], [held('src-a', 'R1', T1)]);

    expect(row(rows, 'src-a')).toMatchObject({ rowKind: 'changed', state: 'linked', itemId: 'e1' });
  });

  it('omits an unmodified copy whose listing has not moved', () => {
    const world = {
      entities: [entity('e1', 'Marsh Warden', { libraryId: 'lib-a', sourceId: 'src-a', sourceRevision: 'R1' })],
    };
    const rows = buildWorldUpdateReview(world, [dependency('src-a', 'Marsh Warden', T1)], [held('src-a', 'R1', T1)]);

    expect(rows).toEqual([]);
  });

  it('lists a local replacement whose listing has not moved, so the update cannot discard it', () => {
    const world = {
      entities: [entity('e1', 'Marsh Warden', {
        libraryId: 'lib-a', sourceId: 'src-a', sourceRevision: 'R1', localReplacement: true,
      })],
    };
    const rows = buildWorldUpdateReview(world, [dependency('src-a', 'Marsh Warden', T1)], [held('src-a', 'R1', T1)]);

    expect(row(rows, 'src-a')).toMatchObject({ rowKind: 'changed', state: 'local-replacement' });
    expect(defaultWorldUpdateAction(row(rows, 'src-a')!)).toBe('keep');
  });

  it('lists a copy that is behind its own library item, even where the listing stood still', () => {
    // The player updated the library item from somewhere else and left this world behind.
    const world = {
      entities: [entity('e1', 'Marsh Warden', { libraryId: 'lib-a', sourceId: 'src-a', sourceRevision: 'R1' })],
    };
    const rows = buildWorldUpdateReview(world, [dependency('src-a', 'Marsh Warden', T1)], [held('src-a', 'R2', T1)]);

    expect(row(rows, 'src-a')?.rowKind).toBe('changed');
  });

  it('says nothing about a revision the player already answered for', () => {
    const world = {
      entities: [entity('e1', 'Marsh Warden', {
        libraryId: 'lib-a', sourceId: 'src-a', sourceRevision: 'R1', reviewedRevision: 'R2',
      })],
    };
    const rows = buildWorldUpdateReview(world, [dependency('src-a', 'Marsh Warden', T1)], [held('src-a', 'R2', T1)]);

    expect(rows).toEqual([]);
  });

  it('lists a source the world now requires and holds no copy of', () => {
    const rows = buildWorldUpdateReview({ entities: [] }, [dependency('src-b', 'Fen Lore', T2)], []);

    expect(row(rows, 'src-b')).toMatchObject({ rowKind: 'added', name: 'Fen Lore' });
    expect(defaultWorldUpdateAction(row(rows, 'src-b')!)).toBe('update');
  });

  it('lists a copy whose listing left the required set', () => {
    const world = {
      entities: [entity('e1', 'Marsh Warden', {
        libraryId: 'lib-a', sourceId: 'src-a', sourceRevision: 'R1', sourceName: 'Marsh Warden',
      })],
    };
    const rows = buildWorldUpdateReview(world, [], [held('src-a', 'R1', T1)]);

    expect(row(rows, 'src-a')).toMatchObject({ rowKind: 'dropped', name: 'Marsh Warden' });
    expect(defaultWorldUpdateAction(row(rows, 'src-a')!)).toBe('unlink');
  });

  it('ignores a copy that follows a library item alone, which no listing can speak for', () => {
    const world = { entities: [entity('e1', 'My Own', { libraryId: 'lib-x', sourceRevision: 'R1' })] };

    expect(buildWorldUpdateReview(world, [], [])).toEqual([]);
  });

  it('lists a new required source the server could not resolve, rather than leaving it out', () => {
    // Omitting it would promise a review of the new required set and withhold the one row that fails.
    const gone: DependencyRow = { id: 'src-c', status: 'not_found' };
    const rows = buildWorldUpdateReview({ entities: [] }, [gone], []);

    expect(row(rows, 'src-c')).toMatchObject({ rowKind: 'added', unavailable: true });
  });
});

describe('protectedCopies', () => {
  const changed = (state: 'linked' | 'local-replacement'): WorldUpdateRow =>
    ({ sourceId: 'src-a', name: 'Marsh Warden', rowKind: 'changed', library: 'entity', state });
  const dropped: WorldUpdateRow =
    { sourceId: 'src-d', name: 'Fen Dialect', rowKind: 'dropped', library: 'dictionary', state: 'linked' };
  const landed = { sourceId: 'src-a', libraryId: 'lib-a', name: 'Marsh Warden', revision: 'R2' };

  it('protects nothing for a row the player updated and the run installed', () => {
    expect(protectedCopies([changed('linked')], { 'src-a': 'update' }, [landed])).toEqual([]);
  });

  it('protects a row whose source would not install, whatever the player chose', () => {
    // The author's version is not there to take, so the copy keeps what it has and the failure is reported.
    expect(protectedCopies([changed('linked')], { 'src-a': 'update' }, []))
      .toEqual([{ sourceId: 'src-a', action: 'keep' }]);
  });

  it('carries the library item into a Keep Mine, so the copy still follows it', () => {
    expect(protectedCopies([changed('local-replacement')], {}, [landed]))
      .toEqual([{ sourceId: 'src-a', action: 'keep', installed: landed }]);
  });

  it('marks a dropped requirement embedded, and no other row', () => {
    const held = protectedCopies([changed('linked'), dropped], { 'src-a': 'keep' }, [landed]);

    expect(held).toEqual([
      { sourceId: 'src-a', action: 'keep', installed: landed },
      { sourceId: 'src-d', action: 'unlink', embedded: true },
    ]);
  });
});

/** A world as the update writes it: the author's new content, with room for what the review protects. */
const worldWith = (over: Partial<World>): World => ({
  id: 'w1',
  worldOverview: { name: 'Sedge Landing' },
  stats: [], locations: [], entities: [], traits: [], statUpdates: [], dictionaries: [],
  ...over,
}) as World;

const placeholder = (id: string, name: string): Placeholder =>
  ({ id, name, values: [{ id: `${id}-v`, text: name }] });

describe('keepInstalledCopies', () => {
  const link = { libraryId: 'lib-a', sourceId: 'src-a', sourceRevision: 'R1', sourceName: 'Marsh Warden' };
  const mine = {
    ...entity('e-mine', 'Marsh Warden', { ...link, localReplacement: true }),
    aiDescription: 'My own warden.',
  } as Entity;
  const theirs = {
    ...entity('e-theirs', 'Marsh Warden', { ...link, sourceRevision: 'R2' }),
    aiDescription: 'The warden as the author wrote it.',
  } as Entity;

  const protect = (action: ProtectedCopy['action'], installed?: ProtectedCopy['installed']): ProtectedCopy[] =>
    [{ sourceId: 'src-a', action, ...(installed ? { installed } : {}) }];

  /** What a dropped requirement protects: the author may have embedded their copy with no record. */
  const protectDropped = (): ProtectedCopy[] => [{ sourceId: 'src-a', action: 'unlink', embedded: true }];

  it('keeps the player content over the author version and records the revision they declined', () => {
    const next = keepInstalledCopies(
      worldWith({ entities: [theirs] }), { entities: [mine] },
      protect('keep', { sourceId: 'src-a', libraryId: 'lib-a', name: 'Marsh Warden', revision: 'R2' }),
    );

    expect(next.entities).toHaveLength(1);
    expect(next.entities[0].aiDescription).toBe('My own warden.');
    expect(next.entities[0].link).toMatchObject({
      libraryId: 'lib-a', reviewedRevision: 'R2', localReplacement: true,
    });
  });

  it('leaves an unprotected copy exactly as the author published it', () => {
    const next = keepInstalledCopies(worldWith({ entities: [theirs] }), { entities: [mine] }, []);

    expect(next.entities[0].aiDescription).toBe('The warden as the author wrote it.');
  });

  it('unlinks a protected copy and keeps its content', () => {
    const next = keepInstalledCopies(worldWith({ entities: [theirs] }), { entities: [mine] }, protect('unlink'));

    expect(next.entities[0].aiDescription).toBe('My own warden.');
    expect(next.entities[0].link).toBeUndefined();
  });

  it('keeps a dropped requirement the author removed from the world outright', () => {
    const next = keepInstalledCopies(worldWith({ entities: [] }), { entities: [mine] }, protect('unlink'));

    expect(next.entities).toHaveLength(1);
    expect(next.entities[0].aiDescription).toBe('My own warden.');
    expect(next.entities[0].link).toBeUndefined();
  });

  it('stands in for the copy a dropped requirement leaves embedded, rather than adding a second one', () => {
    // Publishing an unchecked source embeds its content with the link record stripped, so the incoming
    // copy names no listing at all. Matching it by name is what keeps the world from holding two wardens.
    const { link: _embedded, ...embedded } = theirs;
    const next = keepInstalledCopies(
      worldWith({ entities: [embedded as Entity] }), { entities: [mine] }, protectDropped(),
    );

    expect(next.entities).toHaveLength(1);
    expect(next.entities[0].aiDescription).toBe('My own warden.');
  });

  it('never takes the slot of an unrelated namesake when the source is still required', () => {
    // A still-required source always publishes a copy naming it, so a copy naming nothing is somebody
    // else's. Matching this one by name would silently replace content the update was never about.
    const namesake = {
      ...entity('e-namesake', 'Marsh Warden'), aiDescription: 'An unrelated warden the author wrote.',
    } as Entity;
    // `keep` with no `embedded`: the row is a changed requirement, not a dropped one.
    const next = keepInstalledCopies(
      worldWith({ entities: [namesake] }), { entities: [mine] }, [{ sourceId: 'src-a', action: 'keep' }],
    );

    expect(next.entities).toHaveLength(2);
    expect(next.entities[0].aiDescription).toBe('An unrelated warden the author wrote.');
  });

  it('never takes the slot of a copy that follows a different listing', () => {
    const other = {
      ...entity('e-other', 'Marsh Warden', { libraryId: 'lib-z', sourceId: 'src-z', sourceRevision: 'R1' }),
      aiDescription: 'A different warden, from a different source.',
    } as Entity;
    const next = keepInstalledCopies(worldWith({ entities: [other] }), { entities: [mine] }, protectDropped());

    expect(next.entities).toHaveLength(2);
    expect(next.entities[0].aiDescription).toBe('A different warden, from a different source.');
  });

  it('carries over a shared placeholder the kept copy reaches and the new world lacks', () => {
    const shared = placeholder('ph-1', 'Fen Dialect');
    const chipped = { ...mine, aiDescription: 'Speaks {{ph:ph-1:world:pl-1}}.' } as Entity;
    const next = keepInstalledCopies(
      worldWith({ entities: [theirs], placeholders: [placeholder('ph-2', 'Weather')] }),
      { entities: [chipped], placeholders: [shared, placeholder('ph-9', 'Unused')] },
      protect('keep'),
    );

    expect(next.placeholders?.map((p) => p.id)).toEqual(['ph-2', 'ph-1']);
  });

  it('leaves a shared placeholder the new world already has alone', () => {
    const shared = placeholder('ph-1', 'Fen Dialect');
    const chipped = { ...mine, aiDescription: 'Speaks {{ph:ph-1:world:pl-1}}.' } as Entity;
    const next = keepInstalledCopies(
      worldWith({ entities: [theirs], placeholders: [shared] }),
      { entities: [chipped], placeholders: [shared] },
      protect('keep'),
    );

    expect(next.placeholders).toHaveLength(1);
  });

  it('drops a folder and a location the new world no longer has', () => {
    const placed = { ...mine, groupId: 'g-old', locations: ['loc-old', 'loc-kept'] } as Entity;
    const next = keepInstalledCopies(
      worldWith({
        entities: [theirs],
        entityGroups: [{ id: 'g-new', name: 'Wardens', parentId: null }],
        locations: [{ id: 'loc-kept', name: 'The Landing' }] as World['locations'],
      }),
      { entities: [placed] },
      protect('keep'),
    );

    expect(next.entities[0].groupId).toBeUndefined();
    expect(next.entities[0].locations).toEqual(['loc-kept']);
  });

  it('protects a book the same way, in the dictionary list', () => {
    const book = {
      id: 'd-mine', name: 'Marsh Lore', description: 'My notes.',
      entries: [{ id: 'x', name: 'Reeds', key: ['reeds'], value: 'Mine.' }],
      link: { libraryId: 'lib-b', sourceId: 'src-b', sourceRevision: 'R1' },
    } as Dictionary;
    const authored = { ...book, id: 'd-theirs', description: 'Their notes.' } as Dictionary;

    const next = keepInstalledCopies(
      worldWith({ dictionaries: [authored] }), { dictionaries: [book] },
      [{ sourceId: 'src-b', action: 'keep' }],
    );

    expect(next.dictionaries[0].description).toBe('My notes.');
  });
});
