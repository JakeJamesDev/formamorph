import { cn } from "@/lib/utils";
import { RoleBadge } from "@/components/RoleBadge";
import { SupporterBadge } from "@/components/SupporterBadge";
import { useUserProfile } from "@/contexts/userProfileStore";
import { SUPPORTER_NAME_STYLES, flairTier } from "@/lib/supporterFlair";
import type { SupporterFlair } from "@/types";

interface UserNameProps {
  userId?: string | null;
  username?: string | null;
  /** Shown when there is no name — a comment outlives the account that wrote it. */
  fallback?: string;
  /** Their staff role, if the caller has one. Anything else renders no badge. */
  role?: string | null;
  /** Their Supporter Flair, as the server sent it. Null or absent renders none; the server decides for staff. */
  supporter?: SupporterFlair | null;
  className?: string;
}

/**
 * Somebody's name, opening their profile when clicked.
 *
 * Plain text when there is no account behind it: a deleted author still has a byline, and a control that
 * opens nothing reads as broken. Rendered as a button rather than a link so it carries the keyboard and
 * screen-reader behavior of the thing it actually is.
 *
 * The badge sits outside the button: it says something about the person rather than about where the
 * control goes, and a screen reader announcing "Mod View wren_hallow's profile" would be reading the
 * two as one thing.
 */
export function UserName({ userId, username, fallback = 'Unknown', role, supporter, className }: UserNameProps) {
  const { openProfile } = useUserProfile();
  const label = username || fallback;
  const tier = flairTier(supporter);
  const nameStyle = tier ? SUPPORTER_NAME_STYLES[tier] : undefined;
  const badge = (
    <>
      {tier && <SupporterBadge tier={tier} since={supporter?.since} />}
      <RoleBadge role={role} />
    </>
  );

  if (!userId || !username) {
    return (
      <span className="inline-flex items-center gap-1.5 min-w-0">
        <span className={cn('truncate', nameStyle, className)}>{label}</span>
        {badge}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 min-w-0">
      <button
        type="button"
        // These names sit inside cards and rows that are themselves clickable.
        onClick={(e) => { e.stopPropagation(); openProfile(userId, username); }}
        aria-label={`View ${username}'s profile`}
        className={cn(
          'truncate rounded-sm underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
          nameStyle,
          className
        )}
      >
        {label}
      </button>
      {badge}
    </span>
  );
}
