export type Layout = 'wide' | 'tall';

export type Size = { width: number; height: number };

/** A box in pixels: its top-left corner and its size. */
export type Rect = Size & { x: number; y: number };

/** Canvas size per layout: Steam 16:9 and the 9:16 social cut. */
export const CANVAS: Record<Layout, Size> = {
  wide: { width: 1920, height: 1080 },
  tall: { width: 1080, height: 1920 },
};

/** What every scene receives. A scene places its own content for each layout. */
export type SceneProps = {
  layout: Layout;
  durationInFrames: number;
};
