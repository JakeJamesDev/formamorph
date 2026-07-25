/**
 * The heavy image-encode core: decode → downscale → re-encode to WebP (JPEG fallback). Written to run in a Web
 * Worker as well as on the main thread — it uses `OffscreenCanvas` (never `document`) and takes `webpSupported`
 * as a parameter, since the main-thread `canvas.toDataURL` WebP probe isn't available off-thread.
 *
 * Never grows an image (unless `allowGrow`) and never throws: on any failure the caller gets the original URL.
 */
import { bytesToDataUrl, dataUrlBytes, dataUrlMime, dataUrlToBuffer, fitWithin } from './imageBytes';

const QUALITY = 0.82;

// Lazy WASM lossless/animated-WebP encoder — only fetched when actually encoding. Kept dynamic (not a static
// import) so this module stays evaluable in non-browser contexts (vitest) that can't load the CJS glue, and so
// wasm-webp lands in its own chunk. The worker bundles it inline via `worker.rollupOptions` in vite.config.
let webpPromise: Promise<typeof import('wasm-webp')> | null = null;
const loadWebp = () => (webpPromise ??= import('wasm-webp'));

// Minimal WebCodecs typings (ImageDecoder isn't in our TS lib) — used only to decode animated GIF/WebP frames.
interface VideoFrameLike { duration: number | null; displayWidth: number; displayHeight: number; close(): void }
interface ImageTrack { frameCount: number }
interface ImageTrackList { ready: Promise<void>; selectedTrack: ImageTrack | null }
interface ImageDecoderInstance {
  tracks: ImageTrackList;
  decode(opts: { frameIndex: number }): Promise<{ image: VideoFrameLike }>;
  close(): void;
}
interface ImageDecoderCtor { new (init: { data: BufferSource; type: string }): ImageDecoderInstance }
function getImageDecoder(): ImageDecoderCtor | null {
  return (globalThis as unknown as { ImageDecoder?: ImageDecoderCtor }).ImageDecoder ?? null;
}

// Formats whose frames we can decode + re-encode without flattening the animation.
const ANIMATABLE = new Set(['image/gif', 'image/webp']);

/**
 * True for a multi-frame GIF or WebP (so re-encoding a previously-optimized animated WebP stays animated). Needs
 * WebCodecs `ImageDecoder`; without it (Safari) we report false → static path.
 */
export async function isAnimatedImage(url: string): Promise<boolean> {
  const mime = dataUrlMime(url);
  if (!ANIMATABLE.has(mime)) return false;
  const Ctor = getImageDecoder();
  if (!Ctor) return false;
  try {
    const dec = new Ctor({ data: await dataUrlToBuffer(url), type: mime });
    await dec.tracks.ready;
    const count = dec.tracks.selectedTrack?.frameCount ?? 1;
    dec.close();
    return count > 1;
  } catch {
    return false;
  }
}

/** Decode a data-URL to pixel dimensions + encoded byte size. Worker-safe (fetch + createImageBitmap). */
export async function measureImageDataUrl(url: string): Promise<{ w: number; h: number; bytes: number }> {
  const blob = await (await fetch(url)).blob();
  const bitmap = await createImageBitmap(blob);
  const out = { w: bitmap.width, h: bitmap.height, bytes: dataUrlBytes(url) };
  bitmap.close();
  return out;
}

/** Encode an OffscreenCanvas to a data-URL via `convertToBlob` (the worker-safe replacement for `toDataURL`). */
async function canvasToDataUrl(canvas: OffscreenCanvas, mime: string, quality: number): Promise<string> {
  const blob = await canvas.convertToBlob({ type: mime, quality });
  return bytesToDataUrl(new Uint8Array(await blob.arrayBuffer()), blob.type || mime);
}

// Decode an animated image's frames, scale each to fit `maxDim`, and re-encode as animated WebP (animation preserved).
async function encodeAnimatedImage(url: string, maxDim: number, lossless: boolean): Promise<string | null> {
  const Ctor = getImageDecoder();
  if (!Ctor) return null;
  const dec = new Ctor({ data: await dataUrlToBuffer(url), type: dataUrlMime(url) });
  await dec.tracks.ready;
  const frameCount = dec.tracks.selectedTrack?.frameCount ?? 1;
  const first = await dec.decode({ frameIndex: 0 });
  const { w, h } = fitWithin(first.image.displayWidth, first.image.displayHeight, maxDim);
  const canvas = new OffscreenCanvas(w, h);
  const ctx = canvas.getContext('2d');
  if (!ctx) { first.image.close(); dec.close(); return null; }

  const quality = Math.round(QUALITY * 100);
  const frames: { data: Uint8Array; duration: number; config: { lossless: number; quality: number } }[] = [];
  for (let i = 0; i < frameCount; i++) {
    const { image } = i === 0 ? first : await dec.decode({ frameIndex: i });
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(image as unknown as CanvasImageSource, 0, 0, w, h);
    const durationUs = image.duration ?? 100_000; // VideoFrame.duration is microseconds; default 100ms
    image.close();
    frames.push({
      data: new Uint8Array(ctx.getImageData(0, 0, w, h).data),
      duration: Math.max(1, Math.round(durationUs / 1000)),
      config: { lossless: lossless ? 1 : 0, quality },
    });
  }
  dec.close();

  const { encodeAnimation } = await loadWebp();
  const out = await encodeAnimation(w, h, true, frames);
  return out ? bytesToDataUrl(out, 'image/webp') : null;
}

/**
 * Re-encode an image data-URL to WebP (JPEG fallback), scaling down to `maxDim` (use Infinity to keep resolution).
 * Animated GIFs/WebP re-encode to animated WebP (animation preserved); static images go through OffscreenCanvas.
 * `webpSupported` gates the WebP output (the main thread probes it; the worker is told). Never grows unless
 * `allowGrow`; never throws — the original URL is returned on any failure.
 */
export async function encodeImageDataUrl(
  url: string, maxDim: number, webpSupported: boolean, lossless = false, allowGrow = false,
): Promise<string> {
  try {
    if (await isAnimatedImage(url)) {
      const anim = await encodeAnimatedImage(url, maxDim, lossless);
      return anim && (allowGrow || anim.length < url.length) ? anim : url;
    }
    const blob = await (await fetch(url)).blob();
    const bitmap = await createImageBitmap(blob);
    const { w, h } = fitWithin(bitmap.width, bitmap.height, maxDim);
    const canvas = new OffscreenCanvas(w, h);
    const ctx = canvas.getContext('2d');
    if (!ctx) { bitmap.close(); return url; }
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();
    // Lossless (Optimize): true VP8L via the WASM encoder — canvas WebP is lossy-only. Falls back to the
    // lossy canvas encode if the WASM encode fails. Lossy (Downscale): the fast OffscreenCanvas path.
    let out: string | null = null;
    if (lossless && webpSupported) {
      try {
        const rgba = new Uint8Array(ctx.getImageData(0, 0, w, h).data);
        const bytes = await (await loadWebp()).encode(rgba, w, h, true, { lossless: 1, quality: 100 });
        if (bytes) out = bytesToDataUrl(bytes, 'image/webp');
      } catch {
        out = null; // fall through to the canvas encode below
      }
    }
    if (!out) out = await canvasToDataUrl(canvas, webpSupported ? 'image/webp' : 'image/jpeg', QUALITY);
    // Guard against re-encode growing a small/optimized image (e.g. lossless of an already-compressed source),
    // unless the caller requires the re-encoded container regardless of size (allowGrow).
    return out && (allowGrow || out.length < url.length) ? out : url;
  } catch {
    return url;
  }
}
