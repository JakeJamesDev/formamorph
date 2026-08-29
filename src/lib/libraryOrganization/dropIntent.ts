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

/**
 * Share of the tile, per side, that counts as its middle rather than an edge. Deliberately under half:
 * grouping and reordering compete for the same tile, and reordering is the more common gesture, so the
 * edges win the tie.
 */
const CENTER_BAND = 0.4;

/**
 * Read a drop position over one tile.
 *
 * The middle of a tile groups; everywhere else reorders. A pointer outside the tile's box never groups
 * — the collision layer hands the nearest tile even when the pointer is past the grid's first or last
 * tile, and that drop has to mean "put it at the boundary", not "fold these two". Outside the box on
 * the vertical axis, the side alone decides: below is after, above is before.
 *
 * Inside the box, small tiles take before/after from their top and bottom halves, so hand-stacking a
 * column reads the way the packer already stacks a run of them; every other tile reads left and right.
 * A drag that cannot group — a folder tile, which never nests — uses the whole tile for reordering
 * instead of losing its middle to a gesture it would refuse.
 *
 * @param point - Where the pointer is, not where the dragged tile's center is: a large tile's center
 *   can sit in a small target's middle while the player is pointing at its edge
 * @param rect - The tile being dropped on
 */
export function dropIntent(
  point: { x: number; y: number },
  rect: TileRect,
  { canGroup, overSize }: { canGroup: boolean; overSize: LibraryTileSize },
): DropIntent {
  // Past the tile vertically: the boundary drop. Below the last row or above the first, this is the
  // only reading that lets a tile reach the very start or end of the grid.
  if (point.y > rect.top + rect.height) return { kind: 'reorder', position: 'after' };
  if (point.y < rect.top) return { kind: 'reorder', position: 'before' };

  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;

  const inMiddle = Math.abs(point.x - centerX) <= (rect.width * CENTER_BAND) / 2
    && Math.abs(point.y - centerY) <= (rect.height * CENTER_BAND) / 2;
  if (canGroup && inMiddle) return { kind: 'group' };

  const before = overSize === 'small' ? point.y < centerY : point.x < centerX;
  return { kind: 'reorder', position: before ? 'before' : 'after' };
}
