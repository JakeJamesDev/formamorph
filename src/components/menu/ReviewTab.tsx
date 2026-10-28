import { useCallback, useEffect, useState } from "react";
import { ClipboardCheck, Trophy } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Meta } from "@/components/ui/typography";
import { nounOf, useReviewDecision } from "@/components/community/useReviewDecision";
import { ReviewItemDialog } from "@/components/menu/ReviewItemDialog";
import { downloadBlob } from "@/lib/downloadBlob";
import { REVIEW_TYPE_LABELS, waitedFor } from "@/lib/listingModeration";
import { toastError } from "@/lib/linkToast";
import { quarantineDeadline } from "@/lib/quarantine";
import { useMountedRef } from "@/lib/useMountedRef";
import { cn } from "@/lib/utils";
import ReviewService, { type ReviewQueueItem, type ReviewSubject } from "@/services/ReviewService";

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

/**
 * Admin Panel → Moderation → Review. New listings and updates that wait for a mod, in the server's
 * order: contest entries first, then the longest-waiting.
 */
export function ReviewTab({ active, onOpenListing, onChanged, initialItemId }: ReviewTabProps) {
  const [items, setItems] = useState<ReviewQueueItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const mounted = useMountedRef();

  const openItem = items.find((item) => item.id === openId) ?? null;

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
  const dropItem = (subject: ReviewSubject) => {
    setItems((prev) => prev.filter((row) => row.id !== subject.id));
    setOpenId((prev) => (prev === subject.id ? null : prev));
    onChanged?.();
  };

  const { busyId, mayDecide, approve, startReject, dialogs: decisionDialogs } = useReviewDecision({
    onOutcome: (subject, outcome) => { if (outcome !== 'kept') dropItem(subject); },
  });

  const download = async (item: ReviewQueueItem) => {
    try {
      const content = await ReviewService.fetchContent(item.id);
      if (!mounted.current) return;
      downloadBlob(new Blob([JSON.stringify(content, null, 2)], { type: 'application/json' }), `${item.name || nounOf(item)}.json`);
    } catch (error) {
      if (mounted.current) toastError(error, 'Failed to download the content');
    }
  };

  const dialogs = (
    <>
      <ReviewItemDialog
        item={openItem}
        onOpenChange={(open) => { if (!open) setOpenId(null); }}
        canDecide={openItem ? mayDecide(openItem) : false}
        busy={busyId !== null}
        onApprove={() => { if (openItem) void approve(openItem); }}
        onReject={() => { if (openItem) startReject(openItem); }}
        onDownload={() => { if (openItem) void download(openItem); }}
        onOpenListing={onOpenListing && openItem ? () => onOpenListing(openItem.id) : undefined}
      />

      {decisionDialogs}
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
