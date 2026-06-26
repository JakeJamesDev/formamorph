/* eslint-disable react-refresh/only-export-components -- this module intentionally exports the chip
   components alongside the shared CHIP_BASE constant and splitChipInput helper. */
import { type CSSProperties } from "react";
import { X } from "lucide-react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";

/** Single source for the rounded-square chip shape + aspect ratio (matches the AI Context popup's
 *  keyword chips). Colored chips layer their bg/text on top via `className`. */
export const CHIP_BASE = "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs";

/** Split a chip-input value on commas into complete (trimmed, non-empty) segments plus the trailing
 *  remainder still being typed. Powers comma-to-chip and pasted-comma behavior across chip inputs. */
export function splitChipInput(value: string): { complete: string[]; remainder: string } {
  if (!value.includes(",")) return { complete: [], remainder: value };
  const parts = value.split(",");
  const remainder = parts.pop() ?? "";
  return { complete: parts.map((p) => p.trim()).filter(Boolean), remainder };
}

/** A removable rounded-square chip. Neutral by default; pass `className` for a semantic color. */
export function Chip({ label, onRemove, className, innerRef, style, dragProps, grabbable }: {
  label: string;
  onRemove: (label: string) => void;
  className?: string;
  innerRef?: (node: HTMLElement | null) => void;
  style?: CSSProperties;
  dragProps?: Record<string, unknown>;
  grabbable?: boolean;
}) {
  return (
    <span
      ref={innerRef}
      style={style}
      {...dragProps}
      className={cn(
        CHIP_BASE,
        "border bg-secondary text-secondary-foreground",
        grabbable && "cursor-grab touch-none select-none",
        className,
      )}
    >
      {label}
      <button
        type="button"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={() => onRemove(label)}
        className="hover:text-destructive"
        aria-label={`Remove ${label}`}
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}

/** A draggable chip (only valid inside a SortableContext). The chip's `id` is its label. */
export function SortableChip({ id, onRemove }: { id: string; onRemove: (label: string) => void }) {
  const { setNodeRef, transform, transition, isDragging, attributes, listeners } = useSortable({ id });
  return (
    <Chip
      label={id}
      onRemove={onRemove}
      innerRef={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        zIndex: isDragging ? 1 : undefined,
      }}
      dragProps={{ ...attributes, ...listeners }}
      grabbable
    />
  );
}
