import WorldStorageService from '@/services/WorldStorageService';
import AuthService from '@/services/AuthService';
import { responseError } from '@/services/responseError';

/** A timer this late means the page was frozen or throttled, so it says nothing about the server. */
const LATE_TIMER_MS = 5_000;

/** The message a stalled download rejects with, whatever text the browser gives its own abort. */
export function downloadStalledMessage(stallMs: number): string {
  return `The download stopped. No data arrived for ${Math.round(stallMs / 1000)} seconds. Try again.`;
}

/**
 * Fetch a community listing's stored content, streaming the body so a large download can report progress.
 *
 * Shared by every kind: the server serves worlds, characters, and dictionaries from one content route,
 * wrapping each payload in `data.contentData`. What differs — migrating a world, resolving a thumbnail,
 * which library to store into — belongs to the caller.
 *
 * `onProgress` receives a 0–1 fraction, or `-1` when the size is unknown (a missing or compressed
 * `Content-Length`) so a caller can show an indeterminate bar rather than a wrong one.
 *
 * `opts.signal` lets a caller cancel; `opts.stallTimeoutMs` (default 30s) aborts if the server goes quiet
 * while the page is running — without either, a stalled connection would leave `reader.read()` pending
 * forever with no way out. Time spent hidden or frozen never counts toward the stall.
 */
export async function fetchCatalogContent(
  listingId: string,
  onProgress: (fraction: number) => void,
  opts: { signal?: AbortSignal; stallTimeoutMs?: number } = {},
): Promise<unknown> {
  const stallMs = opts.stallTimeoutMs ?? 30_000;
  const controller = new AbortController();
  const doc = typeof document === 'undefined' ? undefined : document;
  let stalled = false;
  // Reset on every sign of progress (headers, each chunk, the page showing again).
  let stallTimer: ReturnType<typeof setTimeout> | undefined;
  let due = 0;
  const armStall = () => {
    clearTimeout(stallTimer);
    due = Date.now() + stallMs;
    stallTimer = setTimeout(onStallTimer, stallMs);
  };
  const onStallTimer = () => {
    if (doc?.visibilityState === 'hidden' || Date.now() - due > LATE_TIMER_MS) {
      armStall();
      return;
    }
    stalled = true;
    controller.abort(new DOMException('Download stalled', 'TimeoutError'));
  };
  const onShown = () => { if (doc?.visibilityState !== 'hidden') armStall(); };
  const onExternalAbort = () => controller.abort(opts.signal?.reason);
  if (opts.signal?.aborted) controller.abort(opts.signal.reason);
  else opts.signal?.addEventListener('abort', onExternalAbort, { once: true });

  armStall();
  doc?.addEventListener('visibilitychange', onShown);
  doc?.addEventListener('resume', onShown);
  try {
    const response = await fetch(`${WorldStorageService.API_URL}/worlds/${listingId}/content`, {
      headers: AuthService.isAuthenticated() ? { 'Authorization': `Bearer ${AuthService.token}` } : {},
      signal: controller.signal,
    });
    armStall();

    if (!response.ok) throw await responseError(response, 'Failed to download', ['message', 'error']);

    const total = Number(response.headers.get('Content-Length')) || 0;
    const reader = response.body?.getReader();
    let payload: { success?: boolean; data?: { contentData?: unknown } };

    if (reader) {
      const decoder = new TextDecoder();
      let text = '';
      let received = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        armStall();
        received += value.length;
        // Decoded incrementally: a multi-byte character can straddle two chunks, and decoding each chunk
        // independently would split it.
        text += decoder.decode(value, { stream: true });
        onProgress(total ? Math.min(received / total, 1) : -1);
      }
      text += decoder.decode();
      payload = JSON.parse(text);
    } else {
      // No streaming available — take the body whole and report an indeterminate bar.
      payload = await response.json();
    }

    if (!payload.success || !payload.data) {
      throw new Error('Invalid data received');
    }

    return payload.data.contentData;
  } catch (error) {
    // Older browsers drop the abort reason and reject with a generic "The user aborted a request."
    if (stalled) throw new Error(downloadStalledMessage(stallMs), { cause: error });
    throw error;
  } finally {
    clearTimeout(stallTimer);
    doc?.removeEventListener('visibilitychange', onShown);
    doc?.removeEventListener('resume', onShown);
    opts.signal?.removeEventListener('abort', onExternalAbort);
  }
}
