import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "react-toastify";
import { Fingerprint, HeartOff, Link2, UserCheck, VenetianMask } from "lucide-react";
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
import type { AnonymousLikeRow, LikerAuditRow, LikerRow } from "@/types";

/** What the audit knows about one liker, once it has been asked for. Keyed by account id. */
type AuditMarks = Record<string, Pick<LikerAuditRow, 'groupId' | 'linkedToAuthor'>>;

/**
 * The Anonymous Likes from one address, which is the unit a removal acts on.
 *
 * A group the audit drew may span two addresses, so a box can hold more than one of these. A cluster
 * with no key is what the retention sweep left behind: rows to read, with nothing to remove them by.
 */
interface MarkCluster {
  addressKey: string | null;
  rows: AnonymousLikeRow[];
}

/** What the confirmation is standing in front of. One removal is in flight at a time. */
type Pending =
  | { kind: 'like'; row: LikerRow }
  | { kind: 'address'; addressKey: string; count: number }
  | { kind: 'all'; count: number };

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

/** "3 Anonymous Likes", or "1 Anonymous Like". */
const countMarks = (count: number) => `${count} Anonymous ${count === 1 ? 'Like' : 'Likes'}`;

/** What a box of rows sharing an address calls itself, counting whichever kinds are in it. */
const describeGroup = (accounts: number, marks: number) => {
  const parts = [
    accounts > 0 && `${accounts} ${accounts === 1 ? 'account' : 'accounts'}`,
    marks > 0 && countMarks(marks),
  ].filter(Boolean);

  return `${parts.join(' and ')} share a network address`;
};

/** Split rows into one cluster per address, with the keyless ones gathered at the end. */
const clusterByAddress = (marks: AnonymousLikeRow[]): MarkCluster[] => {
  const byKey = new Map<string, AnonymousLikeRow[]>();
  const keyless: AnonymousLikeRow[] = [];

  for (const mark of marks) {
    if (!mark.addressKey) {
      keyless.push(mark);
      continue;
    }
    if (!byKey.has(mark.addressKey)) byKey.set(mark.addressKey, []);
    byKey.get(mark.addressKey)?.push(mark);
  }

  const clusters: MarkCluster[] = [...byKey].map(([addressKey, rows]) => ({ addressKey, rows }));
  if (keyless.length > 0) clusters.push({ addressKey: null, rows: keyless });

  return clusters;
};

/**
 * Who liked a listing. Staff only.
 *
 * A list rather than a table: the fields are a person, not a record, and the one thing staff are reading
 * for — a run of accounts made minutes before they liked — reads down a column of phrases far faster
 * than it does across a row of timestamps.
 *
 * Anonymous Likes are half of what the listing's number counts, so they sit in the same groups the
 * accounts do. They carry no name to read, and the address they came from is the only thing that ties
 * one to anything else on the screen.
 */
