/**
 * `JSON.stringify` that caches each object/array's serialization by identity, so unchanged sub-trees
 * (and their large base64 payloads) aren't re-serialized. Immutable state updates keep unedited records
 * at the same reference, so a single edit only re-serializes that record and its ancestors — the rest
 * hit the cache. Used for the per-keystroke dirty checks over image-heavy world/entity/dictionary data.
 *
 * Output is byte-identical to `JSON.stringify(value)` for plain JSON data (objects, arrays, strings,
 * finite/non-finite numbers, booleans, null, undefined). It does NOT support `toJSON`, Dates, Maps/Sets,
 * or the replacer/space arguments — the dirty-check payloads are plain data by construction.
 *
 * Pass a long-lived `WeakMap` (e.g. from a `useRef`) as the cache; it never needs invalidation — changed
 * objects are new keys, and unreferenced ones are garbage-collected.
 */
export function memoStringify(value: unknown, cache: WeakMap<object, string>): string | undefined {
  // Primitives (and undefined/function) serialize exactly as JSON.stringify does; nothing to cache.
  if (value === null || typeof value !== 'object') return JSON.stringify(value);

  const obj = value as object;
  const cached = cache.get(obj);
  if (cached !== undefined) return cached;

  let out: string;
  if (Array.isArray(value)) {
    // JSON.stringify renders a hole/undefined/function element as `null`.
    out = '[' + value.map((v) => memoStringify(v, cache) ?? 'null').join(',') + ']';
  } else {
    const parts: string[] = [];
    for (const key of Object.keys(obj)) {
      const s = memoStringify((obj as Record<string, unknown>)[key], cache);
      if (s === undefined) continue; // JSON.stringify omits undefined/function-valued object keys
      parts.push(JSON.stringify(key) + ':' + s);
    }
    out = '{' + parts.join(',') + '}';
  }
  cache.set(obj, out);
  return out;
}
