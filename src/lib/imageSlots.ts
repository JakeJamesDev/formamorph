/**
 * The size budget for each kind of image field. DOM-free, so workers can read it.
 */

/** A per-use size budget for an image field. `maxDim` caps the longest edge (px); `maxBytes` the encoded size. */
export interface ImageCap {
  maxDim: number;
  maxBytes: number;
}

/** Display-driven budgets: a Large library tile renders thumbnails at ~800px, entity images in a
 *  modal, backgrounds full-viewport. */
export const IMAGE_CAPS = {
  thumbnail: { maxDim: 1024, maxBytes: 500_000 },
  entity: { maxDim: 1024, maxBytes: 600_000 },
  background: { maxDim: 1920, maxBytes: 1_500_000 },
  /** The Map Background, which an author zooms into on the canvas. */
  map: { maxDim: 2560, maxBytes: 2_500_000 },
} as const satisfies Record<string, ImageCap>;

