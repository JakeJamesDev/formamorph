/**
 * Whether the browser's Local Network Access gate is the reason a custom endpoint won't answer.
 *
 * Chrome 142+ (and Firefox's equivalent) ask the user's permission before a public page may reach an
 * address on their own machine or LAN. A top-level page gets that prompt; a cross-origin iframe only
 * gets the permission if the embedding page delegates it with `allow="local-network-access"` — and
 * itch.io's game embed does not. The fetch is then denied before it leaves, which looks exactly like a
 * server that is off, so the app has to reason about it from the situation rather than the error.
 *
 * The classification is string in, verdict out, so it is provable without a browser. The remedy is to
 * open the game in its own tab — same origin, so saves and settings follow.
 */

/** Which address space an endpoint points at. Loopback and private sit behind the permission gate. */
export type EndpointAddressSpace = 'loopback' | 'private' | 'public';

/** The `window` shape the embed check needs. Structural so a test can hand it a plain object. */
export interface FrameWindow {
  self: unknown;
  top: unknown;
}

const IPV4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;

/** The four octets of a dotted-quad host, or null if it isn't one. */
function ipv4Octets(host: string): number[] | null {
  const match = IPV4.exec(host);
  if (!match) return null;
  const octets = match.slice(1, 5).map(Number);
  return octets.every((n) => n <= 255) ? octets : null;
}

/**
 * Which address space `endpointUrl` points at. Fails safe: anything we can't parse, or can't call over
 * http(s), counts as public — a wrong "local" would blame the embed for a cloud endpoint that is
 * genuinely down, which is the worse error; a wrong "public" only withholds guidance.
 */
export function classifyEndpointAddress(endpointUrl: string): EndpointAddressSpace {
  let url: URL;
  try {
    url = new URL(endpointUrl.trim());
  } catch {
    return 'public';
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return 'public';

  // URL keeps IPv6 hosts in brackets; everything below wants the bare host, lowercased.
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (!host) return 'public';

  if (host === '::1') return 'loopback';
  // fc00::/7 unique-local and fe80::/10 link-local — the IPv6 halves of the RFC1918 ranges.
  if (/^f[cd]/.test(host) && host.includes(':')) return 'private';
  if (/^fe[89ab]/.test(host) && host.includes(':')) return 'private';
  if (host.includes(':')) return 'public';

  const octets = ipv4Octets(host);
  if (octets) {
    const [a, b] = octets;
    if (a === 127) return 'loopback';
    if (a === 0) return 'loopback'; // 0.0.0.0 resolves to the local host
    if (a === 10) return 'private';
    if (a === 172 && b >= 16 && b <= 31) return 'private';
    if (a === 192 && b === 168) return 'private';
    if (a === 169 && b === 254) return 'private'; // link-local
    return 'public';
  }

  if (host === 'localhost' || host.endsWith('.localhost')) return 'loopback';
  if (host.endsWith('.local')) return 'private'; // mDNS
  if (!host.includes('.')) return 'private'; // a single-label host is a LAN name
  return 'public';
}

/** Whether the endpoint is one the browser's local-network permission would gate. */
export function isLocalEndpoint(endpointUrl: string): boolean {
  return classifyEndpointAddress(endpointUrl) !== 'public';
}

/**
 * Whether this document is running inside another site's frame. A same-origin frame reads `top`
 * fine and compares unequal; a cross-origin one throws on access — both mean embedded.
 */
export function isCrossOriginEmbed(win: FrameWindow | undefined = globalThis.window): boolean {
  if (!win) return false;
  try {
    return win.self !== win.top;
  } catch {
    return true;
  }
}

/**
 * Whether to blame the embed and offer the pop-out. All three of embedded, local endpoint and failed
 * probe must hold — the probe can't tell a permission denial from a server that's off, so the other two
 * carry the inference.
 *
 * No policy-introspection input by design: measured in Chrome 148, `featurePolicy.allowsFeature(
 * 'local-network-access')` answers `false` exactly as it does for a name that doesn't exist and warns
 * to the console every call, and `document.permissionsPolicy` is unimplemented. Re-measure before
 * reaching for it again.
 */
export function shouldOfferPopOut({ embedded, localEndpoint, probeFailed }: {
  embedded: boolean;
  localEndpoint: boolean;
  probeFailed: boolean;
}): boolean {
  return embedded && localEndpoint && probeFailed;
}

/** Open this page as a top-level tab. Must be called straight from a click, or popup blockers eat it. */
export function openInOwnTab(): void {
  window.open(window.location.href, '_blank', 'noopener');
}