export function LikersDialog({
  open, onOpenChange, listingId, listingName, currentUser, onLikesChanged,
}: LikersDialogProps) {
  const [rows, setRows] = useState<LikerRow[]>([]);
  const [total, setTotal] = useState(0);
  /** How many Anonymous Likes the listing has, as the server last counted them. */
  const [anonymous, setAnonymous] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** The removal awaiting confirmation, or null. */
  const [pending, setPending] = useState<Pending | null>(null);
  /** What the audit found, or null while nobody has asked for it. */
  const [marks, setMarks] = useState<AuditMarks | null>(null);
  /** The Anonymous Like rows the audit sent, capped by the server. Empty until it is asked. */
  const [anonymousRows, setAnonymousRows] = useState<AnonymousLikeRow[]>([]);
  const [isAuditing, setIsAuditing] = useState(false);
  /** Which listing is on screen. An audit that answers for any other one is about something else. */
  const shown = useRef<string | null>(null);

  useEffect(() => {
    if (!open || !listingId) return;

    let cancelled = false;
    shown.current = listingId;
    setRows([]);
    setTotal(0);
    setAnonymous(0);
    setError(null);
    setMarks(null);
    setAnonymousRows([]);
    setIsAuditing(false);
    setIsLoading(true);

    WorldStorageService.fetchLikers(listingId)
      .then((result) => {
        if (cancelled) return;
        setRows(result.rows);
        setTotal(result.total);
        setAnonymous(result.anonymous);
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
  const runAudit = useCallback(async () => {
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
      setAnonymous(result.anonymous);
      setAnonymousRows(result.anonymousRows);
      setMarks(Object.fromEntries(result.rows.map((row: LikerAuditRow) => [
        row.id,
        { groupId: row.groupId, linkedToAuthor: row.linkedToAuthor },
      ])));
    } catch (e) {
      if (shown.current === asked) toast.error((e as Error).message || 'Failed to audit these likes');
    } finally {
      if (shown.current === asked) setIsAuditing(false);
    }
  }, [listingId]);

  /**
   * Take Anonymous Likes off the listing, by address or all of them.
   *
   * Both numbers on screen come from the answer rather than from arithmetic here: another moderator may
   * have been working the same listing, and an answer of nothing removed means they got there first. The
   * rows are then read again rather than reported as a failure.
   */
  const removeMarks = async (action: Pending) => {
    if (!listingId || action.kind === 'like') return;

    const asked = listingId;
    try {
      const result = action.kind === 'all'
        ? await WorldStorageService.removeAnonymousLikes(asked)
        : await WorldStorageService.removeAnonymousLikeGroup(asked, action.addressKey);

      if (shown.current !== asked) return;

      setAnonymous(result.anonymous);
      onLikesChanged?.(result.likes);

      if (result.removed === 0) {
        void runAudit();
        return;
      }

      setAnonymousRows((prev) => (action.kind === 'all'
        ? []
        : prev.filter((row) => row.addressKey !== action.addressKey)));
    } catch (e) {
      if (shown.current === asked) {
        toast.error((e as Error).message || 'Failed to remove those Anonymous Likes');
      }
    }
  };

  /**
   * The rows in reading order once audited: each shared-address group whole, then everybody else.
   *
   * Group sizes are counted over the rows still on screen rather than taken from the answer, so a group
   * a removal cut down to one row stops being a group without asking the server again. Anonymous Likes
   * count toward a group the same way accounts do.
   */
  const audited = useMemo(() => {
    if (!marks) return null;

    const size = new Map<number, number>();
    const count = (id: number | null | undefined) => {
      if (typeof id === 'number') size.set(id, (size.get(id) ?? 0) + 1);
    };
    for (const row of rows) count(marks[row.id]?.groupId);
    for (const mark of anonymousRows) count(mark.groupId);

    /** A group number only means something while two rows still hold it. */
    const grouped = (id: number | null | undefined): id is number =>
      typeof id === 'number' && (size.get(id) ?? 0) >= 2;

    const members = new Map<number, LikerRow[]>();
    const alone: LikerRow[] = [];
    for (const row of rows) {
      const id = marks[row.id]?.groupId;
      if (!grouped(id)) {
        alone.push(row);
        continue;
      }
      if (!members.has(id)) members.set(id, []);
      members.get(id)?.push(row);
    }

    const groupMarks = new Map<number, AnonymousLikeRow[]>();
    const aloneMarks: AnonymousLikeRow[] = [];
    for (const mark of anonymousRows) {
      if (!grouped(mark.groupId)) {
        aloneMarks.push(mark);
        continue;
      }
      if (!groupMarks.has(mark.groupId)) groupMarks.set(mark.groupId, []);
      groupMarks.get(mark.groupId)?.push(mark);
    }

    const ids = [...new Set([...members.keys(), ...groupMarks.keys()])].sort((a, b) => a - b);

    return {
      groups: ids.map((id) => ({
        id,
        members: members.get(id) ?? [],
        clusters: clusterByAddress(groupMarks.get(id) ?? []),
      })),
      alone,
      aloneClusters: clusterByAddress(aloneMarks),
      linkedToAuthor: rows.filter((row) => marks[row.id]?.linkedToAuthor).length,
    };
  }, [marks, rows, anonymousRows]);

  /** The badge both kinds of row wear when their address is the author's too. */
  const linkedBadge = (tip: string) => (
    <Tip tip={tip} labelsChild={false}>
      <span className="inline-flex items-center gap-1 rounded-full bg-warning/15 px-2 py-0.5 text-meta font-medium text-warning">
        <Link2 className="h-3 w-3" />
        Linked to author
      </span>
    </Tip>
  );

  /** One liker, the same row in both readings of the list. */
  const likerListItem = (row: LikerRow) => {
    const fresh = isFreshAccount(row.accountAgeAtLikeSeconds);
    const linkedToAuthor = marks?.[row.id]?.linkedToAuthor ?? false;

    return (
      <li
        key={row.id}
        data-fresh={fresh || undefined}
        data-linked-to-author={linkedToAuthor || undefined}
        data-claimed={row.claimedAt ? 'true' : undefined}
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
            {linkedToAuthor
              && linkedBadge('This account acted from an address the author also acted from')}
            {row.claimedAt && (
              <Tip
                tip="Given while signed out, then claimed onto this account"
                labelsChild={false}
              >
                <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-meta font-medium text-muted-foreground">
                  <UserCheck className="h-3 w-3" />
                  Claimed
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
          {/* The press above is the original one. This is when it arrived on the account. */}
          {row.claimedAt && (
            <p className="text-meta text-muted-foreground">
              Claimed {formatServerDateTime(row.claimedAt)}
            </p>
          )}
        </div>

        {mayRemove(row) && (
          <Tip tip="Remove this like">
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0 text-muted-foreground hover:text-destructive"
              aria-label={`Remove the like by ${row.username}`}
              onClick={() => setPending({ kind: 'like', row })}
            >
              <HeartOff className="h-4 w-4" />
            </Button>
          </Tip>
        )}
      </li>
    );
  };

  /** One Anonymous Like: a time, a browser family, and whatever the grouping made of it. */
  const markListItem = (mark: AnonymousLikeRow, index: number) => (
    <li
      key={`${mark.addressKey ?? 'ungrouped'}-${mark.likedAt}-${index}`}
      data-anonymous="true"
      data-linked-to-author={mark.linkedToAuthor || undefined}
      className="flex items-center gap-3 rounded-md border border-dashed bg-background p-2 min-w-0"
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <VenetianMask className="h-4 w-4" />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          <span className="text-label font-medium">Anonymous Like</span>
          {mark.linkedToAuthor
            && linkedBadge('This like came from an address the author also acted from')}
        </div>
        <p className="text-meta text-muted-foreground">
          Liked {formatServerDateTime(mark.likedAt)}
          {mark.browserFamily ? ` — ${mark.browserFamily}` : ''}
        </p>
      </div>
    </li>
  );

  /** The Anonymous Likes from one address, with the action that takes them off. */
  const markClusterBlock = ({ addressKey, rows: marked }: MarkCluster, index: number) => (
    <div key={addressKey ?? `ungrouped-${index}`} className="space-y-2">
      <ul className="space-y-2">{marked.map(markListItem)}</ul>
      {addressKey ? (
        <Button
          variant="outline"
          size="sm"
          className="text-destructive"
          onClick={() => setPending({ kind: 'address', addressKey, count: marked.length })}
        >
          <HeartOff className="mr-2 h-4 w-4" />
          Remove {countMarks(marked.length)} from this address
        </Button>
      ) : (
        // Past ninety days the sweep has emptied the hash, so there is no address left to act on.
        <p className="text-meta text-muted-foreground">
          {marked.length === 1 ? 'This one is' : 'These are'} too old to name an address for.
        </p>
      )}
    </div>
  );

  const confirmation = () => {
    if (!pending) return { title: '', description: '' };
    if (pending.kind === 'like') {
      return {
        title: 'Remove this like?',
        description: `The like by ${pending.row.username} comes off this listing and the count drops by one. They can like it again.`,
      };
    }
    if (pending.kind === 'address') {
      return {
        title: 'Remove these Anonymous Likes?',
        description: `${countMarks(pending.count)} from this address come off this listing. No account like is touched.`,
      };
    }
    return {
      title: 'Remove every Anonymous Like?',
      description: `All ${countMarks(pending.count)} come off this listing, including the ones the audit cannot group. No account like is touched.`,
    };
  };

  const hasLikes = rows.length > 0 || anonymous > 0;
  const { title: confirmTitle, description: confirmDescription } = confirmation();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle className="truncate">
            Who liked {listingName ? `“${listingName}”` : 'this'}
          </DialogTitle>
          {/* The total rather than the row count: the server caps the list, and a listing with more
              likes than the cap is exactly the one somebody came here about. The anonymous count sits
              beside it because the room's number is the two added together. */}
          <DialogDescription>
            {isLoading && rows.length === 0
              ? 'Reading the likes…'
              : `${total} ${total === 1 ? 'like' : 'likes'}${rows.length < total ? `, showing the newest ${rows.length}` : ''}${anonymous > 0 ? ` · ${anonymous} anonymous` : ''}`}
          </DialogDescription>
        </DialogHeader>

        {hasLikes && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <Tip
              tip="Groups these likes by the network address they came from"
              labelsChild={false}
            >
              <Button variant="outline" size="sm" onClick={() => void runAudit()} disabled={isAuditing}>
                <Fingerprint className="mr-2 h-4 w-4" />
                {isAuditing ? 'Auditing…' : audited ? 'Audit again' : 'Audit the likes'}
              </Button>
            </Tip>

            {anonymous > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="text-destructive"
                onClick={() => setPending({ kind: 'all', count: anonymous })}
              >
                <HeartOff className="mr-2 h-4 w-4" />
                Remove all Anonymous Likes
              </Button>
            )}

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

            {/* The server caps the audit too, and a flood is exactly the case that reaches the cap. */}
            {audited && anonymous > anonymousRows.length && (
              <p className="text-meta text-muted-foreground">
                Showing the newest {anonymousRows.length} of {anonymous} Anonymous Likes.
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
        ) : !hasLikes ? (
          <p className="py-6 text-center text-helper text-muted-foreground">Nobody has liked this yet.</p>
        ) : (
          <ScrollArea className="h-[19rem]">
            {audited ? (
              <div className="space-y-3 pr-3">
                {audited.groups.map((group) => (
                  <div key={group.id} className="space-y-2 rounded-md border border-warning/50 bg-warning/5 p-2">
                    {/* The finding stated plainly, because a border alone does not say what it means. */}
                    <p className="text-meta font-semibold uppercase tracking-wider text-warning">
                      {describeGroup(
                        group.members.length,
                        group.clusters.reduce((sum, cluster) => sum + cluster.rows.length, 0)
                      )}
                    </p>
                    {group.members.length > 0 && (
                      <ul className="space-y-2">{group.members.map(likerListItem)}</ul>
                    )}
                    {group.clusters.map(markClusterBlock)}
                  </div>
                ))}
                {audited.alone.length > 0 && (
                  <ul className="space-y-2">{audited.alone.map(likerListItem)}</ul>
                )}
                {audited.aloneClusters.map(markClusterBlock)}
              </div>
            ) : (
              <ul className="space-y-2 pr-3">{rows.map(likerListItem)}</ul>
            )}
          </ScrollArea>
        )}

        <ConfirmDialog
          open={pending !== null}
          onOpenChange={(isOpen) => { if (!isOpen) setPending(null); }}
          title={confirmTitle}
          description={confirmDescription}
          onConfirm={() => {
            const action = pending;
            setPending(null);
            if (!action) return;
            if (action.kind === 'like') void remove(action.row);
            else void removeMarks(action);
          }}
          onCancel={() => setPending(null)}
        />
      </DialogContent>
    </Dialog>
  );
}
