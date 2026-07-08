import { useState, type ChangeEvent, type KeyboardEvent } from 'react';
import { useDictionaryStore } from '@/contexts/DictionaryStoreContext';
import { useEditingDraft } from '@/lib/useEditingDraft';
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
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { splitChipInput, replaceChipValue } from "@/components/Chip";
import { EditableChip } from "@/components/EditableChip";
import type { DictionaryEntry } from '@/types';

function KeywordChips({ keywords, onChange, placeholder = 'e.g. dragon, wyrm, drake' }: { keywords: string[]; onChange: (keywords: string[]) => void; placeholder?: string }) {
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

/** A compact labeled checkbox for the lorebook options grid. */
function CheckRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <Checkbox checked={checked} onCheckedChange={(v) => onChange(v === true)} />
      {label}
    </label>
  );
}

const DictionaryManager = ({ entry }: { entry: DictionaryEntry }) => {
  const { updateDictionaryEntry } = useDictionaryStore();
  const { draft: editingEntry, apply, setField: handleChange } = useEditingDraft<DictionaryEntry>(entry, updateDictionaryEntry);

  // The key is a comma-separated string (v1.2 format); name mirrors it for the list display.
  const handleKeyChange = (arr: string[]) => {
    const key = arr.join(', ');
    apply({ key, name: key });
  };

  // Store a numeric field, clearing it (undefined) when the input is blank or not a number.
  const handleNumber = (field: 'scanDepth', raw: string) => {
    const n = raw === '' ? undefined : Number(raw);
    handleChange(field, n != null && Number.isFinite(n) ? n : undefined);
  };

  if (!editingEntry) return null;

  const keywords = (editingEntry.key || '')
    .split(',')
    .map((k) => k.trim())
    .filter(Boolean);

  // Secondary keywords share the trigger-keyword chip UI; stored as the same comma-separated string.
  const secondaryKeywords = (editingEntry.secondaryKeys || '')
    .split(',')
    .map((k) => k.trim())
    .filter(Boolean);
  const handleSecondaryChange = (arr: string[]) => handleChange('secondaryKeys', arr.join(', '));

  // Plain-English summary of the secondary-keyword gate for the four any/all × require/exclude modes.
  const secondaryHint = secondaryKeywords.length === 0
    ? 'Optional: also require (or exclude) these before activating.'
    : editingEntry.secondaryExclude
      ? (editingEntry.secondaryAll
        ? 'Fires when a keyword appears and not all secondaries do.'
        : 'Fires when a keyword appears and none of the secondaries do.')
      : (editingEntry.secondaryAll
        ? 'Fires when a keyword and all secondaries appear.'
        : 'Fires when a keyword and at least one secondary appear.');

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Trigger Keywords (Key)</Label>
        <KeywordChips keywords={keywords} onChange={handleKeyChange} />
        <p className="text-xs text-muted-foreground">
          Type a keyword and press comma or Enter to add it. Double-click to edit, drag to reorder, click the × to remove.
          The value below is injected into the AI prompt only when one of these appears in play.
        </p>
      </div>
      <div className="space-y-2">
        <Label>Options</Label>
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          <CheckRow label="Always inject" checked={!!editingEntry.constant} onChange={(v) => handleChange('constant', v)} />
          <CheckRow label="Regex" checked={!!editingEntry.useRegex} onChange={(v) => handleChange('useRegex', v)} />
          <CheckRow label="Whole words" checked={!!editingEntry.matchWholeWords} onChange={(v) => handleChange('matchWholeWords', v)} />
          <CheckRow label="Case-sensitive" checked={!!editingEntry.caseSensitive} onChange={(v) => handleChange('caseSensitive', v)} />
          <CheckRow label="Recursive" checked={!!editingEntry.recursive} onChange={(v) => handleChange('recursive', v)} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Scan depth (messages)</Label>
          <Input type="number" min={0} value={editingEntry.scanDepth ?? ''} onChange={(e) => handleNumber('scanDepth', e.target.value)} placeholder="all history" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Secondary Keywords</Label>
          <KeywordChips keywords={secondaryKeywords} onChange={handleSecondaryChange} placeholder="e.g. red, crimson" />
          <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1">
            <CheckRow label="Require all" checked={!!editingEntry.secondaryAll} onChange={(v) => handleChange('secondaryAll', v)} />
            <CheckRow label="Exclude (activate when absent)" checked={!!editingEntry.secondaryExclude} onChange={(v) => handleChange('secondaryExclude', v)} />
          </div>
          <p className="text-[0.7rem] text-muted-foreground">{secondaryHint}</p>
        </div>
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
