/**
 * Stable, non-cryptographic hash of a string (cyrb53) — used to answer "did this bundled content change
 * between builds?", not for security. Deterministic across runs and platforms, so a stored hash can be
 * compared against a freshly-computed one.
 *
 * Preferred over a version field for change detection: a hash is *derived* from the content, so it can't
 * drift out of sync the way a hand-bumped version can.
 */
export function contentHash(str: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}
