import { Clock, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import type { WorldRecord } from "@/components/WorldDetails";
import { isQuarantined, quarantineDaysLeft, quarantineDeadline } from "@/lib/quarantine";
import { MODERATION_LABELS, PENDING_REVIEW_HINT, moderationStatus } from "@/lib/listingModeration";

interface ModerationMarkerProps {
  listing: WorldRecord;
  /** Whether a staff quarantine of an approved listing shows too, beside the review states. */
  showStaffQuarantine?: boolean;
  className?: string;
}

/**
 * The box that says a listing is not live: waiting for review, resubmitted, or quarantined.
 *
 * Only the author and the staff receive these listings, so the deadline is stated plainly.
 */
export function ModerationMarker({ listing, showStaffQuarantine = true, className }: ModerationMarkerProps) {
  const status = moderationStatus(listing);

  if (status === 'pending') {
    return (
      <div className={cn("rounded-md border border-border bg-muted/50 px-2 py-1 text-meta", className)}>
        <p className="flex items-center gap-1 font-medium">
          <Clock className="h-3 w-3 shrink-0" aria-hidden /> {MODERATION_LABELS.pending}
        </p>
        <p className="text-muted-foreground">{PENDING_REVIEW_HINT}</p>
      </div>
    );
  }

  const resubmitted = status === 'resubmitted';
  if (!resubmitted && status !== 'rejected' && !(showStaffQuarantine && isQuarantined(listing))) return null;

  const deadline = quarantineDeadline(listing);
  const daysLeft = quarantineDaysLeft(listing);
  const Icon = resubmitted ? Clock : ShieldAlert;

  return (
    <div className={cn("rounded-md border border-warning/40 bg-warning/10 px-2 py-1 text-meta", className)}>
      <p className="flex items-center gap-1 font-medium text-warning">
        <Icon className="h-3 w-3 shrink-0" aria-hidden /> {MODERATION_LABELS[resubmitted ? 'resubmitted' : 'rejected']}
      </p>
      {deadline && (
        <p className="text-muted-foreground">
          Deleted on {deadline}{daysLeft !== null && ` — ${daysLeft} day${daysLeft === 1 ? '' : 's'} left`}
        </p>
      )}
    </div>
  );
}
