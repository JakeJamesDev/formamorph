/** How far, in pixels, content runs past a scroller's edge before it fades out fully there. */
export const EDGE_FADE_DEPTH = 32;

/** How much of an edge fade shows, 0 to 1, for content that runs `distance` pixels past that edge. */
export const edgeFadeShare = (distance: number) => Math.min(Math.max(distance / EDGE_FADE_DEPTH, 0), 1);
