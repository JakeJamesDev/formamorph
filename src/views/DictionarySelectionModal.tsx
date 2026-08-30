import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { GripVertical } from 'lucide-react';
import { closestCorners, type DragEndEvent } from '@dnd-kit/core';
import { useSortable, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { EditorDndContext, StableSortableContext } from '@/components/dnd/EditorDndContext';
import DictionaryStorageService from '@/services/DictionaryStorageService';
import { buildInitialSelection, finalizeSelection, type DictionarySelectionItem } from '@/lib/dictionarySelection';
import type { Dictionary, DictionaryMetadata } from '@/types';
import { Tip } from '@/components/ui/tooltip';

/** One draggable dictionary row: grip (leftmost) + enabled checkbox + name + description + entry count. */
function SelectionRow({ item, onToggle }: {
  item: DictionarySelectionItem;
  onToggle: (key: string, enabled: boolean) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.key });
  const style = {
    // Translate (not Transform): Transform bakes in a scale that resizes the dragged row to the target slot.
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1 : undefined,
  };
  // World books show live enabled/total; library rows aren't fetched yet, so all entries would be copied.
  const enabledEntries = item.source === 'world'
    ? item.book.entries.filter((e) => e.enabled !== false).length
    : item.entryCount;
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 p-2 border rounded ${item.enabled ? '' : 'opacity-60'}`}
    >
      <Tip tip="Drag to reorder">
        <span
          {...attributes}
          {...listeners}
          className="cursor-grab touch-none px-1 text-muted-foreground shrink-0"
        >
          <GripVertical className="h-4 w-4" />
        </span>
      </Tip>
      <Tip tip={item.enabled ? 'Enabled — click to disable' : 'Disabled — click to enable'}>
        <Checkbox
          checked={item.enabled}
          onCheckedChange={(v) => onToggle(item.key, v === true)}
          className="shrink-0"
        />
      </Tip>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="font-semibold truncate">{item.book.name || 'Untitled'}</span>
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground shrink-0">
            {item.source === 'world' ? 'World' : 'Library'}
          </span>
        </div>
        {item.book.description && (
          <p className="text-meta text-muted-foreground truncate">{item.book.description}</p>
        )}
      </div>
      {/* A pair of bare numbers only a tip explains, so it takes a tab stop and reaches a keyboard. */}
      <Tip tip="Enabled entries / total entries">
        <span className="text-meta text-muted-foreground shrink-0" tabIndex={0}>
          {enabledEntries}/{item.entryCount}
        </span>
      </Tip>
    </div>
  );
}

/**
 * Post-location step: choose which dictionaries apply to this playthrough and in what order. Lists the
 * world's own books first, then the player's downloaded library, in one reorderable list. The player can
 * enable/disable and reorder any of them; the ordered enabled set (library picks copied in with fresh
 * ids) becomes the runtime dictionaries. Only shown when there's a real choice (see
 * `shouldShowDictionaryStep`).
 */
const DictionarySelectionModal = ({
  worldBooks,
  libraryMeta,
  onConfirm,
  onAbort,
  onBack,
  confirmLabel = 'Start',
}: {
  worldBooks: Dictionary[];
  libraryMeta: DictionaryMetadata[];
  onConfirm: (finalDictionaries: Dictionary[]) => void;
  onAbort: () => void;
  /** Step back in the enter-world flow. Undefined on the flow's first step (the Back button then fades). */
  onBack?: () => void;
  /** Label for the confirm button — names the next step in the flow (e.g. "Avatar", "Start"). */
  confirmLabel?: string;
}) => {
  const [items, setItems] = useState<DictionarySelectionItem[]>(
    () => buildInitialSelection(worldBooks, libraryMeta),
  );
  const [resolving, setResolving] = useState(false);

  const toggle = (key: string, enabled: boolean) =>
    setItems((prev) => prev.map((i) => (i.key === key ? { ...i, enabled } : i)));

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    setItems((prev) => {
      const from = prev.findIndex((i) => i.key === active.id);
      const to = prev.findIndex((i) => i.key === over.id);
      if (from < 0 || to < 0) return prev;
      return arrayMove(prev, from, to);
    });
  };

  const handleConfirm = async () => {
    setResolving(true);
    try {
      const resolved = new Map<string, Dictionary>();
      for (const item of items) {
        if (item.enabled && item.source === 'library') {
          try {
            resolved.set(item.book.id, await DictionaryStorageService.getDictionaryData(item.book.id));
          } catch {
            // Record vanished between listing and confirm — finalizeSelection skips it.
          }
        }
      }
      onConfirm(finalizeSelection(items, resolved));
    } finally {
      setResolving(false);
    }
  };

  return (
    <Card className="fixed inset-0 m-auto w-[95%] max-w-[600px] h-[90dvh] max-h-[800px] z-50">
      <CardContent className="p-3 sm:p-6 h-full flex flex-col">
        <h2 className="text-title sm:text-heading font-semibold mb-1">Choose Dictionaries</h2>
        <p className="text-meta sm:text-helper text-muted-foreground mb-3">
          Enable, disable, and reorder the dictionaries for this playthrough. Order sets injection order;
          world dictionaries appear first, your library below.
        </p>

        <ScrollArea className="flex-1 mb-4">
          <EditorDndContext collisionDetection={closestCorners} onDragEnd={handleDragEnd}>
            <StableSortableContext items={items} getId={(i) => i.key} strategy={verticalListSortingStrategy}>
              <div className="flex flex-col gap-2 pr-2">
                {items.map((item) => (
                  <SelectionRow key={item.key} item={item} onToggle={toggle} />
                ))}
              </div>
            </StableSortableContext>
          </EditorDndContext>
        </ScrollArea>

        <div className="flex gap-2 flex-shrink-0">
          <Button onClick={onAbort} variant="destructive" className="flex-1" disabled={resolving}>Abort</Button>
          <Button onClick={onBack} variant="outline" className="flex-1" disabled={!onBack || resolving}>Back</Button>
          <Button onClick={handleConfirm} className="flex-1" disabled={resolving}>
            {resolving ? 'Loading…' : confirmLabel}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default DictionarySelectionModal;
