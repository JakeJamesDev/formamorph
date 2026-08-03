import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";
import { Chip, CHIP_BASE } from "./Chip";
import { SuggestionList } from "./SuggestionList";

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
export function EditableChip({ value, onCommit, onRemove, sortable = false, getSuggestions, onActivate, suffix }: {
  value: string;
  onCommit: (next: string) => void;
  onRemove: (value: string) => void;
  sortable?: boolean;
  getSuggestions?: (query: string) => string[];
  onActivate?: (value: string) => void;
  suffix?: string;
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

  const startEdit = () => { setText(value); setActive(0); setEditing(true); };
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

  if (editing) {
    return (
      <span className="relative inline-flex max-w-full">
        <input
          ref={inputRef}
          value={text}
          onChange={(e) => { setText(e.target.value); setActive(0); }}
          onKeyDown={onKeyDown}
          onBlur={() => finish(text)}
          // Grows with the text, but never past the field — a long keyword would otherwise run off a phone screen.
          style={{ width: `${Math.max(text.length + 1, 3)}ch`, maxWidth: "100%" }}
          className={cn(CHIP_BASE, "border bg-secondary text-secondary-foreground outline-none ring-1 ring-ring")}
          aria-label={`Edit ${value}`}
        />
        {suggestions.length > 0 && (
          <SuggestionList items={suggestions} active={active} onPick={finish} onHover={setActive} className="left-0 top-full min-w-[160px]" />
        )}
      </span>
    );
  }

  return (
    <Chip
      label={suffix ? `${value} ${suffix}` : value}
      removeLabel={value}
      onRemove={onRemove}
      innerRef={sortable ? setNodeRef : undefined}
      style={sortable ? {
        // Translate (not Transform): Transform bakes in a scale that resizes the dragged chip to the target.
        transform: CSS.Translate.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        zIndex: isDragging ? 1 : undefined,
      } : undefined}
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
        title: onActivate ? "Click to open, double-click to rename" : "Tap or double-click to edit",
      }}
      grabbable={sortable}
    />
  );
}
