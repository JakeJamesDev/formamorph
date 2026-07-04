/**
 * True if `needle` appears in `haystack` bounded by non-alphanumeric characters (or the
 * string ends) — so "cave" matches "the cave." but not "caves". Both args are lowercased
 * by the caller.
 */
export function containsWord(haystack: string, needle: string): boolean {
  if (!needle) return false;
  for (let from = 0; ; ) {
    const idx = haystack.indexOf(needle, from);
    if (idx === -1) return false;
    const before = idx === 0 ? '' : haystack[idx - 1];
    const after = haystack[idx + needle.length] ?? '';
    if (!/[a-z0-9]/i.test(before) && !/[a-z0-9]/i.test(after)) return true;
    from = idx + 1;
  }
}

/**
 * Drop a single leading "the "/"a "/"an " article so a model that omits it still matches
 * (e.g. "Eelhouse" → "The Eelhouse"). Deliberately NOT a suffix/subset relaxation — "Cottage"
 * must still fail to match "Ferryman's Cottage", since similar suffixes ("Emily's House" vs
 * "John's House") are common and collapsing them would teleport to the wrong place.
 */
function stripArticle(s: string): string {
  return s.replace(/^(?:the|an?)\s+/i, '');
}

/**
 * Resolve a location-change response to one of the available location names.
 * An exact (case-insensitive) match wins — tolerating a dropped/added leading article on either
 * side; otherwise the longest available name that appears as a whole word in the response (so
 * "Cave Entrance" beats a bare "Cave"). Returns null for "NONE", empty input, or no match.
 */
export function matchLocationResponse(response: string, names: string[]): string | null {
  const text = (response || '').trim();
  if (!text || text.toUpperCase() === 'NONE') return null;
  const lower = text.toLowerCase();
  const lowerBare = stripArticle(lower);

  const exact = names.find((n) => {
    const nl = n.toLowerCase();
    return nl === lower || stripArticle(nl) === lowerBare;
  });
  if (exact) return exact;

  const candidates = names
    .filter((n) => n && (containsWord(lower, n.toLowerCase()) || containsWord(lower, stripArticle(n.toLowerCase()))))
    .sort((a, b) => b.length - a.length);
  return candidates[0] ?? null;
}
