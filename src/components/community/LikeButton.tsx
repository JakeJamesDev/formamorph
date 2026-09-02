import { useState } from "react";
import { toast } from "react-toastify";
import { Heart } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tip } from "@/components/ui/tooltip";

interface LikeButtonProps {
  /** How many accounts have liked it. */
  likes: number;
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
export function LikeButton({ likes, liked, onToggle, onOpenLikers, size = 'sm', className }: LikeButtonProps) {
  const [isBusy, setIsBusy] = useState(false);

  const iconClass = cn(size === 'sm' ? 'h-3 w-3' : 'h-4 w-4', liked && 'fill-like text-like');
  const body = <><Heart className={iconClass} /> {likes}</>;
  const label = `${likes} ${likes === 1 ? 'like' : 'likes'}`;

  // For staff the count is a way in rather than a rating: it opens who is behind it. Takes precedence
  // over the heart, so the same element is one control or the other and never both.
  if (onOpenLikers) {
    return (
      <Tip tip="See who liked this">
        <button
          type="button"
          // These sit inside cards that are themselves clickable.
          onClick={(e) => { e.stopPropagation(); onOpenLikers(); }}
          aria-label={`Show who liked this — ${label}`}
          className={cn(
            'flex items-center gap-1 rounded-sm underline underline-offset-2 decoration-dotted transition-colors hover:text-like focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
            className
          )}
        >
          {body}
        </button>
      </Tip>
    );
  }

  if (!onToggle) {
    return (
      // The tip counts too, so it names the span: the heart is decorative and a bare "3" says nothing.
      <Tip tip={label}>
        <span className={cn('flex items-center gap-1', className)}>{body}</span>
      </Tip>
    );
  }

  const toggle = async () => {
    setIsBusy(true);
    try {
      await onToggle(!liked);
    } catch (error) {
      toast.error((error as Error).message || 'Failed to change that');
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <Tip tip={liked ? 'You like this' : 'Like this'}>
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
