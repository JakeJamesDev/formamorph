const isEmpty = (v: unknown): boolean =>
  v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0);

/**
 * A world serialized for *comparison* rather than for storage: two payloads that mean the same thing
 * produce the same string. `JSON.stringify` does not, and the difference is what made the editor's Save
 * button stay lit over a world nobody had changed.
 *
 * Two normalizations, each answering a way an edit-then-undo failed to land back where it started:
 *
 * - **Keys are sorted.** A manager that rebuilds a record writes its keys in its own literal order, so
 *   the same entity re-saved unchanged serialized differently from the one that was loaded.
 * - **Empty means absent.** A field only gains a key once it is touched, and emptying it again leaves
 *   `[]` or `""` behind where there had been nothing. Every reader treats the two alike, so the
 *   comparison does too — an entity that never had aliases and one whose aliases were added and then
 *   removed are the same world.
 *
 * Only `undefined`, `null`, `""` and `[]` count as empty. `0` and `false` are values an author chose.
 *
 * Storage is deliberately unaffected: this decides whether there is anything to save, never what gets
 * written, so no world or save file changes shape because of it.
 *
 * Caches each object's result by identity, like `memoStringify` — the per-keystroke check runs over
 * megabytes of base64, and unedited records must not be re-serialized. The cache is keyed on output that
 * differs from `memoStringify`'s, so the two must never share one.
 */
export function canonicalStringify(value: unknown, cache: WeakMap<object, string>): string | undefined {
  if (isEmpty(value)) return undefined;
  if (typeof value !== 'object') return JSON.stringify(value);

  const obj = value as object;
  const cached = cache.get(obj);
  if (cached !== undefined) return cached;

  let out: string;
  if (Array.isArray(value)) {
    // Order is data here — a list of entities is not a set — so only the elements are normalized.
    out = '[' + value.map((v) => canonicalStringify(v, cache) ?? 'null').join(',') + ']';
  } else {
    const parts: string[] = [];
    for (const key of Object.keys(obj).sort()) {
      const s = canonicalStringify((obj as Record<string, unknown>)[key], cache);
      if (s === undefined) continue; // absent, empty, or emptied — all the same world
      parts.push(JSON.stringify(key) + ':' + s);
    }
    out = '{' + parts.join(',') + '}';
  }
  cache.set(obj, out);
  return out;
}

const isNonFinite = (v: unknown): boolean => typeof v === 'number' && !Number.isFinite(v);

// JSON writes a non-finite element as null, so in a list it matches an empty element.
const asElement = (v: unknown): unknown => (isNonFinite(v) ? null : v);

/**
 * Whether two values give the same {@link canonicalStringify} string, without building either. Shared
 * records are equal by identity, so comparing a world against a baseline that shares its unedited records
 * walks only what an edit replaced.
 */
export function canonicalEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  const aEmpty = isEmpty(a);
  if (aEmpty || isEmpty(b)) return aEmpty && isEmpty(b);
  // Every non-finite number serializes as null.
  if (typeof a !== 'object' || typeof b !== 'object') return isNonFinite(a) && isNonFinite(b);
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) {
    const other = b as unknown[];
    if (a.length !== other.length) return false;
    for (let i = 0; i < a.length; i++) if (!canonicalEqual(asElement(a[i]), asElement(other[i]))) return false;
    return true;
  }
  const left = a as Record<string, unknown>;
  const right = b as Record<string, unknown>;
  for (const key of Object.keys(left)) {
    if (!canonicalEqual(left[key], Object.hasOwn(right, key) ? right[key] : undefined)) return false;
  }
  for (const key of Object.keys(right)) if (!Object.hasOwn(left, key) && !isEmpty(right[key])) return false;
  return true;
}
