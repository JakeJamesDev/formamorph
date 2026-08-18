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

/**
 * True for a link that will stop resolving on its own. Discord signs attachment URLs with `ex`/`is`/`hm`
 * params and drops them when `ex` passes, so a picture an author checked today is gone later.
 *
 * Matched on the path, not the host: Discord's other CDN endpoints — avatars, emojis, guild and app icons —
 * are unsigned and permanent, and flagging those would nag authors using a link that is actually fine.
 */
export const isExpiringImageHost = (url: string | null | undefined): boolean =>
  typeof url === 'string'
  && /^https?:\/\/(cdn\.discordapp\.com|media\.discordapp\.net)\/attachments\//i.test(url.trim());

/** The host an author would recognize, for failure messages. Falls back to the raw value if unparseable. */
export const imageHost = (url: string): string => {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
};

/**
 * True when re-encoding this format as lossless WebP genuinely makes it smaller. PNG, GIF and BMP all carry
 * bytes WebP's lossless mode reclaims for free; JPEG does not (a lossless copy of it grows, and a lossy one
 * costs quality), SVG is text that would only get bigger as pixels, and WebP is already there.
 *
 * The one answer the World Doctor rule, its Fix, and the Optimize popup all read, so the three surfaces
 * cannot disagree about what counts as convertible.
 */
export function improvedByLosslessWebp(mime: string): boolean {
  return mime === 'image/png' || mime === 'image/gif' || mime === 'image/bmp' || mime === 'image/x-ms-bmp';
}

/**
 * True when a stored image is one a lossless WebP conversion genuinely improves: it carries its own bytes
 * (a remote link carries none of the world's) and its format has something to gain. The World Doctor rule
 * and its Fix both ask this, so the row and the run cannot disagree about what the Fix is for.
 */
export const isConvertibleImage = (url: string): boolean =>
  !isRemoteImage(url) && improvedByLosslessWebp(dataUrlMime(url));

/** An image format as an author would name it — `PNG`, `GIF`, `BMP`. */
export const imageFormatLabel = (mime: string): string =>
  mime.replace(/^image\/(x-ms-)?/, '').toUpperCase();

/**
 * True when the browser can decode an animated image's frames (WebCodecs `ImageDecoder`). Without it the
 * encoder has no animation-preserving path, so a GIF would come back as a single flattened frame.
 */
export const supportsAnimatedDecode = (): boolean => 'ImageDecoder' in globalThis;

/**
 * True when re-encoding this image keeps everything it is: any static format always, a GIF only when the
 * browser can decode its frames. The Optimize pass and the World Doctor's Fix both gate on this, so neither
 * ever flattens an animation the other would have kept.
 */
export const reencodeKeepsAnimation = (url: string): boolean =>
  dataUrlMime(url) !== 'image/gif' || supportsAnimatedDecode();
