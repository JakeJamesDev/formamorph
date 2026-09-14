import { describe, it, expect } from 'vitest';
import {
  shouldShowDictionaryChoices,
  buildInitialSelection,
  finalizeSelection,
  selectionKey,
  type DictionarySelectionItem,
} from './dictionarySelection';
import type { Dictionary, DictionaryMetadata } from '@/types';

const book = (id: string, over: Partial<Dictionary> = {}): Dictionary => ({
  id,
  name: id,
  entries: [{ id: `${id}-e1`, name: 'E1', key: ['k'], value: 'v' }],
  ...over,
});

const meta = (id: string, over: Partial<DictionaryMetadata> = {}): DictionaryMetadata => ({
  id,
  name: id,
  entryCount: 3,
  ...over,
});

describe('shouldShowDictionaryChoices', () => {
  it('hides for a single world book and empty library', () => {
    expect(shouldShowDictionaryChoices([book('a')], [])).toBe(false);
  });

  it('shows for more than one world book', () => {
    expect(shouldShowDictionaryChoices([book('a'), book('b')], [])).toBe(true);
  });

  it('shows when the library is non-empty', () => {
    expect(shouldShowDictionaryChoices([book('a')], [meta('lib')])).toBe(true);
  });
});

describe('buildInitialSelection', () => {
  it('lists world books first (honoring enabled), then library appended disabled', () => {
    const items = buildInitialSelection(
      [book('a'), book('b', { enabled: false })],
      [meta('lib1', { description: 'Library notes', thumbnail: 'cover.png' }), meta('lib2', { entryCount: 5 })],
    );
    expect(items.map((i) => i.key)).toEqual([
      selectionKey('world', 'a'),
      selectionKey('world', 'b'),
      selectionKey('library', 'lib1'),
      selectionKey('library', 'lib2'),
    ]);
    expect(items[0]).toMatchObject({ source: 'world', enabled: true, entryCount: 1 });
    expect(items[1]).toMatchObject({ source: 'world', enabled: false });
    expect(items[2]).toMatchObject({ source: 'library', enabled: false, entryCount: 3 });
    expect(items[2].book).toMatchObject({ description: 'Library notes', thumbnail: 'cover.png' });
    expect(items[3].entryCount).toBe(5);
  });

  it('treats a missing library entryCount as 0', () => {
    const items = buildInitialSelection([], [meta('lib', { entryCount: undefined })]);
    expect(items[0].entryCount).toBe(0);
  });

  it('leaves out the library row a world copy already follows, and marks that copy Linked', () => {
    const items = buildInitialSelection(
      [book('a', { link: { libraryId: 'lib1' } }), book('b')],
      [meta('lib1'), meta('lib2')],
    );
    expect(items.map((i) => i.key)).toEqual([
      selectionKey('world', 'a'),
      selectionKey('world', 'b'),
      selectionKey('library', 'lib2'),
    ]);
    expect(items[0].linked).toBe(true);
    expect(items[1].linked).toBeUndefined();
  });

  it('leaves out the library row a local replacement follows, which is still one copy', () => {
    const items = buildInitialSelection(
      [book('a', { link: { libraryId: 'lib1', localReplacement: true } })],
      [meta('lib1')],
    );
    expect(items.map((i) => i.key)).toEqual([selectionKey('world', 'a')]);
    expect(items[0].linked).toBe(true);
  });

  it('shows both rows for an independent copy of a library book', () => {
    const items = buildInitialSelection([book('a')], [meta('lib1')]);
    expect(items.map((i) => i.source)).toEqual(['world', 'library']);
    expect(items[0].linked).toBeUndefined();
  });

  it('reads a padded library id the way publishing reads it, so both agree on what is followed', () => {
    const items = buildInitialSelection([book('a', { link: { libraryId: '  lib1  ' } })], [meta('lib1')]);
    expect(items.map((i) => i.key)).toEqual([selectionKey('world', 'a')]);
    expect(items[0].linked).toBe(true);
  });

  it('keeps a world row plain when the library item it names is gone', () => {
    const items = buildInitialSelection([book('a', { link: { libraryId: 'deleted' } })], [meta('lib1')]);
    expect(items.map((i) => i.source)).toEqual(['world', 'library']);
    expect(items[0].linked).toBeUndefined();
  });

  it('tells two library books of one name apart by their author and source lines', () => {
    const items = buildInitialSelection([], [
      meta('mine', { name: 'Sedge Lore' }),
      meta('theirs', { name: 'Sedge Lore', sourceId: 'listing-1', sourceAuthorName: 'Wren' }),
    ], 'user-1');
    expect(items[0]).toMatchObject({ authorLine: 'You', sourceLine: 'Your library' });
    expect(items[1]).toMatchObject({ authorLine: 'Wren', sourceLine: 'Community Creations' });
  });

  it('reads a downloaded book the signed-in account published as its own', () => {
    const items = buildInitialSelection([], [
      meta('lib', { sourceId: 'listing-1', sourceAuthorId: 'user-1', sourceAuthorName: 'Wren' }),
    ], 'user-1');
    expect(items[0]).toMatchObject({ authorLine: 'You', sourceLine: 'Community Creations' });
  });

  it('gives a world book no author or source line, which the picker words for itself', () => {
    const items = buildInitialSelection([book('a')], []);
    expect(items[0].authorLine).toBeUndefined();
    expect(items[0].sourceLine).toBeUndefined();
  });
});

