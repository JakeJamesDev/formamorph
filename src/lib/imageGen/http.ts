// Small HTTP helpers shared by the image providers (A1111/Forge, ComfyUI, OpenAI-compatible).

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
