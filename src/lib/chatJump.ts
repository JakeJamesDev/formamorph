/**
 * Chat layout's Jump to Latest geometry. All values are scroll offsets inside the Chat scroller: the
 * distance from the top of the list, not from the top of the screen.
 */

// Sub-pixel layout rounds a turn's end onto the viewport edge; this much overlap still counts as on screen.
const EDGE_TOLERANCE_PX = 1;

/** The latest turn's top, where its content ends, and the scroller's size and scroll range. */
export interface JumpGeometry {
  turnTop: number;
  contentEnd: number;
  viewportHeight: number;
  maxScroll: number;
}

/**
 * The scroll offset that shows the newest content: a short turn lands with its top at the viewport top,
 * and a long turn lands with its end at the viewport bottom.
 */
export function jumpTarget({ turnTop, contentEnd, viewportHeight, maxScroll }: JumpGeometry): number {
  return Math.max(0, Math.min(Math.max(turnTop, contentEnd - viewportHeight), maxScroll));
}

/**
 * Whether Jump to Latest shows: the latest turn is not mounted (`contentEnd` null), or its content ends
 * below or above the viewport.
 */
export function jumpVisible(contentEnd: number | null, viewport: { top: number; bottom: number }): boolean {
  if (contentEnd === null) return true;
  return contentEnd > viewport.bottom + EDGE_TOLERANCE_PX || contentEnd < viewport.top - EDGE_TOLERANCE_PX;
}
