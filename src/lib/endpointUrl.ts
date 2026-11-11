// Local servers hand out a base URL, not a chat-completions URL: LM Studio's "Reachable at" chip copies
// the bare origin, and the OpenAI-SDK convention everyone else documents stops at `/v1`. We send to a full
// URL, so we fill in the rest — append-only, and only for the two shapes that are unambiguous.

/** Path suffix the app actually POSTs to. */
const CHAT_PATH = '/chat/completions';

const HAS_SCHEME = /^[a-z][a-z\d+.-]*:\/\//i;
// Loopback, private ranges and single-label names serve plain HTTP; anything else is assumed public.
const PLAIN_HTTP_HOST = /^(?:localhost|127\.|10\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.|\[|[^./:\s]+(?:[:/]|$))/i;

/**
 * Give a schemeless address its scheme. Without one, fetch resolves `127.0.0.1:1234` against the page's own
 * origin and reads the site's HTML. Input that does not start like a host is returned trimmed.
 */
export function withScheme(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed || HAS_SCHEME.test(trimmed) || !/^[\w[]/.test(trimmed)) return trimmed;
  return `${PLAIN_HTTP_HOST.test(trimmed) ? 'http' : 'https'}://${trimmed}`;
}

/**
 * Complete a user-entered endpoint into a full chat-completions URL.
 *
 * A missing scheme is added first. Only a bare origin (no path) or a bare `/v1` gets its path completed.
 * Anything else — an already-complete URL, a gateway served under its own prefix, a non-standard path —
 * keeps its path, since guessing there would break a working setup. Unparseable input is returned as-is.
 */
export function normalizeEndpointUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return trimmed;

  const schemed = withScheme(trimmed);
  let url: URL;
  try {
    url = new URL(schemed);
  } catch {
    return trimmed;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return trimmed;

  const path = url.pathname.replace(/\/+$/, '');
  if (path === '') url.pathname = `/v1${CHAT_PATH}`;
  else if (path === '/v1') url.pathname = `/v1${CHAT_PATH}`;
  else return schemed;

  return url.toString();
}

/** True when normalization would change the URL — drives the "we'll actually call…" hint in Settings. */
export function endpointUrlWasCompleted(raw: string): boolean {
  const normalized = normalizeEndpointUrl(raw);
  return normalized !== raw.trim() && normalized !== '';
}
