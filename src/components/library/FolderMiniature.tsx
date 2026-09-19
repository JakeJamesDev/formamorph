import { cn } from '@/lib/utils';
import type { PlacementMap } from '@/lib/libraryOrganization';

/** The folder tile's border, which the miniature draws under so it aligns to the tile's border box. */
const TILE_BORDER = 2;

/**
 * A folder's own board at tile scale: every member at the cell and span the open folder gives it, drawn
 * at the board's real pixel size and shrunk by one transform so the board width equals the tile width.
 *
 * Plain thumbnails rather than the tab's cards, because a card registers a sortable. Only the rows that
 * reach into the tile are drawn.
 *
 * @param members - The members the open folder draws, in its reading order
 * @param places - The open folder board's homes for those members, at `columns`
 * @param tile - The folder tile's own box, in px
 */
export function FolderMiniature({
  members, places, spanOf, thumbnailOf, columns, boardWidth, rowHeight, gap, tile, fit,
}: {
  members: string[];
  places: PlacementMap;
  spanOf: (id: string) => number;
  thumbnailOf: (id: string) => string | undefined;
  columns: number;
  boardWidth: number;
  rowHeight: number;
  gap: number;
  tile: { width: number; height: number };
  /** The `object-*` classes the member art takes on the full board. */
  fit: string;
}) {
  if (boardWidth <= 0 || tile.width <= 0) return <div className="h-full w-full bg-muted" />;
  const scale = tile.width / boardWidth;
  const rows = Math.ceil(tile.height / scale / (rowHeight + gap));

  return (
    <div
      data-folder-miniature
      className="pointer-events-none absolute overflow-hidden bg-background"
      style={{ inset: -TILE_BORDER }}
    >
      <div
        className="grid origin-top-left"
        style={{
          width: boardWidth,
          gap,
          gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
          gridAutoRows: `${rowHeight}px`,
          transform: `scale(${scale})`,
        }}
      >
        {members.filter((id) => places[id] && places[id].row < rows).map((id) => {
          const thumbnail = thumbnailOf(id);
          return (
            <div
              key={id}
              data-miniature-member={id}
              className="overflow-hidden rounded-lg border-2 border-border bg-muted"
              style={{
                gridColumn: `${places[id].col + 1} / span ${spanOf(id)}`,
                gridRow: `${places[id].row + 1} / span ${spanOf(id)}`,
              }}
            >
              {thumbnail && <img src={thumbnail} alt="" className={cn('h-full w-full select-none', fit)} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}
