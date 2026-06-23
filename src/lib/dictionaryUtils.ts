import type { DictionaryEntry } from '@/types';

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
    (entry.keywords || []).some(
      (kw) => kw && haystack.includes(kw.toLowerCase()),
    ),
  );
}

/** The text block injected into the AI prompt for the activated entries (empty if none). */
export function buildDictionaryContext(entries: DictionaryEntry[]): string {
  if (!entries || entries.length === 0) return '';
  const lines = entries.map((e) => {
    const label = e.name || (e.keywords && e.keywords[0]) || '';
    return label ? `${label}: ${e.description}` : e.description;
  });
  return `Relevant Information:\n${lines.join('\n')}`;
}
