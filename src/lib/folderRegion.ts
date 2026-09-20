import type { PlacementMap } from '@/lib/libraryOrganization';

/**
 * How far past the region's bottom edge a member may reach and still count as whole.
 *
 * A tile's shape is not the same at every span: the gutter is a bigger share of a small tile than of a
 * large one, so a member of one span placed in a region cut to another span's shape misses that shape
 * by a few percent. Without the slack those few pixels would drop a member that reads as whole.
 */
const BOTTOM_SLACK = 0.06;

/** The part of a folder's board its tile stands for. */
export interface FolderRegion {
  /** Base-cell columns the face shows. */
  cols: number;
  /** The region's width in board pixels, which is what the camera zooms by. */
  width: number;
  /** The region's height in board pixels: the tile's own shape, grown to the region's width. */
  height: number;
  /** Members the face leaves out, in the order they were given. The `+N` badge counts them. */
  hidden: string[];
}

/** The pixel size of `span` base cells across. */
const sideOf = (span: number, cell: number, gap: number) => span * cell + (span - 1) * gap;

/**
 * The region of a folder's board that its tile shows: the top-left corner, as many columns wide as the
 * folder uses, capped so a thumbnail on the face stays about the size a mosaic cell was.
 *
 * The face and the camera both read this, so the picture the player clicks and the picture the zoom
 * lands on cannot drift apart.
 *
 * The cap is two medium columns per base cell of the tile. It is never narrower than the member in the
 * board's corner, so a large member on a small folder tile leaves the face something to draw. That
 * member is the one the region is built around, so it is never left out — the tile's own shape crops a
 * few percent off its bottom where their spans differ, which is the closest a single scale can come.
 *
 * @param members - The members the open folder draws, in its reading order
 * @param places - The open folder board's homes for those members, at `baseCols`
 * @param tileSpan - The folder tile's own span on the library board
 * @param baseCols - Base-cell columns of the board itself, which the region never exceeds
 */
export function folderRegion({
  members, places, spanOf, tileSpan, baseCols, cellWidth, rowHeight, gap,
}: {
  members: string[];
  places: PlacementMap;
  spanOf: (id: string) => number;
  tileSpan: number;
  baseCols: number;
  cellWidth: number;
  rowHeight: number;
  gap: number;
}): FolderRegion {
  const used = Math.max(1, ...members.map((id) => (places[id] ? places[id].col + spanOf(id) : 0)));
  const cornerId = members.find((id) => places[id]?.row === 0 && places[id]?.col === 0);
  const corner = cornerId ? spanOf(cornerId) : 1;
  const cols = Math.min(baseCols, Math.max(Math.min(used, tileSpan * 2), corner));

  if (cellWidth <= 0 || rowHeight <= 0) return { cols, width: 0, height: 0, hidden: [] };

  const width = sideOf(cols, cellWidth, gap);
  const height = sideOf(tileSpan, rowHeight, gap) * (width / sideOf(tileSpan, cellWidth, gap));
  const bottomLimit = height * (1 + BOTTOM_SLACK);
  const hidden = members.filter((id) => id !== cornerId && (
    !places[id]
    || places[id].col + spanOf(id) > cols
    || sideOf(places[id].row + spanOf(id), rowHeight, gap) > bottomLimit
  ));

  return { cols, width, height, hidden };
}
