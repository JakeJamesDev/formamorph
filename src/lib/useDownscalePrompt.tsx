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
import {
  dataUrlMime,
  downscaleWorldImages,
  estimateEncodedBytes,
  formatBytes,
  measureDataUrl,
  optimizeImageDataUrl,
  reencodeImageDataUrl,
  scanWorldImages,
  REENCODE_DEPS,
  type ImageCap,
} from './imageOptim';

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

  const promptImage = useCallback(
    async (url: string, cap: ImageCap): Promise<string> => {
      let info;
      try {
        info = await measureDataUrl(url);
      } catch {
        return url;
      }
      if (!(Math.max(info.w, info.h) > cap.maxDim || info.bytes > cap.maxBytes)) return url;
      // Already-WebP images gain nothing from Optimize (lossless WebP→WebP no-ops); only offer Downscale.
      const alreadyWebp = dataUrlMime(url) === 'image/webp';
      const opt = estimateEncodedBytes(info.bytes, info.w, info.h, 'reencode', cap);
      const down = estimateEncodedBytes(info.bytes, info.w, info.h, 'downscale', cap);
      return new Promise<string>((resolve) => {
        let done = false;
        const finish = (v: string) => {
          if (done) return;
          done = true;
          resolve(v);
          close();
        };
        const optimizeSentence = alreadyWebp
          ? ''
          : `Optimize converts it to lossless WebP at the same resolution (~${formatBytes(opt)}, no quality loss). `;
        setPending({
          title: 'Large image',
          description:
            `This image is ${formatBytes(info.bytes)} (${info.w}×${info.h}). ` +
            optimizeSentence +
            `Downscale ${alreadyWebp ? 'shrinks it to fit' : 'also shrinks it to fit'} (~${formatBytes(down)}). Animated GIFs keep their animation.`,
          actions: [
            ...(alreadyWebp ? [] : [{ label: 'Optimize', run: () => void reencodeImageDataUrl(url).then(finish) }]),
            { label: 'Downscale', run: () => void optimizeImageDataUrl(url, cap).then(finish) },
          ],
          cancel: () => finish(url),
          cancelLabel: 'Keep original',
        });
      });
    },
    [close],
  );

  const promptWorld = useCallback(
    async (world: World): Promise<World | null> => {
      const { items, totalBytes } = await scanWorldImages(world);
      if (items.length === 0) return null;
      // Optimize only helps non-WebP images; already-WebP ones re-encode to themselves (unchanged size).
      const canOptimize = items.some((i) => i.mime !== 'image/webp');
      const optTotal = items.reduce(
        (s, i) => s + (i.mime === 'image/webp' ? i.bytes : estimateEncodedBytes(i.bytes, i.w, i.h, 'reencode', i.cap)),
        0,
      );
      const downTotal = items.reduce((s, i) => s + estimateEncodedBytes(i.bytes, i.w, i.h, 'downscale', i.cap), 0);
      const n = items.length;
      return new Promise<World | null>((resolve) => {
        let done = false;
        const finish = (v: World | null) => {
          if (done) return;
          done = true;
          resolve(v);
          close();
        };
        const optimizeSentence = canOptimize
          ? `Optimize converts them to lossless WebP (~${formatBytes(optTotal)}, no quality loss). `
          : '';
        setPending({
          title: 'Optimize world images?',
          description:
            `This world has ${n} image${n > 1 ? 's' : ''} larger than recommended (${formatBytes(totalBytes)} total). ` +
            optimizeSentence +
            `Downscale ${canOptimize ? 'also shrinks them' : 'shrinks them'} (~${formatBytes(downTotal)}). Animated GIFs keep their animation.`,
          actions: [
            ...(canOptimize ? [{ label: 'Optimize', run: () => void downscaleWorldImages(world, REENCODE_DEPS).then(finish) }] : []),
            { label: 'Downscale', run: () => void downscaleWorldImages(world).then(finish) },
          ],
          cancel: () => finish(null),
          cancelLabel: 'Keep as-is',
        });
      });
    },
    [close],
  );

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
          <AlertDialogTitle>{pending?.title}</AlertDialogTitle>
          <AlertDialogDescription>{pending?.description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => pending?.cancel()}>{pending?.cancelLabel ?? 'Cancel'}</AlertDialogCancel>
          {pending?.actions.map((a) => (
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

  return { promptImage, promptWorld, dialog };
}
