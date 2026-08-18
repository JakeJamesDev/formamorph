import { useCallback, useRef, useState, type ReactNode } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import type { Entity, World } from '@/types';
import { toast } from 'react-toastify';
import { dataUrlMime } from './imageBytes';
import { useClosingSnapshot } from './useClosingSnapshot';
import { withOptimizeProgress } from './optimizeProgress';
import { entityImages } from './entityImages';
import {
  applyEntityImagesOptimize,
  applyImageOptimize,
  applyWorldOptimize,
  IMAGE_CAPS,
  countWorldImages,
  describeKeptImages,
  estimateEncodedBytes,
  formatBytes,
  worldImagesByPath,
  scanImages,
  scanWorldImages,
  type ImageCap,
  type ScannedImage,
  type OptimizeMode,
} from './imageOptim';

/** Aggregate size facts about a set of scanned images, shared by every optimize prompt's wording. */
interface OptimizeStats {
  /** How many images the scan surfaced — over budget or losslessly convertible. */
  n: number;
  totalBytes: number;
  /** How many are over budget — all Downscale acts on, so the button and its sentence exist only for them. */
  overCount: number;
  /** False when no image would come back smaller — a JPEG's lossless WebP grows and an already-WebP one
   *  re-encodes to itself, so the encoder keeps both and Optimize would be an offer that does nothing. */
  canOptimize: boolean;
  /** How many of them Optimize would actually convert — what the offer can honestly promise. */
  optCount: number;
  optTotal: number;
  downTotal: number;
}

/** The words one optimize prompt shows; the choices themselves are identical everywhere. */
interface PromptCopy {
  title: string;
  description: string;
  cancelLabel: string;
}

const optimizeStats = (items: ScannedImage[]): OptimizeStats => ({
  n: items.length,
  totalBytes: items.reduce((s, i) => s + i.bytes, 0),
  overCount: items.filter((i) => i.oversized).length,
  canOptimize: items.some((i) => i.convertible),
  optCount: items.filter((i) => i.convertible).length,
  // An image a mode leaves exactly as it is counts at the bytes it already has.
  optTotal: items.reduce(
    (s, i) => s + (i.convertible ? estimateEncodedBytes(i.bytes, i.w, i.h, 'reencode', i.cap) : i.bytes),
    0,
  ),
  downTotal: items.reduce(
    (s, i) => s + (i.oversized ? estimateEncodedBytes(i.bytes, i.w, i.h, 'downscale', i.cap) : i.bytes),
    0,
  ),
});

/**
 * The shared tail of every optimize prompt: what each choice costs and does. Only the lead sentence differs
 * per caller, so the size figures and the what-Optimize-does claim are worded once. `many` picks the pronouns.
 */
const optimizeTail = (s: OptimizeStats, many: boolean): string => {
  const them = many ? 'them' : 'it';
  // Named as a count whenever it isn't all of them: a photo's lossless WebP is bigger, so the encoder keeps
  // it — and an offer that says "converts them" describes a run that cannot happen.
  const subject = s.optCount < s.n ? `${s.optCount} of ${them}` : them;
  // Downscale is the size tool: its sentence, like its button, exists only when something is over budget,
  // and names its own count whenever the set holds within-budget images it would leave alone.
  const downSubject = s.overCount < s.n ? `the ${s.overCount} larger than recommended` : `${them}${many ? '' : ' to fit'}`;
  return (
    (s.canOptimize
      ? `Optimize converts ${subject} to lossless WebP${many ? '' : ' at the same resolution'} (~${formatBytes(s.optTotal)}, no quality loss). `
      : '') +
    (s.overCount > 0
      ? `Downscale ${s.canOptimize ? 'also shrinks' : 'shrinks'} ${downSubject} (~${formatBytes(s.downTotal)}). `
      : '') +
    'Animated GIFs keep their animation.'
  );
};

/** The scanned set as one noun phrase — how many images, and why they're listed. */
const describeScan = (s: OptimizeStats): string => {
  const images = `${s.n} image${s.n > 1 ? 's' : ''}`;
  if (s.overCount === s.n) return `${images} larger than recommended`;
  if (s.overCount === 0) return `${images} lossless WebP would shrink`;
  return `${images} worth optimizing — ${s.overCount} larger than recommended`;
};

