import { useState, useEffect, type ChangeEvent, type KeyboardEvent } from 'react';
import { useGameData } from '@/contexts/GameDataContext';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SortableChip, splitChipInput } from "@/components/Chip";
import type { DictionaryEntry } from '@/types';

function KeywordChips({ keywords, onChange }: { keywords: string[]; onChange: (keywords: string[]) => void }) {
  const [inputValue, setInputValue] = useState('');
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const addKeyword = (raw: string) => {
    const kw = raw.trim();
    if (kw && !keywords.includes(kw)) {
      onChange([...keywords, kw]);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === ',' || e.key === 'Enter') {
      e.preventDefault();
      addKeyword(inputValue);
      setInputValue('');
    } else if (e.key === 'Backspace' && inputValue === '' && keywords.length > 0) {
      onChange(keywords.slice(0, -1));
    }
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    // Handle pasted/typed text containing commas (keydown also catches a single typed comma).
    const { complete, remainder } = splitChipInput(e.target.value);
    const toAdd = complete.filter((p) => !keywords.includes(p));
    if (toAdd.length) onChange([...keywords, ...toAdd]);
    setInputValue(remainder);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = keywords.indexOf(String(active.id));
    const newIndex = keywords.indexOf(String(over.id));
    if (oldIndex === -1 || newIndex === -1) return;
    onChange(arrayMove(keywords, oldIndex, newIndex));
  };

  return (
    <div className="flex flex-wrap items-center gap-1 rounded-md border border-border bg-background/80 p-2">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
        autoScroll={false}
      >
        <SortableContext items={keywords} strategy={horizontalListSortingStrategy}>
          {keywords.map((kw) => (
            <SortableChip
              key={kw}
              id={kw}
              onRemove={(k) => onChange(keywords.filter((x) => x !== k))}
            />
          ))}
        </SortableContext>
      </DndContext>
      <input
        value={inputValue}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onBlur={() => {
          if (inputValue.trim()) {
            addKeyword(inputValue);
            setInputValue('');
          }
        }}
        placeholder={keywords.length === 0 ? 'e.g. dragon, wyrm, drake' : 'Add keyword...'}
        className="flex-grow min-w-[8rem] bg-transparent text-sm outline-none"
      />
    </div>
  );
}

const DictionaryManager = ({ entry }: { entry: DictionaryEntry }) => {
  const { updateDictionaryEntry } = useGameData();
  const [editingEntry, setEditingEntry] = useState<DictionaryEntry>(entry);

  useEffect(() => {
    setEditingEntry(entry);
  }, [entry]);

  const handleChange = (field: string, value: unknown) => {
    const updated = { ...editingEntry, [field]: value } as DictionaryEntry;
    setEditingEntry(updated);
    updateDictionaryEntry(updated);
  };

  // The key is a comma-separated string (v1.2 format); name mirrors it for the list display.
  const handleKeyChange = (arr: string[]) => {
    const key = arr.join(', ');
    const updated = { ...editingEntry, key, name: key };
    setEditingEntry(updated);
    updateDictionaryEntry(updated);
  };

  if (!editingEntry) return null;

  const keywords = (editingEntry.key || '')
    .split(',')
    .map((k) => k.trim())
    .filter(Boolean);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Trigger Keywords (Key)</Label>
        <KeywordChips keywords={keywords} onChange={handleKeyChange} />
        <p className="text-xs text-muted-foreground">
          Type a keyword and press comma or Enter to add it. Drag to reorder, click the × to remove.
          The value below is injected into the AI prompt only when one of these appears in play.
        </p>
      </div>
      <div className="space-y-2">
        <Label>Value (injected on keyword match)</Label>
        <Textarea
          value={editingEntry.value || ''}
          onChange={(e) => handleChange('value', e.target.value)}
          rows={8}
        />
      </div>
    </div>
  );
};

export default DictionaryManager;
