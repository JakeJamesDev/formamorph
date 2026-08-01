import { cn } from "@/lib/utils";
import { UNREAD_MARK_STYLES, type UnreadKind } from "@/lib/unreadSeverity";

interface UnreadDotProps {
  /** What it means here — "Unread" for a message, "New replies" for a thread. */
  label: string;
  /** What kind of waiting thing this is, which decides its color. */
  kind: UnreadKind;
  className?: string;
}

/**
 * The mark saying something in this row is waiting for you.
 *
 * Colored by what it is rather than one color for everything: a suspension notice and a reply on a
 * suggestion are both unread, and only one of them should look alarming. The ladder deciding that
 * lives in `lib/unreadSeverity`, shared with the badge on the profile circle so the two agree.
 *
 * Never the only cue in a row: the title beside it carries weight too, since color alone excludes
 * anybody whose vision does not separate these hues.
 */
export function UnreadDot({ label, kind, className }: UnreadDotProps) {
  return (
    <span
      className={cn('h-2.5 w-2.5 shrink-0 rounded-full', UNREAD_MARK_STYLES[kind].mark, className)}
      aria-label={label}
    />
  );
}
