import { isDesktop } from '@/lib/imageGen/desktop';

/** True when an AI-endpoint fetch failed at the network layer in a browser build — the case where the guide
 *  should appear. A browser `fetch` rejects with a `TypeError` for every network-level failure (server not
 *  running, wrong URL, or — most often — CORS disabled on the server), and those are indistinguishable from
 *  each other in-page. HTTP responses (4xx/5xx) reject with a tagged Error carrying `.response`, so they're
 *  excluded; aborts reject with a DOMException, also excluded. Desktop proxies through a CORS shim, so a
 *  TypeError there isn't a CORS problem — hence web-only. */
export const isLikelyConnectionError = (error: unknown): boolean =>
  !isDesktop() && error instanceof TypeError;
