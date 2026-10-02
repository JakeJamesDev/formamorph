import type { Entity, World } from '@/types';
import { fitWithin } from './imageBytes';
import { encodeInWorker, measureInWorker } from './imageOptimWorkerClient';
import { IMAGE_CAPS, worldImageSlots, type ImageCap } from './imageSlots';
import * as core from './imageOptimCore';
import type { DownscaleDeps, OptimizeMode, ScannedImage } from './imageOptimCore';

// Re-exported so importers keep one `@/lib/imageOptim` path; the DOM-free parts live in `imageBytes`,
// `imageSlots` and `imageOptimCore`, which workers also run.
export { bytesToDataUrl, dataUrlBytes, dataUrlMime, fitWithin } from './imageBytes';
export { IMAGE_CAPS, countWorldImages, type ImageCap } from './imageSlots';
export type { DownscaleDeps, OptimizeMode, ScannedImage } from './imageOptimCore';

/** The main thread's codec: every encode and measure runs in the image-encode worker. */
const workerCodec: core.ImageCodec = {
  encode: (url, maxDim, { lossless, allowGrow } = {}) => encodeInWorker(url, maxDim, lossless, allowGrow),
  measure: (url) => measureInWorker(url),
};

// Rough display-only factors: lossy WebP lands near half the source; lossless keeps most of it.
const LOSSY_FACTOR = 0.5;
const LOSSLESS_FACTOR = 0.85;

/** Decode a data-URL to pixel dimensions + encoded byte size. Runs off-thread. */
export const measureDataUrl = (url: string): Promise<{ w: number; h: number; bytes: number }> =>
  measureInWorker(url);

/** True when the image exceeds either budget. */
export async function isOversized(url: string, cap: ImageCap): Promise<boolean> {
  return (await core.scanItem(workerCodec, url, cap, ''))?.oversized ?? false;
}

/** Scan standalone image data-URLs against one cap (e.g. character portraits), returning the ones worth
 *  offering to re-encode — the flat-list sibling of `scanWorldImages`. Blank/unreadable entries are skipped. */
export async function scanImages(urls: (string | undefined | null)[], cap: ImageCap): Promise<ScannedImage[]> {
  const items: ScannedImage[] = [];
  for (const url of urls) {
    if (!url) continue;
    const item = await core.scanItem(workerCodec, url, cap, '');
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

/** A world's images keyed by the `path` a scan tagged them with — how a caller reads back what one scanned
 *  image became once a run finished with it. */
export const worldImagesByPath = (world: World): Map<string, string> =>
  new Map(worldImageSlots(world).map((slot) => [slot.path, slot.url]));

/** Scan a world for images worth offering to re-encode — over budget or losslessly convertible — plus their
 *  total bytes. */
export async function scanWorldImages(world: World): Promise<{ items: ScannedImage[]; totalBytes: number }> {
  const items: ScannedImage[] = [];
  for (const slot of worldImageSlots(world)) {
    const item = await core.scanItem(workerCodec, slot.url, slot.cap, slot.path);
    if (item) items.push(item);
  }
  return { items, totalBytes: items.reduce((sum, i) => sum + i.bytes, 0) };
}

/** Downscale cares about large files: only images over their budget are touched. */
const REAL_DEPS: DownscaleDeps = core.downscaleDeps(workerCodec);

/** Deps for the "Optimize" (WebP, keep resolution) world pass: every losslessly convertible image at any
 *  size — Optimize is about total world size, not display budgets. */
export const REENCODE_DEPS: DownscaleDeps = core.reencodeDeps(workerCodec);

/** See `imageOptimCore.applyWorldOptimize`; encodes in the image-encode worker. */
export const applyWorldOptimize = (
  world: World,
  mode: OptimizeMode,
  onProgress?: (done: number, total: number) => void,
  signal?: AbortSignal,
): Promise<World> => core.applyWorldOptimize(workerCodec, world, mode, onProgress, signal);

/** See `imageOptimCore.applyImageOptimize`; encodes in the image-encode worker. */
export const applyImageOptimize = (
  url: string | undefined | null,
  mode: OptimizeMode,
  cap: ImageCap = IMAGE_CAPS.entity,
): Promise<string | undefined | null> => core.applyImageOptimize(workerCodec, url, mode, cap);

/** See `imageOptimCore.applyEntityImagesOptimize`; encodes in the image-encode worker. */
export const applyEntityImagesOptimize = (entity: Entity, mode: OptimizeMode, onImage?: () => void): Promise<Entity> =>
  core.applyEntityImagesOptimize(workerCodec, entity, mode, onImage);

/** See `imageOptimCore.downscaleWorldImages`; Downscale's deps by default. */
export const downscaleWorldImages = (
  world: World,
  deps: DownscaleDeps = REAL_DEPS,
  onProgress?: (done: number, total: number) => void,
  signal?: AbortSignal,
): Promise<World> => core.downscaleWorldImages(world, deps, onProgress, signal);

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
