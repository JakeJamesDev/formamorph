// Local servers hand out a base URL, not a chat-completions URL: LM Studio's "Reachable at" chip copies
// the bare origin, and the OpenAI-SDK convention everyone else documents stops at `/v1`. We send to a full
// URL, so we fill in the rest — append-only, and only for the two shapes that are unambiguous.

/** Path suffix the app actually POSTs to. */
const CHAT_PATH = '/chat/completions';

/**
 * Complete a user-entered endpoint into a full chat-completions URL.
 *
 * Only a bare origin (no path) or a bare `/v1` gets completed. Anything else — an already-complete URL, a
 * gateway served under its own prefix, a non-standard path — is returned untouched, since guessing there
 * would break a working setup. Unparseable input is returned as-is for the caller's error handling.
 */
export function normalizeEndpointUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return trimmed;

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return trimmed;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return trimmed;

  const path = url.pathname.replace(/\/+$/, '');
  if (path === '') url.pathname = `/v1${CHAT_PATH}`;
  else if (path === '/v1') url.pathname = `/v1${CHAT_PATH}`;
  else return trimmed;

  return url.toString();
}

/** True when normalization would change the URL — drives the "we'll actually call…" hint in Settings. */
export function endpointUrlWasCompleted(raw: string): boolean {
  const normalized = normalizeEndpointUrl(raw);
  return normalized !== raw.trim() && normalized !== '';
}
