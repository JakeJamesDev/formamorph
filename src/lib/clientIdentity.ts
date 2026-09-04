import { APP_VERSION } from '@/lib/version';
import { BUILD_TARGET } from '@/lib/buildInfo';
import { urlOf } from '@/lib/fetchTarget';

/** The header every request to the community server carries: the version, a space, the platform. */
export const CLIENT_HEADER = 'X-Formamorph-Client';

/** The code the server answers a route that needs a newer client with, under `426 Upgrade Required`. */
export const CLIENT_UPDATE_REQUIRED = 'CLIENT_UPDATE_REQUIRED';

/** Which build is talking. The server logs it and gates routes on the version beside it. */
export type ClientPlatform = 'web' | 'windows' | 'linux' | 'mac' | 'android';

/** What a refused request said it wants. */
export interface ClientUpdateRequired {
  /** The server's name for what was refused, shown to the player. Empty when the server named none. */
  feature: string;
  /** The lowest version that route accepts. Empty when the server named none. */
  minVersion: string;
}

/** What a refused request answers with; the rest of the body is the caller's to read. */
interface RefusalBody {
  code?: string;
  feature?: string;
  minVersion?: string;
}

/**
 * Which build this is, in the five names the server knows.
 *
 * The build class decides Android, because the Android app is a WebView with its own bridge and the
 * desktop check must stay false inside it. Everything else is the desktop bridge plus the agent string,
 * which is the only thing that separates the three desktop builds from each other.
 *
 * @returns The platform half of the client header
 */
export function clientPlatform(): ClientPlatform {
  if (BUILD_TARGET === 'android') return 'android';

  const desktop = typeof window !== 'undefined'
    && Boolean((window as { formamorphDesktop?: unknown }).formamorphDesktop);
  if (!desktop) return 'web';

  const ua = typeof navigator === 'undefined' ? '' : navigator.userAgent;
  if (/Windows/i.test(ua)) return 'windows';
  // Before Linux: a Mac agent string names neither X11 nor Linux, but the order is what keeps it that way.
  if (/Mac OS X|Macintosh/i.test(ua)) return 'mac';
  if (/Linux|X11/i.test(ua)) return 'linux';
  // Only an absent agent string reaches this, which no Electron build has.
  return 'web';
}

/** The header value: the running version, a space, and the platform. */
export function clientIdentity(): string {
  return `${APP_VERSION} ${clientPlatform()}`;
}

/**
 * Stamp every request to the community server with this build, and watch its replies for the one the
 * server sends a build too old for a route.
 *
 * Wraps `fetch` for the same reason the privacy-refusal watch does: a dozen services call it directly,
 * and asking each of them to add a header and recognize a status code is a dozen places to forget. The
 * header is added to requests to `apiUrl` alone, so nothing else the app fetches carries it.
 *
 * A refused request is still refused. The response is returned untouched and its body is read from a
 * clone, because the caller has its own error to report and the gate is only one feature deep.
 *
 * @param apiUrl - The community server's base URL; only requests to it are stamped or inspected
 * @param onUpdateRequired - Run once per refused request, with what the server said it needs
 * @returns A function restoring the previous `fetch`
 */
export function watchClientVersion(
  apiUrl: string,
  onUpdateRequired: (required: ClientUpdateRequired) => void,
): () => void {
  const previous = window.fetch;

  window.fetch = async (...args: Parameters<typeof fetch>): Promise<Response> => {
    const [input, init] = args;
    if (!urlOf(input).startsWith(apiUrl)) return previous(...args);

    // Seeded from whichever of the two carries the caller's own headers, so a `Request` handed straight
    // to `fetch` keeps its Authorization. The rest of that `Request` — method, body — survives because
    // `fetch` merges an init over it rather than replacing it.
    const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
    headers.set(CLIENT_HEADER, clientIdentity());

    const response = await previous(input, { ...init, headers });

    if (response.status === 426) {
      const body = (await response.clone().json().catch(() => null)) as RefusalBody | null;
      if (body?.code === CLIENT_UPDATE_REQUIRED) {
        onUpdateRequired({ feature: body.feature ?? '', minVersion: body.minVersion ?? '' });
      }
    }

    return response;
  };

  return () => { window.fetch = previous; };
}
