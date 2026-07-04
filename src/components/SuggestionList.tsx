import { cn } from "@/lib/utils";

/**
 * Shared autocomplete dropdown: string suggestions with one highlighted (`active`) row. Rows commit on
 * mousedown (before the input blurs); mousedown on the list's own padding/scrollbar is swallowed so it
 * doesn't blur-close the field. Position/width come from `className` (the caller anchors it).
 */
export function SuggestionList({ items, active, onPick, onHover, className }: {
  items: string[];
  active: number;
  onPick: (item: string) => void;
  onHover: (index: number) => void;
  className?: string;
}) {
  return (
    <div
      onMouseDown={(e) => { if (e.target === e.currentTarget) e.preventDefault(); }}
      className={cn("absolute z-50 mt-1 max-h-56 overflow-y-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md", className)}
    >
      {items.map((s, i) => (
        <button
          type="button"
          key={s}
          onMouseDown={(e) => { e.preventDefault(); onPick(s); }}
          onMouseEnter={() => onHover(i)}
          className={cn("flex w-full items-center rounded-sm px-2 py-1.5 text-sm text-left", i === active && "bg-accent text-accent-foreground")}
        >
          {s}
        </button>
      ))}
    </div>
  );
}
