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
 */
export async function fetchCatalogContent(
  listingId: string,
  onProgress: (fraction: number) => void,
): Promise<unknown> {
  const response = await fetch(`${WorldStorageService.API_URL}/worlds/${listingId}/content`, {
    headers: AuthService.isAuthenticated() ? { 'Authorization': `Bearer ${AuthService.token}` } : {},
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
}
