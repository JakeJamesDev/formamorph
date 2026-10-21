// Small HTTP helpers shared by the image providers (A1111/Forge, ComfyUI, OpenAI-compatible).
import { redactUrl } from '@/lib/redactUrl';
import { describeResponseBody } from '@/lib/responseBody';
import { DetailedError } from '../errorDetails';
import { isDesktop } from './desktop';
import type { ImageProviderId } from './types';

/** Strip trailing slashes so `${base}/path` never doubles up. */
export const trimUrl = (u: string): string => u.replace(/\/+$/, '');

/** Authorization header for a provider request, or `{}` when no token is configured. A1111 uses
 *  `Basic` (its `--api-auth` flag); the others are `Bearer`. */
export const authHeaders = (token: string | undefined, scheme: 'Bearer' | 'Basic'): Record<string, string> =>
  token ? { Authorization: `${scheme} ${token}` } : {};

/** Bare base64 → PNG data-URL; an already-prefixed data-URL passes through unchanged. */
export const toPngDataUrl = (image: string): string =>
  image.startsWith('data:') ? image : `data:image/png;base64,${image}`;

/** Shared cadence for best-effort progress polling. */
export const POLL_INTERVAL_MS = 700;

/** Reject as soon as `signal` aborts, for requests that can't take an AbortSignal (the desktop IPC
 *  bridge). The underlying request still runs to completion out of process; its result is discarded. */
export function abortable<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return promise;
  if (signal.aborted) return Promise.reject(new DOMException('Aborted', 'AbortError'));
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(new DOMException('Aborted', 'AbortError'));
    signal.addEventListener('abort', onAbort, { once: true });
    promise.then(resolve, reject).finally(() => signal.removeEventListener('abort', onAbort));
  });
}

/** The body as text, or '' when it can't be read. Read once, so the raw text and any parse agree. */
export async function readBody(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return '';
  }
}

/** The Error Details text for a refused request: the redacted request, the status and the body as sent. */
export function refusalDetails(method: string, url: string, res: { status: number; statusText?: string }, body: string): string {
  return [
    `Request: ${method} ${redactUrl(url)}`,
    `Status: ${[res.status, res.statusText].filter(Boolean).join(' ')}`,
    '',
    'Response:',
    describeResponseBody(body),
  ].join('\n');
}

/** A request that got no response: the server is off, the URL is wrong, or the browser blocked it. */
export class ImageConnectionError extends DetailedError {
  readonly provider: ImageProviderId;

  constructor(provider: ImageProviderId, message: string, details: string, cause: unknown) {
    super(message, details);
    this.name = 'ImageConnectionError';
    this.provider = provider;
    this.cause = cause;
  }
}

const PROVIDER_NAMES: Record<ImageProviderId, string> = {
  a1111: 'Automatic1111',
  comfyui: 'ComfyUI',
  invokeai: 'InvokeAI',
  novelai: 'NovelAI',
  openai: 'the image API',
};

// The desktop app adds CORS headers itself, so the server-side CORS step applies to the browser only.
const BROWSER_CORS_STEP: Partial<Record<ImageProviderId, string>> = {
  a1111: 'it started with --api and --cors-allow-origins',
  comfyui: 'it started with --enable-cors-header',
  invokeai: "the app's origin is in its allow_origins",
};

/** Player-facing advice for a request that got no response from the image server. */
export function imageConnectionMessage(provider: ImageProviderId, endpointUrl: string): string {
  if (provider === 'novelai') return "Couldn't reach NovelAI. Check your internet connection.";
  const base = trimUrl(endpointUrl);
  if (provider === 'openai') return `Couldn't reach ${base}. Check the URL and your internet connection.`;
  const cors = isDesktop() ? undefined : BROWSER_CORS_STEP[provider];
  const checks = cors ? `it's running, the URL is right, and ${cors}` : "it's running and the URL is right";
  return `Couldn't reach ${PROVIDER_NAMES[provider]} at ${base}. Check that ${checks}.`;
}

/** The ImageConnectionError for one failed request, keeping the browser's own error in the details. */
export function imageConnectionError(
  provider: ImageProviderId, endpointUrl: string, method: string, url: string, cause: unknown,
): ImageConnectionError {
  const reason = cause instanceof Error ? `${cause.name}: ${cause.message}` : String(cause);
  return new ImageConnectionError(
    provider,
    imageConnectionMessage(provider, endpointUrl),
    `Request: ${method} ${redactUrl(url)}
No response: ${reason}`,
    cause,
  );
}

/** `fetch` for an image server. A network failure becomes an ImageConnectionError; aborts pass through. */
export async function reachFetch(
  provider: ImageProviderId, endpointUrl: string, url: string, init: RequestInit = {},
): Promise<Response> {
  try {
    return await fetch(url, init);
  } catch (error) {
    // fetch rejects with a TypeError for every network-level failure, and a DOMException for an abort.
    if (!(error instanceof TypeError)) throw error;
    throw imageConnectionError(provider, endpointUrl, init.method ?? 'GET', url, error);
  }
}
