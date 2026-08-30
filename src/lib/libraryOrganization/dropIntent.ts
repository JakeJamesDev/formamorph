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
 * Share of the smaller tile that must be covered before a drop reads as stacking one tile on the
 * other. Half: clearly stacked without demanding pixel alignment.
 */
export const GROUP_OVERLAP = 0.5;

/** The share of the smaller box the two rects' intersection covers, 0 for disjoint rects. */
export function groupOverlapRatio(carried: TileRect, target: TileRect): number {
  const width = Math.min(carried.left + carried.width, target.left + target.width)
    - Math.max(carried.left, target.left);
  const height = Math.min(carried.top + carried.height, target.top + target.height)
    - Math.max(carried.top, target.top);
  if (width <= 0 || height <= 0) return 0;

  const smaller = Math.min(carried.width * carried.height, target.width * target.height);
  return smaller > 0 ? (width * height) / smaller : 0;
}

/**
 * Whether the carried tile sits on the target enough that dropping it would fold the two together.
 *
 * The overlap is measured against the smaller of the two boxes, so a small tile can group onto a
 * large one it can never cover half of, and a large tile brushing a small one's corner does not
 * group just because the sliver is the small tile's whole edge. The target rect must be where the
 * tile is DRAWN right now — a tile the reorder preview slid aside is only a target at its new spot,
 * never at the empty slot it left behind.
 */
export const isGroupOverlap = (carried: TileRect, target: TileRect): boolean =>
  groupOverlapRatio(carried, target) >= GROUP_OVERLAP;
