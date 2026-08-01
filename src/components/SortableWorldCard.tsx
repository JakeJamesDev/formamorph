import React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { CardTags, type WorldRecord } from "@/components/WorldDetails";
import { WorldCardShell } from "@/components/WorldCardShell";

/** A draggable local-world tile. The whole card is the drag handle; a small move distance is required to
 *  start a drag so a plain click still selects the world. `detailed` mirrors the community-browser card layout.
 *  `aspect='portrait'` gives the grid image a tall 2:3 frame (for character portraits) instead of the short
 *  landscape default. Omit `onSelect` for a card with nothing to open — it drops the pointer cursor too, so
 *  the tile doesn't advertise a click it won't answer. `badge` overlays the grid thumbnail's top-left. */
function SortableWorldCard({ world, onSelect, onDelete, layout, aspect = 'landscape', badge }: {
  world: WorldRecord;
  onSelect?: (id: string) => void;
  onDelete: (id: string) => void;
  layout: 'grid' | 'detailed';
  aspect?: 'landscape' | 'portrait';
  badge?: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: world.id });
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
        frameClassName="bg-card touch-pan-y [content-visibility:auto] [contain-intrinsic-size:auto_360px]"
        onClick={() => onSelect?.(world.id)}
        name={world.name}
        description={world.description}
        // Omitted rather than "By Unknown" when there is none: a character or a book in your own library
        // has no byline to print, and the shell drops the line entirely when it gets nothing.
        author={world.author ? `By ${world.author}` : undefined}
        thumbnail={world.thumbnail
          ? (
            <img
              src={world.thumbnail}
              alt={world.name}
              // Character art is almost always a portrait, and this frame is landscape — anchored to the
              // top so the crop takes the face rather than the middle of the torso. Same rule the
              // community browser's cards use.
              className={cn(
                'w-full h-full object-cover select-none pointer-events-none',
                aspect === 'portrait' && 'object-top',
              )}
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

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      // content-visibility:auto skips layout/paint for off-screen tiles; the auto intrinsic-size reserves
      // their height (remembered after first paint) so the scroll frame doesn't jump. The reservation is
      // per-aspect: a 2:3 portrait stands about half again as tall as the landscape tile, and a single
      // figure for both would misreserve one of them on first paint.
      className={`relative rounded-lg overflow-hidden transition-opacity touch-pan-y [content-visibility:auto] ${
        aspect === 'portrait' ? '[contain-intrinsic-size:auto_360px]' : '[contain-intrinsic-size:auto_240px]'
      } ${onSelect ? 'cursor-pointer hover:opacity-90' : ''}`}
      onClick={() => onSelect?.(world.id)}
    >
      {world.thumbnail ? (
        <img
          src={world.thumbnail}
          alt={world.name}
          // Top-anchored for character art, as in the detailed card and the community browser: even a 2:3
          // frame crops a portrait, and the face is the part worth keeping.
          className={cn(
            'w-full object-cover select-none pointer-events-none',
            aspect === 'portrait' ? 'aspect-[2/3] object-top' : 'h-48',
          )}
        />
      ) : (
        <div className={`w-full ${aspect === 'portrait' ? 'aspect-[2/3]' : 'h-48'} bg-muted`} />
      )}
      {badge && <div className="absolute top-1 left-1 z-10">{badge}</div>}
      <div className="absolute bottom-0 left-0 right-0 bg-overlay/50 p-2">
        <h3 className="text-white font-semibold">{world.name}</h3>
        <button
          className="absolute top-2 right-2 p-1 text-destructive hover:text-destructive/80"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={handleDelete}
        >
          <Trash2 className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}

export default SortableWorldCard;
