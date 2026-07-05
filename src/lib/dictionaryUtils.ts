import type { Dictionary, DictionaryEntry } from '@/types';

const MAX_RECURSION_PASSES = 3;

/**
 * Flatten enabled books into a single entry list — book order, then per-book entry order — dropping the
 * entries of any book with `enabled === false`. The one bridge from the book model to the entry-based
 * injection pipeline, so block order follows book order. Per-entry `enabled` is left untouched here;
 * `getActivatedDictionary` still applies it.
 */
export function flattenEnabledBookEntries(dictionaries: Dictionary[] | undefined): DictionaryEntry[] {
  if (!dictionaries) return [];
  return dictionaries.flatMap((book) => (book.enabled === false ? [] : book.entries ?? []));
}

function splitKeys(raw: string | undefined): string[] {
  return (raw || '').split(',').map((k) => k.trim()).filter(Boolean);
}

/** An entry's primary trigger keywords (its comma-separated `key`, trimmed, empties dropped). */
export function parseKeywords(entry: DictionaryEntry): string[] {
  return splitKeys(entry.key);
}

/** Whether any of `keys` occurs in `haystack`, honoring the entry's `useRegex` / `caseSensitive` options. */
function anyKeyMatches(keys: string[], haystack: string, entry: DictionaryEntry): boolean {
  if (keys.length === 0 || !haystack) return false;
  if (entry.useRegex) {
    return keys.some((k) => {
      try { return new RegExp(k, entry.caseSensitive ? '' : 'i').test(haystack); }
      catch { return false; } // a malformed pattern never matches rather than throwing
    });
  }
  const hay = entry.caseSensitive ? haystack : haystack.toLowerCase();
  return keys.some((k) => hay.includes(entry.caseSensitive ? k : k.toLowerCase()));
}

/** Whether an entry fires against `haystack`: a primary hit, plus a secondary hit when `secondaryKeys` is set. */
function triggered(entry: DictionaryEntry, haystack: string): boolean {
  if (!anyKeyMatches(parseKeywords(entry), haystack, entry)) return false;
  const secondary = splitKeys(entry.secondaryKeys);
  return secondary.length === 0 || anyKeyMatches(secondary, haystack, entry);
}

/** Options for `getActivatedDictionary`. */
export interface ActivationOptions {
  /** Recent message contents oldest→newest; scanned per entry up to its `scanDepth` (all of it when unset). */
  history?: string[];
}

/**
 * The dictionary/lorebook entries active this turn. An enabled entry activates when it is `constant` or its
 * keywords fire against the scanned text — the current scene (`sceneTexts`, always scanned) plus the last
 * `scanDepth` messages of `opts.history` (all of it when `scanDepth` is unset; none when it is 0). Entries
 * flagged `recursive` may then be activated by the already-active entries' content, bounded to a few passes.
 * Returns the active entries in declaration order; ordering within a rendered block is `buildDictionaryContext`'s job.
 */
export function getActivatedDictionary(
  dictionary: DictionaryEntry[],
  sceneTexts: string[],
  opts: ActivationOptions = {},
): DictionaryEntry[] {
  if (!dictionary || dictionary.length === 0) return [];
  const live = dictionary.filter((e) => e.enabled !== false);
  const sceneHay = sceneTexts.filter(Boolean).join('\n');
  const history = (opts.history ?? []).filter(Boolean);

  const active = new Set<DictionaryEntry>();
  const pending: DictionaryEntry[] = [];
  for (const entry of live) {
    if (entry.constant) { active.add(entry); continue; }
    const depth = entry.scanDepth;
    const hist = depth == null ? history : depth <= 0 ? [] : history.slice(-depth);
    const hay = hist.length ? `${sceneHay}\n${hist.join('\n')}` : sceneHay;
    if (triggered(entry, hay)) active.add(entry);
    else pending.push(entry);
  }

  // Recursive pass: `recursive` entries can fire against the content already activated, capped to avoid loops.
  const recursive = pending.filter((e) => e.recursive);
  if (recursive.length && active.size) {
    for (let pass = 0; pass < MAX_RECURSION_PASSES; pass++) {
      const activeText = [...active].map((e) => e.value).filter(Boolean).join('\n');
      let added = false;
      for (const entry of recursive) {
        if (!active.has(entry) && triggered(entry, activeText)) { active.add(entry); added = true; }
      }
      if (!added) break;
    }
  }

  return live.filter((e) => active.has(e));
}

/**
 * Text block for the given entries (empty if none), rendered in the order given — the `dictionary` array order
 * within each position block. With `includeHeading` (the default) it carries its own `## Foreground Lore`
 * heading, used only for the no-chip fallback append; `false` returns the body so the prompt template owns it.
 */
export function buildDictionaryContext(entries: DictionaryEntry[], includeHeading = true): string {
  if (!entries || entries.length === 0) return '';
  const lines = entries
    .filter((e) => e.value)
    .map((e) => {
      const label = e.name || e.key || '';
      return label ? `${label}: ${e.value}` : e.value;
    });
  if (lines.length === 0) return '';
  const body = lines.join('\n');
  return includeHeading ? `## Foreground Lore\n${body}` : body;
}
