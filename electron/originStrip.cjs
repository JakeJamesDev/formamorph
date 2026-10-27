// Desktop Origin strip (pure request-header transform; see main.cjs for the wiring). ComfyUI started without
// --enable-cors-header refuses any request whose Origin isn't its own host, which includes app://local and
// the dev server on its own port. Removing Origin and Sec-Fetch-Site from our window's requests to the
// configured ComfyUI passes that check, and the check still guards ComfyUI against every other page.
// electron-free so it's unit-testable in plain Node.

const HTTP_SCHEME = { 'http:': 'http:', 'https:': 'https:', 'ws:': 'http:', 'wss:': 'https:' };

/** The http(s) origin of `url`, with ws/wss mapped to http/https so the progress socket matches its server.
 *  Null for anything else or an unparseable URL. */
function httpOrigin(url) {
  let parsed;
  try {
    parsed = new URL(String(url));
  } catch {
    return null;
  }
  const scheme = HTTP_SCHEME[parsed.protocol];
  return scheme ? `${scheme}//${parsed.host}` : null;
}

/**
 * The request headers to send: without Origin and Sec-Fetch-Site when the request is our window's own and
 * goes to `targetOrigin`, otherwise unchanged. `targetOrigin` is an `httpOrigin` result, or null for none.
 */
function stripOrigin(url, requestHeaders, targetOrigin, ownRequest) {
  if (!ownRequest || !targetOrigin || httpOrigin(url) !== targetOrigin) return requestHeaders;
  const out = {};
  for (const [key, value] of Object.entries(requestHeaders || {})) {
    if (!/^(origin|sec-fetch-site)$/i.test(key)) out[key] = value;
  }
  return out;
}

module.exports = { httpOrigin, stripOrigin };
