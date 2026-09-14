import { describe, expect, it } from 'vitest';
import { readComponentFileLinks, sourceFromLink } from './componentFileLinks';

describe('sourceFromLink', () => {
  it('carries every identifying field of the record', () => {
    expect(sourceFromLink({
      libraryId: 'lib-1', sourceId: 'listing-1', sourceName: 'Sedge', sourceRevision: 'r2',
    })).toEqual({ libraryId: 'lib-1', sourceId: 'listing-1', sourceName: 'Sedge', sourceRevision: 'r2' });
  });

  it('omits a record that identifies nothing', () => {
    expect(sourceFromLink({ sourceName: 'Sedge', localReplacement: true })).toBeUndefined();
    expect(sourceFromLink(undefined)).toBeUndefined();
  });

  it('drops a blank field rather than writing an empty identity', () => {
    expect(sourceFromLink({ libraryId: 'lib-1', sourceId: '  ', sourceName: '' }))
      .toEqual({ libraryId: 'lib-1' });
  });
});

describe('readComponentFileLinks', () => {
  it('reads back what an export wrote', () => {
    const written = {
      name: 'Sedge',
      source: { sourceId: 'listing-1', sourceName: 'Sedge', sourceRevision: 'r2' },
      associations: [{ id: 'world-1', name: 'Sedge Landing' }],
    };

    expect(readComponentFileLinks(written)).toEqual({
      source: { sourceId: 'listing-1', sourceName: 'Sedge', sourceRevision: 'r2' },
      associations: [{ id: 'world-1', name: 'Sedge Landing' }],
    });
  });

  it('reads a file with no relationship blocks as having none', () => {
    expect(readComponentFileLinks({ name: 'Sedge' })).toEqual({});
    expect(readComponentFileLinks(null)).toEqual({});
  });

  it('drops a source that identifies nothing and an association with no id', () => {
    expect(readComponentFileLinks({
      source: { sourceName: 'Sedge' },
      associations: [{ name: 'Nameless' }, 'world-2', { id: 'world-3' }],
    })).toEqual({ associations: [{ id: 'world-3', name: 'Untitled world' }] });
  });
});
