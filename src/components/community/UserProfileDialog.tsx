import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { UserPlus, UserMinus } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/UserAvatar";
import { RoleBadge } from "@/components/RoleBadge";
import { parseServerDate } from "@/lib/serverDate";
import UserService from "@/services/UserService";
import AuthService from "@/services/AuthService";
import type { PublicProfile } from "@/types";

interface UserProfileDialogProps {
  /** Whose profile to show. Null closes it. */
  userId: string | null;
  onOpenChange: (open: boolean) => void;
  /** The name already on screen, shown while the fetch is in flight so the dialog opens with something. */
  fallbackUsername?: string | null;
}

/**
 * Who somebody is, from anywhere their name appears.
 *
 * Fetched on open rather than carried by the thing that was clicked: a name on a listing, a comment and a
 * reply are three different shapes, and none of them should have to grow a signup date to make this work.
 */
export function UserProfileDialog({ userId, onOpenChange, fallbackUsername }: UserProfileDialogProps) {
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isFollowBusy, setIsFollowBusy] = useState(false);

  const myId = String(AuthService.getCurrentUser()?.id ?? '');

  useEffect(() => {
    if (!userId) return;

    let cancelled = false;
    setProfile(null);
    setError(null);
    setIsLoading(true);

    UserService.fetchProfile(userId)
      .then((data) => { if (!cancelled) setProfile(data); })
      .catch((e: Error) => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setIsLoading(false); });

    return () => { cancelled = true; };
  }, [userId]);

  const memberSince = profile ? parseServerDate(profile.createdAt)?.toLocaleDateString() : null;
  // Offered only to somebody who could act on it: following needs an account, and following yourself
  // would put your own work in your own news.
  const canFollow = Boolean(profile) && Boolean(myId) && profile?.id !== myId;

  const toggleFollow = async () => {
    if (!profile) return;

    setIsFollowBusy(true);
    try {
      const next = await UserService.setFollowing(profile.id, !profile.following);
      // The server answers with the count as well as the state, so the number and the button can never
      // disagree about what just happened.
      setProfile({ ...profile, ...next });
    } catch (e) {
      toast.error((e as Error).message || 'Failed to change that');
    } finally {
      setIsFollowBusy(false);
    }
  };
  // The name from wherever they were clicked, so the dialog never opens blank.
  const name = profile?.username ?? fallbackUsername ?? null;

  return (
    <Dialog open={userId !== null} onOpenChange={onOpenChange}>
      {/* No description: a profile is the person, and a line explaining that would say nothing. */}
      <DialogContent aria-describedby={undefined} className="sm:max-w-[380px]">
        <DialogHeader className="sr-only">
          <DialogTitle>{name || 'Profile'}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col items-center gap-3 py-4 text-center min-w-0">
          {isLoading && !name ? (
            <Skeleton className="h-24 w-24 rounded-full" />
          ) : (
            <UserAvatar
              username={name}
              avatarUrl={profile?.avatarUrl}
              size="xl"
              className="h-24 w-24 text-4xl"
            />
          )}

          <div className="min-w-0 space-y-1">
            <div className="flex items-center justify-center gap-2 min-w-0">
              <h3 className="text-lg font-semibold truncate">{name || 'Unknown'}</h3>
              <RoleBadge role={profile?.role} />
            </div>

            {error ? (
              <p className="text-sm text-destructive">{error}</p>
            ) : memberSince ? (
              <p className="text-sm text-muted-foreground">
                Member since {memberSince}
                {' · '}
                {profile?.followers} {profile?.followers === 1 ? 'follower' : 'followers'}
              </p>
            ) : (
              <Skeleton className="mx-auto h-5 w-32" />
            )}
          </div>

          {canFollow && (
            <Button
              variant={profile?.following ? 'outline' : 'default'}
              size="sm"
              className="gap-1.5"
              disabled={isFollowBusy}
              onClick={toggleFollow}
            >
              {profile?.following
                ? <><UserMinus className="h-4 w-4" /> Following</>
                : <><UserPlus className="h-4 w-4" /> Follow</>}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
