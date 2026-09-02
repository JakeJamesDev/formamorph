import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { EyeOff, HeartOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { UserName } from "@/components/UserName";
import { formatServerDateTime } from "@/lib/serverDate";
import UserService from "@/services/UserService";
import type { LikeGiven } from "@/types";

interface UserLikesTabProps {
  /** Whose likes to list. Null fetches nothing. */
  userId: string | null;
  /** Their name, for the empty line and the confirmation. */
  username: string | null;
  /** Whether the reader may act on this account. False hides Clear all; the rows still read. */
  canModerateAccount: boolean;
  /** Opens a listing in Community Creations. Absent leaves the names as plain text. */
  onOpenListing?: (listing: { id: string; kind: string }) => void;
}

/**
 * What one account has liked. Staff only.
 *
 * The other half of the likers list: that one asks who is behind a suspicious count, this one asks what
 * one suspicious account has been propping up. A cluster around a single author is the answer staff are
 * usually looking at, so the author is named on every row rather than left to the listing behind it.
 */
export function UserLikesTab({ userId, username, canModerateAccount, onOpenListing }: UserLikesTabProps) {
  const [rows, setRows] = useState<LikeGiven[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  useEffect(() => {
    if (!userId) return;

    let cancelled = false;
    setRows([]);
    setTotal(0);
    setError(null);
    setIsLoading(true);

    UserService.fetchLikesGiven(userId)
      .then((result) => {
        if (cancelled) return;
        setRows(result.rows);
        setTotal(result.total);
      })
      .catch((e: Error) => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setIsLoading(false); });

    return () => { cancelled = true; };
  }, [userId]);

  const clearAll = async () => {
    if (!userId) return;

    setIsClearing(true);
    try {
      const removed = await UserService.clearLikesGiven(userId);
      setRows([]);
      setTotal(0);
      toast.success(`Removed ${removed} ${removed === 1 ? 'like' : 'likes'}`);
    } catch (e) {
      toast.error((e as Error).message || 'Failed to clear their likes');
    } finally {
      setIsClearing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-2 py-2">
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-14 w-full" />
      </div>
    );
  }

  if (error) {
    return <p className="py-6 text-center text-label text-destructive">{error}</p>;
  }

  return (
    <div className="space-y-2 py-2 min-w-0">
      <div className="flex items-center justify-between gap-2">
        <p className="text-helper text-muted-foreground">
          {total} {total === 1 ? 'like' : 'likes'} given
          {rows.length < total ? `, showing the newest ${rows.length}` : ''}
        </p>

        {/* Off the screen rather than disabled for an account the reader cannot reach: the ladder is a
            fact about them, not a thing to discover by pressing. */}
        {canModerateAccount && rows.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-muted-foreground hover:text-destructive"
            disabled={isClearing}
            onClick={() => setConfirming(true)}
          >
            <HeartOff className="h-3.5 w-3.5" /> Clear all
          </Button>
        )}
      </div>

      {rows.length === 0 ? (
        <p className="py-6 text-center text-helper text-muted-foreground">
          {username || 'They'} hasn&apos;t liked anything.
        </p>
      ) : (
        <ScrollArea className="h-[15.5rem]">
          <ul className="mx-auto w-full max-w-[22rem] space-y-2 pl-[11px]">
            {rows.map((row) => (
              <li key={row.id} className="rounded-md border p-2 min-w-0 text-left">
                {onOpenListing ? (
                  <button
                    type="button"
                    // The row carries no kind; the browser resolves it from the catalog row it finds by id.
                    onClick={() => onOpenListing({ id: row.id, kind: 'world' })}
                    className="block w-full truncate text-left text-label font-medium underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded-sm"
                    aria-label={`Open ${row.name} in Community Creations`}
                  >
                    {row.name}
                  </button>
                ) : (
                  <span className="block truncate text-label font-medium">{row.name}</span>
                )}

                <p className="flex flex-wrap items-center gap-x-3 text-meta text-muted-foreground min-w-0">
                  <span className="inline-flex items-center gap-1 min-w-0">
                    by <UserName userId={row.authorId} username={row.authorUsername} />
                  </span>
                  <span>{formatServerDateTime(row.likedAt)}</span>
                  {/* Kept rather than dropped: a like on a hidden listing is part of what the account did. */}
                  {row.quarantined && (
                    <span className="inline-flex items-center gap-1 text-destructive">
                      <EyeOff className="h-3 w-3" aria-hidden />
                      Hidden
                    </span>
                  )}
                </p>
              </li>
            ))}
          </ul>
        </ScrollArea>
      )}

      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={`Remove ${total} ${total === 1 ? 'like' : 'likes'}?`}
        description={`Every like ${username || 'this account'} has given comes off, and each listing's count drops by one. They can like anything again.`}
        onConfirm={() => { setConfirming(false); void clearAll(); }}
        onCancel={() => setConfirming(false)}
      />
    </div>
  );
}
