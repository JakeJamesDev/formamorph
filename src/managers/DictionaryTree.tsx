import { randomUUID } from "@/lib/uuid";
import { useState } from 'react';
import { useDictionaryStore } from '@/contexts/DictionaryStoreContext';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { X, GripVertical, ChevronRight, ChevronDown, Copy, FilePlus } from 'lucide-react';
import {
  DndContext, closestCorners, PointerSensor, KeyboardSensor, useSensor, useSensors, useDroppable,
  MeasuringStrategy, type DragEndEvent, type DragStartEvent,
} from '@dnd-kit/core';
import {
  SortableContext, useSortable, sortableKeyboardCoordinates, verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { restrictToVerticalAxis, restrictToFirstScrollableAncestor } from '@dnd-kit/modifiers';
import { reorderBooks, moveEntryInBooks, duplicateEntryInBooks } from '@/lib/dictionaryTree';
import { EmptyListHint } from '@/components/EmptyListHint';
import type { Dictionary, DictionaryEntry } from '@/types';

/** One entry ("page") row inside a book zone: grip handle + enabled toggle + name + duplicate/delete. */
function EntryRow({ entry, selected, onSelect, onToggleEnabled, onDuplicate, onRemove }: {
  entry: DictionaryEntry;
  selected: boolean;
  onSelect: (id: string) => void;
  onToggleEnabled: (entry: DictionaryEntry, enabled: boolean) => void;
  onDuplicate: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: entry.id });
  const faded = entry.enabled === false;
  const style = {
    // Translate (not Transform): Transform bakes in a scale that resizes the dragged row to the target slot.
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging || faded ? 0.5 : 1,
    zIndex: isDragging ? 1 : undefined,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={(e) => { e.stopPropagation(); onSelect(entry.id); }}
      className={`p-2 cursor-pointer rounded-md transition-colors flex items-center gap-1
        ${selected ? 'bg-primary text-primary-foreground' : 'hover:bg-secondary'}`}
    >
      <span
        {...attributes}
        {...listeners}
        onClick={(e) => e.stopPropagation()}
        className={`shrink-0 cursor-grab touch-none px-1 ${selected ? 'text-primary-foreground' : 'text-muted-foreground'}`}
        title="Drag to reorder, re-place, or move to another dictionary"
      >
        <GripVertical className="h-4 w-4" />
      </span>
      <Checkbox
        checked={entry.enabled !== false}
        onCheckedChange={(v) => onToggleEnabled(entry, v === true)}
        onClick={(e) => e.stopPropagation()}
        className="mx-1 shrink-0"
        title={entry.enabled === false ? 'Disabled — click to enable' : 'Enabled — click to disable'}
      />
      <span className="min-w-0 flex-grow truncate">{entry.name || entry.key || 'Untitled'}</span>
      <Button variant="ghost" size="icon" className={`shrink-0 ${selected ? 'text-primary-foreground' : 'text-muted-foreground'}`}
        onClick={(e) => { e.stopPropagation(); onDuplicate(entry.id); }} title="Duplicate">
        <Copy className="h-4 w-4" />
      </Button>
      <Button variant="ghost" size="icon" className={`shrink-0 ${selected ? 'text-primary-foreground' : 'text-muted-foreground'}`}
        onClick={(e) => { e.stopPropagation(); onRemove(entry.id); }} title="Delete">
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}

/** One droppable, collapsible zone (Background/Foreground) within a book; empty zones still accept a drop. */
function DictZone({ bookId, position, entries, collapsed, onToggleCollapse, selectedId, onSelectEntry, onToggleEntryEnabled, onDuplicateEntry, onRemoveEntry }: {
  bookId: string;
  position: 'before' | 'after';
  entries: DictionaryEntry[];
  collapsed: boolean;
  onToggleCollapse: () => void;
  selectedId: string | null;
  onSelectEntry: (id: string) => void;
  onToggleEntryEnabled: (entry: DictionaryEntry, enabled: boolean) => void;
  onDuplicateEntry: (id: string) => void;
  onRemoveEntry: (id: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `zone:${bookId}:${position}` });
  return (
    <div>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onToggleCollapse(); }}
        className="flex items-center gap-1 mb-1 text-muted-foreground"
      >
        {collapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        <span className="text-[0.65rem] font-semibold uppercase tracking-wide">
          {position === 'before' ? 'Background' : 'Foreground'}
        </span>
        <span className="text-[0.65rem]">({entries.length})</span>
      </button>
      {!collapsed && (
        <SortableContext items={entries.map((e) => e.id)} strategy={verticalListSortingStrategy}>
          <div
            ref={setNodeRef}
            className={`flex flex-col gap-1 rounded-md border border-dashed p-1 min-h-[2.5rem] transition-colors ${
              isOver ? 'border-primary bg-secondary/40' : 'border-border/50'
            }`}
          >
            {entries.map((entry) => (
              <EntryRow
                key={entry.id}
                entry={entry}
                selected={selectedId === entry.id}
                onSelect={onSelectEntry}
                onToggleEnabled={onToggleEntryEnabled}
                onDuplicate={onDuplicateEntry}
                onRemove={onRemoveEntry}
              />
            ))}
            {entries.length === 0 && <p className="px-2 py-1 text-xs text-muted-foreground">Drag entries here.</p>}
          </div>
        </SortableContext>
      )}
    </div>
  );
}

