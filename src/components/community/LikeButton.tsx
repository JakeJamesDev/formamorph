import { useState } from "react";
import { toastError } from "@/lib/linkToast";
import { Heart } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tip } from "@/components/ui/tooltip";
import type { LikeCount } from "@/lib/likeCount";

export const HIDDEN_LIKES_TIP = 'Likes show after the winners are announced';
export const PRIVATE_LIKES_TIP = 'Only you and staff see this count until the winners are announced';

interface LikeButtonProps {
  /** What the count shows to this reader; see `likeCountOf`. */
  count: LikeCount;
  /** Whether the reader has. Absent for a signed-out visitor, who is shown a number rather than a control. */
  liked?: boolean;
  /**
   * Records the change. Absent leaves this a plain count — for a signed-out reader, and on your own
   * listing, which the server refuses anyway.
   */
  onToggle?: (next: boolean) => Promise<void>;
  /**
   * Opens the list of who liked it. Staff only, and absent everywhere else — the room sees a number, and
   * a control here is the one hint that a list exists at all.
   */
  onOpenLikers?: () => void;
  /** Sizing to match the row it sits in. */
  size?: 'sm' | 'md';
  className?: string;
}

/**
 * How many people were glad they downloaded something.
 *
 * Beside the download count rather than instead of it: downloads say how many tried a world, likes how
 * many finished it wanting to say so, and a listing that scores well on one and badly on the other is
 * exactly the thing neither number tells you alone.
 */
export function LikeButton({ count, liked, onToggle, onOpenLikers, size = 'sm', className }: LikeButtonProps) {
  const [isBusy, setIsBusy] = useState(false);

  const shown = count.visibility === 'hidden' ? '—' : count.likes;
  const iconClass = cn(size === 'sm' ? 'h-3 w-3' : 'h-4 w-4', liked && 'fill-like text-like');
  const body = <><Heart className={iconClass} /> {shown}</>;
  const label = count.visibility === 'hidden'
    ? 'likes hidden'
    : `${count.likes} ${count.likes === 1 ? 'like' : 'likes'}`;
  // A count others can't see says so after whatever the tip already says.
  const why = count.visibility === 'hidden' ? HIDDEN_LIKES_TIP : count.visibility === 'private' ? PRIVATE_LIKES_TIP : null;
  const withWhy = (tip: string) => (why ? `${tip}. ${why}.` : tip);
  const pressTip = withWhy(liked ? 'You like this' : 'Like this');

  const toggle = async () => {
    if (!onToggle) return;

    setIsBusy(true);
    try {
      await onToggle(!liked);
    } catch (error) {
      toastError(error, 'Failed to change that');
    } finally {
      setIsBusy(false);
    }
  };

  // Staff get the split every social app uses: the heart is still theirs to press, and the number beside
  // it opens who is behind it. Two controls rather than one, so checking a suspicious count never costs a
  // moderator the ability to like the thing they came to check.
  if (onOpenLikers) {
    return (
      <span className={cn('flex items-center gap-1', className)}>
        {onToggle ? (
          <Tip tip={pressTip}>
            <button
              type="button"
              // These sit inside cards that are themselves clickable.
              onClick={(e) => { e.stopPropagation(); toggle(); }}
              disabled={isBusy}
              aria-pressed={Boolean(liked)}
              aria-label={liked ? `Unlike — ${label}` : `Like — ${label}`}
              className="flex items-center rounded-sm transition-colors hover:text-like focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-60"
            >
              <Heart className={iconClass} />
            </button>
          </Tip>
        ) : (
          <Heart className={iconClass} aria-hidden />
        )}

        <Tip tip={withWhy('See who liked this')}>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onOpenLikers(); }}
            aria-label={`Show who liked this — ${label}`}
            className="rounded-sm tabular-nums underline underline-offset-2 decoration-dotted transition-colors hover:text-like focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            {shown}
          </button>
        </Tip>
      </span>
    );
  }

  if (!onToggle) {
    return (
      // The tip counts too, so it names the span: the heart is decorative and a bare "3" says nothing.
      <Tip tip={count.visibility === 'hidden' ? HIDDEN_LIKES_TIP : withWhy(label)}>
        <span className={cn('flex items-center gap-1', className)}>{body}</span>
      </Tip>
    );
  }

  return (
    <Tip tip={pressTip}>
      <button
        type="button"
        // These sit inside cards that are themselves clickable.
        onClick={(e) => { e.stopPropagation(); toggle(); }}
        disabled={isBusy}
        aria-pressed={Boolean(liked)}
        aria-label={liked ? `Unlike — ${label}` : `Like — ${label}`}
        className={cn(
          'flex items-center gap-1 rounded-sm transition-colors hover:text-like focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-60',
          className
        )}
      >
        {body}
      </button>
    </Tip>
  );
}
