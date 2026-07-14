import { randomUUID } from "@/lib/uuid";
import type { Dictionary, DictionaryEntry } from '@/types';

/**
 * Convert an open-format lorebook into a Formamorph dictionary ("book"), or return `null` if `raw` isn't a
 * recognizable lorebook. Grounded in the Character Card V3 spec (MIT © 2024 Kwaroran — see
 * THIRD-PARTY-NOTICES.md), which documents the `Lorebook` entry shape. Also tolerates SillyTavern's World
 * Info export, whose `entries` is an object map with legacy field names (`key`/`keysecondary`/`disable`…).
 *
 * Not covered in v1 (documented limitations): token-budget trimming, and full V3 decorator semantics beyond
 * stripping leading `@@…` decorator lines from content.
 */

type RawEntry = Record<string, unknown>;

/** Read a keyword list from either an array (spec) or a comma-separated string (some ST fields). */
function asKeywordList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((v) => String(v).trim()).filter(Boolean);
  if (typeof value === 'string') return value.split(',').map((s) => s.trim()).filter(Boolean);
  return [];
}

/** Map a lorebook position (V3 spec string or ST numeric) to our Background/Foreground placement. */
function mapPosition(pos: unknown): 'before' | 'after' | undefined {
  if (typeof pos === 'string') return pos.startsWith('before') ? 'before' : 'after'; // before_char / after_char
  if (typeof pos === 'number') return pos === 0 || pos === 2 ? 'before' : 'after'; // ST: 0/2 = before char/EM
  return undefined;
}

/** Strip leading V3 decorator lines (`@@position`, `@@depth`, …) from content; their semantics aren't applied. */
function stripDecorators(content: string): string {
  const lines = content.split('\n');
  let i = 0;
  while (i < lines.length && lines[i].trimStart().startsWith('@@')) i++;
  return lines.slice(i).join('\n').replace(/^\n+/, '');
}

function firstNumber(...values: unknown[]): number | undefined {
  for (const v of values) if (typeof v === 'number' && Number.isFinite(v)) return v;
  return undefined;
}

/** Convert one lorebook entry to a `DictionaryEntry`, honoring book-level scan/recursion defaults. */
function convertEntry(raw: RawEntry, book: { scanDepth?: number; recursive?: boolean }): DictionaryEntry | null {
  const keys = asKeywordList(raw.keys ?? raw.key);
  const value = stripDecorators(typeof raw.content === 'string' ? raw.content : typeof raw.value === 'string' ? raw.value : '');
  const constant = raw.constant === true;
  // Drop pure noise, but keep a keyless "always inject" (constant) entry.
  if (!value && keys.length === 0 && !constant) return null;

  const name =
    (typeof raw.name === 'string' && raw.name) ||
    (typeof raw.comment === 'string' && raw.comment) ||
    keys[0] || 'Imported Entry';
  // spec uses `enabled`; ST uses `disable` (inverted).
  const enabled = raw.enabled != null ? raw.enabled === true : raw.disable != null ? !raw.disable : true;
  const useRegex = raw.use_regex === true;
  const matchWholeWords = raw.matchWholeWords === true; // ST-only; V3 has no equivalent
  const caseSensitive = (raw.case_sensitive ?? raw.caseSensitive) === true;
  // secondary_keys only gate when `selective` is on (spec), and are ignored under regex.
  const secondary = !useRegex && raw.selective !== false ? asKeywordList(raw.secondary_keys ?? raw.keysecondary) : [];
  const position = mapPosition(raw.position);
  const scanDepth = firstNumber(raw.scan_depth, raw.scanDepth, book.scanDepth);
  const priority = firstNumber(raw.priority, raw.insertion_order, raw.order);
  // book-level recursive_scanning enables recursion; an ST entry can opt out via excludeRecursion.
  const recursive = book.recursive === true && raw.excludeRecursion !== true;

  const entry: DictionaryEntry = { id: randomUUID(), name, key: keys.join(', '), value };
  if (secondary.length) {
    entry.secondaryKeys = secondary.join(', ');
    // ST `selectiveLogic`: 0 AND_ANY (default), 1 NOT_ALL, 2 NOT_ANY, 3 AND_ALL → our exclude/all flags.
    const logic = typeof raw.selectiveLogic === 'number' ? raw.selectiveLogic : 0;
    if (logic === 1) { entry.secondaryExclude = true; entry.secondaryAll = true; }
    else if (logic === 2) { entry.secondaryExclude = true; }
    else if (logic === 3) { entry.secondaryAll = true; }
  }
  if (constant) entry.constant = true;
  if (!enabled) entry.enabled = false;
  if (useRegex) entry.useRegex = true;
  if (matchWholeWords) entry.matchWholeWords = true;
  if (caseSensitive) entry.caseSensitive = true;
  if (recursive) entry.recursive = true;
  if (position) entry.position = position;
  if (scanDepth != null) entry.scanDepth = scanDepth;
  if (priority != null) entry.priority = priority;
  if (raw.extensions && typeof raw.extensions === 'object' && !Array.isArray(raw.extensions)) {
    entry.extensions = raw.extensions as Record<string, unknown>;
  }
  return entry;
}

/** The `entries` collection from a lorebook object as an array, or `null` if absent/empty-shaped. */
function entryArray(source: Record<string, unknown> | undefined): RawEntry[] | null {
  const raw = source?.entries;
  if (Array.isArray(raw)) return raw.filter((e): e is RawEntry => !!e && typeof e === 'object');
  if (raw && typeof raw === 'object') {
    return Object.values(raw as Record<string, unknown>).filter((e): e is RawEntry => !!e && typeof e === 'object');
  }
  return null;
}

export function convertLorebook(raw: unknown, fallbackName?: string): Dictionary | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  const data = (obj.data && typeof obj.data === 'object' ? obj.data : undefined) as Record<string, unknown> | undefined;
  const asObj = (v: unknown) => (v && typeof v === 'object' ? (v as Record<string, unknown>) : undefined);

  // Find the lorebook object: a card's embedded book, a standalone {spec:'lorebook_v3',data}, or a raw book.
  const candidates = [asObj(data?.character_book), data, asObj(obj.character_book), obj];
  let book: Record<string, unknown> | undefined;
  let list: RawEntry[] | null = null;
  for (const c of candidates) {
    const entries = entryArray(c);
    if (entries) { book = c; list = entries; break; }
  }
  if (!book || !list) return null;

  const bookDefaults = {
    scanDepth: firstNumber(book.scan_depth),
    recursive: book.recursive_scanning === true,
  };
  const entries = list.map((e) => convertEntry(e, bookDefaults)).filter((e): e is DictionaryEntry => e !== null);
  if (entries.length === 0) return null;
  // Order by imported insertion order (then priority) so injection order roughly matches the source.
  entries.sort((a, b) => (a.priority ?? Number.MAX_SAFE_INTEGER) - (b.priority ?? Number.MAX_SAFE_INTEGER));

  const name =
    (typeof book.name === 'string' && book.name) ||
    (typeof data?.name === 'string' && data.name) ||
    fallbackName || 'Imported Dictionary';
  const description = typeof book.description === 'string' && book.description ? book.description : undefined;

  return { id: randomUUID(), name, enabled: true, ...(description ? { description } : {}), entries };
}
