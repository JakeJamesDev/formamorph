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
import { dataUrlMime, improvedByLosslessWebp } from './imageBytes';
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
  type OversizedImage,
  type OptimizeMode,
} from './imageOptim';

/** Aggregate size facts about a set of oversized images, shared by every optimize prompt's wording. */
interface OptimizeStats {
  /** How many images are over budget. */
  n: number;
  totalBytes: number;
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

const optimizeStats = (items: OversizedImage[]): OptimizeStats => ({
  n: items.length,
  totalBytes: items.reduce((s, i) => s + i.bytes, 0),
  canOptimize: items.some((i) => improvedByLosslessWebp(i.mime)),
  optCount: items.filter((i) => improvedByLosslessWebp(i.mime)).length,
  // An image Optimize can't improve is kept exactly as it is, so it counts at the bytes it already has.
  optTotal: items.reduce(
    (s, i) => s + (improvedByLosslessWebp(i.mime) ? estimateEncodedBytes(i.bytes, i.w, i.h, 'reencode', i.cap) : i.bytes),
    0,
  ),
  downTotal: items.reduce((s, i) => s + estimateEncodedBytes(i.bytes, i.w, i.h, 'downscale', i.cap), 0),
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
  return (
    (s.canOptimize
      ? `Optimize converts ${subject} to lossless WebP${many ? '' : ' at the same resolution'} (~${formatBytes(s.optTotal)}, no quality loss). `
      : '') +
    `Downscale ${s.canOptimize ? 'also shrinks' : 'shrinks'} ${them}${many ? '' : ' to fit'} ` +
    `(~${formatBytes(s.downTotal)}). Animated GIFs keep their animation.`
  );
};

/**
 * Say once when an Optimize run finished with images still in their original format. The encoder keeps
 * anything a WebP copy would grow, so a run can legitimately leave the same images the popup just offered to
 * convert — and an author told nothing reads the unchanged offer as the run having failed.
 */
const reportKeptImages = (offered: OversizedImage[], optimized: World): void => {
  const now = worldImagesByPath(optimized);
  const kept = offered.filter((item) => improvedByLosslessWebp(item.mime)
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
 * `await promptWorld(...)` after a world lands. The popup offers two options — Optimize (WebP, same resolution) and
 * Downscale (also shrink to fit) — plus Cancel. Nothing is re-encoded without the user choosing; within-budget
 * inputs resolve immediately with no popup.
 */
export function useDownscalePrompt() {
  const [pending, setPending] = useState<PendingPrompt | null>(null);
  const confirmingRef = useRef(false);
  const close = useCallback(() => setPending(null), []);

  /**
   * The one prompt builder: given the oversized images, offer Optimize / Downscale / keep and resolve to the
   * chosen mode. Callers supply only the wording (`copy`) and apply the mode themselves — so the size math,
   * the WebP-can't-be-optimized rule, and the dialog plumbing live here once.
   */
  const promptOptimizeChoice = useCallback(
    (items: OversizedImage[], copy: (s: OptimizeStats) => PromptCopy): Promise<OptimizeMode> => {
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
            { label: 'Downscale', run: () => finish('downscale') },
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
        title: 'Large image',
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
          `This world has ${s.n} image${s.n > 1 ? 's' : ''} larger than recommended (${formatBytes(s.totalBytes)} total). ` +
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
        title: s.n > 1 ? 'Optimize character images?' : 'Large image',
        description:
          `This character has ${s.n} image${s.n > 1 ? 's' : ''} larger than recommended (${formatBytes(s.totalBytes)} total). ` +
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
      `${s.n} image${s.n > 1 ? 's' : ''} in this import ${s.n > 1 ? 'are' : 'is'} larger than recommended (${formatBytes(s.totalBytes)} total). ` +
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
