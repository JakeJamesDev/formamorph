// Desktop CORS shim (pure header transform; see main.cjs for the wiring). The renderer runs at the
// app://local origin, so any fetch it makes to an external HTTP(S) endpoint — a user's custom
// OpenAI-compatible LLM server (LM Studio / Ollama / …), the community server, Hugging Face — is subject
// to browser CORS. Servers that send no CORS headers (e.g. LM Studio with CORS disabled) block the request
// at the preflight, which surfaces in-app as a generic "Failed to process AI request". A native app has no
// reason to be bound by browser CORS, so we rewrite external responses in the main process to carry
// permissive CORS headers (including on the OPTIONS preflight). This keeps the normal streaming fetch and
// leaves webSecurity on. electron-free so it's unit-testable in plain Node.

// The two request headers the app actually sends (Content-Type + Authorization). `Access-Control-Allow-
// Headers: *` deliberately does NOT cover Authorization per the Fetch spec, so list it explicitly — mirrors
// the built-in engine's own CORS in llmEngine.cjs.
const ALLOW_HEADERS = 'Content-Type, Authorization';
const ALLOW_METHODS = 'GET, POST, OPTIONS';

/**
 * Given a response's URL and headers, return the headers to send back to the renderer. External http(s)
 * responses get their existing CORS headers stripped and permissive ones added (so exactly one
 * Access-Control-Allow-Origin is present — duplicates would themselves fail the check); non-http(s)
 * responses (app:// assets) pass through untouched. Header keys are matched case-insensitively; values are
 * Electron's `{ name: [values] }` shape.
 */
function withCorsHeaders(url, responseHeaders = {}) {
  if (!/^https?:/i.test(String(url))) return responseHeaders;
  const out = {};
  for (const [key, value] of Object.entries(responseHeaders || {})) {
    if (!/^access-control-allow-/i.test(key)) out[key] = value;
  }
  out['Access-Control-Allow-Origin'] = ['*'];
  out['Access-Control-Allow-Methods'] = [ALLOW_METHODS];
  out['Access-Control-Allow-Headers'] = [ALLOW_HEADERS];
  return out;
}

module.exports = { withCorsHeaders, ALLOW_HEADERS, ALLOW_METHODS };
