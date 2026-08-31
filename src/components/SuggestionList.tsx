import { cn } from "@/lib/utils";
import { useWheelScroll } from "@/lib/useWheelScroll";

/**
 * Shared autocomplete dropdown: string suggestions with one highlighted (`active`) row. Rows commit on
 * mousedown (before the input blurs); mousedown on the list's own padding/scrollbar is swallowed so it
 * doesn't blur-close the field. Position/width come from `className` (the caller anchors it).
 *
 * The wheel is handled rather than left to the browser: a caller may portal this out of a modal dialog,
 * whose scroll lock cancels every wheel that lands outside its content. See {@link useWheelScroll}.
 */
export function SuggestionList({ items, active, onPick, onHover, label, className }: {
  items: string[];
  active: number;
  onPick: (item: string) => void;
  onHover: (index: number) => void;
  /** What a row reads as, where the item itself isn't readable (a placeholder chip's stored token). The
   *  item is still what a pick commits. */
  label?: (item: string) => string;
  className?: string;
}) {
  const scroller = useWheelScroll<HTMLDivElement>();
  return (
    <div
      ref={scroller}
      onMouseDown={(e) => { if (e.target === e.currentTarget) e.preventDefault(); }}
      className={cn("absolute z-50 mt-1 max-h-56 overflow-y-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md", className)}
    >
      {items.map((s, i) => (
        <button
          type="button"
          key={s}
          // Not a tab stop: rows are arrow/mouse targets, and the field's blur would close the list from
          // under a row Tab landed on anyway.
          tabIndex={-1}
          onMouseDown={(e) => { e.preventDefault(); onPick(s); }}
          onMouseEnter={() => onHover(i)}
          className={cn("flex w-full items-center rounded-sm px-2 py-1.5 text-label text-left", i === active && "bg-accent text-accent-foreground")}
        >
          {label ? label(s) : s}
        </button>
      ))}
    </div>
  );
}
