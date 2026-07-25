/* eslint-disable react-refresh/only-export-components -- this module intentionally exports the chip
   components alongside the shared CHIP_BASE constant and paste helpers. */
import { type CSSProperties } from "react";
import { X } from "lucide-react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";

/** Single source for the rounded-square chip shape + aspect ratio (matches the AI Context popup's
 *  keyword chips). Colored chips layer their bg/text on top via `className`. */
export const CHIP_BASE = "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs";

/** The separator the comma-split offer looks for. Comma+space, not a bare comma, so a `{2,3}` quantifier
 *  or a compact `a,b` list is left alone — only human-formatted lists are candidates. */
export const CHIP_SPLIT_SEPARATOR = ", ";

/** Split pasted text into chips: one per non-empty line. Newlines are always safe — no regex pattern
 *  contains one — while commas stay literal so a keyword can hold any character. */
export function splitPastedChips(text: string): string[] {
  return text.split(/\r?\n/).map((p) => p.trim()).filter(Boolean);
}

/** The segments a single pasted value would split into, or `null` when it isn't worth offering (fewer
 *  than two non-empty parts). Drives the one-shot "Split into N?" affordance. */
export function commaSplitCandidate(value: string): string[] | null {
  if (!value.includes(CHIP_SPLIT_SEPARATOR)) return null;
  const parts = value.split(CHIP_SPLIT_SEPARATOR).map((p) => p.trim()).filter(Boolean);
  return parts.length > 1 ? parts : null;
}

/** Replace `old` with a trimmed `next` in a chip list (drop `old` if `next` is empty), then dedupe
 *  case-insensitively keeping first occurrence. Shared by editable chip inputs. */
export function replaceChipValue(list: string[], old: string, next: string): string[] {
  const v = next.trim();
  const mapped = v ? list.map((x) => (x === old ? v : x)) : list.filter((x) => x !== old);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const x of mapped) {
    const l = x.toLowerCase();
    if (!seen.has(l)) { seen.add(l); out.push(x); }
  }
  return out;
}

/** A removable rounded-square chip. Neutral by default; pass `className` for a semantic color.
 *  Omit `onRemove` to render a non-removable chip (e.g. inside a read-only prompt editor). */
export function Chip({ label, onRemove, className, innerRef, style, dragProps, grabbable }: {
  label: string;
  onRemove?: (label: string) => void;
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
      {onRemove && (
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => onRemove(label)}
          className="hover:text-destructive"
          aria-label={`Remove ${label}`}
        >
          <X className="h-3 w-3" />
        </button>
      )}
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
        // Translate (not Transform): Transform bakes in a scale that resizes the dragged chip to the target.
        transform: CSS.Translate.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        zIndex: isDragging ? 1 : undefined,
      }}
      dragProps={{ ...attributes, ...listeners }}
      grabbable
    />
  );
}