/**
 * Say once when an Optimize run finished with images still in their original format. The encoder keeps
 * anything a WebP copy would grow, so a run can legitimately leave the same images the popup just offered to
 * convert — and an author told nothing reads the unchanged offer as the run having failed.
 */
const reportKeptImages = (offered: ScannedImage[], optimized: World): void => {
  const now = worldImagesByPath(optimized);
  const kept = offered.filter((item) => item.convertible
    && dataUrlMime(now.get(item.path) ?? '') !== 'image/webp').length;
  const message = describeKeptImages(kept);
  if (message) toast.info(message);
};

interface PromptAction {
  label: string;
  run: () => void;
}

interface PendingPrompt {
  title: ReactNode;
  description: ReactNode;
  actions: PromptAction[];
  cancel: () => void;
  cancelLabel?: string; // the "do nothing and continue" button; defaults to 'Cancel'
}

/**
 * Consent gate for image optimization. Render `dialog` once in the host, then `await promptImage(...)` on upload or
 * `await promptWorld(...)` after a world lands. The popup offers up to two options — Optimize (lossless WebP, any
 * convertible image regardless of size) and Downscale (shrink what's over budget) — plus Cancel. Nothing is
 * re-encoded without the user choosing; inputs that are within budget and already efficiently encoded resolve
 * immediately with no popup.
 */
