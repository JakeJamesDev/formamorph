import WorldStorageService from '@/services/WorldStorageService';
import AuthService from '@/services/AuthService';

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
 * mid-body — without either, a stalled connection would leave `reader.read()` pending forever with no way out.
 */
export async function fetchCatalogContent(
  listingId: string,
  onProgress: (fraction: number) => void,
  opts: { signal?: AbortSignal; stallTimeoutMs?: number } = {},
): Promise<unknown> {
  const stallMs = opts.stallTimeoutMs ?? 30_000;
  const controller = new AbortController();
  // Reset on every sign of progress (headers, each chunk); fire => no data for `stallMs` => give up.
  let stallTimer: ReturnType<typeof setTimeout> | undefined;
  const armStall = () => {
    clearTimeout(stallTimer);
    stallTimer = setTimeout(() => controller.abort(new DOMException('Download stalled', 'TimeoutError')), stallMs);
  };
  const onExternalAbort = () => controller.abort(opts.signal?.reason);
  if (opts.signal?.aborted) controller.abort(opts.signal.reason);
  else opts.signal?.addEventListener('abort', onExternalAbort, { once: true });

  armStall();
  try {
    const response = await fetch(`${WorldStorageService.API_URL}/worlds/${listingId}/content`, {
      headers: AuthService.isAuthenticated() ? { 'Authorization': `Bearer ${AuthService.token}` } : {},
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || errorData.error || 'Failed to download');
    }

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
        armStall(); // progress — restart the stall clock
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
  } finally {
    clearTimeout(stallTimer);
    opts.signal?.removeEventListener('abort', onExternalAbort);
  }
}
