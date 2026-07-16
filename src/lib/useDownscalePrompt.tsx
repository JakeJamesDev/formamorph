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
import type { World } from '@/types';
import { useClosingSnapshot } from './useClosingSnapshot';
import {
  applyImageOptimize,
  applyWorldOptimize,
  estimateEncodedBytes,
  formatBytes,
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
  /** False when every image is already WebP — Optimize (lossless WebP→WebP) would be a no-op, so it's hidden. */
  canOptimize: boolean;
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
  canOptimize: items.some((i) => i.mime !== 'image/webp'),
  // An already-WebP image re-encodes to itself, so Optimize leaves its bytes as-is.
  optTotal: items.reduce(
    (s, i) => s + (i.mime === 'image/webp' ? i.bytes : estimateEncodedBytes(i.bytes, i.w, i.h, 'reencode', i.cap)),
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
  return (
    (s.canOptimize
      ? `Optimize converts ${them} to lossless WebP${many ? '' : ' at the same resolution'} (~${formatBytes(s.optTotal)}, no quality loss). `
      : '') +
    `Downscale ${s.canOptimize ? 'also shrinks' : 'shrinks'} ${them}${many ? '' : ' to fit'} ` +
    `(~${formatBytes(s.downTotal)}). Animated GIFs keep their animation.`
  );
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

  /** Offer to shrink one oversized image (e.g. an upload). Returns the chosen URL — the original when kept. */
  const promptImage = useCallback(
    async (url: string, cap: ImageCap): Promise<string> => {
      const [item] = await scanImages([url], cap);
      if (!item) return url;
      const mode = await promptOptimizeChoice([item], (s) => ({
        title: 'Large image',
        description: `This image is ${formatBytes(s.totalBytes)} (${item.w}×${item.h}). ` + optimizeTail(s, false),
        cancelLabel: 'Keep original',
      }));
      return mode === 'off' ? url : (await applyImageOptimize(url, mode, cap)) ?? url;
    },
    [promptOptimizeChoice],
  );

  /** Offer to shrink one world's oversized images. Returns the new world, or null when nothing changed. */
  const promptWorld = useCallback(
    async (world: World): Promise<World | null> => {
      const { items } = await scanWorldImages(world);
      const mode = await promptOptimizeChoice(items, (s) => ({
        title: 'Optimize world images?',
        description:
          `This world has ${s.n} image${s.n > 1 ? 's' : ''} larger than recommended (${formatBytes(s.totalBytes)} total). ` +
          optimizeTail(s, true),
        cancelLabel: 'Keep as-is',
      }));
      return mode === 'off' ? null : applyWorldOptimize(world, mode);
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

  return { promptImage, promptWorld, promptWorldsBatch, promptImagesBatch, dialog };
}