describe('finalizeSelection', () => {
  const resolved = new Map<string, Dictionary>([['lib1', book('lib1', { description: 'notes' })]]);

  it('keeps only enabled items, in list order', () => {
    const items: DictionarySelectionItem[] = [
      { key: 'world:b', book: book('b'), source: 'world', enabled: true, entryCount: 1 },
      { key: 'world:a', book: book('a'), source: 'world', enabled: false, entryCount: 1 },
    ];
    const out = finalizeSelection(items, resolved);
    expect(out.map((d) => d.name)).toEqual(['b']);
  });

  it('passes world books through with stable ids and enabled:true', () => {
    const wb = book('a', { enabled: false });
    const out = finalizeSelection(
      [{ key: 'world:a', book: wb, source: 'world', enabled: true, entryCount: 1 }],
      resolved,
    );
    expect(out[0].id).toBe('a');
    expect(out[0].enabled).toBe(true);
    expect(out[0].entries[0].id).toBe('a-e1');
  });

  it('replaces enabled library items with a fresh-id copy of the resolved book', () => {
    const out = finalizeSelection(
      [{ key: 'library:lib1', book: book('lib1', { entries: [] }), source: 'library', enabled: true, entryCount: 1 }],
      resolved,
    );
    expect(out[0].name).toBe('lib1');
    expect(out[0].description).toBe('notes');
    expect(out[0].id).not.toBe('lib1');
    expect(out[0].entries[0].id).not.toBe('lib1-e1');
    expect(out[0].enabled).toBe(true);
  });

  it('keeps mixed-source order and identity isolated when source ids collide', () => {
    const authored = book('shared', { name: 'Authored' });
    const library = book('shared', { name: 'Library' });
    const items: DictionarySelectionItem[] = [
      { key: 'library:shared', book: book('shared', { entries: [] }), source: 'library', enabled: true, entryCount: 1 },
      { key: 'world:shared', book: authored, source: 'world', enabled: true, entryCount: 1 },
    ];
    const out = finalizeSelection(items, new Map([['shared', library]]));

    expect(out.map((item) => item.name)).toEqual(['Library', 'Authored']);
    expect(out[0].id).not.toBe('shared');
    expect(out[0].entries[0].id).not.toBe('shared-e1');
    expect(out[1].id).toBe('shared');
    expect(out[1].entries[0].id).toBe('shared-e1');
    expect(authored).toEqual(book('shared', { name: 'Authored' }));
    expect(library).toEqual(book('shared', { name: 'Library' }));
  });

  it('skips an enabled library item whose record is missing', () => {
    const out = finalizeSelection(
      [{ key: 'library:gone', book: book('gone', { entries: [] }), source: 'library', enabled: true, entryCount: 1 }],
      resolved,
    );
    expect(out).toEqual([]);
  });

  it('returns an empty array when nothing is enabled', () => {
    expect(finalizeSelection([
      { key: 'world:a', book: book('a'), source: 'world', enabled: false, entryCount: 1 },
      { key: 'library:lib1', book: book('lib1'), source: 'library', enabled: false, entryCount: 1 },
    ], resolved)).toEqual([]);
  });
});
