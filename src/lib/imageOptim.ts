import type { Entity, World } from '@/types';
import { dataUrlRealMime, fitWithin, isConvertibleImage, isRemoteImage, reencodeKeepsAnimation } from './imageBytes';
import { encodeInWorker, measureInWorker } from './imageOptimWorkerClient';
import { entityImages } from './entityImages';

// Re-exported so existing importers (character cards, image-gen providers, tests) keep their `@/lib/imageOptim`
// import paths — the pure helpers now live in the DOM-free leaf module `imageBytes`.
export { bytesToDataUrl, dataUrlBytes, dataUrlMime, fitWithin } from './imageBytes';

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

// Rough display-only factors: lossy WebP lands near half the source; lossless keeps most of it.
const LOSSY_FACTOR = 0.5;
const LOSSLESS_FACTOR = 0.85;

/** Decode a data-URL to pixel dimensions + encoded byte size. Runs off-thread. */
export const measureDataUrl = (url: string): Promise<{ w: number; h: number; bytes: number }> =>
  measureInWorker(url);

/**
 * The one place the scan rule lives: measure `url` and describe it when the popup has something to offer —
 * over either budget (a 4000px photo, a small-dim multi-MB animated GIF), or a format a lossless WebP
 * shrinks at any size. Null when neither applies or it can't be read. Every scan/check below goes through
 * this, so the rule can't drift between call sites.
 */
async function scanItem(url: string, cap: ImageCap, path: string): Promise<ScannedImage | null> {
  // A linked image contributes no bytes to the world, so no budget applies — and the worker's fetch of a
  // cross-origin URL would only fail into the catch below anyway.
  if (isRemoteImage(url)) return null;
  // A GIF this browser can't re-decode is offered nothing lossless — converting it would flatten it.
  const convertible = isConvertibleImage(url) && reencodeKeepsAnimation(url);
  try {
    const { w, h, bytes } = await measureDataUrl(url);
    const oversized = Math.max(w, h) > cap.maxDim || bytes > cap.maxBytes;
    if (oversized || convertible) return { path, cap, w, h, bytes, mime: dataUrlRealMime(url), oversized, convertible };
  } catch {
    /* unreadable → treat as within budget */
  }
  return null;
}

/** True when the image exceeds either budget. */
export async function isOversized(url: string, cap: ImageCap): Promise<boolean> {
  return (await scanItem(url, cap, ''))?.oversized ?? false;
}

/** Scan standalone image data-URLs against one cap (e.g. character portraits), returning the ones worth
 *  offering to re-encode — the flat-list sibling of `scanWorldImages`. Blank/unreadable entries are skipped. */
export async function scanImages(urls: (string | undefined | null)[], cap: ImageCap): Promise<ScannedImage[]> {
  const items: ScannedImage[] = [];
  for (const url of urls) {
    if (!url) continue;
    const item = await scanItem(url, cap, '');
    if (item) items.push(item);
  }
  return items;
}

/** Convert to lossless WebP at the original resolution (no downscale) — quality-preserving. Runs off-thread. */
export const reencodeImageDataUrl = (url: string): Promise<string> => encodeInWorker(url, Infinity, true);

/** Downscale to the cap and re-encode to (lossy) WebP. Runs off-thread. */
export const optimizeImageDataUrl = (url: string, cap: ImageCap): Promise<string> =>
  encodeInWorker(url, cap.maxDim, false);

/** Like optimizeImageDataUrl but keeps the WebP result even when it's larger than the source — for callers
 *  that require the WebP container (character cards embed metadata in a WebP chunk, so a returned PNG/JPEG
 *  would be unusable). Still falls back to the source only if WebP encoding is unavailable/fails. */
export const optimizeToWebpDataUrl = (url: string, cap: ImageCap): Promise<string> =>
  encodeInWorker(url, cap.maxDim, false, true);

/** Rough display-only estimate of the encoded size for each option (real size is only known after encoding). */
export function estimateEncodedBytes(
  bytes: number, w: number, h: number, mode: 'reencode' | 'downscale', cap: ImageCap,
): number {
  // Optimize is lossless (keeps most bytes); Downscale is lossy and area-scaled to the cap.
  if (mode === 'reencode') return Math.round(bytes * LOSSLESS_FACTOR);
  const fit = fitWithin(w, h, cap.maxDim);
  return Math.round(bytes * LOSSY_FACTOR * (fit.w * fit.h) / (w * h));
}

