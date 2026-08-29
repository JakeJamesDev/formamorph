import type { LibraryTileSize } from './types';

/** What a drop on a tile means: fold the two into a folder, or slot the dragged tile beside it. */
export type DropIntent =
  | { kind: 'group' }
  | { kind: 'reorder'; position: 'before' | 'after' };

/** The box a tile occupies on screen, as dnd-kit reports it. */
export interface TileRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** Share of the tile, per side, that counts as its middle rather than an edge. */
const CENTER_BAND = 0.5;

/**
 * Read a drop position over one tile.
 *
 * The middle of a tile groups; its edges reorder. Small tiles take the drop on their top and bottom
 * edges, so hand-stacking a column reads the way the packer already stacks a run of them; every other
 * tile takes it on the left and right. A drag that cannot group — a folder tile, which never nests —
 * uses the whole tile for reordering instead of losing its middle to a gesture it would refuse.
 *
 * @param point - Where the dragged tile's center sits
 * @param rect - The tile being dropped on
 */
export function dropIntent(
  point: { x: number; y: number },
  rect: TileRect,
  { canGroup, overSize }: { canGroup: boolean; overSize: LibraryTileSize },
): DropIntent {
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;

  const inMiddle = Math.abs(point.x - centerX) <= (rect.width * CENTER_BAND) / 2
    && Math.abs(point.y - centerY) <= (rect.height * CENTER_BAND) / 2;
  if (canGroup && inMiddle) return { kind: 'group' };

  const before = overSize === 'small' ? point.y < centerY : point.x < centerX;
  return { kind: 'reorder', position: before ? 'before' : 'after' };
}
