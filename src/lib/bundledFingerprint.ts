/**
 * The bundled fingerprint: a hash of a world's authored text that survives migration.
 *
 * The server repo computes the same value to refuse an unmodified bundled world. Both copies must return the
 * hash in `__fixtures__/bundled-fingerprint-vector.json`. Change the rule in both repos at the same time.
 */

/** Shorter strings are names, ids, and enum values. They do not make a world someone's own. */
const MIN_TEXT_LENGTH = 40;

/** Stat code sits under this key, and migration rewrites it. */
const SKIPPED_KEY = 'code';

function collectTexts(value: unknown, out: Set<string>): void {
  if (typeof value === 'string') {
    const text = value.replace(/\s+/g, ' ').trim();
    if (text.length >= MIN_TEXT_LENGTH) out.add(text);
  } else if (Array.isArray(value)) {
    for (const item of value) collectTexts(item, out);
  } else if (value !== null && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) {
      if (key !== SKIPPED_KEY) collectTexts(item, out);
    }
  }
}

/**
 * Hash bytes as lowercase hex SHA-256. The fingerprint list stores Avatar files in this form.
 *
 * @param bytes - The bytes to hash
 */
export async function sha256Hex(bytes: Uint8Array<ArrayBuffer>): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Fingerprint a world's content. Every string value is whitespace-collapsed and trimmed. Values under a `code`
 * key are skipped. The strings of 40 or more UTF-16 code units are deduplicated, sorted by code unit, joined
 * with newlines, and hashed with {@link sha256Hex}.
 *
 * @param content - A world, raw from its file or as its publish payload carries it
 */
export async function worldFingerprint(content: unknown): Promise<string> {
  const texts = new Set<string>();
  collectTexts(content, texts);
  return sha256Hex(new TextEncoder().encode([...texts].sort().join('\n')));
}
