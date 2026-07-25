import { describe, it, expect } from 'vitest';
import {
  shouldShowDictionaryStep,
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

describe('shouldShowDictionaryStep', () => {
  it('hides for a single world book and empty library', () => {
    expect(shouldShowDictionaryStep([book('a')], [])).toBe(false);
  });

  it('shows for more than one world book', () => {
    expect(shouldShowDictionaryStep([book('a'), book('b')], [])).toBe(true);
  });

  it('shows when the library is non-empty', () => {
    expect(shouldShowDictionaryStep([book('a')], [meta('lib')])).toBe(true);
  });
});

describe('buildInitialSelection', () => {
  it('lists world books first (honoring enabled), then library appended disabled', () => {
    const items = buildInitialSelection(
      [book('a'), book('b', { enabled: false })],
      [meta('lib1'), meta('lib2', { entryCount: 5 })],
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

  it('skips an enabled library item whose record is missing', () => {
    const out = finalizeSelection(
      [{ key: 'library:gone', book: book('gone', { entries: [] }), source: 'library', enabled: true, entryCount: 1 }],
      resolved,
    );
    expect(out).toEqual([]);
  });

  it('returns an empty array when nothing is enabled', () => {
    expect(finalizeSelection([], resolved)).toEqual([]);
  });
});
