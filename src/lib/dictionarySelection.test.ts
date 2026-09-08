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
