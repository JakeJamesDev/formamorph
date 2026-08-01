/** True when an AI-endpoint fetch failed at the network layer — the case where the guide should appear.
 *  A `fetch` rejects with a `TypeError` for every network-level failure (server not running, wrong URL,
 *  or CORS disabled on the server), and those are indistinguishable from each other in-page. HTTP
 *  responses (4xx/5xx) reject with a tagged Error carrying `.response`, so they're excluded; aborts
 *  reject with a DOMException, also excluded. Fires on desktop too: the CORS shim doesn't help a server
 *  that's off or misaddressed, and users still report CORS-shaped failures there. */
export const isLikelyConnectionError = (error: unknown): boolean =>
  error instanceof TypeError;
