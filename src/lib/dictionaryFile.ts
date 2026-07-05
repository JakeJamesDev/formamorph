import type { Dictionary, DictionaryEntry } from '@/types';
import { APP_VERSION, WORLD_FILE_KIND, SAVE_FILE_KIND } from './version';
import { convertLorebook } from './lorebookImport';

/** Discriminator identifying a standalone one-book dictionary file (vs. a world or save file). */
export const DICTIONARY_FILE_KIND = 'dictionary' as const;

/** The standalone export shape for a single book. */
export interface DictionaryFile {
  formamorphKind: typeof DICTIONARY_FILE_KIND;
  version: string;
  name: string;
  description?: string;
  enabled?: boolean;
  entries: DictionaryEntry[];
}

/** Serialize one book to the standalone file shape, stamped with the current app version. */
export function buildDictionaryFile(book: Dictionary): DictionaryFile {
  return {
    formamorphKind: DICTIONARY_FILE_KIND,
    version: APP_VERSION,
    name: book.name,
    ...(book.description ? { description: book.description } : {}),
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
    ...(typeof obj.description === 'string' && obj.description ? { description: obj.description } : {}),
    ...(obj.enabled === false ? { enabled: false } : {}),
    entries: entries.map((e) => ({ ...e, id: crypto.randomUUID() })),
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
