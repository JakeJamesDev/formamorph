import { type DragEndEvent } from '@dnd-kit/core';
import { arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, X } from 'lucide-react';
import { EditorDndContext, StableSortableContext } from '@/components/dnd/EditorDndContext';
import { Button } from '@/components/ui/button';
import { Tip } from '@/components/ui/tooltip';
import { ActionIcon } from '@/lib/actionIcons';
import { formatSaveTimestamp } from '@/lib/saveOrdering';
import { cn } from '@/lib/utils';

export interface SaveListItem {
  id: string;
  name: string;
  timestamp: number;
  gameTime: number;
  isAutosave?: boolean;
}

const formatGameTime = (time: number) => {
  const hours = Math.floor(time);
  const minutes = Math.floor((time - hours) * 60);
  return `${hours}h ${minutes}m`;
};

function SortableSaveRow<T extends SaveListItem>({ row, disabled, busy, pickLabel, onPick, onExport, onDelete }: {
  row: T;
  disabled: boolean;
  busy: boolean;
  pickLabel: string;
  onPick: (row: T) => void;
  onExport: (row: T) => void;
  onDelete: (row: T) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: row.id, disabled });
  const style = {
    // Translation preserves each row's own height when long save names wrap.
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'flex w-full items-center gap-1 rounded-md border border-input bg-background pr-1 text-left text-label transition-colors',
        disabled ? 'pointer-events-none opacity-50' : 'hover:bg-accent hover:text-accent-foreground',
      )}
    >
      <Tip tip="Drag to reorder">
        <span
          {...attributes}
          {...listeners}
          className="flex shrink-0 self-stretch cursor-grab touch-none items-center rounded-sm px-1 py-2 text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
        >
          <GripVertical className="h-4 w-4" />
        </span>
      </Tip>
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled}
        aria-label={pickLabel}
        className="min-w-0 flex-1 cursor-pointer rounded-sm py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
        onClick={() => { if (!disabled) onPick(row); }}
        onKeyDown={(event) => {
          if (!disabled && (event.key === 'Enter' || event.key === ' ')) {
            event.preventDefault();
            onPick(row);
          }
        }}
      >
        <div className="break-words font-medium">
          {row.name}
          {row.isAutosave && (
            <span className="relative -top-[2px] ml-2 inline-block rounded bg-info/15 px-1.5 py-px align-middle text-[10px] font-semibold uppercase leading-none tracking-wide text-info">
              Auto
            </span>
          )}
        </div>
        <div className="text-meta opacity-70">
          {formatSaveTimestamp(row.timestamp)} - Game Time: {formatGameTime(row.gameTime)}
        </div>
      </div>
      <Tip tip="Export save">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 shrink-0 p-0"
          aria-label={`Export save “${row.name}”`}
          disabled={disabled || busy}
          onClick={(event) => { event.stopPropagation(); onExport(row); }}
        >
          <ActionIcon.export className="h-3.5 w-3.5" />
        </Button>
      </Tip>
      <Tip tip="Delete save">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 shrink-0 p-0 text-destructive"
          aria-label={`Delete save “${row.name}”`}
          disabled={disabled}
          onClick={(event) => { event.stopPropagation(); onDelete(row); }}
        >
          <X className="h-4 w-4" />
        </Button>
      </Tip>
    </div>
  );
}

export function SaveList<T extends SaveListItem>({ rows, disabled = false, busy = false, getPickLabel, onPick, onExport, onDelete, onReorder }: {
  rows: T[];
  disabled?: boolean;
  busy?: boolean;
  getPickLabel?: (row: T) => string;
  onPick: (row: T) => void;
  onExport: (row: T) => void;
  onDelete: (row: T) => void;
  onReorder: (rows: T[]) => void;
}) {
  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const from = rows.findIndex((row) => row.id === active.id);
    const to = rows.findIndex((row) => row.id === over.id);
    if (from < 0 || to < 0) return;
    onReorder(arrayMove(rows, from, to));
  };

  return (
    <EditorDndContext onDragEnd={handleDragEnd}>
      <StableSortableContext items={rows} strategy={verticalListSortingStrategy}>
        {rows.map((row) => (
          <SortableSaveRow
            key={row.id}
            row={row}
            disabled={disabled}
            busy={busy}
            pickLabel={getPickLabel?.(row) ?? `Load save “${row.name}”`}
            onPick={onPick}
            onExport={onExport}
            onDelete={onDelete}
          />
        ))}
      </StableSortableContext>
    </EditorDndContext>
  );
}
