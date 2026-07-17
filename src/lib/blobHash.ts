/**
 * Content hash of a binary blob, for answering "is this the same file I already have?" — not for security.
 *
 * Sibling of `contentHash.ts`, which hashes strings; a multi-MB VRM would have to be decoded to text first,
 * so it gets its own byte-oriented path. Prefers `crypto.subtle` (native, and not on the main thread) with a
 * pure-JS fallback for non-secure contexts, mirroring how `uuid.ts` guards `crypto.randomUUID`.
 */

/** cyrb53 over raw bytes — the same mixing as `contentHash`, fed by a byte array instead of char codes. */
function cyrb53Bytes(bytes: Uint8Array): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < bytes.length; i++) {
    const ch = bytes[i];
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

/**
 * Hash `blob`'s bytes. Stable for identical content within a given environment, which is all duplicate
 * detection needs — the two algorithms below don't agree with each other, so a stored hash is only ever
 * compared against one computed the same way.
 */
export async function blobHash(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    try {
      const digest = await crypto.subtle.digest('SHA-256', buffer);
      return Array.from(new Uint8Array(digest))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
    } catch {
      // Falls through: a non-secure context exposes `crypto.subtle` as undefined, but a hostile or partial
      // implementation can still reject at call time.
    }
  }
  return cyrb53Bytes(new Uint8Array(buffer));
}
