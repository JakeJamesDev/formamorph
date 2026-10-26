import { useCallback, useEffect, useState } from "react";
import { toast } from "react-toastify";
import { ClipboardCheck, Trophy } from "lucide-react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Meta } from "@/components/ui/typography";
import { QuarantineDialog } from "@/components/community/QuarantineDialog";
import { MessageComposerDialog } from "@/components/menu/MessageComposerDialog";
import { ReviewItemDialog } from "@/components/menu/ReviewItemDialog";
import { KIND_LABELS } from "@/lib/catalogKinds";
import { downloadBlob } from "@/lib/downloadBlob";
import {
  JUDGING_APPROVAL_TOAST, REVIEW_TYPE_LABELS, rejectedUpdateTemplate, waitedFor,
} from "@/lib/listingModeration";
import { toastError } from "@/lib/linkToast";
import { quarantineDeadline, quarantineTargetFor, quarantineTemplate, type QuarantineTarget } from "@/lib/quarantine";
import { canModerate } from "@/lib/roles";
import { useMountedRef } from "@/lib/useMountedRef";
import { cn } from "@/lib/utils";
import AuthService from "@/services/AuthService";
import ReviewService, { CONTEST_LOCKED, ReviewConflictError, type ReviewQueueItem } from "@/services/ReviewService";

interface ReviewTabProps {
  /** Whether the tab is visible; the queue only fetches while it is. */
  active: boolean;
  /** Opens a listing in Community Creations. Absent hides Open Listing. */
  onOpenListing?: (listingId: string) => void;
  /** Called after an item leaves the queue, so the panel can re-read its count. */
  onChanged?: () => void;
  /** Opens this item's dialog once the queue loads; the dev-router's `pick`. */
  initialItemId?: string;
}

/** The noun an item's kind reads as, capitalized. */
const nounOf = (item: ReviewQueueItem) => (KIND_LABELS[item.kind]?.one ?? 'Listing');

/**
 * Admin Panel → Moderation → Review. New listings and updates that wait for a mod, in the server's
 * order: contest entries first, then the longest-waiting.
 */