/** One book ("dictionary") — a collapsible, reorderable, selectable header over two entry zones. */
function BookRow({ book, collapsed, collapsedZones, selectedId, onToggleCollapse, onToggleZone, onSelect, onToggleEnabled, onAddEntry, onDeleteBook, entryHandlers }: {
  book: Dictionary;
  collapsed: boolean;
  collapsedZones: Set<string>;
  selectedId: string | null;
  onToggleCollapse: (id: string) => void;
  onToggleZone: (key: string) => void;
  onSelect: (id: string) => void;
  onToggleEnabled: (book: Dictionary, enabled: boolean) => void;
  onAddEntry: (bookId: string) => void;
  onDeleteBook: (bookId: string) => void;
  entryHandlers: {
    onSelectEntry: (id: string) => void;
    onToggleEntryEnabled: (entry: DictionaryEntry, enabled: boolean) => void;
    onDuplicateEntry: (id: string) => void;
    onRemoveEntry: (id: string) => void;
  };
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: book.id });
  // Translate (not Transform): Transform bakes in a scale that resizes the dragged row to the target slot.
  const style = { transform: CSS.Translate.toString(transform), transition, opacity: isDragging ? 0.5 : 1, zIndex: isDragging ? 1 : undefined };
  const selected = selectedId === book.id;
  const faded = book.enabled === false;
  const before = book.entries.filter((e) => e.position === 'before');
  const after = book.entries.filter((e) => e.position !== 'before');
  const enabledCount = book.entries.filter((e) => e.enabled !== false).length;

  return (
    <div ref={setNodeRef} style={style} className="rounded-md border border-border/60">
      <div
        onClick={(e) => { e.stopPropagation(); onSelect(book.id); }}
        className={`p-2 cursor-pointer rounded-t-md transition-colors flex items-center gap-1
          ${selected ? 'bg-primary text-primary-foreground' : 'hover:bg-secondary'} ${faded ? 'opacity-50' : ''}`}
      >
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onToggleCollapse(book.id); }}
          className="shrink-0"
          aria-label={collapsed ? 'Expand dictionary' : 'Collapse dictionary'}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
        <span
          {...attributes}
          {...listeners}
          onClick={(e) => e.stopPropagation()}
          className={`shrink-0 cursor-grab touch-none px-1 ${selected ? 'text-primary-foreground' : 'text-muted-foreground'}`}
          title="Drag to reorder dictionaries"
        >
          <GripVertical className="h-4 w-4" />
        </span>
        <Checkbox
          checked={book.enabled !== false}
          onCheckedChange={(v) => onToggleEnabled(book, v === true)}
          onClick={(e) => e.stopPropagation()}
          className="mx-1 shrink-0"
          title={book.enabled === false ? 'Disabled — click to enable' : 'Enabled — click to disable'}
        />
        <span className="min-w-0 flex-grow truncate font-medium">{book.name}</span>
        <span
          className={`shrink-0 text-xs mr-1 ${selected ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}
          title="Enabled entries / total entries"
        >
          {enabledCount}/{book.entries.length}
        </span>
        <Button variant="ghost" size="icon" className={`shrink-0 ${selected ? 'text-primary-foreground' : 'text-muted-foreground'}`}
          onClick={(e) => { e.stopPropagation(); onAddEntry(book.id); }} title="Add entry">
          <FilePlus className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className={`shrink-0 ${selected ? 'text-primary-foreground' : 'text-muted-foreground'}`}
          onClick={(e) => { e.stopPropagation(); onDeleteBook(book.id); }} title="Delete dictionary">
          <X className="h-4 w-4" />
        </Button>
      </div>
      {!collapsed && (
        <div className="p-2 pl-6 flex flex-col gap-2">
          <DictZone
            bookId={book.id} position="before" entries={before}
            collapsed={collapsedZones.has(`${book.id}:before`)} onToggleCollapse={() => onToggleZone(`${book.id}:before`)}
            selectedId={selectedId} {...entryHandlers}
          />
          <DictZone
            bookId={book.id} position="after" entries={after}
            collapsed={collapsedZones.has(`${book.id}:after`)} onToggleCollapse={() => onToggleZone(`${book.id}:after`)}
            selectedId={selectedId} {...entryHandlers}
          />
        </div>
      )}
    </div>
  );
}

/** The Dictionary tab's book tree: reorderable books, each with Background/Foreground zones; entries drag
 *  within a zone, between zones, and across books (one unified drag context). */
const DictionaryTree = ({ selectedId, onSelect }: { selectedId: string | null; onSelect: (id: string) => void }) => {
  const { dictionaries, setDictionaries, addDictionaryEntry, updateDictionary, removeDictionary, removeDictionaryEntry } = useDictionaryStore();
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [collapsedZones, setCollapsedZones] = useState<Set<string>>(new Set());
  const [bookToDelete, setBookToDelete] = useState<string | null>(null);
  // While a book is being dragged, collapse every book: they can be large and can't nest, so a compact
  // list reorders cleanly. This is transient (doesn't touch the persistent `collapsed` set).
  const [draggingBook, setDraggingBook] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const isBook = (id: string) => dictionaries.some((b) => b.id === id);
  // Locate an entry by id across all books; returns its owning book id and position.
  const findEntry = (id: string): { bookId: string; position: 'before' | 'after' } | null => {
    for (const b of dictionaries) {
      const e = b.entries.find((x) => x.id === id);
      if (e) return { bookId: b.id, position: e.position === 'before' ? 'before' : 'after' };
    }
    return null;
  };
  // The book that owns a drag target (book id, `zone:bookId:pos`, or an entry id), for book reordering.
  const bookOf = (id: string): string | null => {
    if (isBook(id)) return id;
    if (id.startsWith('zone:')) return id.split(':')[1];
    return findEntry(id)?.bookId ?? null;
  };

  const toggleCollapse = (id: string) => setCollapsed((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const toggleZone = (key: string) => setCollapsedZones((prev) => {
    const next = new Set(prev);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });

  const handleDragStart = ({ active }: DragStartEvent) => {
    if (isBook(String(active.id))) setDraggingBook(true);
  };

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    setDraggingBook(false);
    if (!over) return;
    const activeId = String(active.id);
    const overId = String(over.id);

    if (isBook(activeId)) {
      const overBookId = bookOf(overId);
      if (overBookId) setDictionaries(reorderBooks(dictionaries, activeId, overBookId));
      return;
    }

    // Entry drag: resolve the target book + position + insertion anchor from what we're over.
    let targetBookId: string | null;
    let targetPosition: 'before' | 'after';
    let overEntryId: string | null = null;
    if (overId.startsWith('zone:')) {
      const [, bookId, pos] = overId.split(':');
      targetBookId = bookId;
      targetPosition = pos === 'before' ? 'before' : 'after';
    } else if (isBook(overId)) {
      targetBookId = overId; // dropped onto a (possibly collapsed) book header → its Foreground
      targetPosition = 'after';
    } else {
      const loc = findEntry(overId);
      if (!loc) return;
      targetBookId = loc.bookId;
      targetPosition = loc.position;
      overEntryId = overId;
    }
    if (!targetBookId) return;
    setDictionaries(moveEntryInBooks(dictionaries, activeId, targetBookId, targetPosition, overEntryId));
  };

  const duplicateEntry = (id: string) => {
    const { books, newId } = duplicateEntryInBooks(dictionaries, id);
    setDictionaries(books);
    if (newId) onSelect(newId);
  };

  const addEntry = (bookId: string) => {
    const id = randomUUID();
    addDictionaryEntry(bookId, { id, name: 'New Entry', key: '', value: '' });
    setCollapsed((prev) => { const next = new Set(prev); next.delete(bookId); return next; });
    onSelect(id);
  };

  const entryHandlers = {
    onSelectEntry: onSelect,
    onToggleEntryEnabled: (entry: DictionaryEntry, enabled: boolean) => {
      setDictionaries(dictionaries.map((b) => ({
        ...b, entries: b.entries.map((e) => (e.id === entry.id ? { ...e, enabled } : e)),
      })));
    },
    onDuplicateEntry: duplicateEntry,
    onRemoveEntry: (id: string) => { removeDictionaryEntry(id); if (id === selectedId) onSelect(''); },
  };

  if (!dictionaries.length) {
    return <EmptyListHint noun="dictionaries" />;
  }

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setDraggingBook(false)}
        modifiers={[restrictToVerticalAxis, restrictToFirstScrollableAncestor]}
        // Re-measure continuously so the drag tracks the layout as books collapse/expand mid-drag.
        measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
        autoScroll={{
          canScroll: (el) =>
            el !== document.scrollingElement && el !== document.body && el !== document.documentElement,
        }}
      >
        <SortableContext items={dictionaries.map((b) => b.id)} strategy={verticalListSortingStrategy}>
          <div className="flex flex-col gap-3">
            {dictionaries.map((book) => (
              <BookRow
                key={book.id}
                book={book}
                collapsed={draggingBook || collapsed.has(book.id)}
                collapsedZones={collapsedZones}
                selectedId={selectedId}
                onToggleCollapse={toggleCollapse}
                onToggleZone={toggleZone}
                onSelect={onSelect}
                onToggleEnabled={(b, enabled) => updateDictionary({ ...b, enabled })}
                onAddEntry={addEntry}
                onDeleteBook={setBookToDelete}
                entryHandlers={entryHandlers}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
      <ConfirmDialog
        open={!!bookToDelete}
        onOpenChange={(open) => !open && setBookToDelete(null)}
        title="Delete Dictionary"
        description="Delete this dictionary and all of its entries? This cannot be undone."
        onConfirm={() => {
          if (bookToDelete) { removeDictionary(bookToDelete); if (bookToDelete === selectedId) onSelect(''); }
          setBookToDelete(null);
        }}
      />
    </>
  );
};

export default DictionaryTree;
