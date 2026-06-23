import type { DictionaryEntry } from '@/types';

/** Split an entry's comma-separated `key` into trimmed, non-empty keywords. */
export function parseKeywords(entry: DictionaryEntry): string[] {
  return (entry.key || '')
    .split(',')
    .map((k) => k.trim())
    .filter(Boolean);
}

/**
 * Dictionary entries whose any keyword appears in the provided texts (case-insensitive).
 * v1.2.0 scans the full message history, not just the current event text.
 */
export function getActivatedDictionary(
  dictionary: DictionaryEntry[],
  texts: string[],
): DictionaryEntry[] {
  if (!dictionary || dictionary.length === 0) return [];
  const haystack = texts.filter(Boolean).join('\n').toLowerCase();
  if (!haystack) return [];
  return dictionary.filter((entry) =>
    parseKeywords(entry).some((kw) => haystack.includes(kw.toLowerCase())),
  );
}

/** The text block injected into the AI prompt for the activated entries (empty if none). */
export function buildDictionaryContext(entries: DictionaryEntry[]): string {
  if (!entries || entries.length === 0) return '';
  const lines = entries
    .filter((e) => e.value)
    .map((e) => {
      const label = e.name || e.key || '';
      return label ? `${label}: ${e.value}` : e.value;
    });
  if (lines.length === 0) return '';
  return `Relevant Information:\n${lines.join('\n')}`;
}
