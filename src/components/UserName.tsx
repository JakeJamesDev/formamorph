import { cn } from "@/lib/utils";
import { useUserProfile } from "@/contexts/userProfileStore";

interface UserNameProps {
  userId?: string | null;
  username?: string | null;
  /** Shown when there is no name — a comment outlives the account that wrote it. */
  fallback?: string;
  className?: string;
}

/**
 * Somebody's name, opening their profile when clicked.
 *
 * Plain text when there is no account behind it: a deleted author still has a byline, and a control that
 * opens nothing reads as broken. Rendered as a button rather than a link so it carries the keyboard and
 * screen-reader behavior of the thing it actually is.
 */
export function UserName({ userId, username, fallback = 'Unknown', className }: UserNameProps) {
  const { openProfile } = useUserProfile();
  const label = username || fallback;

  if (!userId || !username) {
    return <span className={cn('truncate', className)}>{label}</span>;
  }

  return (
    <button
      type="button"
      // These names sit inside cards and rows that are themselves clickable.
      onClick={(e) => { e.stopPropagation(); openProfile(userId, username); }}
      aria-label={`View ${username}'s profile`}
      className={cn(
        'truncate rounded-sm underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
        className
      )}
    >
      {label}
    </button>
  );
}
