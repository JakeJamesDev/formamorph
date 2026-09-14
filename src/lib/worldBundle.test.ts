import { describe, expect, it } from 'vitest';
import {
  bundledContentLinked, bundledListingIds, bundledSources, embedBundled, followBundled,
  resolveBundledLinks, type LocalLibraryItem,
} from './worldBundle';
import { contentLinkState } from './contentLink';
import type { LibrarySource } from './linkedContent';
import type { ContentLink, Dictionary, Entity } from '@/types';

const entity = (id: string, link?: ContentLink, over: Partial<Entity> = {}): Entity => ({
  id, name: 'Sedge', aiDescription: 'What the file holds.', ...(link ? { link } : {}), ...over,
});

const book = (id: string, link?: ContentLink): Dictionary => ({
  id, name: 'Marsh Lore', entries: [], ...(link ? { link } : {}),
});

/** The library item a record names, holding the same content the file's copy does unless told otherwise. */
const item = (over: Partial<LocalLibraryItem> = {}): LocalLibraryItem => ({
  id: 'lib-1',
  name: 'Sedge',
  revision: 'r9',
  data: { id: 'lib-content', name: 'Sedge', aiDescription: 'What the file holds.' } as Entity,
  ...over,
});

describe('bundledListingIds', () => {
  it('names each listing a record points at, once', () => {
    const world = {
      entities: [entity('e1', { sourceId: 'listing-1' }), entity('e2', { sourceId: 'listing-1' })],
      dictionaries: [book('d1', { sourceId: 'listing-2' })],
    };

    expect(bundledListingIds(world)).toEqual(['listing-1', 'listing-2']);
  });

  it('names nothing for a world whose copies follow nothing', () => {
    expect(bundledListingIds({ entities: [entity('e1')], dictionaries: [] })).toEqual([]);
  });
});

