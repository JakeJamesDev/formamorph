import { useEffect, useState } from "react";
import { Check, Download, ExternalLink, Trophy, X } from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { PendingUpdateTable } from "@/components/community/PendingUpdateTable";
import { Meta } from "@/components/ui/typography";
import { DetailTags } from "@/components/WorldDetails";
import { UserName } from "@/components/UserName";
import { KIND_LABELS } from "@/lib/catalogKinds";
import { REVIEW_TYPE_LABELS, waitedFor } from "@/lib/listingModeration";
import { quarantineDeadline } from "@/lib/quarantine";
import { formatServerDateTime } from "@/lib/serverDate";
import { useMountedRef } from "@/lib/useMountedRef";
import { cn } from "@/lib/utils";
import WorldStorageService, { type ListingDetails } from "@/services/WorldStorageService";
import type { ReviewQueueItem } from "@/services/ReviewService";

interface ReviewItemDialogProps {
  item: ReviewQueueItem | null;
  onOpenChange: (open: boolean) => void;
  /** Whether the staff ladder lets this viewer decide on the item. */
  canDecide: boolean;
  /** Disables the actions while one is being recorded. */
  busy: boolean;
  onApprove: () => void;
  onReject: () => void;
  onDownload: () => void;
  /** Opens the listing in Community Creations. Absent hides the button. */
  onOpenListing?: () => void;
}

/** One waiting item: what it is, who sent it, the listing as it stands, and the decision. */
export function ReviewItemDialog({
  item, onOpenChange, canDecide, busy, onApprove, onReject, onDownload, onOpenListing,
}: ReviewItemDialogProps) {
  const [details, setDetails] = useState<ListingDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const mounted = useMountedRef();
  const id = item?.id;

  useEffect(() => {
    setDetails(null);
    if (!id) return;

    const controller = new AbortController();
    setLoading(true);
    void WorldStorageService.readListingDetails(id, controller.signal).then((read) => {
      if (!mounted.current || controller.signal.aborted) return;
      setDetails(read.status === 'ok' ? read.details : null);
      setLoading(false);
    });

    return () => controller.abort();
  }, [id, mounted]);

  const deadline = item ? quarantineDeadline({ quarantine_expires_at: item.quarantineExpiresAt }) : null;
  const update = item?.type === 'update' ? item.pendingUpdate : undefined;
  const liveThumbnail = details?.thumbnailFile ? WorldStorageService.thumbnailUrl(details.thumbnailFile) : undefined;

  return (
    <Dialog open={item !== null} onOpenChange={onOpenChange}>
      <DialogContent className={cn("max-h-[85dvh] flex flex-col", update ? "sm:max-w-[720px]" : "sm:max-w-[560px]")}>
        {item && (
          <>
            <DialogHeader className="shrink-0">
              <DialogTitle className="truncate">{item.name}</DialogTitle>
              <DialogDescription>
                {KIND_LABELS[item.kind]?.one ?? 'Listing'} by{' '}
                <UserName userId={item.author?.id} username={item.author?.username ?? 'Deleted account'} />
                {' · '}{REVIEW_TYPE_LABELS[item.type]}{' · '}waiting {waitedFor(item.queuedAt)}
              </DialogDescription>
            </DialogHeader>

            <ScrollArea className="flex-1 min-h-0">
              <div className="space-y-3 min-w-0">
                {item.contest && (
                  <p className="flex items-center gap-1.5 text-meta text-info">
                    <Trophy className="h-3.5 w-3.5 shrink-0" /> Entered in {item.contest.title}
                  </p>
                )}
                {deadline && (
                  <p className="text-meta text-warning">Deleted on {deadline} unless a mod approves it</p>
                )}

                {update ? (
                  loading ? <Skeleton className="h-32 w-full" /> : (
                    <PendingUpdateTable update={update} liveThumbnail={liveThumbnail} approvedChangelog={details?.changelog} />
                  )
                ) : loading ? (
                  <Skeleton className="h-32 w-full" />
                ) : details ? (
                  <div className="flex gap-3 min-w-0">
                    {liveThumbnail && (
                      <img
                        src={liveThumbnail}
                        alt={item.name}
                        className="h-28 w-28 shrink-0 rounded-md object-cover"
                      />
                    )}
                    <div className="min-w-0 space-y-2">
                      <p className="text-helper whitespace-pre-wrap break-words line-clamp-6">
                        {details.description || 'No description'}
                      </p>
                      <DetailTags tags={details.tags ?? []} />
                    </div>
                  </div>
                ) : (
                  <Meta as="p">The listing details didn’t load</Meta>
                )}

                <Meta as="p">Submitted {formatServerDateTime(item.createdAt)}</Meta>
              </div>
            </ScrollArea>

            <DialogFooter className="shrink-0 flex-col-reverse gap-2 sm:flex-row sm:justify-between">
              <div className="flex flex-col-reverse gap-2 sm:flex-row">
                {canDecide && (
                  <Button variant="outline" onClick={onReject} disabled={busy} className="gap-1.5">
                    <X className="h-4 w-4" /> Reject
                  </Button>
                )}
              </div>
              <div className="flex flex-col-reverse gap-2 sm:flex-row">
                {/* An update with no new content has nothing to download. */}
                {(item.type !== 'update' || item.pendingUpdate?.content_changed) && (
                  <Button variant="outline" onClick={onDownload} className="gap-1.5">
                    <Download className="h-4 w-4" /> Download
                  </Button>
                )}
                {onOpenListing && (
                  <Button variant="outline" onClick={onOpenListing} className="gap-1.5">
                    <ExternalLink className="h-4 w-4" /> Open Listing
                  </Button>
                )}
                {canDecide && (
                  <Button onClick={onApprove} disabled={busy} className="gap-1.5">
                    <Check className="h-4 w-4" /> Approve
                  </Button>
                )}
              </div>
            </DialogFooter>

            {!canDecide && (
              <Meta as="p">Another staff member decides on this one</Meta>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