export function useDownscalePrompt() {
  const [pending, setPending] = useState<PendingPrompt | null>(null);
  const confirmingRef = useRef(false);
  const close = useCallback(() => setPending(null), []);

  /**
   * The one prompt builder: given the scanned images, offer Optimize / Downscale / keep and resolve to the
   * chosen mode. Callers supply only the wording (`copy`) and apply the mode themselves — so the size math,
   * the per-choice gating, and the dialog plumbing live here once.
   */
  const promptOptimizeChoice = useCallback(
    (items: ScannedImage[], copy: (s: OptimizeStats) => PromptCopy): Promise<OptimizeMode> => {
      if (items.length === 0) return Promise.resolve('off');
      const stats = optimizeStats(items);
      const { title, description, cancelLabel } = copy(stats);
      return new Promise<OptimizeMode>((resolve) => {
        let done = false;
        const finish = (v: OptimizeMode) => { if (done) return; done = true; resolve(v); close(); };
        setPending({
          title,
          description,
          actions: [
            ...(stats.canOptimize ? [{ label: 'Optimize', run: () => finish('optimize') }] : []),
            // Downscale only exists when something is over budget — on a set of within-budget convertibles
            // it would re-encode nothing, and a button that does nothing is a broken promise.
            ...(stats.overCount > 0 ? [{ label: 'Downscale', run: () => finish('downscale') }] : []),
          ],
          cancel: () => finish('off'),
          cancelLabel,
        });
      });
    },
    [close],
  );

  /** Offer to shrink one oversized image (e.g. an upload). Returns the chosen URL — the original when kept.
   *  `onEncoding` fires once the user has chosen and the re-encode actually starts, so a caller can show the
   *  work in place; passing it takes over from the shared progress toast, as `promptWorld` does. It does not
   *  fire when there is nothing to re-encode, which is what keeps a bar off the screen while the consent
   *  dialog is still up. */
  const promptImage = useCallback(
    async (url: string, cap: ImageCap, onEncoding?: () => void): Promise<string> => {
      const [item] = await scanImages([url], cap);
      if (!item) return url;
      const mode = await promptOptimizeChoice([item], (s) => ({
        title: item.oversized ? 'Large image' : 'Optimize image?',
        description: `This image is ${formatBytes(s.totalBytes)} (${item.w}×${item.h}). ` + optimizeTail(s, false),
        cancelLabel: 'Keep original',
      }));
      if (mode === 'off') return url;
      if (onEncoding) {
        onEncoding();
        return (await applyImageOptimize(url, mode, cap)) ?? url;
      }
      return withOptimizeProgress(1, async () => (await applyImageOptimize(url, mode, cap)) ?? url);
    },
    [promptOptimizeChoice],
  );

  /** Offer to shrink one world's oversized images. Returns the new world, or null when nothing changed.
   *  `onProgress(done, total)` fires per image once the user picks a re-encoding mode; a caller passing it
   *  owns the progress UI, otherwise the shared progress toast shows. An aborted `signal`
   *  (e.g. the caller unmounted mid-run) resolves to null — a canceled run is just "nothing changed". */
  const promptWorld = useCallback(
    async (world: World, onProgress?: (done: number, total: number) => void, signal?: AbortSignal): Promise<World | null> => {
      const { items } = await scanWorldImages(world);
      const mode = await promptOptimizeChoice(items, (s) => ({
        title: 'Optimize world images?',
        description:
          `This world has ${describeScan(s)} (${formatBytes(s.totalBytes)} total). ` +
          optimizeTail(s, true),
        cancelLabel: 'Keep as-is',
      }));
      if (mode === 'off') return null;
      try {
        const optimized = onProgress
          ? await applyWorldOptimize(world, mode, onProgress, signal)
          : await withOptimizeProgress(countWorldImages(world), (tick) =>
            applyWorldOptimize(world, mode, (done) => tick(done), signal),
          );
        if (mode === 'optimize') reportKeptImages(items, optimized);
        return optimized;
      } catch (error) {
        if ((error as DOMException).name === 'AbortError') return null;
        throw error;
      }
    },
    [promptOptimizeChoice],
  );

  /** Offer to shrink one entity's whole gallery in a single prompt (e.g. before publishing or after a
   *  download). Returns the entity — the same reference when nothing was re-encoded. */
  const promptEntity = useCallback(
    async (entity: Entity): Promise<Entity> => {
      const images = entityImages(entity);
      const mode = await promptOptimizeChoice(await scanImages(images, IMAGE_CAPS.entity), (s) => ({
        title: s.n > 1 ? 'Optimize entity images?' : s.overCount > 0 ? 'Large image' : 'Optimize image?',
        description:
          `This entity has ${describeScan(s)} (${formatBytes(s.totalBytes)} total). ` +
          optimizeTail(s, s.n > 1),
        cancelLabel: 'Keep as-is',
      }));
      if (mode === 'off') return entity;
      return withOptimizeProgress(images.length, (tick) => {
        let done = 0;
        return applyEntityImagesOptimize(entity, mode, () => tick(++done));
      });
    },
    [promptOptimizeChoice],
  );

  /** The wording an import batch uses — shared by the world and image batch prompts. */
  const batchCopy = (s: OptimizeStats): PromptCopy => ({
    title: 'Optimize imported images?',
    description:
      `This import has ${describeScan(s)} (${formatBytes(s.totalBytes)} total). ` +
      optimizeTail(s, true),
    cancelLabel: 'Keep as-is',
  });

  /** One optimize choice for a batch of worlds — scans every world's images and prompts once. */
  const promptWorldsBatch = useCallback(
    async (worlds: World[]): Promise<OptimizeMode> => {
      const items = (await Promise.all(worlds.map(scanWorldImages))).flatMap((r) => r.items);
      return promptOptimizeChoice(items, batchCopy);
    },
    [promptOptimizeChoice],
  );

  /** One optimize choice for a batch of images (e.g. character portraits) against a shared cap. */
  const promptImagesBatch = useCallback(
    async (urls: string[], cap: ImageCap): Promise<OptimizeMode> => promptOptimizeChoice(await scanImages(urls, cap), batchCopy),
    [promptOptimizeChoice],
  );

  // Keep the prompt's content while it fades out (pending goes null on close, which would blank the text).
  const shown = useClosingSnapshot(!!pending, pending);

  const dialog = (
    <AlertDialog
      open={!!pending}
      onOpenChange={(o) => {
        if (o) return;
        // Radix requests close on every button too; suppress the cancel path when an action just fired so an
        // in-flight re-encode isn't overridden by a dismiss-cancel.
        if (confirmingRef.current) {
          confirmingRef.current = false;
          return;
        }
        pending?.cancel();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{shown?.title}</AlertDialogTitle>
          <AlertDialogDescription>{shown?.description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => pending?.cancel()}>{shown?.cancelLabel ?? 'Cancel'}</AlertDialogCancel>
          {shown?.actions.map((a) => (
            <AlertDialogAction
              key={a.label}
              onClick={() => {
                confirmingRef.current = true;
                a.run();
              }}
            >
              {a.label}
            </AlertDialogAction>
          ))}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  return { promptImage, promptEntity, promptWorld, promptWorldsBatch, promptImagesBatch, dialog };
}
