/** How far, in pixels, content runs past a scroller's edge before it fades out fully there. */
export const EDGE_FADE_DEPTH = 32;

/** How much of an edge fade shows, 0 to 1, for content that runs `distance` pixels past that edge. */
export const edgeFadeShare = (distance: number) => Math.min(Math.max(distance / EDGE_FADE_DEPTH, 0), 1);

/** The scroll change that brings `item` into `view` with `clearance` pixels under it. A taller item keeps its top in view. */
export function revealDelta(item: { top: number; bottom: number }, view: { top: number; bottom: number }, clearance: number): number {
  const below = item.bottom + clearance - view.bottom;
  if (below > 0) return Math.min(below, item.top - view.top);
  return Math.min(item.top - view.top, 0);
}