/** One image a scan surfaced, tagged with which field it came from and why it's listed. */
export interface ScannedImage {
  path: string;
  cap: ImageCap;
  w: number;
  h: number;
  bytes: number;
  mime: string;
  /** Exceeds either budget — what Downscale acts on. */
  oversized: boolean;
  /** A lossless WebP would shrink it (and re-encoding is safe) — what Optimize acts on. */
  convertible: boolean;
}

type ImageSlot = { url: string; cap: ImageCap; path: string };

/** Every image field in a world, paired with its budget. Absent fields are skipped. */
function worldImageSlots(world: World): ImageSlot[] {
  const slots: ImageSlot[] = [];
  const thumb = world.worldOverview?.thumbnail;
  if (thumb) slots.push({ url: thumb, cap: IMAGE_CAPS.thumbnail, path: 'thumbnail' });
  for (const e of world.entities ?? []) {
    // Every picture in the gallery counts, so a world's second and third portraits are budgeted like the first.
    entityImages(e).forEach((url, i) => slots.push({ url, cap: IMAGE_CAPS.entity, path: `entity:${e.id}:${i}` }));
  }
  for (const l of world.locations ?? []) {
    if (l.backgroundImage) slots.push({ url: l.backgroundImage, cap: IMAGE_CAPS.background, path: `location:${l.id}` });
  }
  return slots;
}

/** How many image-bearing slots a world has — the `total` of an optimize run's progress. */
export const countWorldImages = (world: World): number => worldImageSlots(world).length;

/** A world's images keyed by the `path` a scan tagged them with — how a caller reads back what one scanned
 *  image became once a run finished with it. */
export const worldImagesByPath = (world: World): Map<string, string> =>
  new Map(worldImageSlots(world).map((slot) => [slot.path, slot.url]));

/** Scan a world for images worth offering to re-encode — over budget or losslessly convertible — plus their
 *  total bytes. */
export async function scanWorldImages(world: World): Promise<{ items: ScannedImage[]; totalBytes: number }> {
  const items: ScannedImage[] = [];
  for (const slot of worldImageSlots(world)) {
    const item = await scanItem(slot.url, slot.cap, slot.path);
    if (item) items.push(item);
  }
  return { items, totalBytes: items.reduce((sum, i) => sum + i.bytes, 0) };
}

/** Injectable deps so the field-walking logic is unit-testable without a real canvas. */
export interface DownscaleDeps {
  optimize: (url: string, cap: ImageCap) => Promise<string>;
  /** Whether this mode re-encodes the image at all — the per-mode gate the walk asks before dispatching. */
  shouldEncode: (url: string, cap: ImageCap) => Promise<boolean>;
}

/** Downscale cares about large files: only images over their budget are touched. */
const REAL_DEPS: DownscaleDeps = { optimize: optimizeImageDataUrl, shouldEncode: isOversized };

/** Deps for the "Optimize" (WebP, keep resolution) world pass: every losslessly convertible image at any
 *  size — Optimize is about total world size, not display budgets. */
export const REENCODE_DEPS: DownscaleDeps = {
  optimize: (url) => reencodeImageDataUrl(url),
  shouldEncode: (url) => Promise.resolve(isConvertibleImage(url) && reencodeKeepsAnimation(url)),
};

/** An image-handling choice offered on import: leave images as-is, optimize (lossless WebP), or downscale. */
export type OptimizeMode = 'off' | 'optimize' | 'downscale';

/** The world/image deps for a mode, or null for 'off' (no re-encoding). */
function depsForMode(mode: OptimizeMode): DownscaleDeps | null {
  return mode === 'optimize' ? REENCODE_DEPS : mode === 'downscale' ? REAL_DEPS : null;
}

/** Apply an optimize mode to every image the mode selects in a world; a no-op (returns the same world) for
 *  'off'. `onProgress(done, total)` reports per-image progress; an aborted `signal` rejects with an
 *  AbortError (see `downscaleWorldImages`). */
