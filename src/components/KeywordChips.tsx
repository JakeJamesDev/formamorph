import { useState, type ChangeEvent, type ClipboardEvent, type KeyboardEvent, type ReactNode } from 'react';
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
  rectSortingStrategy,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import { commaSplitCandidate, splitPastedChips, replaceChipValue } from '@/components/Chip';
import { EditableChip } from '@/components/EditableChip';

/**
 * An Enter-separated tag input: values render as editable, drag-reorderable chips; Backspace on an empty
 * field pops the last one. Shared by dictionary keywords and placeholder values (any list-of-strings field).
 *
 * Commas are literal — a chip may contain any character, which regex keywords need. Pasting multiple lines
 * still adds one chip per line. With `offerCommaSplit` (default on, off for regex entries), committing a
 * chip that reads like a list offers a one-shot button to split it; it is never automatic, so a pattern or
 * a comma-bearing name is only ever split on purpose.
 */
export function KeywordChips({
  keywords,
  onChange,
  placeholder = 'e.g. dragon',
  offerCommaSplit = true,
  onChipClick,
  chipSuffix,
  renderChip,
}: {
  keywords: string[];
  onChange: (keywords: string[]) => void;
  placeholder?: string;
  offerCommaSplit?: boolean;
  /** Claims the single click/tap on a chip (rename moves to double-click). Pair with `renderChip` to hang
   *  a popover off it. */
  onChipClick?: (value: string) => void;
  /** Trailing decoration inside the chip, e.g. a rolled percentage. */
  chipSuffix?: (value: string) => string | undefined;
  /** Wrap each rendered chip — the host's hook for anchoring per-chip UI. */
  renderChip?: (chip: ReactNode, value: string) => ReactNode;
}) {
  const [inputValue, setInputValue] = useState('');
  // The last committed chip that reads like a comma-separated list, with the segments it would become.
  const [splitOffer, setSplitOffer] = useState<{ chip: string; parts: string[] } | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  /** Append keywords that aren't already present; returns the resulting list. */
  const appendKeywords = (raw: string[]) => {
    const next = [...keywords];
    for (const kw of raw) if (kw && !next.includes(kw)) next.push(kw);
    if (next.length !== keywords.length) onChange(next);
    return next;
  };

  const addKeyword = (raw: string) => {
    const kw = raw.trim();
    if (!kw) return;
    appendKeywords([kw]);
    setSplitOffer(offerCommaSplit ? (() => {
      const parts = commaSplitCandidate(kw);
      return parts ? { chip: kw, parts } : null;
    })() : null);
  };

  /** Replace the offered chip in place with its segments, keeping its position in the list. */
  const acceptSplit = () => {
    if (!splitOffer) return;
    const at = keywords.indexOf(splitOffer.chip);
    if (at !== -1) {
      const rest = keywords.filter((k) => k !== splitOffer.chip);
      const fresh = splitOffer.parts.filter((p) => !rest.includes(p));
      onChange([...keywords.slice(0, at), ...fresh, ...keywords.slice(at + 1)]);
    }
    setSplitOffer(null);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    // Ignore Enter while an IME composition is open — Android keyboards fire it mid-word.
    if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
      e.preventDefault();
      addKeyword(inputValue);
      setInputValue('');
    } else if (e.key === 'Tab' && inputValue.trim()) {
      addKeyword(inputValue);
      setInputValue('');
    } else if (e.key === 'Backspace' && inputValue === '' && keywords.length > 0) {
      onChange(keywords.slice(0, -1));
      setSplitOffer(null);
    } else if (e.key === 'Escape') {
      setInputValue('');
      setSplitOffer(null);
    }
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
    setSplitOffer(null);
  };

  // A single-line paste types into the buffer as usual (so it can be edited before committing); multiple
  // lines commit one chip each. `<input>` strips newlines before `onChange`, so this must read the clipboard.
  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    const lines = splitPastedChips(e.clipboardData.getData('text'));
    if (lines.length < 2) return;
    e.preventDefault();
    appendKeywords(lines);
    setInputValue('');
    setSplitOffer(null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = keywords.indexOf(String(active.id));
    const newIndex = keywords.indexOf(String(over.id));
    if (oldIndex === -1 || newIndex === -1) return;
    onChange(arrayMove(keywords, oldIndex, newIndex));
  };

  const removeKeyword = (k: string) => {
    onChange(keywords.filter((x) => x !== k));
    setSplitOffer(null);
  };

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-1 rounded-md border border-border bg-background/80 p-2">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd} autoScroll={false}>
          {/* rectSortingStrategy (2D), not horizontalListSortingStrategy: the container is flex-wrap, so chips
              span multiple rows — a single-row strategy mispositions drags once they wrap. Dedup stays
              case-sensitive (unlike TokenAutocomplete) because dictionary keyword matching supports a
              per-entry caseSensitive mode, so distinct-case keywords can be meaningful. */}
          <SortableContext items={keywords} strategy={rectSortingStrategy}>
            {keywords.map((kw) => {
              const chip = (
                <EditableChip
                  key={kw}
                  value={kw}
                  sortable
                  suffix={chipSuffix?.(kw)}
                  onActivate={onChipClick}
                  onRemove={removeKeyword}
                  onCommit={(next) => { onChange(replaceChipValue(keywords, kw, next)); setSplitOffer(null); }}
                />
              );
              return renderChip ? <span key={kw}>{renderChip(chip, kw)}</span> : chip;
            })}
          </SortableContext>
        </DndContext>
        <input
          value={inputValue}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          onBlur={() => {
            if (inputValue.trim()) {
              addKeyword(inputValue);
              setInputValue('');
            }
          }}
          enterKeyHint="enter"
          placeholder={keywords.length === 0 ? placeholder : 'Add keyword...'}
          className="flex-grow min-w-[8rem] bg-transparent text-sm outline-none"
        />
      </div>
      {splitOffer && (
        <button
          type="button"
          // Handle on mousedown: clicking blurs the input, which would commit and re-render first.
          onMouseDown={(e) => { e.preventDefault(); acceptSplit(); }}
          className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
          aria-label={`Split “${splitOffer.chip}” into ${splitOffer.parts.length} keywords`}
        >
          Split “{splitOffer.chip}” into {splitOffer.parts.length}?
        </button>
      )}
    </div>
  );
}
