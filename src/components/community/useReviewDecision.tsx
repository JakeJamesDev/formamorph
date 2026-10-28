import { useState, type ReactNode } from "react";
import { toast } from "react-toastify";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { QuarantineDialog } from "@/components/community/QuarantineDialog";
import { MessageComposerDialog } from "@/components/menu/MessageComposerDialog";
import { KIND_LABELS } from "@/lib/catalogKinds";
import { JUDGING_APPROVAL_TOAST, rejectedUpdateTemplate } from "@/lib/listingModeration";
import { toastError } from "@/lib/linkToast";
import { quarantineTargetFor, quarantineTemplate, type QuarantineTarget } from "@/lib/quarantine";
import { canModerate, type AccountLike } from "@/lib/roles";
import { useMountedRef } from "@/lib/useMountedRef";
import AuthService from "@/services/AuthService";
import ReviewService, {
  CONTEST_LOCKED, ReviewConflictError, type ReviewOutcome, type ReviewRejection, type ReviewSubject,
} from "@/services/ReviewService";

interface ReviewDecisionOptions {
  /** Called once per decision that settles where the item goes, before the composer opens. A rejection
   *  passes the server's answer. */
  onOutcome: (subject: ReviewSubject, outcome: ReviewOutcome, rejection?: ReviewRejection) => void;
  /** Who decides. Defaults to the signed-in account. */
  viewer?: AccountLike | null;
}

/** The noun an item's kind reads as, capitalized. */
export const nounOf = (subject: ReviewSubject) => (KIND_LABELS[subject.kind]?.one ?? 'Listing');

/**
 * Approve and reject a waiting listing: the quarantine length for a new listing, the confirm for anything
 * else, the 409 conflicts, and the composer to the author afterwards. Render `dialogs` once.
 */
export function useReviewDecision({ onOutcome, viewer }: ReviewDecisionOptions) {
  const [busyId, setBusyId] = useState<string | null>(null);
  // A new listing picks its quarantine length; anything else confirms first.
  const [quarantining, setQuarantining] = useState<ReviewSubject | null>(null);
  const [confirming, setConfirming] = useState<ReviewSubject | null>(null);
  // The composer's recipient and text after a rejection.
  const [notice, setNotice] = useState<{ author: QuarantineTarget['author']; subject: string; body: string } | null>(null);
  const mounted = useMountedRef();

  const me = viewer === undefined ? AuthService.getCurrentUser() : viewer;

  // The server's ladder, plus its one extra rule: staff never review their own work.
  const mayDecide = (subject: ReviewSubject) => subject.author?.id !== me?.id && canModerate(me, subject.author
    ? { id: subject.author.id, accountType: subject.author.role ?? 'normal' }
    : null);

  const report = (subject: ReviewSubject, outcome: ReviewOutcome, rejection?: ReviewRejection) => {
    if (outcome !== 'kept') setQuarantining((prev) => (prev?.id === subject.id ? null : prev));
    onOutcome(subject, outcome, rejection);
  };

  /** Runs a decision and sorts its `409`s: a contest lock keeps the item, any other conflict drops it. */
  const decide = async <T,>(
    subject: ReviewSubject, run: () => Promise<T>, outcome: ReviewOutcome, failure: string,
    rejectionOf?: (result: T) => ReviewRejection,
  ): Promise<T | null> => {
    setBusyId(subject.id);
    try {
      const result = await run();
      if (!mounted.current) return null;
      report(subject, outcome, rejectionOf?.(result));
      return result;
    } catch (error) {
      if (!mounted.current) return null;
      if (error instanceof ReviewConflictError && error.code === CONTEST_LOCKED) {
        toast.info(JUDGING_APPROVAL_TOAST);
        report(subject, 'kept');
      } else if (error instanceof ReviewConflictError) {
        toast.info('Another mod already handled this item');
        report(subject, 'dropped');
      } else {
        toastError(error, failure);
      }
      return null;
    } finally {
      if (mounted.current) setBusyId(null);
    }
  };

  const approve = async (subject: ReviewSubject) => {
    const done = await decide(subject, () => ReviewService.approve(subject.id).then(() => true), 'approved', 'Failed to approve this');
    if (done) toast.success(`${nounOf(subject)} approved`);
  };

  const reject = async (subject: ReviewSubject, days?: number) => {
    const result = await decide(subject, () => ReviewService.reject(subject.id, days), 'rejected', 'Failed to reject this', (answer) => answer);
    if (!result) return;

    toast.success(subject.type === 'update' ? 'Update rejected' : `${nounOf(subject)} rejected`);

    // Opened at once, as after a quarantine: a rejection the author never hears about reads as a bug.
    const target = quarantineTargetFor({
      kind: subject.kind,
      name: subject.name,
      author: result.author,
      quarantine_expires_at: result.quarantineExpiresAt,
    }, me?.id as string | undefined);
    if (!target) return;
    const notified = { ...target, extended: result.quarantineExtended === true };
    const template = subject.type === 'update' ? rejectedUpdateTemplate(notified) : quarantineTemplate(notified);
    setNotice({ author: target.author, ...template });
  };

  /** Opens the quarantine length for a new listing, the confirm for an update or a resubmission. */
  const startReject = (subject: ReviewSubject) => {
    if (subject.type === 'new') setQuarantining(subject);
    else setConfirming(subject);
  };

  const dialogs: ReactNode = (
    <>
      <QuarantineDialog
        open={quarantining !== null}
        onOpenChange={(open) => { if (!open) setQuarantining(null); }}
        what={quarantining ? `The ${nounOf(quarantining).toLowerCase()} “${quarantining.name}”` : ''}
        willNotifyAuthor={Boolean(quarantining?.author && quarantining.author.id !== me?.id)}
        busy={busyId !== null}
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
      {notice && (
        <MessageComposerDialog
          open
          onOpenChange={(open) => { if (!open) setNotice(null); }}
          target={{ broadcast: false, recipients: [notice.author] }}
          adminUsername={String(me?.username || 'Admin')}
          initialSubject={notice.subject}
          initialBody={notice.body}
          initialSeverity="warning"
        />
      )}
    </>
  );

  return { busyId, mayDecide, approve, startReject, dialogs };
}
