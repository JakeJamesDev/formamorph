import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Folder, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tip } from '@/components/ui/tooltip';
import { WorldCardShell } from '@/components/WorldCardShell';
import type { LibraryGroup } from '@/lib/libraryOrganization';

/** How many member thumbnails the folder shows before it starts counting the rest. */
const MOSAIC_CELLS = 4;

/** The 2x2 mini-mosaic that makes a folder recognizable at a glance. */
function GroupMosaic({ thumbnails, className }: { thumbnails: (string | undefined)[]; className?: string }) {
  const cells = Array.from({ length: MOSAIC_CELLS }, (_, i) => thumbnails[i]);

  return (
    <div className={cn('grid grid-cols-2 grid-rows-2 gap-px bg-border', className)}>
      {cells.map((thumbnail, index) => (
        <div key={index} className="relative overflow-hidden bg-muted">
          {thumbnail && (
            <img
              src={thumbnail}
              alt=""
              className="h-full w-full object-cover object-top select-none pointer-events-none"
            />
          )}
        </div>
      ))}
    </div>
  );
}

/**
 * A folder's tile in a library grid — the mosaic of what is inside, its name, and how many it holds.
 *
 * Draggable and sortable like any other tile, so a folder can be reordered and resized; clicking it
 * opens the folder view rather than a popup.
 *
 * @param thumbnails - Member thumbnails in member order; the tile shows the first four
 * @param presetName - The prompt preset this folder applies, when it carries one
 */
export function LibraryGroupTile({
  group, thumbnails, layout, fill, compact, presetName, onOpen,
}: {
  group: LibraryGroup;
  thumbnails: (string | undefined)[];
  layout: 'grid' | 'detailed';
  fill?: boolean;
  compact?: boolean;
  presetName?: string;
  onOpen: (groupId: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: group.id });
  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1 : undefined,
  };
  const count = `${group.members.length} item${group.members.length === 1 ? '' : 's'}`;

  if (layout === 'detailed') {
    return (
      <WorldCardShell
        ref={setNodeRef}
        style={style}
        {...attributes}
        {...listeners}
        frameClassName="h-full bg-card touch-pan-y"
        onClick={() => onOpen(group.id)}
        name={group.name}
        description={count}
        thumbnail={<GroupMosaic thumbnails={thumbnails} className="h-full w-full" />}
      >
        {presetName && (
          <div className="mt-auto flex items-center gap-1 text-meta text-muted-foreground">
            <Sparkles className="h-3 w-3" />
            {presetName}
          </div>
        )}
      </WorldCardShell>
    );
  }

  const tile = (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        'relative rounded-lg overflow-hidden border-2 border-border transition-opacity touch-pan-y',
        'cursor-pointer hover:opacity-90',
        fill ? 'h-full w-full' : 'h-48 w-full',
      )}
      onClick={() => onOpen(group.id)}
    >
      <GroupMosaic thumbnails={thumbnails} className="h-full w-full" />
      {group.members.length > MOSAIC_CELLS && (
        <span className="absolute top-1 right-1 rounded bg-overlay/70 px-1.5 py-0.5 text-meta text-white">
          +{group.members.length - MOSAIC_CELLS}
        </span>
      )}
      {!compact && (
        <div className="absolute bottom-0 left-0 right-0 bg-overlay/50 p-2 flex items-end gap-2">
          <Folder className="h-5 w-5 shrink-0 text-white" />
          <h3 className="min-w-0 flex-1 break-words text-white font-semibold">{group.name}</h3>
          <span className="shrink-0 text-meta text-white/70">{group.members.length}</span>
        </div>
      )}
    </div>
  );

  // A small folder tile keeps only the mosaic, so its name and count reach the player as a tip.
  return compact ? <Tip tip={`${group.name} — ${count}`}>{tile}</Tip> : tile;
}