describe('resolveBundledLinks', () => {
  it('leaves a record whose library item is on this machine exactly as it is', () => {
    const link: ContentLink = { libraryId: 'lib-1', sourceRevision: 'r2', sourceName: 'Sedge' };
    const world = { entities: [entity('e1', link)], dictionaries: [] };

    const resolved = resolveBundledLinks(world, [item()]);

    expect(resolved.entities[0].link).toEqual(link);
  });

  it('sets a record naming a library item this machine does not have aside as bundled', () => {
    const world = {
      entities: [entity('e1', { libraryId: 'their-lib', sourceName: 'Sedge', localReplacement: true })],
      dictionaries: [],
    };

    const resolved = resolveBundledLinks(world, []);

    expect(resolved.entities[0].link).toEqual({
      bundledFrom: 'their-lib', sourceName: 'Sedge', localReplacement: true,
    });
  });

  it('sets a record aside with its listing and revisions gone, so it reads as no link at all', () => {
    const world = {
      entities: [entity('e1', {
        libraryId: 'their-lib', sourceId: 'listing-1', sourceRevision: 'their-r1', reviewedRevision: 'their-r1',
        sourceName: 'Sedge',
      })],
      dictionaries: [],
    };

    const resolved = resolveBundledLinks(world, []);

    expect(resolved.entities[0].link).toEqual({ bundledFrom: 'their-lib', sourceName: 'Sedge' });
  });

  it('sets a record aside the same way embedding a linked one does', () => {
    const link: ContentLink = { libraryId: 'their-lib', sourceId: 'listing-1', sourceRevision: 'r1', sourceName: 'Sedge' };
    const world = { entities: [entity('e1', link)], dictionaries: [] };

    const fresh = resolveBundledLinks(world, []);
    const placed = followBundled(fresh, new Map([['their-lib', { id: 'mine-1', name: 'Sedge', revision: 'r1', owned: true }]]));

    // Placing renames the group after the local item; everything else must match.
    const { bundledFrom: _placed, ...embedded } = embedBundled(placed).entities[0].link!;
    const { bundledFrom: _theirs, ...set } = fresh.entities[0].link!;
    expect(embedded).toEqual(set);
  });

  it('repoints a record at the local item holding the same listing', () => {
    const world = {
      entities: [entity('e1', { libraryId: 'their-lib', sourceId: 'listing-1', sourceRevision: 'their-r1' })],
      dictionaries: [],
    };

    const resolved = resolveBundledLinks(world, [item({ sourceId: 'listing-1' })]);

    expect(resolved.entities[0].link).toMatchObject({
      libraryId: 'lib-1', sourceId: 'listing-1', sourceName: 'Sedge',
    });
  });

  it('records the group on a repointed copy, so the player can undo the link the import made', () => {
    const world = {
      entities: [entity('e1', { libraryId: 'their-lib', sourceId: 'listing-1' })],
      dictionaries: [],
    };

    const resolved = resolveBundledLinks(world, [item({ sourceId: 'listing-1' })]);

    expect(resolved.entities[0].link?.bundledFrom).toBe('lib-1');
    expect(bundledContentLinked(resolved)).toBe(true);
  });

  it('keeps the file revision on a repointed copy, so the local item still comes up for review', () => {
    const world = {
      entities: [entity('e1', { sourceId: 'listing-1', sourceRevision: 'their-r1' })],
      dictionaries: [],
    };

    const resolved = resolveBundledLinks(world, [item({ sourceId: 'listing-1' })]);

    expect(resolved.entities[0].link?.sourceRevision).toBe('their-r1');
  });

  it('marks a repointed copy whose content differs from the local item a local replacement', () => {
    const world = {
      entities: [entity('e1', { sourceId: 'listing-1' }, { aiDescription: 'What this file holds.' })],
      dictionaries: [],
    };

    const resolved = resolveBundledLinks(world, [item({ sourceId: 'listing-1' })]);

    expect(resolved.entities[0].link?.localReplacement).toBe(true);
    expect(resolved.entities[0].aiDescription).toBe('What this file holds.');
  });

  it('keeps a local replacement marked even where the local item matches it', () => {
    const world = {
      entities: [entity('e1', { sourceId: 'listing-1', localReplacement: true })],
      dictionaries: [],
    };

    const resolved = resolveBundledLinks(world, [item({ sourceId: 'listing-1' })]);

    expect(resolved.entities[0].link?.localReplacement).toBe(true);
  });

  it('treats an unreadable local item as a difference rather than as a match', () => {
    const world = { entities: [entity('e1', { sourceId: 'listing-1' })], dictionaries: [] };

    const resolved = resolveBundledLinks(world, [item({ sourceId: 'listing-1', data: undefined })]);

    expect(resolved.entities[0].link?.localReplacement).toBe(true);
  });

  it('leaves an independent copy and a record naming nothing alone', () => {
    const world = {
      entities: [entity('e1'), entity('e2', { sourceName: 'Sedge' })],
      dictionaries: [],
    };

    const resolved = resolveBundledLinks(world, [item()]);

    expect(resolved.entities[0].link).toBeUndefined();
    expect(resolved.entities[1].link).toEqual({ sourceName: 'Sedge' });
  });

  it('resolves dictionaries the same way as entities', () => {
    const world = { entities: [], dictionaries: [book('d1', { libraryId: 'their-lib' })] };

    expect(resolveBundledLinks(world, []).dictionaries[0].link).toEqual({ bundledFrom: 'their-lib' });
  });
});

describe('bundledSources', () => {
  it('groups the copies that followed one source into one row', () => {
    const world = {
      entities: [
        entity('e1', { bundledFrom: 'their-lib', sourceName: 'Sedge' }),
        entity('e2', { bundledFrom: 'their-lib', sourceName: 'Sedge' }),
      ],
      dictionaries: [],
    };

    expect(bundledSources(world)).toEqual([{
      bundledFrom: 'their-lib', kind: 'entity', name: 'Sedge', itemIds: ['e1', 'e2'], placed: false,
    }]);
  });

  it('reports a placed group as placed', () => {
    const world = {
      entities: [entity('e1', { bundledFrom: 'their-lib', libraryId: 'mine-1', sourceName: 'Sedge' })],
      dictionaries: [],
    };

    expect(bundledSources(world)[0].placed).toBe(true);
  });

  it('names a group from the copy where the record carries no source name', () => {
    const world = { entities: [], dictionaries: [book('d1', { bundledFrom: 'their-lib' })] };

    expect(bundledSources(world)[0]).toMatchObject({ kind: 'dictionary', name: 'Marsh Lore' });
  });

  it('reports nothing for a world with no bundled content', () => {
    expect(bundledSources({ entities: [entity('e1', { libraryId: 'lib-1' })], dictionaries: [] })).toEqual([]);
  });
});

describe('bundledContentLinked', () => {
  it('has no answer for a world carrying no bundled content', () => {
    expect(bundledContentLinked({ entities: [entity('e1')], dictionaries: [] })).toBeNull();
  });

  it('is false while a bundled source follows nothing and true once every one does', () => {
    const embedded = { entities: [entity('e1', { bundledFrom: 'their-lib' })], dictionaries: [] };
    const linked = {
      entities: [entity('e1', { bundledFrom: 'their-lib', libraryId: 'mine-1' })],
      dictionaries: [],
    };

    expect(bundledContentLinked(embedded)).toBe(false);
    expect(bundledContentLinked(linked)).toBe(true);
  });
});

