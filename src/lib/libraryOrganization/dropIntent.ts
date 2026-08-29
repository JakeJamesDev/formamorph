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
 * Whether a drop at this point folds the dragged tile into the tile under it.
 *
 * The middle of the tile groups; everywhere else, including anywhere outside its box, is left to the
 * reorder the sortable layer already computes. The point must be the dragged tile's center in the same
 * drag-start coordinate space the tile's rect was measured in — the space every other collision reading
 * lives in — never the live pointer, which drifts out of that space as the preview slides tiles around.
 *
 * @param canGroup - False for drags that can never group, such as a folder tile, which never nests;
 *   their middle would otherwise be a dead zone
 */
export function isGroupDrop(
  point: { x: number; y: number },
  rect: TileRect,
  canGroup: boolean,
): boolean {
  if (!canGroup) return false;

  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;

  return Math.abs(point.x - centerX) <= (rect.width * CENTER_BAND) / 2
    && Math.abs(point.y - centerY) <= (rect.height * CENTER_BAND) / 2;
}
