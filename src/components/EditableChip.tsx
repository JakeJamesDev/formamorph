import { useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";
import { Chip, CHIP_BASE, CHIP_REMOVE_RESERVE, ChipFieldSizer } from "./Chip";
import { SuggestionList } from "./SuggestionList";
import ChipInput from "@/components/prompt/ChipInput";
import { placeholderVocabulary } from "@/lib/chipVocabulary";
import { hasPlaceholders } from "@/lib/placeholders";
import { PLACEHOLDER_TRIGGER } from "@/lib/placeholderInsert";
import type { Placeholder } from "@/types";

/**
 * A chip that becomes an inline text field on double-click (single tap on touch, where there is no
 * double-click — the drag sensor's distance gate keeps a tap from starting a reorder). Enter/Tab/blur commits, Escape cancels,
 * clearing the text removes it (via `onRemove`). Editing replaces the chip in place, so order is kept.
 * Pass `getSuggestions` (query is pre-lowercased) to show an autocomplete dropdown while editing; omit it
 * for a plain text edit (e.g. dictionary keywords). Render inside a dnd-kit `SortableContext` when `sortable`.
 *
 * `onActivate` claims the single click/tap for the host (a per-chip popover); text editing then stays on
 * double-click, so the popover must offer its own way to rename on touch. `suffix` trails the label.
 */
export function EditableChip({ value, onCommit, onRemove, sortable = false, getSuggestions, onActivate, suffix, label, style, placeholders }: {
  value: string;
  onCommit: (next: string) => void;
  onRemove: (value: string) => void;
  sortable?: boolean;
  getSuggestions?: (query: string) => string[];
  onActivate?: (value: string) => void;
  suffix?: string;
  /** The chip's own colors — a placeholder's accent, or a draw chance's tone. Absent ⇒ the neutral tag
   *  chip. Everything inside — the suffix, the × — inherits it. */
  style?: CSSProperties;
  /** What to show, when the stored value isn't readable as-is (a value holding placeholder tokens). A node,
   *  so the placeholders inside it can be drawn as chips; `value` still names the chip for a screen reader. */
  label?: ReactNode;
  /** Given these, editing opens a chip editor instead of a text input, so a value holding placeholders can
   *  be edited in place — and its chips keep their World/Unique pop-out while it is open. */
  placeholders?: Placeholder[];
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(value);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  // What kind of pointer opened this interaction, captured on pointerdown — `click` is a PointerEvent in
  // current browsers, but not everywhere, so the down event is the reliable source.
  const pointerType = useRef<string | undefined>(undefined);

  const { setNodeRef, transform, transition, isDragging, attributes, listeners } = useSortable({ id: value });

  const suggestions = useMemo(() => {
    if (!editing || !getSuggestions) return [];
    const q = text.trim().toLowerCase();
    return q ? getSuggestions(q) : [];
  }, [editing, getSuggestions, text]);

  // Focus + select-all when entering edit mode.
  useLayoutEffect(() => {
    if (editing && inputRef.current) { inputRef.current.focus(); inputRef.current.select(); }
  }, [editing]);

  // A placeholder value written in the multiline editor holds newlines, and `<input>` strips them from any
  // value assigned to it — so an inline rename would commit the paragraph flattened. Such a chip is display
  // only; it is edited in the multiline view it was written in.
  const renameable = !value.includes('\n');
  const startEdit = () => { if (renameable) { setText(value); setActive(0); setEditing(true); } };
  const cancel = () => { setEditing(false); setText(value); };
  const finish = (raw: string) => {
    setEditing(false);
    const next = raw.trim();
    if (!next) onRemove(value);
    else if (next !== value) onCommit(next);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      finish(suggestions[active] ?? text);
    } else if (e.key === "Escape") {
      e.preventDefault();
      cancel();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    }
  };

  const shown = label ?? value;
  // A node label carries no readable text, so the stored value names the remove button and the edit field.
  const accessibleName = typeof shown === 'string' ? shown : value;

  // A plain text input cannot represent a chip, so a value that holds one (or a list that may gain one)
  // edits in the chip editor instead. Same commit/cancel contract: Enter or blur commits, Escape abandons,
  // emptying it removes the chip.
  const chipEditing = !!placeholders?.length || hasPlaceholders(value);

  if (editing && chipEditing) {
    return (
      <span className="relative inline-flex max-w-full align-middle">
        <ChipInput
          value={text}
          onChange={setText}
          vocabulary={placeholderVocabulary(placeholders ?? [])}
          trigger={PLACEHOLDER_TRIGGER}
          autoFocus
          onSubmit={() => finish(text)}
          onBlur={() => finish(text)}
          onCancel={cancel}
          ariaLabel={`Edit ${accessibleName}`}
          // `w-auto` beats ChipInput's own `w-full`: this one sits inline among chips and should be as wide
          // as what is in it — the chips it may contain rule out measuring it as plain text. The 3ch floor
          // is the same one the plain text input it replaces used, so an empty field is still big enough to
          // click into, and the reserve stands in for the × this editor drops.
          className={cn('min-h-0 w-auto min-w-[3ch] max-w-full rounded border bg-secondary pl-1.5 py-0.5 text-meta', CHIP_REMOVE_RESERVE)}
        />
      </span>
    );
  }

  if (editing) {
    return (
      // Sized by a twin of the text rather than by counting characters, so the chip keeps its width when it
      // becomes a field — the same way the chip-editor form above sizes itself to its content.
      <ChipFieldSizer text={text} withRemove>
        <input
          ref={inputRef}
          // See ChipFieldSizer: the twin sets the width, so the input must not impose its own.
          size={1}
          value={text}
          onChange={(e) => { setText(e.target.value); setActive(0); }}
          onKeyDown={onKeyDown}
          onBlur={() => finish(text)}
          className={cn(CHIP_BASE, "col-start-1 row-start-1 w-full min-w-0 border bg-secondary text-secondary-foreground outline-none ring-1 ring-ring")}
          aria-label={`Edit ${accessibleName}`}
        />
        {suggestions.length > 0 && (
          <SuggestionList items={suggestions} active={active} onPick={finish} onHover={setActive} className="left-0 top-full min-w-[160px]" />
        )}
      </ChipFieldSizer>
    );
  }

  return (
    <Chip
      label={suffix ? <>{shown} {suffix}</> : shown}
      removeLabel={value}
      onRemove={onRemove}
      innerRef={sortable ? setNodeRef : undefined}
      style={{
        ...style,
        ...(sortable ? {
          // Translate (not Transform): Transform bakes in a scale that resizes the dragged chip to the target.
          transform: CSS.Translate.toString(transform),
          transition,
          // A drag dims the chip; at rest it keeps whatever opacity the caller's style gave it.
          opacity: isDragging ? 0.5 : style?.opacity,
          zIndex: isDragging ? 1 : undefined,
        } : undefined),
      }}
      dragProps={{
        ...(sortable ? { ...attributes, ...listeners } : {}),
        onDoubleClick: startEdit,
        // Note the pointer kind, then hand off to dnd-kit's own pointerdown listener (spread above, so it
        // would otherwise be shadowed by this one).
        onPointerDown: (e: React.PointerEvent) => {
          pointerType.current = e.pointerType;
          if (sortable) (listeners?.onPointerDown as ((e: React.PointerEvent) => void) | undefined)?.(e);
        },
        // Touch has no double-click, so a plain tap edits; a mouse click still does nothing (it would
        // fight drag-to-reorder). A tap that moved far enough became a drag and never reaches click.
        onClick: (e: React.MouseEvent) => {
          if (onActivate) { onActivate(value); return; }
          const kind = pointerType.current ?? (e.nativeEvent as PointerEvent).pointerType;
          if (kind === "touch" || kind === "pen") startEdit();
        },
      }}
      tip={!renameable
        ? (onActivate ? "Click to open — switch to Multiline to edit the text" : "Switch to Multiline to edit this value")
        : onActivate ? "Click to open, double-click to rename" : "Tap or double-click to edit"}
      grabbable={sortable}
    />
  );
}
