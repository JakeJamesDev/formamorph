import { cn } from "@/lib/utils";
import { ROLE_BADGE_STYLES, ROLE_LABELS, badgeRole } from "@/lib/roles";

interface RoleBadgeProps {
  /** What the person was. Anything that isn't a staff role renders nothing. */
  role: string | null | undefined;
  className?: string;
}

/**
 * A small tag saying somebody is on the team.
 *
 * A badge beside the name rather than a name of its own: a reply is always from a person, and "Formamorph
 * Team" in place of a username hid who was actually speaking. The three roles are tinted apart so a
 * thread can be scanned without reading every tag.
 */
export function RoleBadge({ role, className }: RoleBadgeProps) {
  const staffRole = badgeRole(role);
  if (!staffRole) return null;

  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
        ROLE_BADGE_STYLES[staffRole],
        className
      )}
    >
      {ROLE_LABELS[staffRole]}
    </span>
  );
}
