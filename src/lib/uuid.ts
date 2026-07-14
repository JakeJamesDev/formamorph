// UUID generation with a non-secure-context fallback. `crypto.randomUUID` is only defined in secure contexts
// (HTTPS or localhost); over plain-HTTP LAN — e.g. testing the dev server from a phone at http://<ip>:5173 —
// it's undefined and calling it throws, which would blank the whole app. `crypto.getRandomValues` is NOT
// secure-context-gated, so we build an RFC-4122 v4 UUID from it when the native API is missing.

/** A v4 UUID. Uses `crypto.randomUUID` when available, else a `getRandomValues`-based fallback. */
export function randomUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  b[6] = (b[6] & 0x0f) | 0x40; // version 4
  b[8] = (b[8] & 0x3f) | 0x80; // variant 10xx
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0'));
  return `${h[0]}${h[1]}${h[2]}${h[3]}-${h[4]}${h[5]}-${h[6]}${h[7]}-${h[8]}${h[9]}-${h[10]}${h[11]}${h[12]}${h[13]}${h[14]}${h[15]}`;
}
