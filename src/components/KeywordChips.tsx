import { useState, type ChangeEvent, type ClipboardEvent, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react';
import { type DragEndEvent } from '@dnd-kit/core';
import { arrayMove, rectSortingStrategy } from '@dnd-kit/sortable';
import { EditorDndContext, StableSortableContext } from '@/components/dnd/EditorDndContext';
import { commaSplitCandidate, splitPastedChips, replaceChipValue } from '@/components/Chip';
import { EditableChip } from '@/components/EditableChip';
import ChipInput from '@/components/prompt/ChipInput';
import { usePlaceholderChipVocabulary } from '@/lib/chipVocabulary';
import { hasPlaceholders, lonePlaceholderToken, placeholderValueLine } from '@/lib/placeholders';
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
 * as pills (double-click to edit it in place). Omit the prop for lists that must stay literal.
 */
const NO_PLACEHOLDERS: Placeholder[] = [];
const NO_MODIFIERS: never[] = [];

export function KeywordChips({
  keywords,
  onChange,
  placeholder = 'e.g. dragon',
  offerCommaSplit = true,
  onChipClick,
  chipSuffix,
  chipStyle,
  renderChip,
  placeholders,
  ownerId,
  lonePlaceholderAsPath = false,
}: {
  keywords: string[];
  onChange: (keywords: string[]) => void;
  placeholder?: string;
  offerCommaSplit?: boolean;
  /** The world's placeholders, when tags may embed them. Absent ⇒ a plain literal tag list. */
  placeholders?: Placeholder[];
  /** The placeholder whose own value list this is. A placeholder created from here is born owned by it,
   *  and its owned rows read bare — the panel already says whose they are. */
  ownerId?: string;
  /** Label a tag that is *exactly* one chip with its full path name instead of what it resolves to. A lone
   *  chip is structure in a placeholder's own value list — the part it holds — where in an alias it is
   *  still prose. Chips inside a longer tag read as prose either way. */
  lonePlaceholderAsPath?: boolean;
  /** Claims the single click/tap on a chip (rename moves to double-click). Pair with `renderChip` to hang
   *  a popover off it. */
  onChipClick?: (value: string) => void;
  /** Trailing decoration inside the chip, e.g. a rolled percentage. */
  chipSuffix?: (value: string) => string | undefined;
  /** The host's own colors for a chip — a draw chance's tone, say. Given, it replaces the default accent
   *  rule (a tag that is exactly one chip wears that placeholder's color). */
  chipStyle?: (value: string) => CSSProperties | undefined;
  /** Wrap each rendered chip — the host's hook for anchoring per-chip UI. */
  renderChip?: (chip: ReactNode, value: string) => ReactNode;
}) {
  const [inputValue, setInputValue] = useState('');
  const chipsEnabled = !!placeholders?.length;
  // A stable empty list, so a tag list with no placeholders doesn't rebuild its vocabulary every render.
  const vocab = usePlaceholderChipVocabulary(placeholders ?? NO_PLACEHOLDERS, ownerId);
  // The last committed chip that reads like a comma-separated list, with the segments it would become.
  const [splitOffer, setSplitOffer] = useState<{ chip: string; parts: string[] } | null>(null);
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

  /** What a committed tag shows, when the stored string isn't readable as-is. Undefined ⇒ the string itself. */
  const chipLabel = (kw: string): ReactNode => {
    const lone = lonePlaceholderAsPath ? lonePlaceholderToken(kw) : null;
    if (lone) return vocab.display?.(lone) ?? vocab.label(lone);
    if (hasPlaceholders(kw)) return <PlaceholderText text={kw} placeholders={placeholders ?? []} />;
    return kw.includes('\n') ? placeholderValueLine(kw) : undefined;
  };

  /** A tag that is nothing but a chip wears that placeholder's accent: it *is* the placeholder, so it reads
   *  as one rather than as a literal string that happens to be spelled like one. A chip inside a longer tag
   *  is prose, and the pill it already draws inside the neutral chip carries the accent instead. The same
   *  accent-with-black-text recipe every other placeholder chip wears. */
  const chipStyleOf = (kw: string): CSSProperties | undefined => {
    if (chipStyle) return chipStyle(kw);
    const lone = lonePlaceholderAsPath ? lonePlaceholderToken(kw) : null;
    const color = lone ? vocab.color(lone) : undefined;
    return color ? { backgroundColor: color, color: '#000' } : undefined;
  };

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-1 rounded-md border border-border bg-background/80 p-2">
        {/* No modifiers and no auto-scroll: chips wrap in two dimensions inside a box that never scrolls,
            so the vertical-list clamps would pin a drag to a single column. */}
        <EditorDndContext modifiers={NO_MODIFIERS} autoScroll={false} onDragEnd={handleDragEnd}>
          {/* rectSortingStrategy (2D), not horizontalListSortingStrategy: the container is flex-wrap, so chips
              span multiple rows — a single-row strategy mispositions drags once they wrap. Dedup stays
              case-sensitive (unlike TokenAutocomplete) because dictionary keyword matching supports a
              per-entry caseSensitive mode, so distinct-case keywords can be meaningful. */}
          <StableSortableContext items={keywords} strategy={rectSortingStrategy}>
            {keywords.map((kw) => {
              const chip = (
                <EditableChip
                  key={kw}
                  value={kw}
                  sortable
                  // A value written in the multiline editor comes back as its first line — a chip row is a
                  // one-line surface, and a paragraph in one would wrap the whole box.
                  label={chipLabel(kw)}
                  style={chipStyleOf(kw)}
                  placeholders={placeholders}
                  suffix={chipSuffix?.(kw)}
                  onActivate={onChipClick}
                  onRemove={removeKeyword}
                  onCommit={(next) => { onChange(replaceChipValue(keywords, kw, next)); setSplitOffer(null); }}
                />
              );
              return renderChip ? <span key={kw}>{renderChip(chip, kw)}</span> : chip;
            })}
          </StableSortableContext>
        </EditorDndContext>
        {chipsEnabled ? (
          // The growth lives out here, on the flex item itself. Passed through `className` it reaches the
          // editable instead, whose wrapper then shrink-wraps — leaving the editor a eighth of the box wide
          // and the rest of it looking like a field that ignores clicks.
          <div className="min-w-[8rem] flex-grow">
          <ChipInput
            value={inputValue}
            onChange={(v) => { setInputValue(v); setSplitOffer(null); }}
            vocabulary={vocab}
            ownerId={ownerId}
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
