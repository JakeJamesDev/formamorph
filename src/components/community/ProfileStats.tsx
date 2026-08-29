import { Users, Heart, Download } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tip } from "@/components/ui/tooltip";
import type { PublicProfile } from "@/types";

/**
 * One number on a profile: the icon carries the meaning on screen, the word carries it to a reader who
 * cannot see the icon, and the tip puts that word in front of a pointer or a keyboard.
 *
 * The word stays a real `sr-only` node rather than becoming the tip's `aria-label`: this span has no
 * role, and ARIA does not allow a label on a generic element.
 */
function ProfileStat({ icon: Icon, value, label }: {
  icon: typeof Users;
  value: number;
  label: string;
}) {
  return (
    <Tip tip={`${value} ${label}`} labelsChild={false}>
      <span className="flex items-center gap-1.5" tabIndex={0}>
        <Icon className="h-4 w-4" aria-hidden />
        <span className="tabular-nums">{value}</span>
        <span className="sr-only">{label}</span>
      </span>
    </Tip>
  );
}

/**
 * What an account amounts to: who follows them, and what their published work has earned.
 *
 * Shared by the popup a stranger opens and the dialog behind your own profile circle, so your own
 * numbers are the ones everybody else is reading rather than a second answer to the same question.
 *
 * The totals count the catalog rather than what the reader may see — an author's quarantined work is
 * listed to them with its own numbers and still sits out of these. See `World.authorTotals`.
 */
export function ProfileStats({ profile, className }: {
  profile: Pick<PublicProfile, 'followers' | 'likes' | 'downloads'>;
  className?: string;
}) {
  return (
    <div className={cn('flex items-center gap-5 text-helper text-muted-foreground', className)}>
      <ProfileStat
        icon={Users}
        value={profile.followers}
        label={profile.followers === 1 ? 'follower' : 'followers'}
      />
      <ProfileStat
        icon={Heart}
        value={profile.likes}
        label={profile.likes === 1 ? 'like' : 'likes'}
      />
      <ProfileStat
        icon={Download}
        value={profile.downloads}
        label={profile.downloads === 1 ? 'download' : 'downloads'}
      />
    </div>
  );
}
