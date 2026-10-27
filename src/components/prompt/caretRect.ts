/** Where a menu opened at the caret anchors, in viewport pixels. */
export interface CaretRect {
  left: number;
  top: number;
  bottom: number;
}

/** How tall a caret menu may grow before it opens above the caret instead. */
const MENU_MAX = 240;

/**
 * Fixed-position offsets for a menu `width` pixels wide at the caret: below it, or above it near the
 * viewport's bottom, and kept inside the viewport's right edge.
 */
export function caretMenuPosition(rect: CaretRect, width: number): { left: number; top?: number; bottom?: number } {
  const left = Math.min(rect.left, window.innerWidth - width - 16);
  return rect.bottom + MENU_MAX < window.innerHeight
    ? { left, top: rect.bottom + 4 }
    : { left, bottom: window.innerHeight - rect.top + 4 };
}

/** The caret's viewport box, falling back to the editor's own when the caret sits against a chip and
 *  collapses to an empty rect. */
export function caretRect(root: HTMLElement | null): CaretRect | null {
  const sel = window.getSelection();
  if (sel && sel.rangeCount > 0) {
    const r = sel.getRangeAt(0).getBoundingClientRect();
    if (r.height) return { left: r.left, top: r.top, bottom: r.bottom };
  }
  if (!root) return null;
  const r = root.getBoundingClientRect();
  return { left: r.left, top: r.top, bottom: r.bottom };
}
