// The lore overlay: what scripts switched on dictionary entries in play, laid over the books every reader reads.

import type { Dictionary, DictionaryEntry, LoreEntryToggle, LoreToggles } from '@/types';
import { flattenEnabledBookEntries } from './dictionaryUtils';

/** One entry field a run wrote, by book id and entry id. */
export interface LoreWrite {
  book: string;
  entry: string;
  field: keyof LoreEntryToggle;
  value: boolean;
}

export const NO_LORE_TOGGLES: LoreToggles = {};

/** Each entry under its name, in first-seen order: an enabled entry takes a name over a disabled one, and the
 *  later of two equals wins (Q26). */
export function namedEntries<E extends { name: string; enabled: boolean }>(entries: readonly E[]): Map<string, E> {
  const named = new Map<string, E>();
  for (const entry of entries) {
    const held = named.get(entry.name);
    if (!held || entry.enabled || !held.enabled) named.set(entry.name, entry);
  }
  return named;
}

/** `books` with each entry's `enabled` and `constant` as the overlay sets them; the same array when it sets none. */
export function withLoreToggles<B extends { id: string; entries?: readonly DictionaryEntry[] }>(
  books: readonly B[], toggles: LoreToggles | undefined,
): readonly B[] {
  if (!toggles || !Object.keys(toggles).length) return books;
  return books.map((book) => {
    const set = toggles[book.id]?.entries;
    if (!set || !book.entries) return book;
    return { ...book, entries: book.entries.map((entry) => (set[entry.id] ? { ...entry, ...set[entry.id] } : entry)) };
  });
}

/** The entries the prompts read: every on book's entries in book order, as the overlay sets them. */
export const loreEntries = (books: readonly Dictionary[], toggles: LoreToggles | undefined): DictionaryEntry[] =>
  flattenEnabledBookEntries([...withLoreToggles(books, toggles)]);

/** `toggles` with `writes` applied in order, the later write winning; the same object when they change nothing. */
export function withLoreWrites(toggles: LoreToggles, writes: readonly LoreWrite[] | undefined): LoreToggles {
  const changed = (writes ?? []).filter(({ book, entry, field, value }) => toggles[book]?.entries?.[entry]?.[field] !== value);
  if (!changed.length) return toggles;
  const next: Record<string, LoreToggles[string]> = { ...toggles };
  for (const { book, entry, field, value } of changed) {
    const held = next[book] ?? {};
    next[book] = { ...held, entries: { ...held.entries, [entry]: { ...held.entries?.[entry], [field]: value } } };
  }
  return next;
}
