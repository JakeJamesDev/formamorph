import { describe, it, expect } from 'vitest';
import { reorderBooks, moveEntryInBooks, duplicateEntryInBooks } from './dictionaryTree';
import type { Dictionary, DictionaryEntry } from '@/types';

const e = (id: string, position?: 'before' | 'after'): DictionaryEntry => ({ id, name: id, key: id, value: id, ...(position ? { position } : {}) });
const bk = (id: string, entries: DictionaryEntry[]): Dictionary => ({ id, name: id, enabled: true, entries });

describe('reorderBooks', () => {
  const books = [bk('b1', []), bk('b2', []), bk('b3', [])];

  it('moves a book to the target slot', () => {
    expect(reorderBooks(books, 'b1', 'b3').map((b) => b.id)).toEqual(['b2', 'b3', 'b1']);
  });

  it('returns the same array on a no-op or unknown id', () => {
    expect(reorderBooks(books, 'b1', 'b1')).toBe(books);
    expect(reorderBooks(books, 'nope', 'b2')).toBe(books);
  });
});

describe('moveEntryInBooks', () => {
  it('reorders within a zone by inserting before the target entry', () => {
    const books = [bk('b1', [e('a', 'after'), e('b', 'after'), e('c', 'after')])];
    const out = moveEntryInBooks(books, 'c', 'b1', 'after', 'a');
    expect(out[0].entries.map((x) => x.id)).toEqual(['c', 'a', 'b']);
  });

  it('re-places an entry to the other zone and keeps zones contiguous (before then after)', () => {
    const books = [bk('b1', [e('a', 'before'), e('b', 'after')])];
    const out = moveEntryInBooks(books, 'b', 'b1', 'before', null);
    expect(out[0].entries.map((x) => x.position)).toEqual(['before', 'before']);
    expect(out[0].entries.map((x) => x.id)).toEqual(['a', 'b']);
  });

  it('moves an entry across books, setting its position on arrival', () => {
    const books = [bk('b1', [e('a', 'after')]), bk('b2', [e('z', 'after')])];
    const out = moveEntryInBooks(books, 'a', 'b2', 'before', 'z');
    expect(out[0].entries).toEqual([]);
    expect(out[1].entries.map((x) => ({ id: x.id, position: x.position }))).toEqual([
      { id: 'a', position: 'before' },
      { id: 'z', position: 'after' },
    ]);
  });

  it('appends to a zone end when there is no over-entry', () => {
    const books = [bk('b1', [e('a', 'after')]), bk('b2', [])];
    const out = moveEntryInBooks(books, 'a', 'b2', 'after', null);
    expect(out[1].entries.map((x) => x.id)).toEqual(['a']);
  });

  it('returns the input unchanged when the entry or target book is missing', () => {
    const books = [bk('b1', [e('a', 'after')])];
    expect(moveEntryInBooks(books, 'ghost', 'b1', 'after', null)).toBe(books);
    expect(moveEntryInBooks(books, 'a', 'nope', 'after', null)).toBe(books);
  });
});

describe('duplicateEntryInBooks', () => {
  it('inserts a "(Copy)" right after the original in the same book with a fresh id', () => {
    const books = [bk('b1', [e('a', 'after'), e('b', 'after')])];
    const { books: out, newId } = duplicateEntryInBooks(books, 'a');
    expect(out[0].entries.map((x) => x.id)).toEqual(['a', newId, 'b']);
    expect(out[0].entries[1].name).toBe('a (Copy)');
    expect(newId).not.toBe('a');
  });

  it('returns null newId when the entry is not found', () => {
    const books = [bk('b1', [e('a', 'after')])];
    expect(duplicateEntryInBooks(books, 'ghost').newId).toBeNull();
  });
});
