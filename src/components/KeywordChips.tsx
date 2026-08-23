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
import ChipInput from '@/components/prompt/ChipInput';
import { usePlaceholderChipVocabulary } from '@/lib/chipVocabulary';
import { hasPlaceholders, placeholderValueLine } from '@/lib/placeholders';
import { PLACEHOLDER_TRIGGER, placeholderHint } from '@/lib/placeholderInsert';
import type { Placeholder } from '@/types';
import PlaceholderText from '@/components/prompt/PlaceholderText';

/**
 * An Enter-separated tag input: values render as editable, drag-reorderable chips; Backspace on an empty
 * field pops the last one. Shared by dictionary keywords and placeholder values (any list-of-strings field).
 *
 * Commas are literal — a chip may contain any character, which regex keywords need. Pasting multiple lines
 * still adds one chip per line. With `offerCommaSplit` (default on, off for regex entries), committing a
 * chip that reads like a list offers a one-shot button to split it; it is never automatic, so a pattern or
 * a comma-bearing name is only ever split on purpose.
 *
 * Given `placeholders`, a tag may mix text and chips (an "Old \{Town\} keeper" alias): the entry field becomes a chip
 * editor with the same `{` typeahead as every other placeholder field, and a committed tag draws its chips
 * as pills (double-click to edit it in place). Omit the prop for lists that must stay literal — placeholder values themselves, since resolution
 * is single-pass and a chip inside one would never expand.
 */
const NO_PLACEHOLDERS: Placeholder[] = [];

export function KeywordChips({
  keywords,
  onChange,
  placeholder = 'e.g. dragon',
  offerCommaSplit = true,
  onChipClick,
  chipSuffix,
  renderChip,
  placeholders,
}: {
  keywords: string[];
  onChange: (keywords: string[]) => void;
  placeholder?: string;
  offerCommaSplit?: boolean;
  /** The world's placeholders, when tags may embed them. Absent ⇒ a plain literal tag list. */
  placeholders?: Placeholder[];
  /** Claims the single click/tap on a chip (rename moves to double-click). Pair with `renderChip` to hang
   *  a popover off it. */
  onChipClick?: (value: string) => void;
  /** Trailing decoration inside the chip, e.g. a rolled percentage. */
  chipSuffix?: (value: string) => string | undefined;
  /** Wrap each rendered chip — the host's hook for anchoring per-chip UI. */
  renderChip?: (chip: ReactNode, value: string) => ReactNode;
}) {
  const [inputValue, setInputValue] = useState('');
  const chipsEnabled = !!placeholders?.length;
  // A stable empty list, so a tag list with no placeholders doesn't rebuild its vocabulary every render.
  const vocab = usePlaceholderChipVocabulary(placeholders ?? NO_PLACEHOLDERS);
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
                  // A value written in the multiline editor comes back as its first line — a chip row is a
                  // one-line surface, and a paragraph in one would wrap the whole box.
                  label={hasPlaceholders(kw)
                    ? <PlaceholderText text={kw} placeholders={placeholders ?? []} />
                    : kw.includes('\n') ? placeholderValueLine(kw) : undefined}
                  placeholders={placeholders}
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
        {chipsEnabled ? (
          // The growth lives out here, on the flex item itself. Passed through `className` it reaches the
          // editable instead, whose wrapper then shrink-wraps — leaving the editor a eighth of the box wide
          // and the rest of it looking like a field that ignores clicks.
          <div className="min-w-[8rem] flex-grow">
          <ChipInput
            value={inputValue}
            onChange={(v) => { setInputValue(v); setSplitOffer(null); }}
            vocabulary={vocab}
            trigger={PLACEHOLDER_TRIGGER}
            onSubmit={() => { addKeyword(inputValue); setInputValue(''); }}
            onBlur={() => { if (inputValue.trim()) { addKeyword(inputValue); setInputValue(''); } }}
            placeholder={placeholderHint(keywords.length === 0 ? placeholder : 'Add keyword...', true)}
            ariaLabel={keywords.length === 0 ? placeholder : 'Add keyword'}
            // Sits inside the chip box, so it drops the bordered-input shell; the width comes from the wrapper.
            className="min-h-0 w-full border-0 bg-transparent px-0 py-0 focus-visible:ring-0"
          />
          </div>
        ) : (
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
            className="flex-grow min-w-[8rem] bg-transparent text-label outline-none"
          />
        )}
      </div>
      {splitOffer && (
        <button
          type="button"
          // Handle on mousedown: clicking blurs the input, which would commit and re-render first.
          onMouseDown={(e) => { e.preventDefault(); acceptSplit(); }}
          className="text-meta text-muted-foreground underline underline-offset-2 hover:text-foreground"
          aria-label={`Split “${splitOffer.chip}” into ${splitOffer.parts.length} keywords`}
        >
          Split “{splitOffer.chip}” into {splitOffer.parts.length}?
        </button>
      )}
    </div>
  );
}
