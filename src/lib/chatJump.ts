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

/** The viewport's top and bottom scroll offsets. */
export interface ViewportSpan {
  top: number;
  bottom: number;
}

/**
 * Where the latest turn's content ends relative to the viewport. A turn that is not mounted (`contentEnd`
 * null) is below, because the latest turn is the last one in the list.
 */
export function latestPlacement(contentEnd: number | null, viewport: ViewportSpan): 'above' | 'inside' | 'below' {
  if (contentEnd === null || contentEnd > viewport.bottom + EDGE_TOLERANCE_PX) return 'below';
  return contentEnd < viewport.top - EDGE_TOLERANCE_PX ? 'above' : 'inside';
}

/** Whether Jump to Latest shows: the latest turn's content does not end inside the viewport. */
export function jumpVisible(contentEnd: number | null, viewport: ViewportSpan): boolean {
  return latestPlacement(contentEnd, viewport) !== 'inside';
}
