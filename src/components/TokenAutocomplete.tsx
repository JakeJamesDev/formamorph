import { useMemo, useState } from "react";
import { type DragEndEvent } from "@dnd-kit/core";
import { arrayMove, rectSortingStrategy } from "@dnd-kit/sortable";
import { EditorDndContext, StableSortableContext } from "@/components/dnd/EditorDndContext";
import { Chip, SortableChip, splitPastedChips, replaceChipValue } from "./Chip";
import { EditableChip } from "./EditableChip";
import { SuggestionList } from "./SuggestionList";
import { rankTagSuggestions } from "@/lib/tagSuggest";

const SUGGESTION_LIMIT = 50;
const NO_MODIFIERS: never[] = [];

/**
 * Chip input with autocomplete. Type to filter `options` (closest match); Enter or a clicked suggestion
 * adds a chip, and a multi-line paste adds one per line. Commas are literal, so a chip may contain any
 * character. Free text not in `options` is allowed. Suggestions are added on mousedown so the click registers before blur.
 * - `openOnFocus`: show all available options the moment the field is focused (before typing).
 * - `reorderable`: chips can be dragged to reorder (the X still removes; click vs. drag is distance-gated).
 * - `single`: scalar combobox mode — no chips; the input edits one value (`values[0]`, free text allowed),
 *   selecting a suggestion replaces it. A committed value shows the full option list again so you can switch.
 * - `preserveOrder`: rank filtered suggestions by the `options` array order (e.g. tag popularity) instead of
 *   alphabetically — for ranked lists like the Danbooru tags.
 * - `editable`: double-click a chip to edit it in place (with autocomplete when `options` are present). Multi
 *   mode only.
 * - `describe`: what a value reads as where its stored form isn't readable — a placeholder chip's token.
 *   Suggestions are filtered, sorted and drawn through it, and in `single` mode a committed value it
 *   rewrites is shown as a pill instead of as editable text. What gets committed is always the raw value.
 * - `ariaLabel`: names the input for a caller whose own `<Label>` has no control to point at.
 */
