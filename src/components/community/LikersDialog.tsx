import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { HeartOff } from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Tip } from "@/components/ui/tooltip";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { UserAvatar } from "@/components/UserAvatar";
import { UserName } from "@/components/UserName";
import { StatusPill } from "@/components/StatusPill";
import { describeAccountAge, isFreshAccount } from "@/lib/accountAge";
import { canModerate } from "@/lib/roles";
import { formatServerDate, formatServerDateTime } from "@/lib/serverDate";
import { cn } from "@/lib/utils";
import WorldStorageService from "@/services/WorldStorageService";
import type { WorldRecord } from "@/components/WorldDetails";
import type { LikerRow } from "@/types";

interface LikersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The listing whose likers to show. Null fetches nothing. */
  listingId: string | null;
  /** Its name, for the title — the dialog opens over the listing it belongs to. */
  listingName?: string | null;
  /** Who is reading, so a row they cannot moderate carries no remove action. */
  currentUser?: WorldRecord | null;
  /** Reports the listing's new like count after a removal, so the heart behind this agrees. */
  onLikesChanged?: (likes: number) => void;
}

/**
 * Who liked a listing. Staff only.
 *
 * A list rather than a table: the fields are a person, not a record, and the one thing staff are reading
 * for — a run of accounts made minutes before they liked — reads down a column of phrases far faster
 * than it does across a row of timestamps.
 */
export function LikersDialog({
  open, onOpenChange, listingId, listingName, currentUser, onLikesChanged,
}: LikersDialogProps) {
  const [rows, setRows] = useState<LikerRow[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** The row awaiting confirmation, or null. Only one removal is in flight at a time. */
  const [pending, setPending] = useState<LikerRow | null>(null);

  useEffect(() => {
    if (!open || !listingId) return;

    let cancelled = false;
    setRows([]);
    setTotal(0);
    setError(null);
    setIsLoading(true);

    WorldStorageService.fetchLikers(listingId)
      .then((result) => {
        if (cancelled) return;
        setRows(result.rows);
        setTotal(result.total);
      })
      .catch((e: Error) => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setIsLoading(false); });

    return () => { cancelled = true; };
  }, [open, listingId]);

  /**
   * Whether to offer the bin on a row.
   *
   * The row carries no role today, so a staff liker reads as an ordinary account here and the server's
   * refusal is what the reader gets. Once the server sends `role`, the ladder is honest on both sides
   * without this changing.
   */
  const mayRemove = (row: LikerRow) =>
    canModerate(currentUser, { id: row.id, accountType: row.role ?? 'normal' });

  const remove = async (row: LikerRow) => {
    if (!listingId) return;

    try {
      const likes = await WorldStorageService.removeLike(listingId, row.id);
      setRows((prev) => prev.filter((r) => r.id !== row.id));
      setTotal((prev) => Math.max(prev - 1, 0));
      onLikesChanged?.(likes);
    } catch (e) {
      toast.error((e as Error).message || 'Failed to remove that like');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle className="truncate">
            Who liked {listingName ? `“${listingName}”` : 'this'}
          </DialogTitle>
          {/* The total rather than the row count: the server caps the list, and a listing with more
              likes than the cap is exactly the one somebody came here about. */}
          <DialogDescription>
            {isLoading && rows.length === 0
              ? 'Reading the likes…'
              : `${total} ${total === 1 ? 'like' : 'likes'}${rows.length < total ? `, showing the newest ${rows.length}` : ''}`}
          </DialogDescription>
        </DialogHeader>

        {error ? (
          <p className="py-6 text-center text-label text-destructive">{error}</p>
        ) : isLoading ? (
          <div className="space-y-2 py-2">
            {Array(3).fill(0).map((_, index) => <Skeleton key={index} className="h-16 w-full" />)}
          </div>
        ) : rows.length === 0 ? (
          <p className="py-6 text-center text-helper text-muted-foreground">Nobody has liked this yet.</p>
        ) : (
          <ScrollArea className="h-[19rem]">
            <ul className="space-y-2 pr-3">
              {rows.map((row) => {
                const fresh = isFreshAccount(row.accountAgeAtLikeSeconds);

                return (
                  <li
                    key={row.id}
                    data-fresh={fresh || undefined}
                    className={cn(
                      'flex items-center gap-3 rounded-md border p-2 min-w-0',
                      // The one automatic judgment here: an account made the day it liked is worth a
                      // second look, and a cluster of them is the pattern staff came for.
                      fresh && 'border-warning/40 bg-warning/5'
                    )}
                  >
                    <UserAvatar username={row.username} avatarUrl={row.avatarUrl} size="sm" />

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <UserName
                          userId={row.id}
                          username={row.username}
                          role={row.role}
                          className="text-label font-medium"
                        />
                        <StatusPill status={row.status} />
                      </div>

                      <p className="text-meta text-muted-foreground">
                        Member since {formatServerDate(row.createdAt)}
                      </p>
                      <p className="text-meta text-muted-foreground">
                        Liked {formatServerDateTime(row.likedAt)}
                        {' — '}
                        <span className={cn(fresh && 'font-semibold text-warning')}>
                          account was {describeAccountAge(row.accountAgeAtLikeSeconds)}
                        </span>
                      </p>
                    </div>

                    {mayRemove(row) && (
                      <Tip tip="Remove this like">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="shrink-0 text-muted-foreground hover:text-destructive"
                          aria-label={`Remove the like by ${row.username}`}
                          onClick={() => setPending(row)}
                        >
                          <HeartOff className="h-4 w-4" />
                        </Button>
                      </Tip>
                    )}
                  </li>
                );
              })}
            </ul>
          </ScrollArea>
        )}

        <ConfirmDialog
          open={pending !== null}
          onOpenChange={(isOpen) => { if (!isOpen) setPending(null); }}
          title="Remove this like?"
          description={
            pending
              ? `The like by ${pending.username} comes off this listing and the count drops by one. They can like it again.`
              : ''
          }
          onConfirm={() => {
            const row = pending;
            setPending(null);
            if (row) void remove(row);
          }}
          onCancel={() => setPending(null)}
        />
      </DialogContent>
    </Dialog>
  );
}
