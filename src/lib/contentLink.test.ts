import { describe, it, expect } from 'vitest';
import type { ContentLink } from '@/types';
import {
  CONTENT_LINK_LABELS, contentLinkState, contentLinkSourceName, normalizeLinkedItem,
} from './contentLink';

describe('contentLinkState', () => {
  it('reads no state from a copy that carries no record', () => {
    expect(contentLinkState(undefined)).toBeNull();
  });

  it('reads no state from a record naming neither a library item nor a listing', () => {
    // A record has to identify what it follows; a name alone never establishes a link.
    expect(contentLinkState({ sourceName: 'Sedge Lore' })).toBeNull();
    expect(contentLinkState({ localReplacement: true })).toBeNull();
    expect(contentLinkState({ libraryId: '', sourceId: '' })).toBeNull();
  });

  it('reads Linked from a record naming a library item', () => {
    expect(contentLinkState({ libraryId: 'lib-1' })).toBe('linked');
  });

  it('reads Linked from a record naming only a published listing', () => {
    expect(contentLinkState({ sourceId: 'listing-1' })).toBe('linked');
  });

  it('reads Local replacement from an edited copy that still tracks its source', () => {
    expect(contentLinkState({ libraryId: 'lib-1', localReplacement: true })).toBe('local-replacement');
  });

  it('treats an explicit localReplacement false as still following the source', () => {
    expect(contentLinkState({ libraryId: 'lib-1', localReplacement: false })).toBe('linked');
  });

  it('labels both states the way the spec words them', () => {
    expect(CONTENT_LINK_LABELS.linked).toBe('Linked');
    expect(CONTENT_LINK_LABELS['local-replacement']).toBe('Local replacement');
  });
});

describe('contentLinkSourceName', () => {
  it('gives the carried name', () => {
    expect(contentLinkSourceName({ libraryId: 'lib-1', sourceName: 'Sedge Lore' })).toBe('Sedge Lore');
  });

  it('gives nothing rather than an id when no name was carried', () => {
    expect(contentLinkSourceName({ libraryId: 'lib-1' })).toBeNull();
    expect(contentLinkSourceName({ libraryId: 'lib-1', sourceName: '  ' })).toBeNull();
  });

  it('gives nothing for a copy with no record', () => {
    expect(contentLinkSourceName(undefined)).toBeNull();
  });
});

describe('a record whose fields were written by something else', () => {
  // The container guard lets any record through, so the readers are what stand between a hand-edited or
  // later-version world and a row that throws while it renders.
  const foreign = (over: Record<string, unknown>) => over as unknown as ContentLink;

  it('does not read a non-string name as one', () => {
    expect(contentLinkSourceName(foreign({ libraryId: 'lib-1', sourceName: 7 }))).toBeNull();
    expect(contentLinkSourceName(foreign({ libraryId: 'lib-1', sourceName: { text: 'x' } }))).toBeNull();
    expect(contentLinkSourceName(foreign({ libraryId: 'lib-1', sourceName: ['x'] }))).toBeNull();
  });

  it('does not accept a non-string id as naming a source', () => {
    expect(contentLinkState(foreign({ libraryId: 1 }))).toBeNull();
    expect(contentLinkState(foreign({ sourceId: { id: 'x' } }))).toBeNull();
  });

  it('still reads the fields it can, beside ones it cannot', () => {
    const link = foreign({ libraryId: 'lib-1', sourceId: 4, sourceName: 'Sedge Lore' });
    expect(contentLinkState(link)).toBe('linked');
    expect(contentLinkSourceName(link)).toBe('Sedge Lore');
  });
});

describe('normalizeLinkedItem', () => {
  it('returns the same reference for an item with no record', () => {
    const item = { id: 'e1', name: 'Wren' };
    expect(normalizeLinkedItem(item)).toBe(item);
  });

  it('returns the same reference for an item whose record is already a record', () => {
    const item = { id: 'e1', name: 'Wren', link: { libraryId: 'lib-1' } };
    expect(normalizeLinkedItem(item)).toBe(item);
  });

  it('preserves fields this version does not know about', () => {
    const item = { id: 'e1', name: 'Wren', link: { libraryId: 'lib-1', futureField: 'keep me' } };
    const next = normalizeLinkedItem(item);
    expect(next.link).toEqual({ libraryId: 'lib-1', futureField: 'keep me' });
  });

  it('drops a record that is not a record, which nothing downstream could read', () => {
    expect(normalizeLinkedItem({ id: 'e1', link: 'lib-1' })).toEqual({ id: 'e1' });
    expect(normalizeLinkedItem({ id: 'e1', link: null })).toEqual({ id: 'e1' });
    expect(normalizeLinkedItem({ id: 'e1', link: ['lib-1'] })).toEqual({ id: 'e1' });
  });

  it('leaves the rest of the item untouched when it drops a bad record', () => {
    const next = normalizeLinkedItem({ id: 'e1', name: 'Wren', aiDescription: 'A marsh guide', link: 7 });
    expect(next).toEqual({ id: 'e1', name: 'Wren', aiDescription: 'A marsh guide' });
  });

  it('is idempotent: a second run changes nothing and keeps the reference', () => {
    const once = normalizeLinkedItem({ id: 'e1', link: 'lib-1' });
    expect(normalizeLinkedItem(once)).toBe(once);
  });
});

describe('state and name read together', () => {
  it('describes a linked copy the header can name', () => {
    const link: ContentLink = { libraryId: 'lib-1', sourceRevision: 'r3', sourceName: 'Sedge Lore' };
    expect(contentLinkState(link)).toBe('linked');
    expect(contentLinkSourceName(link)).toBe('Sedge Lore');
  });
});
