import { cn } from "@/lib/utils";
import { UNREAD_MARK_STYLES, type UnreadKind } from "@/lib/unreadSeverity";

interface UnreadEdgeProps {
  /** What kind of waiting thing this row holds, which decides its color. */
  kind: UnreadKind;
  className?: string;
}

/**
 * A bar down the left of a row that has something waiting in it.
 *
 * A background tint would have been simpler, but message rows are already tinted by severity and a
 * second wash over the first reads as neither. This sits beside that instead of arguing with it.
 *
 * Absolutely positioned rather than a thick left border, which would shift the row's contents three
 * pixels when it appeared and leave read and unread rows misaligned down the list. Inset and rounded
 * rather than flush, so it needs no `overflow-hidden` on the row — that would clip a wide code block
 * in an expanded message instead of letting it scroll.
 *
 * Decoration only: it carries no label because the dot beside the title already says this, and a
 * screen reader should hear it once. `pointer-events-none` keeps it from swallowing a click meant for
 * the row, and the z-index keeps it visible over a suggestion's vote button, whose hover fill covers
 * the same few pixels.
 */
export function UnreadEdge({ kind, className }: UnreadEdgeProps) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'pointer-events-none absolute inset-y-1 left-0.5 z-10 w-1 rounded-full',
        UNREAD_MARK_STYLES[kind].mark,
        className
      )}
    />
  );
}
