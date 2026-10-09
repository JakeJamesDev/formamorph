import { CANVAS, type Layout, type Rect } from './layout';
import { cameraAt, type CameraPath } from './parts/FrameCamera';
import { cardSize, type CardPose } from './parts/GlassCard';
import type { Shot } from './shots';

/** One camera in a scene: the shot it films, its path, and the card it fills, with how far that card bobs. `pane` names a stack pane. */
export type CameraUse = { shot: Shot; path: CameraPath; card: CardPose; bob: number; pane?: number };

/** Ruling Q38: whether the shot's subject region stays whole in the card's visible area. `margin` is its closest gap to the crop's edge, in card pixels. */
export type SubjectReading = { problem: string | null; margin: number };

/**
 * One camera in a cut. Zoom is relative to the zoom that just covers the card. `travelPercent` is how far the shot
 * moves on screen, as a share of the card. `source` is the capture id.
 */
export type CameraReading = { shot: string; pane: number | null; source: string; zoomFrom: number; zoomTo: number; travelPercent: number; subject: SubjectReading };

const overlaps = (a: Rect, b: Rect) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

/** A card's box on the canvas at rest, without its tilt (ruling Q39). */
export const cardBox = (layout: Layout, card: CardPose): Rect => ({
  x: CANVAS[layout].width / 2 + card.x - card.width / 2,
  y: CANVAS[layout].height / 2 + card.y - card.height / 2,
  width: card.width,
  height: card.height,
});

/**
 * Checks the subject on every frame the scene plays: it must sit inside the card's crop, and no `cover` (a caption
 * pill or panel drawn over the card, in canvas pixels) may touch it while the card bobs.
 */
const readSubject = (layout: Layout, { shot, path, card, bob }: CameraUse, durationInFrames: number, covers: Rect[]): SubjectReading => {
  if (!shot.subject) return { problem: `no subject region for "${shot.id}" in captures.json`, margin: 0 };
  const size = cardSize(card);
  const box = cardBox(layout, card);
  let margin = Infinity;
  for (let frame = 0; frame < durationInFrames; frame++) {
    const { x, y, scale } = cameraAt(frame, durationInFrames, shot, path, size);
    const region: Rect = {
      x: x + shot.subject.x * shot.width * scale,
      y: y + shot.subject.y * shot.height * scale,
      width: shot.subject.width * shot.width * scale,
      height: shot.subject.height * shot.height * scale,
    };
    const gap = Math.min(region.x, region.y, size.width - region.x - region.width, size.height - region.y - region.height);
    margin = Math.min(margin, gap);
    if (gap < 0) return { problem: `${(-gap).toFixed(0)} px outside the card's crop at scene frame ${frame}`, margin };
    // The card bobs under still copy, so the region grows by the bob on the canvas.
    const onCanvas = { ...region, x: region.x + box.x, y: region.y + box.y - bob, height: region.height + 2 * bob };
    if (covers.some((cover) => overlaps(onCanvas, cover))) return { problem: 'copy drawn over the card covers it', margin };
  }
  return { problem: null, margin };
};

/** Measures a camera on the frames the scene plays, through the same function the scene uses. */
export const readCamera = (layout: Layout, shotId: string, use: CameraUse, durationInFrames: number, covers: Rect[]): CameraReading => {
  const { shot, path, card } = use;
  const size = cardSize(card);
  const [start, end] = [cameraAt(0, durationInFrames, shot, path, size), cameraAt(durationInFrames - 1, durationInFrames, shot, path, size)];
  const base = Math.max(size.width / shot.width, size.height / shot.height);
  const travel = Math.max(Math.abs(end.x - start.x) / size.width, Math.abs(end.y - start.y) / size.height);
  return {
    shot: shotId,
    pane: use.pane ?? null,
    source: shot.id,
    zoomFrom: start.scale / base,
    zoomTo: end.scale / base,
    travelPercent: travel * 100,
    subject: readSubject(layout, use, durationInFrames, covers),
  };
};
