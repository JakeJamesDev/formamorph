import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { UserPlus, UserMinus, Flag } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/UserAvatar";
import { RoleBadge } from "@/components/RoleBadge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserCreationsTab } from "@/components/community/UserCreationsTab";
import { UserLikesTab } from "@/components/community/UserLikesTab";
import { ReportDialog } from "@/components/community/ReportDialog";
import { useReportsEnabled } from "@/lib/useReportsEnabled";
import { ProfileStats } from "@/components/community/ProfileStats";
import { parseServerDate } from "@/lib/serverDate";
import { canModerate, isStaff } from "@/lib/roles";
import UserService from "@/services/UserService";
import AuthService from "@/services/AuthService";
import type { PublicProfile } from "@/types";

interface UserProfileDialogProps {
  /** Whose profile to show. Null closes it. */
  userId: string | null;
  onOpenChange: (open: boolean) => void;
  /** The name already on screen, shown while the fetch is in flight so the dialog opens with something. */
  fallbackUsername?: string | null;
  /** Opens one of their listings in Community Creations. Absent leaves the rows as plain text. */
  onOpenListing?: (listing: { id: string; kind: string }) => void;
}

/**
 * Who somebody is, from anywhere their name appears.
 *
 * Fetched on open rather than carried by the thing that was clicked: a name on a listing, a comment and a
 * reply are three different shapes, and none of them should have to grow a signup date to make this work.
 */
export function UserProfileDialog({ userId, onOpenChange, fallbackUsername, onOpenListing }: UserProfileDialogProps) {
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isFollowBusy, setIsFollowBusy] = useState(false);
  const [reporting, setReporting] = useState(false);
  // Which half of the staff view is on show. Ordinary readers never see the strip that sets it.
  const [tab, setTab] = useState<'creations' | 'likes'>('creations');
  // Whether Likes has ever been opened. The list is a moderation read, so it is not fetched for every
  // profile a staff member happens to click.
  const [likesOpened, setLikesOpened] = useState(false);

  const me = AuthService.getCurrentUser();
  const myId = String(me?.id ?? '');
  // Signed-out visitors and servers without the feature get no control at all.
  const reportsEnabled = useReportsEnabled(Boolean(myId));

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
  // The same rule as following, for the same reason: reporting yourself is not a thing to offer.
  const canReport = reportsEnabled && Boolean(profile) && profile?.id !== myId;

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
  // What somebody liked is a moderation surface: the tab is staff-only, and nothing hints at it otherwise.
  const canSeeLikes = isStaff(me);
  // Clearing them is a further step up the ladder, checked against this account rather than against staff
  // in general — the profile carries the role, so this is honest before the server answers.
  const canClearLikes = canModerate(me, profile ? { id: profile.id, accountType: profile.role ?? 'normal' } : null);

  return (
    <Dialog open={userId !== null} onOpenChange={onOpenChange}>
      {/* No description: a profile is the person, and a line explaining that would say nothing. */}
      <DialogContent aria-describedby={undefined} className="sm:max-w-[460px]">
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
              // An avatar's initial scales with its circle, not with the type scale, so no role fits.
              // eslint-disable-next-line no-restricted-syntax
              className="h-24 w-24 text-4xl"
            />
          )}

          <div className="min-w-0 space-y-1">
            <div className="flex items-center justify-center gap-2 min-w-0">
              <h3 className="text-title font-semibold truncate">{name || 'Unknown'}</h3>
              <RoleBadge role={profile?.role} />
            </div>

            {error ? (
              <p className="text-label text-destructive">{error}</p>
            ) : memberSince ? (
              <p className="text-helper text-muted-foreground">Member since {memberSince}</p>
            ) : (
              <Skeleton className="mx-auto h-5 w-32" />
            )}
          </div>

          {/* Followers, and what their work has earned. Always rendered once the profile lands, zeros
              included, so the dialog keeps its shape whoever is in it. */}
          {profile && <ProfileStats profile={profile} className="justify-center" />}

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

        {/* Straight under the header rather than behind a tab: there is only one thing to show, and a bar
            with a single trigger on it costs a row of the dialog to say so. Staff have two, so they get
            the bar and nobody else pays for it. */}
        {canSeeLikes ? (
          <Tabs
            value={tab}
            onValueChange={(value) => {
              setTab(value as 'creations' | 'likes');
              if (value === 'likes') setLikesOpened(true);
            }}
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="creations">Creations</TabsTrigger>
              <TabsTrigger value="likes">Likes</TabsTrigger>
            </TabsList>

            <TabsContent value="creations">
              <UserCreationsTab userId={userId} username={name} onOpenListing={onOpenListing} />
            </TabsContent>

            {/* Mounted only once the tab has been opened, so the fetch follows the click rather than
                every staff member who looks somebody up — and kept mounted from then on, so switching
                back to Creations and returning does not read the list a second time. */}
            <TabsContent value="likes" forceMount={likesOpened ? true : undefined}>
              {likesOpened && (
                <UserLikesTab
                  userId={userId}
                  username={name}
                  canModerateAccount={canClearLikes}
                  onOpenListing={onOpenListing}
                />
              )}
            </TabsContent>
          </Tabs>
        ) : (
          <UserCreationsTab userId={userId} username={name} onOpenListing={onOpenListing} />
        )}

        {/* Under their work rather than beside their name: an offensive image or username is the reason
            this exists, and both are already on screen above. */}
        {canReport && (
          <Button
            variant="ghost"
            size="sm"
            className="mx-auto gap-1.5 text-muted-foreground hover:text-destructive"
            onClick={() => setReporting(true)}
          >
            <Flag className="h-3.5 w-3.5" /> Report Profile
          </Button>
        )}

        <ReportDialog
          open={reporting}
          onOpenChange={setReporting}
          target={profile ? { kind: 'profile', id: profile.id, name: profile.username } : null}
        />
      </DialogContent>
    </Dialog>
  );
}
