import { describe, it, expect } from 'vitest';
import { reorderBooks, moveEntryInBooks, duplicateEntryInBooks } from './dictionaryTree';
import type { Dictionary, DictionaryEntry } from '@/types';

const e = (id: string, position?: 'before' | 'after'): DictionaryEntry => ({ id, name: id, key: [id], value: id, ...(position ? { position } : {}) });
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
  it('reorders within a zone by inserting before the target entry (upward drag)', () => {
    const books = [bk('b1', [e('a', 'after'), e('b', 'after'), e('c', 'after')])];
    const out = moveEntryInBooks(books, 'c', 'b1', 'after', 'a');
    expect(out[0].entries.map((x) => x.id)).toEqual(['c', 'a', 'b']);
  });

  it('a downward same-zone drag lands after the over entry, matching the arrayMove preview', () => {
    // Drag `a` down over `c`. The sortable preview shows [b, c, a]; insert-before would wrongly give [b,a,c].
    const books = [bk('b1', [e('a', 'after'), e('b', 'after'), e('c', 'after')])];
    const out = moveEntryInBooks(books, 'a', 'b1', 'after', 'c');
    expect(out[0].entries.map((x) => x.id)).toEqual(['b', 'c', 'a']);
  });

  it('a downward drag over the immediate next entry swaps the pair', () => {
    // Drag `a` over `b` → preview [b, a, c]; insert-before would give the no-op [a, b, c].
    const books = [bk('b1', [e('a', 'after'), e('b', 'after'), e('c', 'after')])];
    const out = moveEntryInBooks(books, 'a', 'b1', 'after', 'b');
    expect(out[0].entries.map((x) => x.id)).toEqual(['b', 'a', 'c']);
  });

  it('is a no-op when an entry is dropped on itself (in-place drag)', () => {
    // dnd-kit fires drag-end with over === active when you pick up an entry and don't move it. Without a
    // guard, stripping then re-finding `over` (which is the stripped entry) appended it to the zone's end.
    const books = [bk('b1', [e('a', 'after'), e('b', 'after'), e('c', 'after')])];
    const out = moveEntryInBooks(books, 'b', 'b1', 'after', 'b');
    expect(out).toBe(books); // unchanged reference
    expect(out[0].entries.map((x) => x.id)).toEqual(['a', 'b', 'c']);
  });

  it('treats an unset position as the default (Foreground) zone on a downward drag', () => {
    // Real-world repro: an untouched entry has `position: undefined`; a previously-moved one carries an
    // explicit 'after'. Both live in the Foreground zone, so a downward drag must land after `over`. A strict
    // `===` on position misreads the mix as cross-zone and wrongly inserts before → [b, a, c].
    const books = [bk('b1', [e('a'), e('b'), e('c', 'after')])];
    const out = moveEntryInBooks(books, 'a', 'b1', 'after', 'c');
    expect(out[0].entries.map((x) => x.id)).toEqual(['b', 'c', 'a']);
  });

  it('a cross-zone move still inserts before the over entry (not treated as downward)', () => {
    // `a` (before zone) dropped onto `c` (after zone): a genuine zone change, insert-before is correct.
    const books = [bk('b1', [e('a', 'before'), e('b', 'after'), e('c', 'after')])];
    const out = moveEntryInBooks(books, 'a', 'b1', 'after', 'c');
    expect(out[0].entries.map((x) => `${x.id}:${x.position}`)).toEqual(['b:after', 'a:after', 'c:after']);
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
