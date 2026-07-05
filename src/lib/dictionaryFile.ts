import type { Dictionary, DictionaryEntry } from '@/types';
import { APP_VERSION } from './version';

/** Discriminator identifying a standalone one-book dictionary file (vs. a world or save file). */
export const DICTIONARY_FILE_KIND = 'dictionary' as const;

/** The standalone export shape for a single book. */
export interface DictionaryFile {
  formamorphKind: typeof DICTIONARY_FILE_KIND;
  version: string;
  name: string;
  enabled?: boolean;
  entries: DictionaryEntry[];
}

/** Serialize one book to the standalone file shape, stamped with the current app version. */
export function buildDictionaryFile(book: Dictionary): DictionaryFile {
  return {
    formamorphKind: DICTIONARY_FILE_KIND,
    version: APP_VERSION,
    name: book.name,
    ...(book.enabled === false ? { enabled: false } : {}),
    entries: book.entries,
  };
}

/**
 * Parse a standalone dictionary file into a NEW book. The discriminator rejects world files (they have
 * `worldOverview` and no `formamorphKind`) and save files (`currentState`/`stateHistory`) with a clear
 * error. The book id and every entry id are regenerated so an import never collides with or overwrites
 * existing content — safe to import the same file twice.
 */
export function parseDictionaryFile(raw: unknown): Dictionary {
  if (!raw || typeof raw !== 'object') throw new Error('Not a valid dictionary file.');
  const obj = raw as Record<string, unknown>;
  if (obj.formamorphKind !== DICTIONARY_FILE_KIND) {
    throw new Error('This file is not a dictionary. Import worlds from the main menu.');
  }
  const entries = Array.isArray(obj.entries) ? (obj.entries as DictionaryEntry[]) : [];
  return {
    id: crypto.randomUUID(),
    name: typeof obj.name === 'string' && obj.name ? obj.name : 'Imported Dictionary',
    ...(obj.enabled === false ? { enabled: false } : {}),
    entries: entries.map((e) => ({ ...e, id: crypto.randomUUID() })),
  };
}
