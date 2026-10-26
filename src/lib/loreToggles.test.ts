import { describe, expect, it } from 'vitest';
import { loreEntries, playthroughBooks, withLoreWrites } from './loreToggles';
import type { Dictionary } from '@/types';

const book = (id: string, over: Partial<Dictionary> = {}): Dictionary =>
  ({ id, name: id, entries: [{ id: `${id}-e`, name: 'E', key: ['k'], value: `${id}-text` }], ...over });

describe('playthroughBooks (Q36, Q51)', () => {
  const lore = book('lore');
  const shelf = book('shelf');
  const chapter = book('chapter', { enabled: false });
  const almanac = book('almanac-copy', { enabled: true });

  it('adds each shipped-off book the save lacks after the save’s books, and leaves out an on book the save lacks', () => {
    expect(playthroughBooks([almanac, lore], [lore, chapter, shelf]).map((b) => b.id)).toEqual(['almanac-copy', 'lore', 'chapter']);
  });

  it('reads a shipped-off book the save holds off from the current world, after the save’s books', () => {
    const stale = { ...chapter, entries: [] };
    expect(playthroughBooks([stale, lore], [lore, chapter])).toEqual([lore, chapter]);
  });

  it('keeps a shipped-off book the player switched on in the save’s place', () => {
    const picked = { ...chapter, enabled: true };
    expect(playthroughBooks([picked, lore], [lore, chapter])).toEqual([picked, lore]);
  });
});

describe('book toggles (Q37, Q38, Q40)', () => {
  const books = [book('lore'), book('chapter', { enabled: false })];

  it('puts a book’s entries in the prompts as the overlay switches it', () => {
    expect(loreEntries(books, { chapter: { enabled: true }, lore: { enabled: false } }).map((e) => e.value)).toEqual(['chapter-text']);
  });

  it('applies book writes beside entry writes, the later winning, and keeps the object when nothing changes', () => {
    const start = { lore: { entries: { 'lore-e': { constant: true } } } };
    const next = withLoreWrites(start, [
      { book: 'lore', field: 'enabled', value: true },
      { book: 'lore', field: 'enabled', value: false },
      { book: 'chapter', entry: 'chapter-e', field: 'enabled', value: true },
    ]);
    expect(next).toEqual({ lore: { enabled: false, entries: { 'lore-e': { constant: true } } }, chapter: { entries: { 'chapter-e': { enabled: true } } } });
    expect(withLoreWrites(next, [{ book: 'lore', field: 'enabled', value: false }])).toBe(next);
  });
});
