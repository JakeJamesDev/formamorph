import React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Trash2 } from "lucide-react";
import { CardTags, type WorldRecord } from "@/components/WorldDetails";
import { WorldCardShell } from "@/components/WorldCardShell";

/** A draggable local-world tile. The whole card is the drag handle; a small move distance is required to
 *  start a drag so a plain click still selects the world. `detailed` mirrors the community-browser card layout.
 *  `aspect='portrait'` gives the grid image a tall 2:3 frame (for character portraits) instead of the short
 *  landscape default. */
function SortableWorldCard({ world, onSelect, onDelete, layout, aspect = 'landscape' }: {
  world: WorldRecord;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  layout: 'grid' | 'detailed';
  aspect?: 'landscape' | 'portrait';
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: world.id });
  const style = {
    transform: CSS.Transform.toString(transform),
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
        frameClassName="bg-background touch-none"
        onClick={() => onSelect(world.id)}
        name={world.name}
        description={world.description}
        author={`By ${world.author || "Unknown"}`}
        thumbnail={world.thumbnail
          ? <img src={world.thumbnail} alt={world.name} className="w-full h-full object-cover select-none pointer-events-none" />
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
      className="relative cursor-pointer rounded-lg overflow-hidden hover:opacity-90 transition-opacity touch-none"
      onClick={() => onSelect(world.id)}
    >
      {world.thumbnail ? (
        <img
          src={world.thumbnail}
          alt={world.name}
          className={`w-full ${aspect === 'portrait' ? 'aspect-[2/3]' : 'h-48'} object-cover select-none pointer-events-none`}
        />
      ) : (
        <div className={`w-full ${aspect === 'portrait' ? 'aspect-[2/3]' : 'h-48'} bg-muted`} />
      )}
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
