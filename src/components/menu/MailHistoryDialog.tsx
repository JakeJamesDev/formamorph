import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Hint, Meta } from "@/components/ui/typography";
import { FiguresTable } from "@/components/menu/UsageTab";
import { describeError } from "@/lib/errorDetails";
import { instantLabel } from "@/lib/usageReport";
import { useMountedRef } from "@/lib/useMountedRef";
import MailHistoryService, { type MailHistory, type MailHistoryApi, type MailHistoryRow, type MailKind, type MailStatus } from "@/services/MailHistoryService";
import type { EmailMarker } from "@/types";

const KIND_LABELS: Record<MailKind, string> = { verify: 'Verification', reset: 'Password Reset', alert: 'Alert' };
const STATUS_LABELS: Record<MailStatus, string> = {
  sent: 'Sent',
  delayed: 'Delayed',
  delivered: 'Delivered',
  bounced: 'Bounced',
  complained: 'Marked as Spam',
};

/** A row's result as words, with a bounce's type: `Bounced (hard)`. */
function resultLabel(mail: MailHistoryRow): string {
  const status = STATUS_LABELS[mail.status] ?? mail.status;
  return mail.status === 'bounced' && mail.bounceType ? `${status} (${mail.bounceType})` : status;
}

const MARKER_REASONS: Record<EmailMarker, string> = {
  bounce: 'Mail to this address bounced',
  complaint: 'The user marked mail from us as spam',
};

interface MailHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  username: string;
  /** Whether the viewer may clear this account's bounce. Hides the action when false. */
  mayClear: boolean;
  api?: MailHistoryApi;
}

/** One account's mail and address marker, opened from a row in the Users tab. The address never shows. */
export function MailHistoryDialog({ open, onOpenChange, userId, username, mayClear, api = MailHistoryService }: MailHistoryDialogProps) {
  const [history, setHistory] = useState<MailHistory | null>(null);
  const [readFailure, setReadFailure] = useState<string | null>(null);
  const [clearFailure, setClearFailure] = useState<string | null>(null);
  /** `already` when the server found no marker, as when another staff member cleared it first. */
  const [cleared, setCleared] = useState<'cleared' | 'already' | null>(null);
  const [clearing, setClearing] = useState(false);
  const clearController = useRef<AbortController | null>(null);
  const mounted = useMountedRef();

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    setHistory(null);
    setReadFailure(null);
    setClearFailure(null);
    setCleared(null);
    setClearing(false);
    api.fetchMailHistory(userId, controller.signal)
      .then((data) => { if (!controller.signal.aborted && mounted.current) setHistory(data); })
      .catch((error: unknown) => {
        if (controller.signal.aborted || !mounted.current) return;
        setReadFailure(describeError(error, 'Failed to read the mail history').message);
      });
    return () => {
      controller.abort();
      clearController.current?.abort();
    };
  }, [open, userId, api, mounted]);

  const clearBounce = useCallback(async () => {
    const controller = new AbortController();
    clearController.current = controller;
    setClearing(true);
    setClearFailure(null);
    try {
      const removed = await api.clearEmailMarker(userId, controller.signal);
      if (controller.signal.aborted || !mounted.current) return;
      setHistory((current) => (current ? { ...current, emailMarker: null, emailMarkedAt: null } : current));
      setCleared(removed ? 'cleared' : 'already');
    } catch (error: unknown) {
      if (controller.signal.aborted || !mounted.current) return;
      setClearFailure(describeError(error, 'Failed to clear the bounce').message);
    } finally {
      if (!controller.signal.aborted && mounted.current) setClearing(false);
    }
  }, [api, userId, mounted]);

  const marker = history?.emailMarker ?? null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[720px] max-h-[85dvh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{`Mail History for ${username}`}</DialogTitle>
          <DialogDescription>Verification, password reset and alert mail sent to this account, newest first.</DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 min-h-0">
          <div className="grid gap-4 py-2 min-w-0">
            {readFailure !== null ? (
              <Meta role="alert">{`The mail history could not be read: ${readFailure}`}</Meta>
            ) : !history ? (
              <Skeleton className="h-24 w-full" />
            ) : (
              <>
                {marker && (
                  <section aria-label="Address marker" className="grid gap-2 rounded-md border bg-card p-3">
                    <div className="text-label font-medium">{MARKER_REASONS[marker] ?? marker}</div>
                    {history.emailMarkedAt && <Meta as="div">{`Since ${instantLabel(history.emailMarkedAt)} UTC`}</Meta>}
                    {mayClear ? (
                      <div>
                        <Button size="sm" variant="outline" disabled={clearing} onClick={() => void clearBounce()}>
                          {clearing ? 'Clearing…' : 'Clear Bounce'}
                        </Button>
                      </div>
                    ) : (
                      <Hint>Only an admin can clear this account&apos;s bounce</Hint>
                    )}
                    {clearFailure !== null && <Meta role="alert">{`The bounce was not cleared: ${clearFailure}`}</Meta>}
                  </section>
                )}
                {cleared && (
                  <Meta role="status">
                    {cleared === 'cleared'
                      ? `The bounce is cleared. ${username} must verify their address again.`
                      : 'The bounce was already cleared.'}
                  </Meta>
                )}

                {history.mails.length === 0 ? (
                  <Meta>This account has no mail on record.</Meta>
                ) : (
                  <FiguresTable
                    label="Mail"
                    minWidth="32rem"
                    rows={history.mails}
                    rowKey={(mail) => `${mail.kind}-${mail.sentAt}-${mail.statusAt}-${mail.status}`}
                    columns={[
                      { label: 'Mail', left: true, cell: (mail) => KIND_LABELS[mail.kind] ?? mail.kind },
                      { label: 'Sent', cell: (mail) => instantLabel(mail.sentAt) },
                      { label: 'Result', cell: (mail) => resultLabel(mail) },
                      { label: 'Updated', cell: (mail) => instantLabel(mail.statusAt) },
                    ]}
                  />
                )}
                {history.mails.length > 0 && <Hint>All times are UTC. Updated is when the result last changed.</Hint>}
              </>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
