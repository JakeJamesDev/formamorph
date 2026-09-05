/** The origin a candidate is parsed against. Never reached — it only makes "same site" checkable. */
const PROBE_ORIGIN = 'https://next.invalid';

/** A leading slash followed by a second slash or a backslash. Both read as an authority to a browser. */
const AUTHORITY_START = /^\/[/\\]/;

/**
 * Where a finished sign-in returns to.
 *
 * Only an absolute path on this site is honored. A crafted link is the reason: `?next=` rides in the
 * URL, so anyone can write one, and a value the browser reads as another origin would hand a reader
 * who has just typed a password to a page we do not control. Anything that is not plainly one of our
 * own paths becomes the fallback instead.
 *
 * @param raw - The value read out of the query string, already decoded
 * @param fallback - Where to send a reader when the value is refused
 */
/**
 * The sign-in page, told where to send the reader back to.
 *
 * One place that builds it, because the encoding is the part that goes wrong: a page writing its own
 * `?next=` by hand has to remember to escape the slash, and a path that arrives unescaped is refused
 * by the filter above and silently becomes the landing page.
 *
 * @param returnTo - An absolute path on this site to come back to
 */
export function signInTo(returnTo: string): string {
  return `/login?next=${encodeURIComponent(returnTo)}`;
}

export function safeNextPath(raw: string | null | undefined, fallback = '/'): string {
  if (!raw) return fallback;

  // Leading whitespace is stripped by the browser before it resolves a URL, so it is stripped here
  // too — otherwise " //evil.test" would pass a naive prefix check and still leave the site.
  const value = raw.trim();

  // A path, not a scheme and not an authority. `//host` and `/\host` are both absolute to a browser
  // despite the leading slash, which is exactly the trap this line closes.
  if (!value.startsWith('/') || AUTHORITY_START.test(value)) return fallback;

  let url: URL;
  try {
    url = new URL(value, PROBE_ORIGIN);
  } catch {
    return fallback;
  }
  if (url.origin !== PROBE_ORIGIN) return fallback;

  return `${url.pathname}${url.search}${url.hash}`;
}
