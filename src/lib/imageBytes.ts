/**
 * DOM-free byte/geometry helpers shared by the image-optimize pipeline. Kept as a leaf module (no canvas,
 * worker, or app imports) so both the main thread and the encode worker can pull it in without dragging the
 * worker client — or a `new Worker` — into the worker's own bundle.
 */

/** Read a data-URL's bytes as an ArrayBuffer (works on the main thread and in a worker). */
export async function dataUrlToBuffer(url: string): Promise<ArrayBuffer> {
  return (await fetch(url)).arrayBuffer();
}

export function bytesToDataUrl(bytes: Uint8Array, mime: string): string {
  let binary = '';
  const chunk = 0x8000; // chunk the fromCharCode spread so a large buffer doesn't blow the arg limit
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return `data:${mime};base64,${btoa(binary)}`;
}

/** Downscale-only box fit: the largest w/h that fits within `maxDim` at the original aspect. Never upscales. */
export function fitWithin(w: number, h: number, maxDim: number): { w: number; h: number } {
  const longEdge = Math.max(w, h);
  if (longEdge <= maxDim) return { w, h };
  const scale = maxDim / longEdge;
  return { w: Math.max(1, Math.round(w * scale)), h: Math.max(1, Math.round(h * scale)) };
}

/** Approximate decoded byte size of a base64 data-URL from its payload length. */
export function dataUrlBytes(url: string): number {
  const comma = url.indexOf(',');
  const b64 = comma === -1 ? url : url.slice(comma + 1);
  const padding = b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0;
  return Math.max(0, Math.floor((b64.length * 3) / 4) - padding);
}

export function dataUrlMime(url: string): string {
  return /^data:([^;,]+)/.exec(url)?.[1] ?? '';
}

/**
 * True when a stored image value points at a remote host rather than carrying its own bytes. Lives in this
 * leaf module so the optimize pipeline can ask without importing the fetch/DOM side of `imageSource`.
 */
export const isRemoteImage = (url: string | null | undefined): boolean =>
  typeof url === 'string' && /^https?:\/\//i.test(url.trim());

/** The host an author would recognize, for failure messages. Falls back to the raw value if unparseable. */
export const imageHost = (url: string): string => {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
};
