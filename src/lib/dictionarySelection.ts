import { randomUUID } from "@/lib/uuid";
import type { Dictionary, DictionaryMetadata } from '@/types';

/**
 * One row in the pre-game dictionary-selection step: a world book or a library dictionary, with its
 * current enabled toggle. `key` is a composite dnd id (`world:<id>` / `library:<id>`) so the two stores
 * never collide when their underlying ids overlap.
 */
export interface DictionarySelectionItem {
  key: string;
  book: Dictionary;
  source: 'world' | 'library';
  enabled: boolean;
  /** Total entries (from the world book, or the library metadata's `entryCount`). */
  entryCount: number;
}

/** Composite dnd/react key for a selection row, unique across the world and library stores. */
export const selectionKey = (source: 'world' | 'library', id: string): string => `${source}:${id}`;

/**
 * Whether the dictionary step is worth showing at all: only when there's a real choice — more than one
 * world book, or at least one downloaded library dictionary. A single-book world with an empty library
 * skips the step (mirrors how the location step is skipped for single-location worlds).
 */
export function shouldShowDictionaryStep(
  worldBooks: Dictionary[],
  libraryMeta: DictionaryMetadata[],
): boolean {
  return worldBooks.length > 1 || libraryMeta.length > 0;
}

/**
 * Seed the selection list: world books first (each honoring its authored `enabled`), then library
 * dictionaries appended disabled (opt-in — the player enables the ones they want for this run).
 */
export function buildInitialSelection(
  worldBooks: Dictionary[],
  libraryMeta: DictionaryMetadata[],
): DictionarySelectionItem[] {
  const world: DictionarySelectionItem[] = worldBooks.map((book) => ({
    key: selectionKey('world', book.id),
    book,
    source: 'world',
    enabled: book.enabled !== false,
    entryCount: book.entries.length,
  }));
  const library: DictionarySelectionItem[] = libraryMeta.map((meta) => ({
    key: selectionKey('library', meta.id),
    book: { id: meta.id, name: meta.name, enabled: true, entries: [] },
    source: 'library',
    enabled: false,
    entryCount: meta.entryCount ?? 0,
  }));
  return [...world, ...library];
}

/**
 * Produce the runtime `Dictionary[]` from the reordered/toggled list. In list order, keep only enabled
 * items: world books pass through as-is (stable ids preserved) with `enabled: true`; each enabled library
 * item is replaced by its fetched full book (from `resolvedLibraryBooks`, keyed by the library id) with
 * fresh book + entry ids so the world copy is independent of the library original. Empty-tolerant.
 */
export function finalizeSelection(
  items: DictionarySelectionItem[],
  resolvedLibraryBooks: Map<string, Dictionary>,
): Dictionary[] {
  const result: Dictionary[] = [];
  for (const item of items) {
    if (!item.enabled) continue;
    if (item.source === 'world') {
      result.push({ ...item.book, enabled: true });
      continue;
    }
    const resolved = resolvedLibraryBooks.get(item.book.id);
    if (!resolved) continue; // library record vanished between listing and confirm
    result.push({
      ...resolved,
      id: randomUUID(),
      enabled: true,
      entries: resolved.entries.map((e) => ({ ...e, id: randomUUID() })),
    });
  }
  return result;
}
