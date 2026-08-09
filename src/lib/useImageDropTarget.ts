import { useCallback, useState, type DragEvent } from 'react';
import { canDropImage, imageDropPayload } from './imageDrop';

/**
 * Makes an element take a dropped picture. Shared so the uploader's frame and the gallery strip's add tile
 * behave identically — a drop that works on one and not the other is the kind of inconsistency nobody
 * reports, they just stop trying.
 */
export function useImageDropTarget({ enabled, allowFiles, onUrl, onFiles }: {
  /** False for a slot that has nothing to accept — a filled one, which is changed by removing it first. */
  enabled: boolean;
  /** False once the embedded-bytes allowance is spent. Links stay welcome: they cost the payload nothing. */
  allowFiles: boolean;
  onUrl: (url: string) => void;
  onFiles: (files: File[]) => void;
}) {
  const [dragOver, setDragOver] = useState(false);

  // Both handlers stop propagation once they take the event, so these targets can nest: a slot inside a pane
  // handles its own drag, and the pane only sees the ones its slots turned down.
  const onDragOver = useCallback((e: DragEvent<HTMLElement>) => {
    if (!enabled || !canDropImage(e.dataTransfer)) return;
    e.preventDefault(); // without this the browser navigates to the dropped file instead
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
    setDragOver(true);
  }, [enabled]);

  const onDrop = useCallback((e: DragEvent<HTMLElement>) => {
    setDragOver(false);
    if (!enabled) return;
    const payload = imageDropPayload(e.dataTransfer);
    if (!payload) return;
    e.preventDefault();
    e.stopPropagation();
    if (payload.kind === 'url') return onUrl(payload.url);
    if (allowFiles) onFiles(payload.files);
  }, [enabled, allowFiles, onUrl, onFiles]);

  return {
    dragOver,
    dropProps: { onDragOver, onDragLeave: () => setDragOver(false), onDrop },
  };
}