export function ReviewTab({ active, onOpenListing, onChanged, initialItemId }: ReviewTabProps) {
  const [items, setItems] = useState<ReviewQueueItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // A new listing picks its quarantine length; anything else confirms first.
  const [quarantining, setQuarantining] = useState<ReviewQueueItem | null>(null);
  const [confirming, setConfirming] = useState<ReviewQueueItem | null>(null);
  // Who the composer writes to after a rejection; an update gets its own template.
  const [notice, setNotice] = useState<(QuarantineTarget & { update?: boolean }) | null>(null);
  const mounted = useMountedRef();

  const me = AuthService.getCurrentUser();
  const openItem = items.find((item) => item.id === openId) ?? null;

  // The server's ladder, plus its one extra rule: staff never review their own work.
  const mayDecide = (item: ReviewQueueItem) => item.author?.id !== me?.id && canModerate(me, item.author
    ? { id: item.author.id, accountType: item.author.role ?? 'normal' }
    : null);

  const load = useCallback(async (signal: AbortSignal) => {
    setIsLoading(true);
    try {
      const queue = await ReviewService.fetchQueue(signal);
      if (!mounted.current || signal.aborted) return;
      setItems(queue);
      if (initialItemId && queue.some((item) => item.id === initialItemId)) setOpenId(initialItemId);
    } catch (error) {
      if (!mounted.current || signal.aborted) return;
      toastError(error, 'Failed to load the review queue');
    } finally {
      if (mounted.current && !signal.aborted) setIsLoading(false);
    }
  }, [initialItemId, mounted]);

  useEffect(() => {
    if (!active) return;
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [active, load]);

  /** Takes an item off the list once the server has decided it, by this mod or another. */
  const dropItem = (item: ReviewQueueItem) => {
    setItems((prev) => prev.filter((row) => row.id !== item.id));
    setOpenId((prev) => (prev === item.id ? null : prev));
    setQuarantining((prev) => (prev?.id === item.id ? null : prev));
    onChanged?.();
  };

  /**
   * Runs a decision. A `409` means another mod got there first, so the row goes, unless a contest being
   * judged holds an update's approval: then the row stays.
   */
  const decide = async <T,>(item: ReviewQueueItem, run: () => Promise<T>, failure: string): Promise<T | null> => {
    setBusy(true);
    try {
      const result = await run();
      if (!mounted.current) return null;
      dropItem(item);
      return result;
    } catch (error) {
      if (!mounted.current) return null;
      if (error instanceof ReviewConflictError && error.code === CONTEST_LOCKED) {
        toast.info(JUDGING_APPROVAL_TOAST);
      } else if (error instanceof ReviewConflictError) {
        toast.info('Another mod already handled this item');
        dropItem(item);
      } else {
        toastError(error, failure);
      }
      return null;
    } finally {
      if (mounted.current) setBusy(false);
    }
  };

  const approve = async (item: ReviewQueueItem) => {
    const done = await decide(item, () => ReviewService.approve(item.id).then(() => true), 'Failed to approve this');
    if (done) toast.success(`${nounOf(item)} approved`);
  };

  const reject = async (item: ReviewQueueItem, days?: number) => {
    const result = await decide(item, () => ReviewService.reject(item.id, days), 'Failed to reject this');
    if (!result) return;

    toast.success(item.type === 'update' ? 'Update rejected' : `${nounOf(item)} rejected`);

    // Opened at once, as after a quarantine: a rejection the author never hears about reads as a bug.
    const target = quarantineTargetFor({
      kind: item.kind,
      name: item.name,
      author: result.author,
      quarantine_expires_at: result.quarantineExpiresAt,
    }, me?.id as string | undefined);
    if (target) setNotice({ ...target, extended: result.quarantineExtended === true, update: item.type === 'update' });
  };

  const download = async (item: ReviewQueueItem) => {
    try {
      const content = await ReviewService.fetchContent(item.id);
      if (!mounted.current) return;
      downloadBlob(new Blob([JSON.stringify(content, null, 2)], { type: 'application/json' }), `${item.name || nounOf(item)}.json`);
    } catch (error) {
      if (mounted.current) toastError(error, 'Failed to download the content');
    }
  };

  const startReject = (item: ReviewQueueItem) => {
    if (item.type === 'new') setQuarantining(item);
    else setConfirming(item);
  };

  const template = notice?.update ? rejectedUpdateTemplate(notice) : notice ? quarantineTemplate(notice) : null;

  const dialogs = (
    <>
      <ReviewItemDialog
        item={openItem}
        onOpenChange={(open) => { if (!open) setOpenId(null); }}
        canDecide={openItem ? mayDecide(openItem) : false}
        busy={busy}
        onApprove={() => { if (openItem) void approve(openItem); }}
        onReject={() => { if (openItem) startReject(openItem); }}
        onDownload={() => { if (openItem) void download(openItem); }}
        onOpenListing={onOpenListing && openItem ? () => onOpenListing(openItem.id) : undefined}
      />

      <QuarantineDialog
        open={quarantining !== null}
        onOpenChange={(open) => { if (!open) setQuarantining(null); }}
        what={quarantining ? `The ${nounOf(quarantining).toLowerCase()} “${quarantining.name}”` : ''}
        willNotifyAuthor={Boolean(quarantining?.author && quarantining.author.id !== me?.id)}
        busy={busy}
        onConfirm={(days) => { if (quarantining) void reject(quarantining, days); }}
      />

      <ConfirmDialog
        open={confirming !== null}
        onOpenChange={(open) => { if (!open) setConfirming(null); }}
        title={`Reject “${confirming?.name ?? ''}”?`}
        description={confirming?.type === 'update'
          ? 'The update is dropped. Players keep the live version. You’ll write to the author next.'
          : 'It stays in quarantine and keeps its deadline. You’ll write to the author next.'}
        confirmLabel="Reject"
        destructive
        onConfirm={() => { if (confirming) void reject(confirming); }}
      />

      {/* Closing it sends nothing. */}
      {notice && template && (
        <MessageComposerDialog
          open
          onOpenChange={(open) => { if (!open) setNotice(null); }}
          target={{ broadcast: false, recipients: [notice.author] }}
          adminUsername={String(me?.username || 'Admin')}
          initialSubject={template.subject}
          initialBody={template.body}
          initialSeverity="warning"
        />
      )}
    </>
  );

  if (isLoading && items.length === 0) {
    return (
      <div className="py-4 space-y-2">
        {[0, 1, 2].map((row) => <Skeleton key={row} className="h-16 w-full" />)}
        {dialogs}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="py-12 text-center text-helper text-muted-foreground">
        <ClipboardCheck className="mx-auto mb-2 h-6 w-6 opacity-50" />
        Nothing waits for review
        {dialogs}
      </div>
    );
  }

  return (
    <div className={cn("py-4 space-y-2 min-w-0", isLoading && "opacity-60")}>
      <ul className="space-y-2" aria-label="Review Queue">
        {items.map((item) => {
          const deadline = quarantineDeadline({ quarantine_expires_at: item.quarantineExpiresAt });

          return (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => setOpenId(item.id)}
                className="w-full rounded-lg border border-border p-3 text-left hover:bg-muted/50 min-w-0"
              >
                <div className="flex items-start justify-between gap-2 min-w-0">
                  <h3 className="text-label font-semibold truncate">
                    {nounOf(item)}: {item.name}
                  </h3>
                  <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-meta">
                    {REVIEW_TYPE_LABELS[item.type]}
                  </span>
                </div>
                <Meta as="p">
                  by {item.author?.username ?? 'Deleted account'}
                  {' · '}waiting {waitedFor(item.queuedAt)}
                  {deadline && ` · deleted on ${deadline}`}
                </Meta>
                {item.contest && (
                  <p className="mt-1 flex items-center gap-1.5 text-meta text-info">
                    <Trophy className="h-3.5 w-3.5 shrink-0" /> Contest entry: {item.contest.title}
                  </p>
                )}
              </button>
            </li>
          );
        })}
      </ul>
      {dialogs}
    </div>
  );
}
