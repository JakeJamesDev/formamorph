import { randomUUID } from "@/lib/uuid";
import type { Dictionary, DictionaryEntry, Placeholder } from '@/types';
import { APP_VERSION, WORLD_FILE_KIND, SAVE_FILE_KIND, migrateCarriedPlaceholders, migrateEntryKeys } from './version';
import { convertLorebook } from './lorebookImport';
import { carriedPlaceholders, sharedPlaceholdersUsed } from './placeholderHomes';
import { portablePlaceholders } from './placeholderGroups';

/** Discriminator identifying a standalone one-book dictionary file (vs. a world or save file). */
export const DICTIONARY_FILE_KIND = 'dictionary' as const;

/** The standalone export shape for a single book. */
export interface DictionaryFile {
  formamorphKind: typeof DICTIONARY_FILE_KIND;
  version: string;
  name: string;
  description?: string;
  enabled?: boolean;
  /** Listing tags, as the catalog filters on. */
  tags?: string[];
  /** Cover art, inline. Absent when the book has none, which is what keeps a text-only book text-sized. */
  thumbnail?: string;
  entries: DictionaryEntry[];
  /** The book's own placeholder defs, as they are (see lib/placeholders). A file with no
   *  `sharedPlaceholders` carries everything its entries use here, and reads it all as owned. */
  placeholders?: Placeholder[];
  /** The shared defs the book's entries and its own placeholders reach, so they resolve after import. */
  sharedPlaceholders?: Placeholder[];
}

/** Serialize one book to the standalone file shape, stamped with the current app version. `available` is the
 *  placeholder pool to resolve the book's used chips from — the world's combined list, or the book's own
 *  carried pool. */
export function buildDictionaryFile(book: Dictionary, available: Placeholder[] = carriedPlaceholders(book)): DictionaryFile {
  // Folders are the world's: a def leaves its folder reference behind.
  const owned = portablePlaceholders(book.placeholders ?? []);
  const shared = portablePlaceholders(sharedPlaceholdersUsed(
    book.entries.flatMap((e) => [e.name ?? '', ...(e.key ?? []), ...(e.secondaryKeys ?? []), e.value ?? '']),
    owned,
    available,
  ));
  return {
    formamorphKind: DICTIONARY_FILE_KIND,
    version: APP_VERSION,
    name: book.name,
    ...(book.description ? { description: book.description } : {}),
    ...(book.enabled === false ? { enabled: false } : {}),
    ...(book.tags?.length ? { tags: book.tags } : {}),
    ...(book.thumbnail ? { thumbnail: book.thumbnail } : {}),
    entries: book.entries,
    ...(owned.length ? { placeholders: owned } : {}),
    ...(shared.length ? { sharedPlaceholders: shared } : {}),
  };
}

/**
 * Parse a standalone dictionary file into a NEW book. The discriminator rejects world files (they have
 * `worldOverview` and no `formamorphKind`) and save files (`currentState`/`stateHistory`) with a clear
 * error. The book id and every entry id are regenerated so an import never collides with or overwrites
 * existing content — safe to import the same file twice. Entries exported before keywords became arrays
 * are migrated on the way in.
 */
export function parseDictionaryFile(raw: unknown): Dictionary {
  if (!raw || typeof raw !== 'object') throw new Error('Not a valid dictionary file.');
  const obj = raw as Record<string, unknown>;
  if (obj.formamorphKind !== DICTIONARY_FILE_KIND) {
    throw new Error('This file is not a dictionary. Import worlds from the main menu.');
  }
  const entries = Array.isArray(obj.entries) ? (obj.entries as DictionaryEntry[]) : [];
  const tags = Array.isArray(obj.tags)
    ? (obj.tags as unknown[]).filter((t): t is string => typeof t === 'string' && !!t.trim())
    : [];
  return {
    id: randomUUID(),
    name: typeof obj.name === 'string' && obj.name ? obj.name : 'Imported Dictionary',
    ...(typeof obj.description === 'string' && obj.description ? { description: obj.description } : {}),
    ...(obj.enabled === false ? { enabled: false } : {}),
    ...(tags.length ? { tags } : {}),
    ...(typeof obj.thumbnail === 'string' && obj.thumbnail ? { thumbnail: obj.thumbnail } : {}),
    entries: entries.map((e) => migrateEntryKeys({ ...e, id: randomUUID() })),
    // Carried defs ride along: the owned ones stay the book's when it is added to a world, the shared ones
    // merge into the world's list (see `adoptBookPlaceholders`).
    ...(Array.isArray(obj.placeholders) ? { placeholders: migrateCarriedPlaceholders(obj.placeholders) } : {}),
    ...(Array.isArray(obj.sharedPlaceholders) ? { sharedPlaceholders: migrateCarriedPlaceholders(obj.sharedPlaceholders) } : {}),
  };
}

/**
 * Parse any importable dictionary file into a book: our native format, or a foreign lorebook
 * (SillyTavern World Info / Character Card V2/V3 `character_book`) via `convertLorebook`. `fallbackName`
 * (e.g. the uploaded file's name) titles lorebooks that carry no internal name. Throws a targeted message
 * for a world/save file and a generic one for anything unrecognized.
 */
export function parseDictionaryImport(raw: unknown, fallbackName?: string): Dictionary {
  if (raw && typeof raw === 'object') {
    const kind = (raw as Record<string, unknown>).formamorphKind;
    if (kind === DICTIONARY_FILE_KIND) return parseDictionaryFile(raw);
    if (kind === WORLD_FILE_KIND) throw new Error("That's a world file — import it from the Worlds tab.");
    if (kind === SAVE_FILE_KIND) throw new Error("That's a save file, not a dictionary.");
  }
  const converted = convertLorebook(raw, fallbackName);
  if (converted) return converted;
  throw new Error('Unrecognized file — import a Formamorph dictionary or a SillyTavern / character-card lorebook.');
}
