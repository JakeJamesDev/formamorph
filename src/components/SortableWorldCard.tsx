import React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { CardTags, type WorldRecord } from "@/components/WorldDetails";
import { TITLE_SCRIM, WorldCardShell } from "@/components/WorldCardShell";
import { Tip } from "@/components/ui/tooltip";
import { THUMB_FRAME, thumbFit, type ThumbAspect } from "@/lib/thumbAspect";

/** A draggable local-world tile. The whole card is the drag handle; a small move distance is required to
 *  start a drag so a plain click still selects the world. `detailed` mirrors the community-browser card layout.
 *  `aspect='portrait'` gives the grid image a tall 2:3 frame (for character portraits) instead of the short
 *  landscape default. Omit `onSelect` for a card with nothing to open — it drops the pointer cursor too, so
 *  the tile doesn't advertise a click it won't answer. `badge` overlays the grid thumbnail's top-left, and
 *  `note` is the same thing said as a line in the detailed layout, which has no thumbnail to overlay. */
function SortableWorldCard({ world, onSelect, onDelete, layout, aspect = 'landscape', badge, note, fill, compact }: {
  world: WorldRecord;
  onSelect?: (id: string) => void;
  onDelete: (id: string) => void;
  layout: 'grid' | 'detailed';
  aspect?: ThumbAspect;
  badge?: React.ReactNode;
  note?: React.ReactNode;
  /** Fill the tile the grid hands it, instead of taking its height from `aspect`. */
  fill?: boolean;
  /** Trade the name strip for a tooltip, so the smallest tile is thumbnail and nothing else. */
  compact?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    // The tile board slides displaced tiles itself; dnd-kit's layout animation would stack a second
    // offset on the same move, so the card starts twice as far away.
    useSortable({ id: world.id, animateLayoutChanges: layout === 'grid' ? () => false : undefined });
  const style = {
    // Translate (not Transform): Transform bakes in a scale that resizes the dragged card to the target slot.
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1 : undefined,
  };
  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete(world.id);
  };

  // Detailed layout: the shared card shell (thumbnail on top, info beneath), draggable, with a delete corner.
  if (layout === 'detailed') {
    return (
      <WorldCardShell
        ref={setNodeRef}
        style={style}
        {...attributes}
        {...listeners}
        // content-visibility:auto lets the browser skip layout/paint for off-screen cards; the auto
        // intrinsic-size reserves space (remembered after first paint) so scrolling stays stable.
        frameClassName="h-full bg-card touch-pan-y [content-visibility:auto] [contain-intrinsic-size:auto_360px]"
        onClick={() => onSelect?.(world.id)}
        name={world.name}
        description={world.description}
        // Omitted rather than "By Unknown" when there is none: a character or a book in your own library
        // has no byline to print, and the shell drops the line entirely when it gets nothing.
        author={world.author ? `By ${world.author}` : undefined}
        note={note}
        thumbnail={world.thumbnail
          ? (
            <img
              src={world.thumbnail}
              alt={world.name}
              className={cn('w-full h-full select-none pointer-events-none', thumbFit(aspect))}
            />
          )
          : undefined}
        cornerAction={(
          <button
            className="absolute top-1 right-1 z-10 p-1 rounded bg-overlay/50 text-destructive hover:text-destructive/80"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={handleDelete}
            aria-label="Delete world"
          >
            <Trash2 className="h-5 w-5" />
          </button>
        )}
      >
        <div className="mt-auto" onClick={(e) => e.stopPropagation()}>
          <CardTags tags={world.tags || []} />
        </div>
      </WorldCardShell>
    );
  }

  // A filled tile takes its box from the grid, so the height hints that size an auto tile are dropped
  // along with the intrinsic-size reservation they exist to feed.
  const frameSize = fill
    ? 'h-full w-full'
    : cn(
      'touch-pan-y [content-visibility:auto]',
      aspect === 'portrait' ? '[contain-intrinsic-size:auto_360px]' : '[contain-intrinsic-size:auto_240px]',
    );
  const mediaSize = fill
    ? 'h-full w-full'
    : cn('w-full', THUMB_FRAME[aspect]);

  const tile = (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      // content-visibility:auto skips layout/paint for off-screen tiles; the auto intrinsic-size reserves
      // their height (remembered after first paint) so the scroll frame doesn't jump. The reservation is
      // per-aspect: a 2:3 portrait stands about half again as tall as the landscape tile, and a single
      // figure for both would misreserve one of them on first paint.
      className={cn(
        'relative rounded-lg overflow-hidden transition-opacity touch-pan-y',
        frameSize,
        onSelect && 'cursor-pointer hover:opacity-90',
      )}
      onClick={() => onSelect?.(world.id)}
    >
      {world.thumbnail ? (
        <img
          src={world.thumbnail}
          alt={world.name}
          className={cn('select-none pointer-events-none', mediaSize, thumbFit(aspect))}
        />
      ) : (
        <div className={cn(mediaSize, 'bg-muted')} />
      )}
      {badge && <div className="absolute top-1 left-1 z-10 max-w-[calc(100%-0.5rem)]">{badge}</div>}
      {compact ? (
        <button
          className="absolute bottom-0.5 right-0.5 z-10 rounded bg-overlay/50 p-0.5 text-destructive hover:text-destructive/80"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={handleDelete}
          aria-label="Delete world"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      ) : (
        /* Flex row, not an absolute corner button: the trash keeps its own column so a long name wraps
           beside it instead of running underneath, and it bottom-aligns with the last line of the name. */
        <div className={cn('absolute bottom-0 left-0 right-0 p-2 pt-8 flex items-end gap-2', TITLE_SCRIM)}>
          <h3 className="min-w-0 flex-1 break-words text-white font-semibold">{world.name}</h3>
          <button
            className="shrink-0 p-1 text-destructive hover:text-destructive/80"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={handleDelete}
            aria-label="Delete world"
          >
            <Trash2 className="h-5 w-5" />
          </button>
        </div>
      )}
    </div>
  );

  // A small tile has no room for the name strip, so the name is a tip instead. `labelsChild` is off:
  // the delete button inside already carries its own label, and the tile is not a control.
  return compact ? <Tip tip={world.name} labelsChild={false}>{tile}</Tip> : tile;
}

export default SortableWorldCard;