describe('followBundled', () => {
  const placed = (over: Partial<LibrarySource> = {}): LibrarySource => ({
    id: 'mine-1', name: 'Sedge', revision: 'r1', owned: true, ...over,
  });

  it('points every copy of a group at the item placed for it', () => {
    const world = {
      entities: [
        entity('e1', { bundledFrom: 'their-lib' }),
        entity('e2', { bundledFrom: 'their-lib' }),
      ],
      dictionaries: [],
    };

    const linked = followBundled(world, new Map([['their-lib', placed()]]));

    expect(linked.entities.map((e) => e.link)).toEqual([
      { bundledFrom: 'mine-1', libraryId: 'mine-1', sourceName: 'Sedge', sourceRevision: 'r1' },
      { bundledFrom: 'mine-1', libraryId: 'mine-1', sourceName: 'Sedge', sourceRevision: 'r1' },
    ]);
  });

  it('keeps the connections the copy already made', () => {
    const world = {
      entities: [entity('e1', { bundledFrom: 'their-lib', connections: { 'their-ref': 'ours' } })],
      dictionaries: [],
    };

    const linked = followBundled(world, new Map([['their-lib', placed()]]));

    expect(linked.entities[0].link?.connections).toEqual({ 'their-ref': 'ours' });
  });

  it('leaves a local replacement marked after it links', () => {
    const world = {
      entities: [entity('e1', { bundledFrom: 'their-lib', localReplacement: true })],
      dictionaries: [],
    };

    const linked = followBundled(world, new Map([['their-lib', placed()]]));

    expect(linked.entities[0].link?.localReplacement).toBe(true);
  });

  it('marks a copy that differs from the item it now follows a local replacement', () => {
    const world = {
      entities: [entity('e1', { bundledFrom: 'their-lib' }, { aiDescription: 'Mine.' })],
      dictionaries: [],
    };

    const linked = followBundled(world, new Map([['their-lib', placed({
      data: { id: 'x', name: 'Sedge', aiDescription: "The author's." } as Entity,
    })]]));

    expect(linked.entities[0].link?.localReplacement).toBe(true);
  });

  it('carries a linked group back to the same item after it is embedded and linked again', () => {
    const world = { entities: [entity('e1', { bundledFrom: 'their-lib' })], dictionaries: [] };

    const once = followBundled(world, new Map([['their-lib', placed()]]));
    const again = followBundled(embedBundled(once), new Map([['mine-1', placed()]]));

    expect(again.entities[0].link?.libraryId).toBe('mine-1');
  });

  it('leaves a group nothing was placed for alone', () => {
    const world = { entities: [entity('e1', { bundledFrom: 'other-lib' })], dictionaries: [] };

    expect(followBundled(world, new Map([['their-lib', placed()]])).entities[0].link)
      .toEqual({ bundledFrom: 'other-lib' });
  });
});

describe('embedBundled', () => {
  it('releases a placed copy and keeps its content and its bundle', () => {
    const world = {
      entities: [entity('e1', {
        bundledFrom: 'mine-1', libraryId: 'mine-1', sourceRevision: 'r1', sourceName: 'Sedge',
      })],
      dictionaries: [],
    };

    const embedded = embedBundled(world);

    expect(embedded.entities[0].link).toEqual({ bundledFrom: 'mine-1', sourceName: 'Sedge' });
    expect(embedded.entities[0].aiDescription).toBe('What the file holds.');
  });

  it('takes the listing off too, so an embedded copy follows nothing at all', () => {
    const world = {
      entities: [entity('e1', {
        bundledFrom: 'mine-1', libraryId: 'mine-1', sourceId: 'listing-1', sourceName: 'Sedge',
      })],
      dictionaries: [],
    };

    const embedded = embedBundled(world);

    expect(embedded.entities[0].link?.sourceId).toBeUndefined();
    expect(contentLinkState(embedded.entities[0].link)).toBeNull();
  });

  it('leaves a copy that was never bundled following its item', () => {
    const world = { entities: [entity('e1', { libraryId: 'mine-1' })], dictionaries: [] };

    expect(embedBundled(world).entities[0].link).toEqual({ libraryId: 'mine-1' });
  });
});
