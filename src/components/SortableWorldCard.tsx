import React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Globe, Trash2 } from "lucide-react";
import { MarkdownRenderer } from "@/components/game/MarkdownRenderer";
import { CardTags, type WorldRecord } from "@/components/WorldDetails";

/** A draggable local-world tile. The whole card is the drag handle; a small move distance is required to
 *  start a drag so a plain click still selects the world. `detailed` mirrors the Discover card layout. */
function SortableWorldCard({ world, onSelect, onDelete, layout }: {
  world: WorldRecord;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  layout: 'grid' | 'detailed';
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

  // Detailed layout mirrors the Discover-menu card renderer (thumbnail on top, info beneath).
  if (layout === 'detailed') {
    return (
      <div
        ref={setNodeRef}
        style={style}
        {...attributes}
        {...listeners}
        className="relative flex flex-col rounded-lg border border-gray-200 dark:border-gray-700 cursor-pointer bg-background touch-none"
        onClick={() => onSelect(world.id)}
      >
        <div className="h-32 bg-gray-100 dark:bg-gray-800 rounded-t-lg overflow-hidden">
          {world.thumbnail ? (
            <img src={world.thumbnail} alt={world.name} className="w-full h-full object-cover select-none pointer-events-none" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-400">
              <Globe className="h-12 w-12" />
            </div>
          )}
        </div>

        <div className="p-4 flex flex-col flex-grow">
          <h3 className="font-semibold text-lg mb-1">{world.name}</h3>
          <div className="text-sm text-gray-600 dark:text-gray-400 mb-2 max-h-20 overflow-hidden">
            <MarkdownRenderer text={world.description || "No description available."} />
          </div>
          <div className="text-xs text-gray-500 mb-2">By {world.author || "Unknown"}</div>
          <div className="mt-auto" onClick={(e) => e.stopPropagation()}>
            <CardTags tags={world.tags || []} />
          </div>
        </div>

        <button
          className="absolute top-1 right-1 z-10 p-1 rounded bg-black/50 text-red-400 hover:text-red-600"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={handleDelete}
          aria-label="Delete world"
        >
          <Trash2 className="h-5 w-5" />
        </button>
      </div>
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
      <img
        src={world.thumbnail}
        alt={world.name}
        className="w-full h-48 object-cover select-none pointer-events-none"
      />
      <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 p-2">
        <h3 className="text-white font-semibold">{world.name}</h3>
        <button
          className="absolute top-2 right-2 p-1 text-red-500 hover:text-red-700"
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
