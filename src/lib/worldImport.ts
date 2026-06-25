import type { MediaAsset } from '@/types';

/**
 * Normalize a world's custom player VRM into our `MediaAsset` shape on import.
 *
 * Accepts:
 * - our own `{ data, type }` object (data is a base64 data-URL),
 * - a bare data-URL **string** — v1.2/v1.3 stored the VRM as a top-level `customPlayerVRM`
 *   data URL (e.g. `data:application/octet-stream;base64,…`) rather than a `{ data, type }` object,
 * - `null`/`undefined`/anything else → `null`.
 */
export function normalizeCustomVRM(raw: unknown): MediaAsset | null {
  if (!raw) return null;
  if (typeof raw === 'string') {
    return raw.startsWith('data:') ? { data: raw, type: 'model/vrm' } : null;
  }
  if (typeof raw === 'object') {
    const asset = raw as { data?: unknown; type?: unknown };
    if (typeof asset.data === 'string' && asset.data) {
      return { data: asset.data, type: typeof asset.type === 'string' ? asset.type : 'model/vrm' };
    }
  }
  return null;
}
