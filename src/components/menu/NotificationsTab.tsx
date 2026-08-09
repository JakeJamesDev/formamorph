import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";
import { ChevronDown, ChevronRight, UserMinus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { UserAvatar } from "@/components/UserAvatar";
import { UserName } from "@/components/UserName";
import { KIND_LABELS, type CatalogKind } from "@/lib/catalogKinds";
import { formatServerDateTime } from "@/lib/serverDate";
import UserService from "@/services/UserService";
import type { FeedItem, FollowedUser } from "@/types";

interface NotificationsTabProps {
  /** Whether the tab is visible; opening it is what reads the feed, which marks it read. */
  active: boolean;
  /** Fired once the feed has been read, so the badge outside drops its share. */
  onRead?: () => void;
  /** Opens the listing a row is about. Absent leaves the rows as plain text. */
  onOpenListing?: (item: FeedItem) => void;
}

/** One feed row's sentence. Kept here rather than inline so the wording is in one place. */
const describe = (item: FeedItem): string => {
  const noun = (KIND_LABELS[item.kind as CatalogKind]?.one ?? item.kind).toLowerCase();

  return item.event === 'published' ? `published a new ${noun}` : `updated their ${noun}`;
};

/**
 * What the accounts you follow have been up to.
 *
 * Opening the tab reads the feed, and reading it is what marks it read — there is nothing else that
 * could, since a row is a listing rather than a stored notification.
 */
export function NotificationsTab({ active, onRead, onOpenListing }: NotificationsTabProps) {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [following, setFollowing] = useState<FollowedUser[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showFollowing, setShowFollowing] = useState(false);

  // Held in a ref rather than closed over: this callback bumps state in the host, so a host passing an
  // inline arrow would hand back a new identity every render — refetch, bump, re-render, refetch. That
  // loop only stops when the server does.
  const onReadRef = useRef(onRead);
  useEffect(() => { onReadRef.current = onRead; });

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const [feed, followed] = await Promise.all([
        UserService.fetchNotifications(),
        UserService.fetchFollowing(),
      ]);
      setItems(feed.items);
      setFollowing(followed);
      // The read has already landed by the time this resolves, so the badge outside is now stale.
      onReadRef.current?.();
    } catch (error) {
      toast.error((error as Error).message || 'Failed to load your notifications');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (active) load();
  }, [active, load]);

  const unfollow = async (user: FollowedUser) => {
    try {
      await UserService.setFollowing(user.id, false);
      // Their rows go with them: the feed is a view over who you follow, not a stored list.
      setFollowing((prev) => prev.filter((u) => u.id !== user.id));
      setItems((prev) => prev.filter((item) => item.author.id !== user.id));
      toast.success(`You no longer follow ${user.username}`);
    } catch (error) {
      toast.error((error as Error).message || 'Failed to unfollow them');
    }
  };

  return (
    <div className="py-4 space-y-4 min-w-0">
      <div className="rounded-md border">
        <button
          type="button"
          onClick={() => setShowFollowing((open) => !open)}
          className="flex w-full items-center gap-2 px-3 py-2 text-label font-medium hover:bg-muted/50"
          aria-expanded={showFollowing}
        >
          {showFollowing ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          Following ({following.length})
        </button>

        {showFollowing && (
          <div className="border-t p-2 space-y-1">
            {following.length === 0 ? (
              <p className="px-1 py-2 text-helper text-muted-foreground">
                You don&apos;t follow anyone yet. Click a name in Community Creations to see their profile.
              </p>
            ) : following.map((user) => (
              <div key={user.id} className="flex items-center gap-2 rounded-md px-1 py-1 min-w-0">
                <UserAvatar username={user.username} avatarUrl={user.avatarUrl} size="sm" />
                {/* The stretch lives out here: the name is wrapped alongside its badge, so growing the
                    name itself would push the badge off the end of the row instead of filling it. */}
                <div className="flex-1 min-w-0">
                  <UserName userId={user.id} username={user.username} role={user.role} className="text-label text-left" />
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0"
                  aria-label={`Unfollow ${user.username}`}
                  title={`Unfollow ${user.username}`}
                  onClick={() => unfollow(user)}
                >
                  <UserMinus className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {isLoading && items.length === 0 ? (
        <div className="space-y-2">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      ) : items.length === 0 ? (
        <p className="py-6 text-center text-helper text-muted-foreground">
          {following.length === 0
            ? 'Follow someone and their new work will show up here.'
            : 'Nothing new from anyone you follow.'}
        </p>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => (
            <li key={item.id} className="flex items-start gap-2 rounded-md border p-3 min-w-0">
              <UserAvatar username={item.author.username} avatarUrl={item.author.avatarUrl} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="text-label min-w-0">
                  <UserName userId={item.author.id} username={item.author.username} role={item.author.role} className="font-medium" />
                  {' '}{describe(item)}{' '}
                  {onOpenListing ? (
                    <button
                      type="button"
                      onClick={() => onOpenListing(item)}
                      className="font-medium underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded-sm"
                      aria-label={`Open ${item.name} in Community Creations`}
                    >
                      &ldquo;{item.name}&rdquo;
                    </button>
                  ) : (
                    <span className="font-medium">&ldquo;{item.name}&rdquo;</span>
                  )}
                </p>
                <p className="text-meta text-muted-foreground">{formatServerDateTime(item.at)}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
