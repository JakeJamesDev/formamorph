import type { Entity } from '@/types';

/**
 * Detect which of a set of names appear in a block of text — the canonical "who is in this narration"
 * parse. Used to fill the Entities tab, store per-turn participation, and scope the choices request.
 *
 * Matching rules (per name):
 * - **Single-word** name: counts only when it occurs with an **initial capital** (proper-noun use), so a
 *   name that is also a common word (Hope, Will, Rose, Crow) doesn't match ordinary lowercase prose.
 * - **Multi-word** name: an exact contiguous match, or (loose) every word present somewhere — both
 *   case-insensitive, since the multi-word shape is already specific.
 * - A trailing plural `s` is tolerated; blank names are skipped.
 */

const escapeRegExp = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** True if `name` appears in `text` with an uppercase first letter (a proper-noun occurrence). */
function occursCapitalized(text: string, name: string): boolean {
  const re = new RegExp(`\\b${escapeRegExp(name)}(?:s)?\\b`, 'gi');
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (/[A-Z]/.test(m[0].charAt(0))) return true;
  }
  return false;
}

/**
 * The subset of `names` that `text` contains, deduped and returned in first-seen order. The capital guard
 * on single-word names suits proper-cased narration; pass `requireCapital: false` for lowercase sources
 * (e.g. player actions) so a single-word name matches case-insensitively.
 */
export function matchNames(
  text: string,
  names: string[],
  opts: { requireCapital?: boolean } = {},
): string[] {
  const { requireCapital = true } = opts;
  if (!text) return [];
  const found = new Set<string>();
  for (const name of names) {
    const trimmed = name?.trim();
    if (!trimmed || found.has(name)) continue;
    const words = trimmed.toLowerCase().split(/\s+/);
    if (words.length === 1) {
      const matched = requireCapital
        ? occursCapitalized(text, trimmed)
        : new RegExp(`\\b${escapeRegExp(trimmed)}(?:s)?\\b`, 'i').test(text);
      if (matched) found.add(name);
      continue;
    }
    const exact = new RegExp(`\\b${escapeRegExp(trimmed)}(?:s)?\\b`, 'i');
    const allWordsPresent = words.every((w) => new RegExp(`\\b${escapeRegExp(w)}(?:s)?\\b`, 'i').test(text));
    if (exact.test(text) || allWordsPresent) found.add(name);
  }
  return [...found];
}

/** The names of the defined entities that appear in `text` (a thin wrapper over `matchNames`). */
export function findEntityNames(text: string, entities: Entity[], opts?: { requireCapital?: boolean }): string[] {
  return matchNames(text, entities.map((e) => e.name), opts);
}

// Short/function words dropped before loose matching so a name like "The Wolf" can't match on "the".
const LOOSE_STOPWORDS = new Set(['the', 'a', 'an', 'of', 'and', 'or', 'with']);

const significantWords = (name: string): string[] =>
  name.toLowerCase().split(/\s+/).filter((w) => w.length >= 3 && !LOOSE_STOPWORDS.has(w));

/**
 * Looser counterpart to `matchNames`: a name counts when **any** of its significant words appears
 * (case-insensitive, plural-tolerant, no capital guard). Intended only for names already vouched for by
 * another source — e.g. defined entities the staged director cast — so "the tank rolls" still confirms a
 * "Battle Tank" the director named, without the strict parse's full-name/capitalization requirement.
 */
export function matchNamesLoose(text: string, names: string[]): string[] {
  if (!text) return [];
  const found = new Set<string>();
  for (const name of names) {
    const trimmed = name?.trim();
    if (!trimmed || found.has(name)) continue;
    const words = significantWords(trimmed);
    if (words.some((w) => new RegExp(`\\b${escapeRegExp(w)}(?:s)?\\b`, 'i').test(text))) found.add(name);
  }
  return [...found];
}
