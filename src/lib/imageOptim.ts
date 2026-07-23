import type { World } from '@/types';

/** A per-use size budget for an image field. `maxDim` caps the longest edge (px); `maxBytes` the encoded size. */
export interface ImageCap {
  maxDim: number;
  maxBytes: number;
}

/** Display-driven budgets: thumbnails render ~192px, entity images in a modal, backgrounds full-viewport. */
export const IMAGE_CAPS = {
  thumbnail: { maxDim: 512, maxBytes: 200_000 },
  entity: { maxDim: 1024, maxBytes: 600_000 },
  background: { maxDim: 1920, maxBytes: 1_500_000 },
} as const satisfies Record<string, ImageCap>;

const QUALITY = 0.82;
// Rough display-only factors: lossy WebP lands near half the source; lossless keeps most of it.
const LOSSY_FACTOR = 0.5;
const LOSSLESS_FACTOR = 0.85;

// Lazy WASM animated-WebP encoder — only fetched when an animated GIF is actually encoded.
let webpPromise: Promise<typeof import('wasm-webp')> | null = null;
const loadWebp = () => (webpPromise ??= import('wasm-webp'));

// Minimal WebCodecs typings (ImageDecoder isn't in our TS lib) — used only to decode animated GIF frames.
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

async function dataUrlToBuffer(url: string): Promise<ArrayBuffer> {
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

let webpSupport: boolean | null = null;
function supportsWebp(): boolean {
  if (webpSupport === null) {
    try {
      const c = document.createElement('canvas');
      c.width = c.height = 1;
      webpSupport = c.toDataURL('image/webp').startsWith('data:image/webp');
    } catch {
      webpSupport = false;
    }
  }
  return webpSupport;
}

/** Decode a data-URL to pixel dimensions + encoded byte size. */
export async function measureDataUrl(url: string): Promise<{ w: number; h: number; bytes: number }> {
  const blob = await (await fetch(url)).blob();
  const bitmap = await createImageBitmap(blob);
  const out = { w: bitmap.width, h: bitmap.height, bytes: dataUrlBytes(url) };
  bitmap.close();
  return out;
}

/**
 * The one place the over-budget rule lives: measure `url` and describe it when it exceeds either budget —
 * catching a 4000px photo AND a small-dim multi-MB animated GIF. Null when it fits or can't be read.
 * Every scan/check below goes through this, so the rule can't drift between call sites.
 */
async function oversizedItem(url: string, cap: ImageCap, path: string): Promise<OversizedImage | null> {
  try {
    const { w, h, bytes } = await measureDataUrl(url);
    if (Math.max(w, h) > cap.maxDim || bytes > cap.maxBytes) return { path, cap, w, h, bytes, mime: dataUrlMime(url) };
  } catch {
    /* unreadable → treat as within budget */
  }
  return null;
}

/** True when the image exceeds either budget. */
export async function isOversized(url: string, cap: ImageCap): Promise<boolean> {
  return (await oversizedItem(url, cap, '')) !== null;
}

/** Scan standalone image data-URLs against one cap (e.g. character portraits), returning only the oversized
 *  ones — the flat-list sibling of `scanWorldImages`. Blank/unreadable entries are skipped. */
export async function scanImages(urls: (string | undefined | null)[], cap: ImageCap): Promise<OversizedImage[]> {
  const items: OversizedImage[] = [];
  for (const url of urls) {
    if (!url) continue;
    const item = await oversizedItem(url, cap, '');
    if (item) items.push(item);
  }
  return items;
}

export function dataUrlMime(url: string): string {
  return /^data:([^;,]+)/.exec(url)?.[1] ?? '';
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

// Decode an animated image's frames, scale each to fit `maxDim`, and re-encode as animated WebP (animation preserved).
async function encodeAnimatedImage(url: string, maxDim: number, lossless: boolean): Promise<string | null> {
  const Ctor = getImageDecoder();
  if (!Ctor) return null;
  const dec = new Ctor({ data: await dataUrlToBuffer(url), type: dataUrlMime(url) });
  await dec.tracks.ready;
  const frameCount = dec.tracks.selectedTrack?.frameCount ?? 1;
  const first = await dec.decode({ frameIndex: 0 });
  const { w, h } = fitWithin(first.image.displayWidth, first.image.displayHeight, maxDim);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
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
 * Animated GIFs/WebP re-encode to animated WebP (animation preserved); static images go through canvas. Never grows the
 * image and never throws: on any failure the original is returned.
 */
export async function encodeImageDataUrl(url: string, maxDim: number, lossless = false, allowGrow = false): Promise<string> {
  try {
    if (await isAnimatedImage(url)) {
      const anim = await encodeAnimatedImage(url, maxDim, lossless);
      return anim && (allowGrow || anim.length < url.length) ? anim : url;
    }
    const blob = await (await fetch(url)).blob();
    const bitmap = await createImageBitmap(blob);
    const { w, h } = fitWithin(bitmap.width, bitmap.height, maxDim);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return url;
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();
    // Lossless (Optimize): true VP8L via the WASM encoder — canvas WebP is lossy-only. Falls back to the
    // lossy canvas encode if the WASM encode fails. Lossy (Downscale): the fast native canvas path.
    let out: string | null = null;
    if (lossless && supportsWebp()) {
      try {
        const rgba = new Uint8Array(ctx.getImageData(0, 0, w, h).data);
        const bytes = await (await loadWebp()).encode(rgba, w, h, true, { lossless: 1, quality: 100 });
        if (bytes) out = bytesToDataUrl(bytes, 'image/webp');
      } catch {
        out = null; // fall through to the canvas encode below
      }
    }
    if (!out) out = canvas.toDataURL(supportsWebp() ? 'image/webp' : 'image/jpeg', QUALITY);
    // Guard against re-encode growing a small/optimized image (e.g. lossless of an already-compressed source),
    // unless the caller requires the re-encoded container regardless of size (allowGrow).
    return out && (allowGrow || out.length < url.length) ? out : url;
  } catch {
    return url;
  }
}

/** Convert to lossless WebP at the original resolution (no downscale) — quality-preserving. */
export const reencodeImageDataUrl = (url: string): Promise<string> => encodeImageDataUrl(url, Infinity, true);

/** Downscale to the cap and re-encode to (lossy) WebP. */
export const optimizeImageDataUrl = (url: string, cap: ImageCap): Promise<string> =>
  encodeImageDataUrl(url, cap.maxDim, false);

/** Like optimizeImageDataUrl but keeps the WebP result even when it's larger than the source — for callers
 *  that require the WebP container (character cards embed metadata in a WebP chunk, so a returned PNG/JPEG
 *  would be unusable). Still falls back to the source only if WebP encoding is unavailable/fails. */
export const optimizeToWebpDataUrl = (url: string, cap: ImageCap): Promise<string> =>
  encodeImageDataUrl(url, cap.maxDim, false, true);

/** Rough display-only estimate of the encoded size for each option (real size is only known after encoding). */
export function estimateEncodedBytes(
  bytes: number, w: number, h: number, mode: 'reencode' | 'downscale', cap: ImageCap,
): number {
  // Optimize is lossless (keeps most bytes); Downscale is lossy and area-scaled to the cap.
  if (mode === 'reencode') return Math.round(bytes * LOSSLESS_FACTOR);
  const fit = fitWithin(w, h, cap.maxDim);
  return Math.round(bytes * LOSSY_FACTOR * (fit.w * fit.h) / (w * h));
}

/** One oversized image found in a world, tagged with which field it came from. */
export interface OversizedImage {
  path: string;
  cap: ImageCap;
  w: number;
  h: number;
  bytes: number;
  mime: string;
}

type ImageSlot = { url: string; cap: ImageCap; path: string };

/** Every image field in a world, paired with its budget. Absent fields are skipped. */
function worldImageSlots(world: World): ImageSlot[] {
  const slots: ImageSlot[] = [];
  const thumb = world.worldOverview?.thumbnail;
  if (thumb) slots.push({ url: thumb, cap: IMAGE_CAPS.thumbnail, path: 'thumbnail' });
  for (const e of world.entities ?? []) {
    if (e.image) slots.push({ url: e.image, cap: IMAGE_CAPS.entity, path: `entity:${e.id}` });
  }
  for (const l of world.locations ?? []) {
    if (l.backgroundImage) slots.push({ url: l.backgroundImage, cap: IMAGE_CAPS.background, path: `location:${l.id}` });
  }
  return slots;
}

/** Scan a world for images exceeding their budget. Returns only the oversized ones plus their total bytes. */
export async function scanWorldImages(world: World): Promise<{ items: OversizedImage[]; totalBytes: number }> {
  const items: OversizedImage[] = [];
  for (const slot of worldImageSlots(world)) {
    const item = await oversizedItem(slot.url, slot.cap, slot.path);
    if (item) items.push(item);
  }
  return { items, totalBytes: items.reduce((sum, i) => sum + i.bytes, 0) };
}

/** Injectable deps so the field-walking logic is unit-testable without a real canvas. */
export interface DownscaleDeps {
  optimize: (url: string, cap: ImageCap) => Promise<string>;
  isOversized: (url: string, cap: ImageCap) => Promise<boolean>;
}

const REAL_DEPS: DownscaleDeps = { optimize: optimizeImageDataUrl, isOversized };

/** Deps for the "Optimize" (WebP, keep resolution) world pass — same oversized-gating, no downscale. */
export const REENCODE_DEPS: DownscaleDeps = { optimize: (url) => reencodeImageDataUrl(url), isOversized };

/** An image-handling choice offered on import: leave images as-is, optimize (lossless WebP), or downscale. */
export type OptimizeMode = 'off' | 'optimize' | 'downscale';

/** The world/image deps for a mode, or null for 'off' (no re-encoding). */
function depsForMode(mode: OptimizeMode): DownscaleDeps | null {
  return mode === 'optimize' ? REENCODE_DEPS : mode === 'downscale' ? REAL_DEPS : null;
}

/** Apply an optimize mode to every oversized image in a world; a no-op (returns the same world) for 'off'. */
export async function applyWorldOptimize(world: World, mode: OptimizeMode): Promise<World> {
  const deps = depsForMode(mode);
  return deps ? downscaleWorldImages(world, deps) : world;
}

/** Apply an optimize mode to a single image data-URL (e.g. a character portrait); no-op for 'off' or within-budget. */
export async function applyImageOptimize(
  url: string | undefined | null,
  mode: OptimizeMode,
  cap: ImageCap = IMAGE_CAPS.entity,
): Promise<string | undefined | null> {
  const deps = depsForMode(mode);
  if (!deps || !url) return url;
  return (await deps.isOversized(url, cap)) ? deps.optimize(url, cap) : url;
}

/**
 * Return a new world with every oversized image re-encoded in place (shape-preserving — still a data-URL). Only
 * the three image fields are touched; all other data is passed through untouched.
 */
export async function downscaleWorldImages(world: World, deps: DownscaleDeps = REAL_DEPS): Promise<World> {
  const opt = async (url: string | undefined | null, cap: ImageCap): Promise<string | undefined | null> =>
    url && (await deps.isOversized(url, cap)) ? deps.optimize(url, cap) : url;

  const thumbnail = await opt(world.worldOverview?.thumbnail, IMAGE_CAPS.thumbnail);
  const entities = await Promise.all(
    (world.entities ?? []).map(async (e) => ({ ...e, image: (await opt(e.image, IMAGE_CAPS.entity)) ?? undefined })),
  );
  const locations = await Promise.all(
    (world.locations ?? []).map(async (l) => ({
      ...l,
      backgroundImage: (await opt(l.backgroundImage, IMAGE_CAPS.background)) ?? undefined,
    })),
  );

  return {
    ...world,
    worldOverview: { ...world.worldOverview, thumbnail: thumbnail ?? null },
    entities,
    locations,
  };
}

/** Human-readable byte size for prompt copy. */
export function formatBytes(bytes: number): string {
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`;
  if (bytes >= 1_000) return `${Math.round(bytes / 1_000)} KB`;
  return `${bytes} B`;
}
