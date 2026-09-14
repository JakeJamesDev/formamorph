import { libraryLines } from '@/lib/librarySources';
import { randomUUID } from "@/lib/uuid";
import type { Dictionary, DictionaryMetadata } from '@/types';

/**
 * One dictionary row in the Library Additions workspace: a world book or a library dictionary, with its
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
  /** World rows only: this copy follows a library book, whose own row the list leaves out. */
  linked?: boolean;
  /** Library rows only: who wrote the book, so two of one name stay apart. */
  authorLine?: string;
  /** Library rows only: where the book came from. */
  sourceLine?: string;
}

/** Composite dnd/react key for a selection row, unique across the world and library stores. */
export const selectionKey = (source: 'world' | 'library', id: string): string => `${source}:${id}`;

/**
 * Whether dictionary choices make the setup workspace worth showing: more than one world book, or at
 * least one downloaded library dictionary.
 */
export function shouldShowDictionaryChoices(
  worldBooks: Dictionary[],
  libraryMeta: DictionaryMetadata[],
): boolean {
  return worldBooks.length > 1 || libraryMeta.length > 0;
}

/**
 * Which library books this world already holds a copy of. A world copy that names a book the library no
 * longer has follows nothing the player can see, so its id is not one of these.
 */
function followedLibraryIds(worldBooks: Dictionary[], libraryMeta: DictionaryMetadata[]): Set<string> {
  const present = new Set(libraryMeta.map((meta) => meta.id));
  return new Set(worldBooks
    .map((book) => book.link?.libraryId)
    .filter((id): id is string => !!id && present.has(id)));
}

/**
 * Seed the selection list: world books first (each honoring its authored `enabled`), then library
 * dictionaries appended disabled (opt-in — the player enables the ones they want for this run).
 *
 * A library book the world already holds a copy of gets no row of its own. Enabling both would put the
 * same entries in the run twice, so the world's copy stands for it and carries the `linked` mark. A copy
 * the player has edited is still that one copy, so it hides the library row the same way.
 *
 * `userId` decides whether a library book reads as the player's own; omit it and the signed-in account
 * answers.
 */
export function buildInitialSelection(
  worldBooks: Dictionary[],
  libraryMeta: DictionaryMetadata[],
  userId?: string,
): DictionarySelectionItem[] {
  const followed = followedLibraryIds(worldBooks, libraryMeta);
  const world: DictionarySelectionItem[] = worldBooks.map((book) => ({
    key: selectionKey('world', book.id),
    book,
    source: 'world',
    enabled: book.enabled !== false,
    entryCount: book.entries.length,
    ...(book.link?.libraryId && followed.has(book.link.libraryId) ? { linked: true } : {}),
  }));
  const library: DictionarySelectionItem[] = libraryMeta
    .filter((meta) => !followed.has(meta.id))
    .map((meta) => ({
      key: selectionKey('library', meta.id),
      book: {
        id: meta.id,
        name: meta.name,
        description: meta.description,
        thumbnail: meta.thumbnail,
        enabled: true,
        entries: [],
      },
      source: 'library',
      enabled: false,
      entryCount: meta.entryCount ?? 0,
      ...libraryLines(meta, userId),
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
