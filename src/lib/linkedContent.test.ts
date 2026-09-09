import { describe, it, expect } from 'vitest';
import type { Dictionary, Entity } from '@/types';
import {
  applyLibraryUpdate, contentMatchesSource, libraryOwned, libraryRevision,
  linkToSource, markEdited, syncWorldContent, unlink,
} from './linkedContent';

const book = (over: Partial<Dictionary> = {}): Dictionary => ({
  id: 'book-1', name: 'Sedge Lore', entries: [{ id: 'e1', name: 'Sedge', key: ['sedge'], value: 'Reeds.' }], ...over,
});

const person = (over: Partial<Entity> = {}): Entity => ({
  id: 'ent-1', name: 'Wren', playerDescription: 'A ferryman.', ...over,
});

describe('libraryRevision', () => {
  it('reads the last save as the revision', () => {
    expect(libraryRevision({ editedAt: '2026-09-09T10:00:00.000Z', createdAt: '2026-01-01T00:00:00.000Z' }))
      .toBe('2026-09-09T10:00:00.000Z');
  });

  it('falls back to the download stamp, then to creation, for an item never edited here', () => {
    expect(libraryRevision({ downloadedAt: '2026-05-05T00:00:00.000Z', createdAt: '2026-01-01T00:00:00.000Z' }))
      .toBe('2026-05-05T00:00:00.000Z');
    expect(libraryRevision({ createdAt: '2026-01-01T00:00:00.000Z' })).toBe('2026-01-01T00:00:00.000Z');
  });

  it('reads an empty revision from a record with no stamp at all', () => {
    expect(libraryRevision({})).toBe('');
  });
});

describe('libraryOwned', () => {
  it('owns an item that was never downloaded', () => {
    expect(libraryOwned({}, 'user-1')).toBe(true);
  });

  it('owns a downloaded item the signed-in account published', () => {
    expect(libraryOwned({ sourceId: 'listing-1', sourceAuthorId: 'user-1' }, 'user-1')).toBe(true);
  });

  it('does not own the published item of another account', () => {
    expect(libraryOwned({ sourceId: 'listing-1', sourceAuthorId: 'user-2' }, 'user-1')).toBe(false);
  });

  it('does not own a downloaded item while nobody is signed in', () => {
    // Signed out, the account that published it cannot be matched, so its saves must not push anywhere.
    expect(libraryOwned({ sourceId: 'listing-1', sourceAuthorId: 'user-2' }, undefined)).toBe(false);
  });
});

describe('linkToSource', () => {
  it('records what the copy follows, the revision it holds, and the name as it read', () => {
    expect(linkToSource({ id: 'lib-1', name: 'Sedge Lore', revision: 'r1', owned: true }))
      .toEqual({ libraryId: 'lib-1', sourceName: 'Sedge Lore', sourceRevision: 'r1' });
  });

  it('carries the published listing when the library item has one', () => {
    expect(linkToSource({ id: 'lib-1', name: 'Sedge Lore', revision: 'r1', owned: false, sourceId: 'listing-1' }))
      .toEqual({ libraryId: 'lib-1', sourceId: 'listing-1', sourceName: 'Sedge Lore', sourceRevision: 'r1' });
  });

  it('marks a copy whose content already differs as a local replacement', () => {
    expect(linkToSource({ id: 'lib-1', name: 'Sedge Lore', revision: 'r1', owned: true }, true))
      .toMatchObject({ localReplacement: true });
  });
});

describe('markEdited', () => {
  it('turns an edited linked copy into a local replacement', () => {
    expect(markEdited(person({ link: { libraryId: 'lib-1' } })).link)
      .toEqual({ libraryId: 'lib-1', localReplacement: true });
  });

  it('leaves an independent copy independent', () => {
    expect(markEdited(person()).link).toBeUndefined();
  });

  it('returns the same object when the copy is already a local replacement', () => {
    const already = person({ link: { libraryId: 'lib-1', localReplacement: true } });
    expect(markEdited(already)).toBe(already);
  });
});

describe('unlink', () => {
  it('keeps the content and clears the record', () => {
    const copy = person({ name: 'Wren the Elder', link: { libraryId: 'lib-1' } });
    const result = unlink(copy);
    expect(result.link).toBeUndefined();
    expect(result.name).toBe('Wren the Elder');
  });
});

describe('contentMatchesSource', () => {
  it('matches a copy that differs only in the fields the world owns', () => {
    const copy = person({
      id: 'other-id', groupId: 'group-1', order: 4, locations: ['loc-1'], link: { libraryId: 'lib-1' },
    });
    expect(contentMatchesSource(copy, person())).toBe(true);
  });

  it('does not match a copy whose authored content differs', () => {
    expect(contentMatchesSource(person({ playerDescription: 'A smuggler.' }), person())).toBe(false);
  });

  it('ignores dictionary entry ids, which every copy mints for itself', () => {
    const copy = book({ id: 'other', entries: [{ id: 'fresh', name: 'Sedge', key: ['sedge'], value: 'Reeds.' }] });
    expect(contentMatchesSource(copy, book())).toBe(true);
  });

  it('does not match a book whose entry text differs', () => {
    const copy = book({ entries: [{ id: 'e1', name: 'Sedge', key: ['sedge'], value: 'Rushes.' }] });
    expect(contentMatchesSource(copy, book())).toBe(false);
  });
});