export function TokenAutocomplete({ values, onChange, options, placeholder, ariaLabel, openOnFocus = false, reorderable = false, single = false, preserveOrder = false, editable = false, describe }: {
  values: string[];
  onChange: (values: string[]) => void;
  options: string[];
  placeholder?: string;
  ariaLabel?: string;
  openOnFocus?: boolean;
  reorderable?: boolean;
  single?: boolean;
  preserveOrder?: boolean;
  editable?: boolean;
  describe?: (value: string) => string;
}) {
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  // In single mode the input reflects the one committed value; in multi mode it's the transient chip buffer.
  const query = single ? (values[0] ?? "") : text;
  // A committed value the field can't show as text, drawn as a pill instead. Null in multi mode, where the
  // chips already carry their own labels, and null without `describe`, which is what rewrites a value.
  const described = single && values[0] && describe ? describe(values[0]) : null;
  const pill = described && described !== values[0] ? described : null;

  const suggestions = useMemo(() => {
    const show = (value: string) => describe?.(value) ?? value;
    const q = query.trim().toLowerCase();
    const selected = single ? new Set<string>() : new Set(values.map((v) => v.toLowerCase()));
    const available = options.filter((o) => !selected.has(o.toLowerCase()));
    const all = () => available.slice().sort((a, b) => show(a).localeCompare(show(b))).slice(0, SUGGESTION_LIMIT);
    if (!q) {
      // Empty field: only surface options when opening on focus is requested.
      return openOnFocus ? all() : [];
    }
    // A committed value shown as a pill is not text to filter by, so the whole list stays on offer.
    if (pill) return all();
    // A committed single value (exactly one option) shows the full list so you can switch selections.
    if (single && available.some((o) => o.toLowerCase() === q)) return all();
    const limit = openOnFocus ? SUGGESTION_LIMIT : 8;
    if (preserveOrder) return rankTagSuggestions(available, q, limit); // keep options (popularity) order
    return available
      .filter((o) => show(o).toLowerCase().includes(q))
      .sort((a, b) => {
        const aw = show(a).toLowerCase().startsWith(q) ? 0 : 1;
        const bw = show(b).toLowerCase().startsWith(q) ? 0 : 1;
        return aw - bw || show(a).localeCompare(show(b));
      })
      .slice(0, limit);
  }, [query, options, values, openOnFocus, single, preserveOrder, describe, pill]);

  /** Append values that aren't already present (case-insensitive); returns whether anything changed. */
  const addMany = (toAdd: string[]) => {
    const next = [...values];
    for (const raw of toAdd) {
      const v = raw.trim();
      if (v && !next.some((x) => x.toLowerCase() === v.toLowerCase())) next.push(v);
    }
    if (next.length !== values.length) onChange(next);
  };

  const add = (val: string) => {
    addMany([val]);
    setText("");
    setActive(0);
    setOpen(false);
  };
  const remove = (val: string) => onChange(values.filter((x) => x !== val));

  // Editable-chip helpers: replace a chip's value in place (dedup), and suggest tags for editing one chip
  // (its own value excluded so a suggestion doesn't just re-pick it, other chips excluded to avoid dupes).
  const replaceValue = (old: string, next: string) => onChange(replaceChipValue(values, old, next));
  const editSuggestions = (excluded: string) => (q: string) => {
    if (!options.length) return [];
    const others = new Set(values.filter((v) => v !== excluded).map((v) => v.toLowerCase()));
    return rankTagSuggestions(options.filter((o) => !others.has(o.toLowerCase())), q, 8);
  };
  const renderChip = (v: string) => (editable
    ? <EditableChip key={v} value={v} sortable={reorderable} onRemove={remove} onCommit={(next) => replaceValue(v, next)} getSuggestions={options.length ? editSuggestions(v) : undefined} />
    : reorderable ? <SortableChip key={v} id={v} onRemove={remove} /> : <Chip key={v} label={v} onRemove={remove} />);

  // Single mode: commit replaces the value (empty ⇒ []); typing writes through immediately (free text).
  const commit = (val: string) => {
    if (single) {
      onChange(val ? [val] : []);
      setActive(0);
      setOpen(false);
    } else {
      add(val);
    }
  };
  const handleSingleInput = (raw: string) => {
    onChange(raw ? [raw] : []);
    setOpen(true);
    setActive(0);
  };

  const handleInput = (raw: string) => {
    setText(raw);
    setOpen(true);
    setActive(0);
  };

  // A multi-line paste adds one chip per line; anything else types into the buffer. Commas stay literal so
  // a value may contain any character. `<input>` strips newlines before `onChange`, hence the clipboard read.
  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    if (single) return;
    const lines = splitPastedChips(e.clipboardData.getData("text"));
    if (lines.length < 2) return;
    e.preventDefault();
    addMany(lines);
    setText("");
  };

  const handleDragEnd = (e: DragEndEvent) => {
    const { active: a, over } = e;
    if (!over || a.id === over.id) return;
    const oldIndex = values.indexOf(a.id as string);
    const newIndex = values.indexOf(over.id as string);
    if (oldIndex === -1 || newIndex === -1) return;
    onChange(arrayMove(values, oldIndex, newIndex));
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Ignore Enter while an IME composition is open — Android keyboards fire it mid-word.
    if (e.key === "Enter" && !e.nativeEvent.isComposing) {
      e.preventDefault();
      commit(open && suggestions[active] ? suggestions[active] : query);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((a) => Math.min(a + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Tab" && !e.shiftKey && open && suggestions[active] && !pill && query.trim()) {
      // Tab accepts like Enter — but only once something is typed, so tabbing across the form past an
      // openOnFocus field deposits nothing. Shift+Tab always just leaves. Beside a pill the input is empty
      // however full the value is, so the pill itself is what says nothing has been typed.
      e.preventDefault();
      commit(suggestions[active]);
    } else if (e.key === "Backspace" && !single && !text && values.length) {
      remove(values[values.length - 1]);
    } else if (e.key === "Backspace" && pill) {
      // The input beside a pill is always empty, so Backspace there clears the pill — the same gesture the
      // chip row answers to.
      onChange([]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div className="relative">
      {/* Single mode matches the shadcn Input (h-10 px-3 text-label) so it lines up with sibling fields;
          multi mode keeps the tighter padding the chips need, but types at the same size — a hint a step
          smaller than every other field's read as a different kind of control. */}
      <div className={`flex flex-wrap items-center gap-1 rounded-md border border-input bg-background min-w-[180px] ${single && !pill ? "px-3 h-10" : "px-2 py-1 min-h-10"}`}>
        {pill && <Chip label={pill} removeLabel={pill} onRemove={() => onChange([])} />}
        {!single && (reorderable ? (
          // Chips wrap in two dimensions inside a box that never scrolls, so no axis clamp and no auto-scroll.
          <EditorDndContext modifiers={NO_MODIFIERS} autoScroll={false} onDragEnd={handleDragEnd}>
            <StableSortableContext items={values} strategy={rectSortingStrategy}>
              {values.map(renderChip)}
            </StableSortableContext>
          </EditorDndContext>
        ) : values.map(renderChip))}
        <input
          // Beside a pill the input starts empty: the first keystroke replaces the whole value, so a chip
          // pin becomes a text pin visibly rather than by editing text that was never in the field.
          value={pill ? "" : single ? query : text}
          onChange={(e) => (single ? handleSingleInput(e.target.value) : handleInput(e.target.value))}
          onKeyDown={onKeyDown}
          onPaste={handlePaste}
          aria-label={ariaLabel}
          enterKeyHint="enter"
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 100)}
          placeholder={(single ? !pill : !values.length) ? placeholder : ""}
          className={`flex-1 min-w-[80px] bg-transparent text-helper outline-none placeholder:text-muted-foreground ${single ? "" : "py-0.5"}`}
        />
      </div>
      {open && suggestions.length > 0 && (
        <SuggestionList items={suggestions} active={active} onPick={commit} onHover={setActive} label={describe} className="w-full min-w-[180px]" />
      )}
    </div>
  );
}
