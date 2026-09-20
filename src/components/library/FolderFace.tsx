import { cn } from '@/lib/utils';
import type { PlacementMap } from '@/lib/libraryOrganization';

/** The folder tile's border, which the face draws under so it aligns to the tile's border box. */
const TILE_BORDER = 2;

/**
 * A folder's board at tile scale: the top-left region of it, with every member at the cell and span the
 * open folder gives it, drawn at the board's real pixel size and shrunk by one transform so the region's
 * width equals the tile width.
 *
 * Plain thumbnails rather than the tab's cards, because a card registers a sortable. The face draws
 * whole tiles only; a `+N` badge counts the members the region leaves out.
 *
 * @param members - The members the open folder draws, in its reading order
 * @param places - The open folder board's homes for those members, at `columns`
 * @param hidden - The members the region leaves out, which the badge counts and the face skips
 * @param regionWidth - The board-space width of the region, which the face shrinks to the tile's width
 * @param tileWidth - The folder tile's own width, in px
 */
export function FolderFace({
  members, places, hidden, spanOf, thumbnailOf, columns, boardWidth, regionWidth, rowHeight, gap,
  tileWidth, fit,
}: {
  members: string[];
  places: PlacementMap;
  hidden: string[];
  spanOf: (id: string) => number;
  thumbnailOf: (id: string) => string | undefined;
  columns: number;
  boardWidth: number;
  regionWidth: number;
  rowHeight: number;
  gap: number;
  tileWidth: number;
  /** The `object-*` classes the member art takes on the full board. */
  fit: string;
}) {
  if (boardWidth <= 0 || tileWidth <= 0 || regionWidth <= 0) return <div className="h-full w-full bg-muted" />;
  const scale = tileWidth / regionWidth;
  const left = new Set(hidden);

  return (
    <div
      data-folder-face
      className="pointer-events-none absolute overflow-hidden bg-background"
      style={{ inset: -TILE_BORDER }}
    >
      {hidden.length > 0 && (
        <span
          data-folder-badge
          className="absolute right-1.5 top-1.5 z-10 rounded bg-overlay/70 px-1.5 py-0.5 text-meta text-white"
        >
          +{hidden.length}
        </span>
      )}
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
        {members.filter((id) => places[id] && !left.has(id)).map((id) => {
          const thumbnail = thumbnailOf(id);
          return (
            <div
              key={id}
              data-face-member={id}
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
