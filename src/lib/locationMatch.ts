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
  return exactName(lower, names) ?? longestNameIn(lower, names);
}

/**
 * Resolve a router reply. A one-move place matches as {@link matchLocationResponse} reads it. A place in `far`
 * matches only an exact reply, markdown and end punctuation aside; the longest name a reply holds decides, so
 * a reply that names a far place inside other words moves nobody.
 */
export function matchRouterResponse(response: string, names: string[], far: readonly string[], here?: string): string | null {
  const text = (response || '').trim();
  if (!text || text.toUpperCase() === 'NONE') return null;
  const lower = text.toLowerCase();
  const all = withHere(names, here);
  const exact = exactNameIgnoringMarkup(lower, all);
  if (exact) return exact === here ? null : exact;
  const found = longestNameIn(lower, all);
  return found && found !== here && !far.includes(found) ? found : null;
}

/** `names` plus the player's current location, so a reply naming where the player stands outmatches a shorter
 *  name inside it ("Academy Dorms" over "Academy"). */
const withHere = (names: string[], here: string | undefined): string[] =>
  here && !names.includes(here) ? [...names, here] : names;

/** The longest name in `names` that `lower` holds as whole words, give or take a leading article. */
function longestNameIn(lower: string, names: string[]): string | null {
  const candidates = names
    .filter((n) => n && (containsWord(lower, n.toLowerCase()) || containsWord(lower, stripArticle(n.toLowerCase()))))
    .sort((a, b) => b.length - a.length);
  return candidates[0] ?? null;
}

/** A place name as an exact reply matches it: case, outer spaces and a leading article aside. */
export const placeNameKey = (name: string): string => stripArticle(name.trim().toLowerCase());

/** The name in `names` that `lower` (a lowercased reply) is, give or take a leading article. */
function exactName(lower: string, names: string[]): string | undefined {
  const key = placeNameKey(lower);
  return names.find((n) => n.toLowerCase() === lower || placeNameKey(n) === key);
}

/** {@link exactName}, with markdown and punctuation around the reply aside. */
const exactNameIgnoringMarkup = (lower: string, names: string[]): string | undefined =>
  exactName(lower.replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, ''), names) ?? exactName(lower, names);

/**
 * Resolve a Narrated Move reply. A reply whose first word is Elsewhere means the player went somewhere off the
 * list and resolves to null, whatever follows it. An exact listed name still wins, markdown and punctuation aside.
 * A reply that resolves to `here`, the player's current location, is no move.
 */
export function matchNarratedMoveResponse(response: string, names: string[], here?: string): string | null {
  const lower = (response || '').trim().toLowerCase();
  const all = withHere(names, here);
  const exact = exactNameIgnoringMarkup(lower, all);
  if (exact) return exact === here ? null : exact;
  if (/^[^a-z0-9]*elsewhere(?![a-z0-9])/.test(lower)) return null;
  const found = matchLocationResponse(response, all);
  return found === here ? null : found;
}
