// The Map Background's shape and geometry: which images it holds, where its frame sits, and how a gesture moves it.

import type { GalleryImage, GameLocation, MapBackground, MapFrame, WorldOverview } from '@/types';
import { canvasRects } from './locationCanvas';

/** The width of a first frame with nothing to cover (Q78). */
export const EMPTY_MAP_WIDTH = 1280;

/** The smallest edge a resize leaves, in canvas units. */
export const MIN_MAP_EDGE = 40;

/** The Map Background's images in author order, blanks dropped. */
export const mapImages = (overview?: Pick<WorldOverview, 'mapBackground'> | null): GalleryImage[] =>
  (overview?.mapBackground?.images ?? []).filter((img) => !!img?.data);

/**
 * The background with `images` in place of its own. The field goes with the last image (Q77), and a first
 * image takes `frame` at full opacity (Q81).
 */
export function withMapImages(current: MapBackground | undefined, images: GalleryImage[], frame?: MapFrame): MapBackground | undefined {
  const kept = images.filter((img) => !!img.data);
  if (!kept.length) return undefined;
  if (current) return { ...current, images: kept };
  return frame ? { images: kept, frame, opacity: 1 } : undefined;
}

/**
 * The field after `rewrite` runs on each image's data in order, one at a time, for a world walk such as
 * Optimize Images. A world without one gets nothing to spread.
 */
export async function rewriteMapImages(
  overview: Pick<WorldOverview, 'mapBackground'> | undefined,
  rewrite: (data: string) => Promise<string>,
): Promise<Pick<WorldOverview, 'mapBackground'>> {
  const background = overview?.mapBackground;
  if (!background) return {};
  const images: GalleryImage[] = [];
  for (const img of mapImages(overview)) images.push({ ...img, data: await rewrite(img.data) });
  return { mapBackground: withMapImages(background, images) };
}

/** The box every location box fills, or null with no locations. */
export function locationsBounds(locations: GameLocation[]): MapFrame | null {
  const rects = [...canvasRects(locations).values()];
  if (!rects.length) return null;
  const x = Math.min(...rects.map((r) => r.x));
  const y = Math.min(...rects.map((r) => r.y));
  return {
    x, y,
    width: Math.max(...rects.map((r) => r.x + r.width)) - x,
    height: Math.max(...rects.map((r) => r.y + r.height)) - y,
  };
}

/** The smallest frame at `aspect` (width over height) that covers `box`, centered on it. */
export function coverFrame(box: MapFrame, aspect: number): MapFrame {
  const width = Math.max(box.width, box.height * aspect);
  const height = width / aspect;
  return { x: box.x + (box.width - width) / 2, y: box.y + (box.height - height) / 2, width, height };
}

/**
 * Where a first image lands: over the locations' bounding box, else over `visible` (the canvas's view), else
 * 1280 units wide centered on the origin.
 */
export function firstMapFrame(locations: GameLocation[], aspect: number, visible?: MapFrame | null): MapFrame {
  const box = locationsBounds(locations) ?? visible;
  if (box) return coverFrame(box, aspect);
  const height = EMPTY_MAP_WIDTH / aspect;
  return { x: -EMPTY_MAP_WIDTH / 2, y: -height / 2, width: EMPTY_MAP_WIDTH, height };
}

export const moveFrame = (frame: MapFrame, dx: number, dy: number): MapFrame => ({ ...frame, x: frame.x + dx, y: frame.y + dy });

export type MapCorner = 'nw' | 'ne' | 'sw' | 'se';

/**
 * The frame after dragging `corner` by (dx, dy) canvas units, at its own aspect ratio. The opposite corner
 * stays put, and the axis that moved further sets the scale.
 */
export function resizeFrame(frame: MapFrame, corner: MapCorner, dx: number, dy: number): MapFrame {
  const sx = corner.endsWith('e') ? 1 : -1;
  const sy = corner.startsWith('s') ? 1 : -1;
  const scale = Math.max((frame.width + sx * dx) / frame.width, (frame.height + sy * dy) / frame.height);
  const floor = MIN_MAP_EDGE / Math.min(frame.width, frame.height);
  const s = Math.max(scale, floor);
  const width = frame.width * s;
  const height = frame.height * s;
  return {
    x: sx > 0 ? frame.x : frame.x + frame.width - width,
    y: sy > 0 ? frame.y : frame.y + frame.height - height,
    width,
    height,
  };
}

/** The History Step label for a gallery write that turns `before` into `after`. */
export function mapGalleryStepLabel(before: GalleryImage[], after: GalleryImage[]): string {
  const kept = after.filter((img) => !!img.data);
  if (!before.length) return 'Set Map Background';
  const changed = (list: GalleryImage[], other: GalleryImage[]) => list.findIndex((img, i) => img.data !== other[i]?.data);
  if (kept.length < before.length) return `Remove Image ${changed(before, kept) + 1}: Map Background`;
  if (kept.length > before.length) return `Add Image ${kept.length}: Map Background`;
  const at = changed(kept, before);
  const sameSet = kept.map((img) => img.data).sort().join('\n') === before.map((img) => img.data).sort().join('\n');
  if (at !== -1 && sameSet) return 'Reorder Images: Map Background';
  if (at !== -1) return `Replace Image ${at + 1}: Map Background`;
  return 'Edit Map Background';
}
