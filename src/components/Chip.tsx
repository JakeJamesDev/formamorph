/* eslint-disable react-refresh/only-export-components -- this module intentionally exports the chip
   components alongside the shared CHIP_BASE constant and paste helpers. */
import { useRef, useState, type CSSProperties, type ReactNode } from "react";
import { X } from "lucide-react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Tip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/** Single source for the rounded-square chip shape + aspect ratio (matches the AI Context popup's
 *  keyword chips). Colored chips layer their bg/text on top via `className`. */
export const CHIP_BASE = "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-meta";

/** Right padding that stands in for a chip's remove (×) — `gap-1` plus the icon, on top of `px-1.5`. An
 *  editor that has no × of its own uses it to land exactly the width of the chip it replaced, so the row
 *  never reflows on the way into edit mode. */
export const CHIP_REMOVE_RESERVE = "pr-[1.375rem]";

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
export function Chip({ label, removeLabel, onRemove, className, innerRef, style, dragProps, grabbable, tip }: {
  /** A node, not just text, so a chip can hold a nested chip (a placeholder inside a name). */
  label: ReactNode;
  /** The value handed to `onRemove`, and the accessible name when `label` is decorated (it carries a
   *  percentage) or is a node with no readable text of its own. */
  removeLabel?: string;
  onRemove?: (label: string) => void;
  className?: string;
  innerRef?: (node: HTMLElement | null) => void;
  style?: CSSProperties;
  dragProps?: Record<string, unknown>;
  grabbable?: boolean;
  /** Hover text — what the chip is, when its label shows something else. */
  tip?: string;
}) {
  // A node label has no string form to name the remove button with, so `removeLabel` carries it.
  const name = removeLabel ?? (typeof label === 'string' ? label : '');
  return (
    // No tab stop of its own: chips run dozens to a list and live inside the prompt editor's
    // contenteditable, where an added stop costs more than the tip is worth. The label is on the chip.
    <Tip tip={tip} labelsChild={false}>
      <span
        ref={innerRef}
        style={style}
        // A chip is a value, not decoration: it is where a keyword or placeholder value is shown, so the
        // World Editor's find bar has to be able to reach it the way it reaches a text field.
        data-chip=""
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
            onClick={() => onRemove(name)}
            className="hover:text-destructive"
            aria-label={`Remove ${name}`}
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </span>
    </Tip>
  );
}

/**
 * Sizes a chip-shaped field to exactly the text in it, by laying an invisible twin of that text in the same
 * box underneath it and letting the twin set the width.
 *
 * A character count cannot do this: `ch` is the width of one `0`, and chip labels are proportional text, so
 * anything counting characters lands narrower than the label it replaces and the chip visibly shrinks the
 * moment it becomes editable. The twin carries the same classes as the field, so the two agree by
 * construction rather than by arithmetic that has to be kept in sync with the styling.
 *
 * Wrap a field in it and give that field `col-start-1 row-start-1 w-full`.
 */
export function ChipFieldSizer({ text, withRemove, children }: {
  text: string;
  /** Set when the chip being replaced carries a remove (×), so the twin reserves that room and the field
   *  lands exactly the chip's width rather than the chip's width less a button. */
  withRemove?: boolean;
  children: ReactNode;
}) {
  return (
    <span className="relative inline-grid max-w-full align-middle">
      <span aria-hidden className={cn(CHIP_BASE, 'invisible col-start-1 row-start-1 min-w-[3ch] border whitespace-pre')}>
        {text || ' '}
        {withRemove && <span className="h-3 w-3" />}
      </span>
      {children}
    </span>
  );
}

/**
 * A chip that has become a text box: same size and colors, so renaming happens in place rather than in a
 * dialog. Enter or blur commits, Escape abandons, and an empty value is treated as abandoning — a chip
 * labels itself with its name, so committing nothing would leave nothing to grab hold of.
 */
export function ChipRenameInput({ value, onCommit, onCancel, ariaLabel, style, withRemove }: {
  value: string;
  onCommit: (next: string) => void;
  onCancel: () => void;
  ariaLabel: string;
  style?: CSSProperties;
  /** See {@link ChipFieldSizer}. */
  withRemove?: boolean;
}) {
  const [text, setText] = useState(value);
  const done = useRef(false);
  const finish = (next: string) => {
    if (done.current) return;
    done.current = true;
    const trimmed = next.trim();
    if (trimmed && trimmed !== value) onCommit(trimmed);
    else onCancel();
  };
  return (
    <ChipFieldSizer text={text} withRemove={withRemove}>
      <input
        autoFocus
        // The twin sets the width; an input's own intrinsic size is 20 characters, which would
        // otherwise be what the grid track measures.
        size={1}
        value={text}
        aria-label={ariaLabel}
        style={style}
        onChange={(e) => setText(e.target.value)}
        onFocus={(e) => e.currentTarget.select()}
        onBlur={() => finish(text)}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === 'Enter') { e.preventDefault(); finish(text); }
          if (e.key === 'Escape') { e.preventDefault(); done.current = true; onCancel(); }
        }}
        className={cn(CHIP_BASE, 'col-start-1 row-start-1 w-full min-w-0 rounded border bg-secondary text-secondary-foreground outline-none ring-1 ring-ring')}
      />
    </ChipFieldSizer>
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
