/** A rectangle on the screen, as `getBoundingClientRect` reports it. */
export interface CameraRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** One layer's transform: a translation in px and a uniform scale, about the layer's top-left corner. */
export interface CameraTransform {
  x: number;
  y: number;
  scale: number;
}

/** A layer's trip, written in the fly-in sense: a fly-out plays the same pair in reverse. */
interface CameraTrip {
  from: CameraTransform;
  to: CameraTransform;
}

export interface FolderCamera {
  /** The library board: at rest, then zoomed into the folder tile. */
  outer: CameraTrip;
  /** The folder board: inside the tile at tile scale, then at rest. */
  inner: CameraTrip;
  /** How many times the tile fits across the region it stands for. */
  scale: number;
  /** The inner board's overhang below the tile's shape, which the opening clip cuts away. */
  clipBottom: number;
  /** The inner board's overhang to the right of the region, which the same clip cuts away. */
  clipRight: number;
}

/** A layer's offset from another layer's corner. */
const offset = (rect: CameraRect, from: CameraRect) => ({ x: rect.left - from.left, y: rect.top - from.top });

/**
 * The two transforms that carry a folder tile into its own board, as one camera.
 *
 * Both layers scale about their top-left corner. Linear interpolation of each pair keeps the tile's
 * image in the outer layer standing at the region's own corner and width at every progress value, so
 * the face becomes the board with no jump.
 *
 * The tile shows a region of the inner board rather than all of it, so the camera zooms by that
 * region's width. The rest of the board is behind the clip until the reveal point.
 *
 * The `d` term — the inner layer's corner less the outer layer's — is what makes that true for a
 * scrolled library and for the folder header, which both move the inner corner away from the outer one.
 *
 * The corners lock for any pair of layers. The widths lock only where the two layers are as wide as
 * each other, which the caller guarantees: both rectangles are the same grid element, measured on
 * either side of one swap, so only a viewport resize could tell them apart.
 *
 * @param tile - The folder tile's box on screen
 * @param outer - The library board's box on screen
 * @param inner - The folder board's box on screen
 * @param regionWidth - The board-space width of the region the tile's face shows. A board too early to
 *   have been measured reports nothing to zoom by, which stands for the whole board
 */
export function folderCamera({ tile, outer, inner, regionWidth }: {
  tile: CameraRect;
  outer: CameraRect;
  inner: CameraRect;
  regionWidth: number;
}): FolderCamera {
  const region = regionWidth > 0 ? regionWidth : inner.width;
  const scale = region / tile.width;
  const o = offset(tile, outer);
  const i = offset(tile, inner);
  const d = offset(inner, outer);

  return {
    outer: {
      from: { x: 0, y: 0, scale: 1 },
      to: { x: d.x - o.x * scale, y: d.y - o.y * scale, scale },
    },
    inner: {
      from: { x: i.x, y: i.y, scale: 1 / scale },
      to: { x: 0, y: 0, scale: 1 },
    },
    scale,
    clipBottom: Math.max(0, inner.height - tile.height * scale),
    clipRight: Math.max(0, inner.width - region),
  };
}

const lerp = (from: number, to: number, progress: number) => from + (to - from) * progress;

const tripAt = (trip: CameraTrip, progress: number): CameraTransform => ({
  x: lerp(trip.from.x, trip.to.x, progress),
  y: lerp(trip.from.y, trip.to.y, progress),
  scale: lerp(trip.from.scale, trip.to.scale, progress),
});

/**
 * Both layers partway through the trip, the way the browser interpolates two matching transform lists.
 * Progress is the eased value, not the clock.
 */
export function cameraAt(camera: FolderCamera, progress: number): {
  outer: CameraTransform;
  inner: CameraTransform;
} {
  return { outer: tripAt(camera.outer, progress), inner: tripAt(camera.inner, progress) };
}

/** One transform as a CSS `transform` value. */
export const cameraCss = (t: CameraTransform): string =>
  `translate(${t.x}px, ${t.y}px) scale(${t.scale})`;
