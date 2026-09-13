import { describe, it, expect } from 'vitest';
import {
  declaresDependencies, hasLinkedContent, linkedContentRows, requiredSourceIds, sourcesToPublish,
  worldPublishContent,
} from './publishLinks';
import type { LibraryItemSummary } from './librarySources';
import type { Dictionary, Entity } from '@/types';

const libraryItem = (over: Partial<LibraryItemSummary> & { id: string }): LibraryItemSummary => ({
  kind: 'dictionary', name: 'Shared Lore', revision: 'r1', owned: true,
  authorLine: 'You', sourceLine: 'Your library', ...over,
});

const book = (over: Partial<Dictionary> = {}): Dictionary =>
  ({ id: 'd-local', name: 'Shared Lore', entries: [], ...over } as Dictionary);

const person = (over: Partial<Entity> = {}): Entity =>
  ({ id: 'e-local', name: 'Sedge', ...over } as Entity);

describe('hasLinkedContent', () => {
  it('finds a link in either list', () => {
    expect(hasLinkedContent({ entities: [person({ link: { libraryId: 'lib-e' } })] })).toBe(true);
    expect(hasLinkedContent({ dictionaries: [book({ link: { libraryId: 'lib-d' } })] })).toBe(true);
  });

  it('is false for a world of independent copies, an empty world, and no world at all', () => {
    expect(hasLinkedContent({ entities: [person()], dictionaries: [book()] })).toBe(false);
    expect(hasLinkedContent({})).toBe(false);
    expect(hasLinkedContent(null)).toBe(false);
  });

  it('is false for a record that names nothing to follow', () => {
    expect(hasLinkedContent({ dictionaries: [book({ link: { sourceName: 'Shared Lore' } })] })).toBe(false);
  });
});

describe('linkedContentRows', () => {
  it('skips a record that names nothing to follow', () => {
    const world = { dictionaries: [book({ link: { sourceName: 'Shared Lore' } })] };

    expect(linkedContentRows(world, [], null)).toEqual([]);
  });

  it('lists one row per followed library item and skips independent copies', () => {
    const world = {
      entities: [person({ link: { libraryId: 'lib-e' } }), person({ id: 'e2' })],
      dictionaries: [book({ link: { libraryId: 'lib-d' } })],
    };
    const library = [libraryItem({ id: 'lib-e', kind: 'entity', name: 'Sedge' }), libraryItem({ id: 'lib-d' })];

    const rows = linkedContentRows(world, library, null);

    expect(rows.map((row) => [row.libraryId, row.kind, row.name]))
      .toEqual([['lib-e', 'entity', 'Sedge'], ['lib-d', 'dictionary', 'Shared Lore']]);
  });

  it('collapses two copies that follow one source into one row', () => {
    const world = {
      dictionaries: [book({ link: { libraryId: 'lib-d' } }), book({ id: 'd2', link: { libraryId: 'lib-d' } })],
    };

    expect(linkedContentRows(world, [libraryItem({ id: 'lib-d' })], null)).toHaveLength(1);
  });

  it('checks every row on a first publication', () => {
    const world = { dictionaries: [book({ link: { libraryId: 'lib-d' } })] };

    expect(linkedContentRows(world, [libraryItem({ id: 'lib-d' })], null)[0].required).toBe(true);
  });

  it('follows the listing on a later publication, checked and unchecked alike', () => {
    const world = {
      dictionaries: [
        book({ link: { libraryId: 'kept' } }),
        book({ id: 'd2', link: { libraryId: 'dropped' } }),
      ],
    };
    const library = [
      libraryItem({ id: 'kept', sourceId: 'listing-kept' }),
      libraryItem({ id: 'dropped', sourceId: 'listing-dropped' }),
    ];

    const rows = linkedContentRows(world, library, ['listing-kept']);

    expect(rows.map((row) => row.required)).toEqual([true, false]);
  });

  it('leaves an unpublished source unchecked on a later publication', () => {
    // A listing that required it would name it, so the author left it embedded last time. Checking it
    // again would publish a listing for their library item without them asking.
    const world = { dictionaries: [book({ link: { libraryId: 'lib-d' } })] };

    const rows = linkedContentRows(world, [libraryItem({ id: 'lib-d' })], []);

    expect(rows[0]).toMatchObject({ state: 'unpublished', required: false });
  });

  it('defaults a source published with the world to unlisted', () => {
    const world = { dictionaries: [book({ link: { libraryId: 'lib-d' } })] };

    expect(linkedContentRows(world, [libraryItem({ id: 'lib-d' })], null)[0].visibility).toBe('unlisted');
  });

  it('reads a published source through the library item, whichever author owns it', () => {
    const world = { dictionaries: [book({ link: { libraryId: 'lib-d' } })] };
    const library = [libraryItem({ id: 'lib-d', owned: false, sourceId: 'listing-other' })];

    expect(linkedContentRows(world, library, null)[0])
      .toMatchObject({ state: 'published', sourceId: 'listing-other' });
  });

  it('cannot require a copy whose library item is gone and which names no listing', () => {
    const world = { dictionaries: [book({ link: { libraryId: 'lib-gone', sourceName: 'Shared Lore' } })] };

    expect(linkedContentRows(world, [], null)[0]).toMatchObject({
      state: 'unavailable', required: false, name: 'Shared Lore',
    });
  });

  it('still requires a deleted library item that the copy names a listing for', () => {
    const world = { dictionaries: [book({ link: { libraryId: 'lib-gone', sourceId: 'listing-d' } })] };

    expect(linkedContentRows(world, [], null)[0]).toMatchObject({ state: 'published', required: true });
  });
});

