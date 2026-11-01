import { CANVAS, type Layout, type Rect } from './layout';

/** Ruling Q70: text stays this share of the frame height from every edge. */
export const TEXT_MARGIN_SHARE = 0.04;

/**
 * One text element of a scene: its boxes on the canvas on a scene frame, none while it cannot be seen. `clipped` is
 * how many pixels of it its own panel cuts off.
 */
export type TextTrack = { text: string; clipped?: number; boxesAt: (frame: number) => Rect[] };

export type Edge = 'left' | 'top' | 'right' | 'bottom';

/** Where a text element leaves the margin: its first and last frames out, and its worst, in scene frames with the frame the cut plays them on. */
export type TextOffense = { edge: Edge; pixels: number; worstFrame: number; firstFrame: number; lastFrame: number; cutFrom: number };

/** One text element in a cut. `gap` is its closest distance to a frame edge on any frame, null when it never shows. */
export type TextReading = { shot: string; text: string; margin: number; gap: number | null; clipped: number; offense: TextOffense | null; ok: boolean };

/** A box scaled by `scale` about the point (`cx`, `cy`). */
export const scaledAbout = ({ x, y, width, height }: Rect, scale: number, cx: number, cy: number): Rect => ({
  x: cx + (x - cx) * scale,
  y: cy + (y - cy) * scale,
  width: width * scale,
  height: height * scale,
});

/** A box scaled by `scale` about its own center. */
export const scaledBox = (box: Rect, scale: number): Rect => scaledAbout(box, scale, box.x + box.width / 2, box.y + box.height / 2);

/** The box that holds a box turned by `degrees` about its own center. */
export const turnedBox = ({ x, y, width, height }: Rect, degrees: number): Rect => {
  const [cos, sin] = [Math.abs(Math.cos((degrees * Math.PI) / 180)), Math.abs(Math.sin((degrees * Math.PI) / 180))];
  const [turnedWidth, turnedHeight] = [width * cos + height * sin, width * sin + height * cos];
  return { x: x + (width - turnedWidth) / 2, y: y + (height - turnedHeight) / 2, width: turnedWidth, height: turnedHeight };
};

/** The edge a box sits closest to, and how far from it. Negative when the box crosses the edge. */
const closestEdge = (box: Rect, layout: Layout): { edge: Edge; gap: number } => {
  const { width, height } = CANVAS[layout];
  const gaps: { edge: Edge; gap: number }[] = [
    { edge: 'left', gap: box.x },
    { edge: 'top', gap: box.y },
    { edge: 'right', gap: width - box.x - box.width },
    { edge: 'bottom', gap: height - box.y - box.height },
  ];
  return gaps.reduce((closest, next) => (next.gap < closest.gap ? next : closest));
};

/** Measures a text element on every frame its scene plays. `cutFrom` is the frame of the cut the scene starts on. */
export const readText = (layout: Layout, shot: string, track: TextTrack, durationInFrames: number, cutFrom: number): TextReading => {
  const margin = TEXT_MARGIN_SHARE * CANVAS[layout].height;
  const out: { frame: number; edge: Edge; gap: number }[] = [];
  let gap = Infinity;
  for (let frame = 0; frame < durationInFrames; frame++) {
    for (const box of track.boxesAt(frame)) {
      const closest = closestEdge(box, layout);
      gap = Math.min(gap, closest.gap);
      if (closest.gap < margin) out.push({ frame, ...closest });
    }
  }
  const worst = out.reduce<(typeof out)[number] | null>((most, next) => (!most || next.gap < most.gap ? next : most), null);
  const offense = worst && { edge: worst.edge, pixels: margin - worst.gap, worstFrame: worst.frame, firstFrame: out[0].frame, lastFrame: out[out.length - 1].frame, cutFrom };
  const clipped = track.clipped ?? 0;
  const shown = gap !== Infinity;
  return { shot, text: track.text, margin, gap: shown ? gap : null, clipped, offense, ok: offense === null && clipped === 0 && shown };
};
