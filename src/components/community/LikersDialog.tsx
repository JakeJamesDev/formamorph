import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "react-toastify";
import { Fingerprint, HeartOff, Link2 } from "lucide-react";
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
import type { LikerAuditRow, LikerRow } from "@/types";

/** What the audit knows about one liker, once it has been asked for. Keyed by account id. */
type AuditMarks = Record<string, Pick<LikerAuditRow, 'groupId' | 'linkedToAuthor'>>;

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
  /** What the audit found, or null while nobody has asked for it. */
  const [marks, setMarks] = useState<AuditMarks | null>(null);
  const [isAuditing, setIsAuditing] = useState(false);
  /** Which listing is on screen. An audit that answers for any other one is about something else. */
  const shown = useRef<string | null>(null);

  useEffect(() => {
    if (!open || !listingId) return;

    let cancelled = false;
    shown.current = listingId;
    setRows([]);
    setTotal(0);
    setError(null);
    setMarks(null);
    setIsAuditing(false);
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

  /**
   * Ask what the network Signals say about these likes.
   *
   * A press rather than part of the load: the server writes an audit row for every call, so opening a
   * like list to read it must not file a look at the people in it.
   */
  const runAudit = async () => {
    if (!listingId) return;

    // The dialog can move to another listing while this is out. Its answer is about the listing it was
    // asked for, and "no two of these accounts share an address" over somebody else's likes is a lie a
    // moderation screen must never tell.
    const asked = listingId;
    setIsAuditing(true);
    try {
      const result = await WorldStorageService.fetchLikersAudit(asked);
      if (shown.current !== asked) return;

      setRows(result.rows);
      setTotal(result.total);
      setMarks(Object.fromEntries(result.rows.map((row: LikerAuditRow) => [
        row.id,
        { groupId: row.groupId, linkedToAuthor: row.linkedToAuthor },
      ])));
    } catch (e) {
      if (shown.current === asked) toast.error((e as Error).message || 'Failed to audit these likes');
    } finally {
      if (shown.current === asked) setIsAuditing(false);
    }
  };

  /**
   * The rows in reading order once audited: each shared-address group whole, then everybody else.
   *
   * Group sizes are counted over the rows still on screen rather than taken from the answer, so a group
   * a removal cut down to one account stops being a group without asking the server again.
   */
  const audited = useMemo(() => {
    if (!marks) return null;

    const size = new Map<number, number>();
    for (const row of rows) {
      const id = marks[row.id]?.groupId;
      if (typeof id === 'number') size.set(id, (size.get(id) ?? 0) + 1);
    }

    const groups = new Map<number, LikerRow[]>();
    const alone: LikerRow[] = [];
    for (const row of rows) {
      const id = marks[row.id]?.groupId;
      if (typeof id !== 'number' || (size.get(id) ?? 0) < 2) {
        alone.push(row);
        continue;
      }
      if (!groups.has(id)) groups.set(id, []);
      groups.get(id)?.push(row);
    }

    return {
      groups: [...groups].sort(([a], [b]) => a - b),
      alone,
      linkedToAuthor: rows.filter((row) => marks[row.id]?.linkedToAuthor).length,
    };
  }, [marks, rows]);

  /** One liker, the same row in both readings of the list. */
  const likerListItem = (row: LikerRow) => {
    const fresh = isFreshAccount(row.accountAgeAtLikeSeconds);
    const linkedToAuthor = marks?.[row.id]?.linkedToAuthor ?? false;

    return (
      <li
        key={row.id}
        data-fresh={fresh || undefined}
        data-linked-to-author={linkedToAuthor || undefined}
        className={cn(
          'flex items-center gap-3 rounded-md border bg-background p-2 min-w-0',
          // The one automatic judgment here: an account made the day it liked is worth a
          // second look, and a cluster of them is the pattern staff came for.
          fresh && 'border-warning/40 bg-warning/5'
        )}
      >
        <UserAvatar username={row.username} avatarUrl={row.avatarUrl} size="sm" />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 min-w-0">
            <UserName
              userId={row.id}
              username={row.username}
              role={row.role}
              className="text-label font-medium"
            />
            <StatusPill status={row.status} />
            {linkedToAuthor && (
              <Tip
                tip="This account acted from an address the author also acted from"
                labelsChild={false}
              >
                <span className="inline-flex items-center gap-1 rounded-full bg-warning/15 px-2 py-0.5 text-meta font-medium text-warning">
                  <Link2 className="h-3 w-3" />
                  Linked to author
                </span>
              </Tip>
            )}
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

        {rows.length > 0 && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <Tip
              tip="Reads the network record behind these likes. Every check is written to the admin log."
              labelsChild={false}
            >
              <Button variant="outline" size="sm" onClick={() => void runAudit()} disabled={isAuditing}>
                <Fingerprint className="mr-2 h-4 w-4" />
                {isAuditing ? 'Auditing…' : audited ? 'Audit again' : 'Audit the likes'}
              </Button>
            </Tip>

            {audited && (
              <p className="text-meta text-muted-foreground">
                {audited.groups.length === 0 && audited.linkedToAuthor === 0
                  ? 'No two of these accounts share a network address.'
                  : [
                      audited.groups.length > 0
                        && `${audited.groups.length} ${audited.groups.length === 1 ? 'group shares' : 'groups share'} an address`,
                      audited.linkedToAuthor > 0
                        && `${audited.linkedToAuthor} ${audited.linkedToAuthor === 1 ? 'liker shares' : 'likers share'} one with the author`,
                    ].filter(Boolean).join(' · ')}
              </p>
            )}
          </div>
        )}

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
            {audited ? (
              <div className="space-y-3 pr-3">
                {audited.groups.map(([groupId, members]) => (
                  <div key={groupId} className="rounded-md border border-warning/50 bg-warning/5 p-2">
                    {/* The finding stated plainly, because a border alone does not say what it means. */}
                    <p className="mb-2 text-meta font-semibold uppercase tracking-wider text-warning">
                      {members.length} accounts share a network address
                    </p>
                    <ul className="space-y-2">{members.map(likerListItem)}</ul>
                  </div>
                ))}
                <ul className="space-y-2">{audited.alone.map(likerListItem)}</ul>
              </div>
            ) : (
              <ul className="space-y-2 pr-3">{rows.map(likerListItem)}</ul>
            )}
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
