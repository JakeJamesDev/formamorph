import { useEffect, useRef, type RefObject } from 'react';
import { historyShortcut } from '@/lib/editorHistory';
import { keepsOwnHistory } from '@/lib/editableTarget';
import { surfaceRegistry } from '@/lib/surface/surfaceRegistry';
import type { SurfaceId } from '@/lib/docs/surfaceMap';

interface HistoryChordOptions {
  /** The dialog the host itself is, which never counts as one opened over it. */
  hostDialog?: SurfaceId;
  /** Takes only keys from inside the root or a world window, so the rest of the page keeps them. */
  scoped?: boolean;
  /** Reads no chord, as during the Authoring Tour. */
  paused?: boolean;
}

const OPEN_MODALS = '[role="dialog"]:not([aria-modal="false"]):not([data-state="closed"]), [role="alertdialog"]:not([data-state="closed"])';

/** Whether a modal outside the layer was opened over it, also one that reports no surface. A popover is not one. */
function modalOver(layer: Element): boolean {
  return [...document.querySelectorAll(OPEN_MODALS)].some((dialog) =>
    !dialog.closest('[data-radix-popper-content-wrapper]') && !dialog.contains(layer) && !layer.contains(dialog)
    && (layer.compareDocumentPosition(dialog) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0);
}

/** Undo and redo chords for one world history; a `data-world-window` counts as a layer of the root. */
export function useHistoryChords(
  moves: { undo(): void; redo(): void },
  rootRef: RefObject<HTMLElement | null>,
  { hostDialog, scoped = false, paused = false }: HistoryChordOptions = {},
) {
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const move = historyShortcut(event);
      if (!move || event.isComposing || pausedRef.current) return;
      // A dialog opened over the host owns the keyboard.
      const dialog = surfaceRegistry.get().dialog;
      if (dialog !== null && dialog !== hostDialog) return;
      const target = event.target instanceof Element ? event.target : null;
      const worldWindow = target?.closest('[data-world-window]') ?? null;
      const layer = worldWindow ?? rootRef.current;
      if (scoped && !worldWindow && !(target && rootRef.current?.contains(target))) return;
      if (layer && modalOver(layer)) return;
      if (keepsOwnHistory(event.target, move)) return;
      event.preventDefault();
      if (move === 'undo') moves.undo(); else moves.redo();
    };
    // Capture: Lexical fields stop keydown from bubbling.
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [moves, rootRef, hostDialog, scoped]);
}
