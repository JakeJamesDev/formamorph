// The lore overlay: what scripts switched on dictionary books and entries in play, laid over the books every reader reads.

import type { Dictionary, DictionaryEntry, LoreEntryToggle, LoreToggles } from '@/types';
import { flattenEnabledBookEntries } from './dictionaryUtils';

/** One field a run wrote, by book id: an entry's field by entry id, or the book's own `enabled` with no entry. */
export type LoreWrite =
  | { book: string; entry: string; field: keyof LoreEntryToggle; value: boolean }
  | { book: string; entry?: undefined; field: 'enabled'; value: boolean };

/** `write` with its four fields alone, so a row the save keeps carries nothing else. */
export const bareLoreWrite = (write: LoreWrite): LoreWrite => (write.entry === undefined
  ? { book: write.book, field: write.field, value: write.value }
  : { book: write.book, entry: write.entry, field: write.field, value: write.value });

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

/** The books a playthrough has: the save's on books, then each book the world ships off that the save lacks
 *  on, from the current world and off, in authored order (Q36, Q51). A book the world has on and the save lacks
 *  is the player's to leave out. */
export function playthroughBooks(runtime: readonly Dictionary[], worldBooks: readonly Dictionary[]): readonly Dictionary[] {
  const on = new Set(runtime.filter((book) => book.enabled !== false).map((book) => book.id));
  const shippedOff = worldBooks.filter((book) => book.enabled === false && !on.has(book.id));
  if (!shippedOff.length) return runtime;
  const replaced = new Set(shippedOff.map((book) => book.id));
  return [...runtime.filter((book) => !replaced.has(book.id)), ...shippedOff];
}

/** `books` with each book's `enabled` and each entry's `enabled` and `constant` as the overlay sets them; the
 *  same array when it sets none. */
export function withLoreToggles<B extends { id: string; enabled?: boolean; entries?: readonly DictionaryEntry[] }>(
  books: readonly B[], toggles: LoreToggles | undefined,
): readonly B[] {
  if (!toggles || !Object.keys(toggles).length) return books;
  return books.map((book) => {
    const toggle = toggles[book.id];
    if (!toggle) return book;
    const set = toggle.entries;
    const entries = set && book.entries?.map((entry) => (set[entry.id] ? { ...entry, ...set[entry.id] } : entry));
    return { ...book, ...(toggle.enabled === undefined ? {} : { enabled: toggle.enabled }), ...(entries ? { entries } : {}) };
  });
}

/** The entries the prompts read: every on book's entries in book order, as the overlay sets them. */
export const loreEntries = (books: readonly Dictionary[], toggles: LoreToggles | undefined): DictionaryEntry[] =>
  flattenEnabledBookEntries([...withLoreToggles(books, toggles)]);

const heldValue = (toggles: LoreToggles, { book, entry, field }: LoreWrite) =>
  (entry === undefined ? toggles[book]?.enabled : toggles[book]?.entries?.[entry]?.[field]);

/** `toggles` with `writes` applied in order, the later write winning; the same object when they change nothing. */
export function withLoreWrites(toggles: LoreToggles, writes: readonly LoreWrite[] | undefined): LoreToggles {
  const changed = (writes ?? []).filter((write) => heldValue(toggles, write) !== write.value);
  if (!changed.length) return toggles;
  const next: Record<string, LoreToggles[string]> = { ...toggles };
  for (const { book, entry, field, value } of changed) {
    const held = next[book] ?? {};
    next[book] = entry === undefined
      ? { ...held, enabled: value }
      : { ...held, entries: { ...held.entries, [entry]: { ...held.entries?.[entry], [field]: value } } };
  }
  return next;
}