describe('applyLibraryUpdate', () => {
  it('takes the authored content of the source and keeps what the world owns', () => {
    const copy = person({
      id: 'world-copy', groupId: 'group-1', order: 2, locations: ['loc-1'],
      link: { libraryId: 'lib-1', sourceRevision: 'r1' },
    });
    const next = applyLibraryUpdate(copy, person({ id: 'lib-1', name: 'Wren the Elder' }), {
      id: 'lib-1', name: 'Wren the Elder', revision: 'r2', owned: true,
    });
    expect(next).toMatchObject({
      id: 'world-copy', groupId: 'group-1', order: 2, locations: ['loc-1'], name: 'Wren the Elder',
    });
    expect(next.link).toEqual({ libraryId: 'lib-1', sourceName: 'Wren the Elder', sourceRevision: 'r2' });
  });

  it('keeps the placeholders of the copy, which the world resolved when the copy arrived', () => {
    const copy = book({
      placeholders: [{ id: 'p-world', name: 'River', values: [{ id: 'v1', text: 'Sedge' }] }],
      link: { libraryId: 'lib-1' },
    });
    const next = applyLibraryUpdate(copy, book({ placeholders: [{ id: 'p-lib', name: 'River', values: [] }] }), {
      id: 'lib-1', name: 'Sedge Lore', revision: 'r2', owned: true,
    });
    expect(next.placeholders).toEqual(copy.placeholders);
  });

  it('reuses the entry ids of the copy in order, so a selected entry survives the update', () => {
    const copy = book({ entries: [{ id: 'own-1', name: 'Sedge', key: ['sedge'], value: 'Reeds.' }] });
    const next = applyLibraryUpdate(
      copy,
      book({
        entries: [
          { id: 'lib-1', name: 'Sedge', key: ['sedge'], value: 'Rushes.' },
          { id: 'lib-2', name: 'Ferry', key: ['ferry'], value: 'A punt.' },
        ],
      }),
      { id: 'lib-1', name: 'Sedge Lore', revision: 'r2', owned: true },
    );
    expect(next.entries[0]).toMatchObject({ id: 'own-1', value: 'Rushes.' });
    expect(next.entries[1].id).not.toBe('lib-2');
    expect(next.entries[1]).toMatchObject({ value: 'A punt.' });
  });
});

describe('syncWorldContent', () => {
  const source = { id: 'lib-1', name: 'Sedge Lore', revision: 'r2', owned: true, data: book({ name: 'Sedge Lore II' }) };

  it('updates a linked copy of an owned source whose revision moved on', () => {
    const world = { entities: [], dictionaries: [book({ link: { libraryId: 'lib-1', sourceRevision: 'r1' } })] };
    const result = syncWorldContent(world, [source]);
    expect(result.updated).toBe(1);
    expect(result.dictionaries[0].name).toBe('Sedge Lore II');
  });

  it('leaves a local replacement alone', () => {
    const world = {
      entities: [],
      dictionaries: [book({ link: { libraryId: 'lib-1', sourceRevision: 'r1', localReplacement: true } })],
    };
    const result = syncWorldContent(world, [source]);
    expect(result.updated).toBe(0);
    expect(result.dictionaries[0].name).toBe('Sedge Lore');
  });

  it('leaves a copy that already holds the current revision alone', () => {
    const world = { entities: [], dictionaries: [book({ link: { libraryId: 'lib-1', sourceRevision: 'r2' } })] };
    expect(syncWorldContent(world, [source]).updated).toBe(0);
  });

  it('leaves a copy of the source of another author alone, which only Check for Updates touches', () => {
    const world = { entities: [], dictionaries: [book({ link: { libraryId: 'lib-1', sourceRevision: 'r1' } })] };
    expect(syncWorldContent(world, [{ ...source, owned: false }]).updated).toBe(0);
  });

  it('leaves an independent copy and a copy of a deleted library item alone', () => {
    const world = {
      entities: [],
      dictionaries: [book(), book({ id: 'book-2', link: { libraryId: 'gone', sourceRevision: 'r1' } })],
    };
    expect(syncWorldContent(world, [source]).updated).toBe(0);
  });

  it('returns the same arrays when nothing changed, so an open does not dirty the world', () => {
    const world = { entities: [person()], dictionaries: [book()] };
    const result = syncWorldContent(world, [source]);
    expect(result.entities).toBe(world.entities);
    expect(result.dictionaries).toBe(world.dictionaries);
  });

  it('updates linked entities the same way', () => {
    const world = { entities: [person({ link: { libraryId: 'lib-2', sourceRevision: 'r1' } })], dictionaries: [] };
    const result = syncWorldContent(world, [
      { id: 'lib-2', name: 'Wren', revision: 'r5', owned: true, data: person({ name: 'Wren the Elder' }) },
    ]);
    expect(result.updated).toBe(1);
    expect(result.entities[0].name).toBe('Wren the Elder');
  });
});
