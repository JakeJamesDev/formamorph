/**
 * The size budget for each kind of image field. DOM-free, so workers can read it.
 */

/** A per-use size budget for an image field. `maxDim` caps the longest edge (px); `maxBytes` the encoded size. */
export interface ImageCap {
  maxDim: number;
  maxBytes: number;
}

/** Display-driven budgets: a Large library tile renders thumbnails at ~800px, entity images in a
 *  modal, backgrounds full-viewport. Each byte budget is about 3× a quality-0.82 WebP at its cap, so
 *  editor-made art never trips it. Byte values are 1024-based, so they print as round KB. */
export const IMAGE_CAPS = {
  thumbnail: { maxDim: 1024, maxBytes: 204_800 },
  /** 1280 keeps an 832×1216 SDXL portrait at its native size. */
  entity: { maxDim: 1280, maxBytes: 256_000 },
  background: { maxDim: 1920, maxBytes: 921_600 },
  /** The Map Background, which an author zooms into on the canvas. */
  map: { maxDim: 2560, maxBytes: 1_572_864 },
} as const satisfies Record<string, ImageCap>;