export async function applyWorldOptimize(
  world: World,
  mode: OptimizeMode,
  onProgress?: (done: number, total: number) => void,
  signal?: AbortSignal,
): Promise<World> {
  const deps = depsForMode(mode);
  return deps ? downscaleWorldImages(world, deps, onProgress, signal) : world;
}

/** Apply an optimize mode to a single image data-URL (e.g. a character portrait); no-op for 'off' or when
 *  the mode has nothing to do with it. */
export async function applyImageOptimize(
  url: string | undefined | null,
  mode: OptimizeMode,
  cap: ImageCap = IMAGE_CAPS.entity,
): Promise<string | undefined | null> {
  const deps = depsForMode(mode);
  if (!deps || !url) return url;
  return (await deps.shouldEncode(url, cap)) ? deps.optimize(url, cap) : url;
}

/**
 * Apply an optimize mode across one entity's whole gallery, so a second or third picture is re-encoded on the
 * same terms as its primary. `onImage` fires per picture for progress; a no-op mode ticks nothing and returns
 * the entity untouched.
 */
export async function applyEntityImagesOptimize(
  entity: Entity,
  mode: OptimizeMode,
  onImage?: () => void,
): Promise<Entity> {
  if (mode === 'off') return entity;
  const images: string[] = [];
  for (const url of entityImages(entity)) {
    images.push((await applyImageOptimize(url, mode, IMAGE_CAPS.entity)) ?? url);
    onImage?.();
  }
  return images.length ? { ...entity, images } : entity;
}

/**
 * Return a new world with every image the deps select re-encoded in place (shape-preserving — still a data-URL).
 * Only the three image fields are touched; all other data is passed through untouched. `onProgress(done, total)`
 * fires once per image-bearing slot as it resolves (monotonic; skipped slots tick too so the bar still fills).
 *
 * Slots are processed sequentially — the encode worker serializes them anyway (the WASM encode is one long
 * synchronous call), and dispatching one at a time is what lets `signal` actually stop the run between images:
 * an aborted signal rejects with an AbortError before the next slot is sent, so an abandoned run (e.g. the
 * editor closed mid-optimize) frees the worker within at most one in-flight image.
 */
export async function downscaleWorldImages(
  world: World,
  deps: DownscaleDeps = REAL_DEPS,
  onProgress?: (done: number, total: number) => void,
  signal?: AbortSignal,
): Promise<World> {
  const total = countWorldImages(world);
  let done = 0;
  onProgress?.(0, total);
  const opt = async (url: string | undefined | null, cap: ImageCap): Promise<string | undefined | null> => {
    if (!url) return url;
    if (signal?.aborted) throw new DOMException('Optimize canceled', 'AbortError');
    const result = (await deps.shouldEncode(url, cap)) ? await deps.optimize(url, cap) : url;
    onProgress?.(++done, total);
    return result;
  };

  const thumbnail = await opt(world.worldOverview?.thumbnail, IMAGE_CAPS.thumbnail);
  const entities: World['entities'] = [];
  for (const e of world.entities ?? []) {
    const images: string[] = [];
    for (const url of entityImages(e)) images.push((await opt(url, IMAGE_CAPS.entity)) ?? url);
    entities.push({ ...e, images });
  }
  const locations: World['locations'] = [];
  for (const l of world.locations ?? []) {
    locations.push({ ...l, backgroundImage: (await opt(l.backgroundImage, IMAGE_CAPS.background)) ?? undefined });
  }

  return {
    ...world,
    worldOverview: { ...world.worldOverview, thumbnail: thumbnail ?? null },
    entities,
    locations,
  };
}

/**
 * The one sentence both optimize flows use for images a run left exactly as they were. The encoder keeps
 * anything a WebP copy would grow, so a run can finish with the same offer still standing — said out loud
 * that reads as a fact about the images rather than a button that did nothing. Empty when nothing was kept.
 */
export function describeKeptImages(kept: number): string {
  if (kept <= 0) return '';
  return kept === 1
    ? 'Kept 1 image as it was — WebP wouldn’t make it smaller.'
    : `Kept ${kept} images as they were — WebP wouldn’t make them smaller.`;
}

/** Human-readable byte size for prompt copy. */
export function formatBytes(bytes: number): string {
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`;
  if (bytes >= 1_000) return `${Math.round(bytes / 1_000)} KB`;
  return `${bytes} B`;
}
