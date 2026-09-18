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

// Magic-number signatures for the formats the image pipeline handles, checked against the payload's first
// bytes. WebP's needs 12 bytes (RIFF····WEBP); everything else decides in the first four.
const MAGIC: Array<{ mime: string; test: (b: Uint8Array) => boolean }> = [
  { mime: 'image/png', test: (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 },
  { mime: 'image/jpeg', test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { mime: 'image/gif', test: (b) => b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38 },
  {
    mime: 'image/webp',
    test: (b) => b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46
      && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50,
  },
  { mime: 'image/bmp', test: (b) => b[0] === 0x42 && b[1] === 0x4d },
];

/** The format a base64 data-URL's bytes actually are, from their magic numbers — '' when the payload isn't
 *  base64, is too short, or matches no known signature. */
export function sniffDataUrlMime(url: string): string {
  const comma = url.indexOf(',');
  if (comma === -1 || !url.slice(0, comma).includes(';base64')) return '';
  try {
    // 16 base64 chars → 12 bytes, enough for every signature above.
    const head = atob(url.slice(comma + 1, comma + 17));
    if (head.length < 12) return '';
    const bytes = Uint8Array.from(head, (c) => c.charCodeAt(0));
    return MAGIC.find(({ test }) => test(bytes))?.mime ?? '';
  } catch {
    return '';
  }
}

/** An image's size in pixels. */
export interface PixelSize { width: number; height: number }

// A JPEG's frame header follows its EXIF and ICC segments; 64 KB of payload covers them in practice.
const SIZE_HEAD_BYTES = 64 * 1024;

/** The first bytes of a base64 data-URL's payload, or null when it isn't base64. */
function dataUrlHead(url: string, bytes: number): Uint8Array | null {
  const comma = url.indexOf(',');
  if (!url.startsWith('data:') || comma === -1 || !url.slice(0, comma).includes(';base64')) return null;
  try {
    const chars = Math.ceil(bytes / 3) * 4;
    const b64 = url.slice(comma + 1, comma + 1 + chars);
    return Uint8Array.from(atob(b64.slice(0, b64.length - (b64.length % 4))), (c) => c.charCodeAt(0));
  } catch {
    return null;
  }
}

/** Width and height from a JPEG's first frame header (SOF0–SOF15, except DHT, JPG, and DAC). */
function jpegSize(b: Uint8Array): PixelSize | null {
  let i = 2;
  while (i + 9 < b.length) {
    if (b[i] !== 0xff) return null;
    const marker = b[i + 1];
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return { height: (b[i + 5] << 8) | b[i + 6], width: (b[i + 7] << 8) | b[i + 8] };
    }
    i += 2 + ((b[i + 2] << 8) | b[i + 3]);
  }
  return null;
}

/** Width and height from a WebP's first chunk: VP8 (lossy), VP8L (lossless), or VP8X (extended). */
function webpSize(b: Uint8Array): PixelSize | null {
  if (b.length < 30) return null;
  const chunk = String.fromCharCode(b[12], b[13], b[14], b[15]);
  if (chunk === 'VP8 ') return { width: ((b[27] << 8) | b[26]) & 0x3fff, height: ((b[29] << 8) | b[28]) & 0x3fff };
  if (chunk === 'VP8L') {
    const bits = b[21] | (b[22] << 8) | (b[23] << 16) | (b[24] << 24);
    return { width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 };
  }
  if (chunk === 'VP8X') {
    return { width: (b[24] | (b[25] << 8) | (b[26] << 16)) + 1, height: (b[27] | (b[28] << 8) | (b[29] << 16)) + 1 };
  }
  return null;
}

/**
 * An image data-URL's pixel size, read from its header bytes without decoding pixels. Null for a remote
 * URL, a truncated header, or a format other than PNG, JPEG, and WebP.
 */
export function dataUrlImageSize(url: string): PixelSize | null {
  const b = dataUrlHead(url, SIZE_HEAD_BYTES);
  if (!b || b.length < 12) return null;
  const mime = MAGIC.find(({ test }) => test(b))?.mime;
  if (mime === 'image/png') {
    if (b.length < 24) return null;
    const view = new DataView(b.buffer, b.byteOffset, b.byteLength);
    return { width: view.getUint32(16), height: view.getUint32(20) };
  }
  if (mime === 'image/jpeg') return jpegSize(b);
  if (mime === 'image/webp') return webpSize(b);
  return null;
}

/**
 * The format an image data-URL really holds: its bytes' word when recognized, its label's otherwise.
 * Labels lie — a bundled world ships a JPEG marked `image/png` — so every decision that hinges on format
 * (convertibility, animation safety, the name shown to the author) reads this instead of the label.
 */
export const dataUrlRealMime = (url: string): string => sniffDataUrlMime(url) || dataUrlMime(url);

/** Rewrite a data-URL whose label disagrees with its bytes to say what it really is. Returns the same
 *  string when the label already tells the truth or the bytes aren't recognizable. */
export function relabelDataUrl(url: string): string {
  const real = sniffDataUrlMime(url);
  if (!real || real === dataUrlMime(url)) return url;
  return url.replace(/^data:[^;,]+/, `data:${real}`);
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
  !isRemoteImage(url) && improvedByLosslessWebp(dataUrlRealMime(url));

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
  dataUrlRealMime(url) !== 'image/gif' || supportsAnimatedDecode();
