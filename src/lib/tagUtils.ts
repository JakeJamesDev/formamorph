// Normalize a tag so formatting variants collapse to one value for matching:
// fold accents (NFKD + strip combining marks), lowercase, treat any run of non-alphanumerics
// as a single space -- except '/', which is kept (often used as "this/that"; spacing around it is
// normalized so "a / b" == "a/b"), then trim. '' for junk-only input.
export const sanitizeTag = (tag: string): string =>
  String(tag ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9/]+/g, ' ')
    .replace(/\s*\/+\s*/g, '/')
    .trim();

/**
 * Unique, sanitized tags across the given worlds' tag lists, sorted alphabetically; optionally
 * excluding already-sanitized `hidden` tags. Casing/spacing/punctuation variants collapse into one
 * entry. Shared by the Discover filter and the world-editor tag autocomplete.
 */
export const collectSanitizedTags = (
  tagLists: Iterable<readonly string[] | undefined>,
  hidden?: ReadonlySet<string>,
): string[] => {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const list of tagLists) {
    for (const t of list ?? []) {
      const s = sanitizeTag(t);
      if (s && !seen.has(s) && !hidden?.has(s)) {
        seen.add(s);
        out.push(s);
      }
    }
  }
  return out.sort((a, b) => a.localeCompare(b));
};