describe('requiredSourceIds', () => {
  it('names every checked row, taking a source published in this run from the resolved map', () => {
    const rows = linkedContentRows(
      { dictionaries: [book({ link: { libraryId: 'fresh' } }), book({ id: 'd2', link: { libraryId: 'old' } })] },
      [libraryItem({ id: 'fresh' }), libraryItem({ id: 'old', sourceId: 'listing-old' })],
      null,
    );

    expect(requiredSourceIds(rows, { fresh: 'listing-fresh' })).toEqual(['listing-fresh', 'listing-old']);
  });

  it('leaves out an unchecked row', () => {
    const rows = linkedContentRows(
      { dictionaries: [book({ link: { libraryId: 'old' } })] },
      [libraryItem({ id: 'old', sourceId: 'listing-old' })],
      [],
    );

    expect(requiredSourceIds(rows)).toEqual([]);
  });
});

describe('sourcesToPublish', () => {
  const rows = () => linkedContentRows(
    {
      dictionaries: [
        book({ link: { libraryId: 'fresh' } }),
        book({ id: 'd2', link: { libraryId: 'listed' } }),
        book({ id: 'd3', link: { libraryId: 'skipped' } }),
      ],
    },
    [libraryItem({ id: 'fresh' }), libraryItem({ id: 'listed', sourceId: 'listing' }), libraryItem({ id: 'skipped' })],
    null,
  );

  it('names only the checked sources that have no listing yet', () => {
    const checked = rows().map((row) => (row.libraryId === 'skipped' ? { ...row, required: false } : row));

    expect(sourcesToPublish(checked).map((row) => row.libraryId)).toEqual(['fresh']);
  });

  it('skips a source already published in this run, so a retry does not publish it twice', () => {
    expect(sourcesToPublish(rows(), { fresh: 'listing-fresh' }).map((row) => row.libraryId)).toEqual(['skipped']);
  });
});

describe('declaresDependencies', () => {
  it('states a set the author asked for', () => {
    expect(declaresDependencies(['listing-d'], [])).toBe(true);
    expect(declaresDependencies(['listing-d'], null)).toBe(true);
  });

  it('says nothing when the listing requires none and this publish requires none', () => {
    expect(declaresDependencies([], [])).toBe(false);
  });

  it('clears a listing that still requires something the world no longer links', () => {
    expect(declaresDependencies([], ['listing-old'])).toBe(true);
  });

  it('leaves a listing alone when its own set could not be read', () => {
    // Null is unknown, not empty. Clearing here would drop required content over a failed request.
    expect(declaresDependencies([], null)).toBe(false);
  });
});

describe('worldPublishContent', () => {
  const world = () => ({
    entities: [person({
      link: { libraryId: 'lib-e', sourceName: 'Sedge', sourceRevision: 'r7', connections: { a: 'b' } },
    })],
    dictionaries: [book({ link: { libraryId: 'lib-d' } })],
  });
  const library = [libraryItem({ id: 'lib-e', kind: 'entity' }), libraryItem({ id: 'lib-d' })];

  it('names the listing on a required copy and drops the publisher-only fields', () => {
    const rows = linkedContentRows(world(), library, null);

    const published = worldPublishContent(world(), rows, { 'lib-e': 'listing-e', 'lib-d': 'listing-d' });

    expect(published.entities[0].link)
      .toEqual({ sourceId: 'listing-e', sourceName: 'Sedge', connections: { a: 'b' } });
  });

  it('embeds an unchecked copy with no record at all', () => {
    const rows = linkedContentRows(world(), library, null).map((row) => ({ ...row, required: false }));

    const published = worldPublishContent(world(), rows);

    expect(published.entities[0]).not.toHaveProperty('link');
    expect(published.dictionaries[0]).not.toHaveProperty('link');
    expect(published.dictionaries[0].name).toBe('Shared Lore');
  });

  it('leaves the author their own links', () => {
    const source = world();
    const rows = linkedContentRows(source, library, null).map((row) => ({ ...row, required: false }));

    worldPublishContent(source, rows);

    expect(source.entities[0].link).toMatchObject({ libraryId: 'lib-e' });
  });

  it('leaves an independent copy exactly as it is', () => {
    const source = { entities: [person()] };

    expect(worldPublishContent(source, [])).toEqual(source);
  });
});
