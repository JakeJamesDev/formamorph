/**
 * The optimize rules and field walks, over an injected codec. DOM-free, so a worker runs them with an encoder
 * of its own; `imageOptim` binds them to the encode worker for the main thread.
 */
import type { Entity, World } from '@/types';
import { dataUrlRealMime, isConvertibleImage, isRemoteImage, reencodeKeepsAnimation } from './imageBytes';
import { entityImages } from './entityImages';
import { IMAGE_CAPS, countWorldImages, type ImageCap } from './imageSlots';

/** Encodes and measures image data-URLs. `encode` never throws; it returns the source on failure. */
export interface ImageCodec {
  /** `lossless` keeps every pixel; `allowGrow` keeps a result larger than the source. */
  encode: (url: string, maxDim: number, options?: { lossless?: boolean; allowGrow?: boolean }) => Promise<string>;
  measure: (url: string) => Promise<{ w: number; h: number; bytes: number }>;
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

/**
 * The one place the scan rule lives: measure `url` and describe it when the popup has something to offer —
 * over either budget (a 4000px photo, a small-dim multi-MB animated GIF), or a format a lossless WebP
 * shrinks at any size. Null when neither applies or it can't be read. Every scan/check goes through
 * this, so the rule can't drift between call sites.
 */
export async function scanItem(codec: ImageCodec, url: string, cap: ImageCap, path: string): Promise<ScannedImage | null> {
  // A linked image contributes no bytes to the world, so no budget applies — and the worker's fetch of a
  // cross-origin URL would only fail into the catch below anyway.
  if (isRemoteImage(url)) return null;
  // A GIF this browser can't re-decode is offered nothing lossless — converting it would flatten it.
  const convertible = isConvertibleImage(url) && reencodeKeepsAnimation(url);
  try {
    const { w, h, bytes } = await codec.measure(url);
    const oversized = Math.max(w, h) > cap.maxDim || bytes > cap.maxBytes;
    if (oversized || convertible) return { path, cap, w, h, bytes, mime: dataUrlRealMime(url), oversized, convertible };
  } catch {
    /* unreadable → treat as within budget */
  }
  return null;
}

/** Injectable deps so the field-walking logic is unit-testable without a real canvas. */
export interface DownscaleDeps {
  optimize: (url: string, cap: ImageCap) => Promise<string>;
  /** Whether this mode re-encodes the image at all — the per-mode gate the walk asks before dispatching. */
  shouldEncode: (url: string, cap: ImageCap) => Promise<boolean>;
}

/** Downscale cares about large files: only images over their budget are touched. */
export const downscaleDeps = (codec: ImageCodec): DownscaleDeps => ({
  optimize: (url, cap) => codec.encode(url, cap.maxDim),
  shouldEncode: async (url, cap) => (await scanItem(codec, url, cap, ''))?.oversized ?? false,
});

/** Deps for the "Optimize" (WebP, keep resolution) world pass: every losslessly convertible image at any
 *  size — Optimize is about total world size, not display budgets. */
export const reencodeDeps = (codec: ImageCodec): DownscaleDeps => ({
  optimize: (url) => codec.encode(url, Infinity, { lossless: true }),
  shouldEncode: (url) => Promise.resolve(isConvertibleImage(url) && reencodeKeepsAnimation(url)),
});

/** An image-handling choice offered on import: leave images as-is, optimize (lossless WebP), or downscale. */
export type OptimizeMode = 'off' | 'optimize' | 'downscale';

/** The world/image deps for a mode, or null for 'off' (no re-encoding). */
function depsForMode(codec: ImageCodec, mode: OptimizeMode): DownscaleDeps | null {
  return mode === 'optimize' ? reencodeDeps(codec) : mode === 'downscale' ? downscaleDeps(codec) : null;
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
  deps: DownscaleDeps,
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

/** Apply an optimize mode to every image the mode selects in a world; a no-op (returns the same world) for
 *  'off'. `onProgress(done, total)` reports per-image progress; an aborted `signal` rejects with an
 *  AbortError (see `downscaleWorldImages`). */
export async function applyWorldOptimize(
  codec: ImageCodec,
  world: World,
  mode: OptimizeMode,
  onProgress?: (done: number, total: number) => void,
  signal?: AbortSignal,
): Promise<World> {
  const deps = depsForMode(codec, mode);
  return deps ? downscaleWorldImages(world, deps, onProgress, signal) : world;
}

/** Apply an optimize mode to a single image data-URL (e.g. a character portrait); no-op for 'off' or when
 *  the mode has nothing to do with it. */
export async function applyImageOptimize(
  codec: ImageCodec,
  url: string | undefined | null,
  mode: OptimizeMode,
  cap: ImageCap = IMAGE_CAPS.entity,
): Promise<string | undefined | null> {
  const deps = depsForMode(codec, mode);
  if (!deps || !url) return url;
  return (await deps.shouldEncode(url, cap)) ? deps.optimize(url, cap) : url;
}

/**
 * Apply an optimize mode across one entity's whole gallery, so a second or third picture is re-encoded on the
 * same terms as its primary. `onImage` fires per picture for progress; a no-op mode ticks nothing and returns
 * the entity untouched.
 */
export async function applyEntityImagesOptimize(
  codec: ImageCodec,
  entity: Entity,
  mode: OptimizeMode,
  onImage?: () => void,
): Promise<Entity> {
  if (mode === 'off') return entity;
  const images: string[] = [];
  for (const url of entityImages(entity)) {
    images.push((await applyImageOptimize(codec, url, mode, IMAGE_CAPS.entity)) ?? url);
    onImage?.();
  }
  return images.length ? { ...entity, images } : entity;
}
