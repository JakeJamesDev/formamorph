// Desktop CORS shim (pure header transform; see main.cjs for the wiring). The renderer runs at the
// app://local origin, so any fetch it makes to an external HTTP(S) endpoint — a user's custom
// OpenAI-compatible LLM server (LM Studio / Ollama / …), the community server, Hugging Face — is subject
// to browser CORS. Servers that send no CORS headers (e.g. LM Studio with CORS disabled) block the request
// at the preflight, which surfaces in-app as a generic "Failed to process AI request". A native app has no
// reason to be bound by browser CORS, so we rewrite external responses in the main process to carry
// permissive CORS headers (including on the OPTIONS preflight). This keeps the normal streaming fetch and
// leaves webSecurity on. electron-free so it's unit-testable in plain Node.
//
// The transform must never end up NARROWER than the server's own answer or than what the app sends: it
// widens, it doesn't gate. A hardcoded allow-list that replaces the server's is how PUT/DELETE to the
// community server broke on desktop while working on web.

// Every method the app sends, plus the preflight itself. Unioned into whatever the server already allows.
const REQUIRED_METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'];
// The two request headers the app actually sends. `Access-Control-Allow-Headers: *` deliberately does NOT
// cover Authorization per the Fetch spec, so it has to be named explicitly even against a wildcarding
// server — mirrors the built-in engine's own CORS in llmEngine.cjs.
const REQUIRED_HEADERS = ['Content-Type', 'Authorization'];

/**
 * Union a response's existing allow-list with the values the app requires, keeping the server's own entries
 * and appending only what's missing (case-insensitive). The result is never narrower than either side.
 * `existing` is Electron's `{ name: [values] }` value shape, or undefined when the server sent no such header.
 */
function unionAllow(existing, required) {
  const tokens = (existing ?? [])
    .flatMap((value) => String(value).split(','))
    .map((token) => token.trim())
    .filter(Boolean);
  const seen = new Set(tokens.map((token) => token.toLowerCase()));
  for (const token of required) {
    if (seen.has(token.toLowerCase())) continue;
    tokens.push(token);
    seen.add(token.toLowerCase());
  }
  return tokens.join(', ');
}

/**
 * Given a response's URL and headers, return the headers to send back to the renderer. External http(s)
 * responses keep the server's own allow-lists, widened to cover what the app needs, and always answer the
 * app://local origin; non-http(s) responses (app:// assets) pass through untouched. Header keys are matched
 * case-insensitively; values are Electron's `{ name: [values] }` shape.
 */
function withCorsHeaders(url, responseHeaders = {}) {
  if (!/^https?:/i.test(String(url))) return responseHeaders;
  const out = {};
  let methods;
  let headers;
  for (const [key, value] of Object.entries(responseHeaders || {})) {
    if (/^access-control-allow-methods$/i.test(key)) methods = value;
    else if (/^access-control-allow-headers$/i.test(key)) headers = value;
    // Every other access-control-allow-* is dropped: a second Allow-Origin would itself fail the check, and
    // Allow-Credentials is meaningless beside the wildcard origin below.
    else if (!/^access-control-allow-/i.test(key)) out[key] = value;
  }
  // Forced, not unioned: the server's own value names its web origin, never app://local.
  out['Access-Control-Allow-Origin'] = ['*'];
  out['Access-Control-Allow-Methods'] = [unionAllow(methods, REQUIRED_METHODS)];
  out['Access-Control-Allow-Headers'] = [unionAllow(headers, REQUIRED_HEADERS)];
  return out;
}

module.exports = { withCorsHeaders, unionAllow, REQUIRED_METHODS, REQUIRED_HEADERS };
