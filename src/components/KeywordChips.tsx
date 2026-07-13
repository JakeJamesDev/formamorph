import { useState, type ChangeEvent, type KeyboardEvent } from 'react';
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
import { splitChipInput, replaceChipValue } from '@/components/Chip';
import { EditableChip } from '@/components/EditableChip';

/**
 * A comma/Enter-separated tag input: values render as editable, drag-reorderable chips; Backspace on an empty
 * field pops the last one. Shared by dictionary keywords and placeholder values (any list-of-strings field).
 */
export function KeywordChips({
  keywords,
  onChange,
  placeholder = 'e.g. dragon, wyrm, drake',
}: {
  keywords: string[];
  onChange: (keywords: string[]) => void;
  placeholder?: string;
}) {
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
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd} autoScroll={false}>
        <SortableContext items={keywords} strategy={horizontalListSortingStrategy}>
          {keywords.map((kw) => (
            <EditableChip
              key={kw}
              value={kw}
              sortable
              onRemove={(k) => onChange(keywords.filter((x) => x !== k))}
              onCommit={(next) => onChange(replaceChipValue(keywords, kw, next))}
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
        placeholder={keywords.length === 0 ? placeholder : 'Add keyword...'}
        className="flex-grow min-w-[8rem] bg-transparent text-sm outline-none"
      />
    </div>
  );
}
