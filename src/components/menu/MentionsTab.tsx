import { useCallback, useEffect, useState } from "react";
import { ArrowRight, MessageSquareQuote } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Meta } from "@/components/ui/typography";
import { derivedLabelRows, entityLabel, passageRuns, reviewedCorrections, ruleLabel, shownQuote } from "@/lib/coref/contributionReview";
import { formatServerDateTime } from "@/lib/serverDate";
import { toastError } from "@/lib/linkToast";
import { useMountedRef } from "@/lib/useMountedRef";
import { cn } from "@/lib/utils";
import CorefContributionService, { type ContributionDecision, type CorefContribution } from "@/services/CorefContributionService";

interface MentionsTabProps {
  /** Whether the tab is visible; the queue only fetches while it is. */
  active: boolean;
  /** Runs after an accept or a reject, so the count can refresh. */
  onChanged?: () => void;
}

function ContributionItem({ item, busy, onDecide }: {
  item: CorefContribution;
  busy: boolean;
  onDecide: (item: CorefContribution, action: ContributionDecision) => void;
}) {
  const corrections = reviewedCorrections(item);
  const derived = derivedLabelRows(item);
  const label = (id: string | null, none: string) => (id === null ? none : entityLabel(item.entityNames, id));
  return (
    <li className="rounded-lg border border-border p-3 min-w-0 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Meta as="p">
          by {item.contributorUsername ?? 'Deleted account'} · {formatServerDateTime(item.createdAt)} · {item.modelId} model v{item.modelVersion}
        </Meta>
        {item.changesLabels === false && <Badge variant="outline">No label change</Badge>}
      </div>
      <p className="whitespace-pre-wrap rounded-md bg-muted/40 p-2 text-body">
        {passageRuns(item.passage, corrections).map((run, i) => (run.corrected
          ? <mark key={i} className="rounded-sm bg-primary/20 text-foreground">{run.text}</mark>
          : <span key={i}>{run.text}</span>))}
      </p>
      <ul className="space-y-1" aria-label="Corrections">
        {corrections.map((c) => {
          const shown = c.kind === 'quote' ? shownQuote(item, c.start, c.end) : null;
          return (
            <li key={`${c.kind}:${c.start}:${c.end}`} className="flex flex-wrap items-center gap-1.5 text-helper min-w-0">
              <span className="font-semibold">{c.kind === 'quote' ? 'Quote' : 'Mention'}</span>
              {/* A quote span holds its own quotation marks. */}
              <span className="truncate max-w-[16rem]">{c.kind === 'quote' ? c.text : `“${c.text}”`}</span>
              {c.kind !== 'quote' && <span className="text-muted-foreground">{label(c.from, 'Unlinked')}</span>}
              {shown && (
                <span className="text-muted-foreground">
                  {label(shown.speakerId, 'No speaker')} · {ruleLabel(shown.rule)}
                </span>
              )}
              <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-label="corrected to" />
              <span>{c.kind === 'nonMention' ? 'Not a Character' : label(c.to, 'Not Listed')}</span>
            </li>
          );
        })}
      </ul>
      {derived.length > 0 && (
        <div className="space-y-1">
          <Meta as="p">From quote fixes</Meta>
          <ul className="space-y-1" aria-label="Derived labels">
            {derived.map((d) => (
              <li key={`${d.start}:${d.end}`} className="flex flex-wrap items-center gap-1.5 text-helper min-w-0">
                <span className="truncate max-w-[16rem]">{`“${d.text}”`}</span>
                <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-label="labeled as" />
                <span>{label(d.entityId, 'Not Listed')}</span>
                {d.wholeCluster && <span className="text-muted-foreground">and its whole cluster</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="flex items-center justify-between gap-2">
        <Button variant="outline" size="sm" disabled={busy} onClick={() => onDecide(item, 'reject')}>Reject</Button>
        <Button size="sm" disabled={busy} onClick={() => onDecide(item, 'accept')}>Accept</Button>
      </div>
    </li>
  );
}

/** Admin Panel → Moderation → Mentions. Contributed Character Mentions corrections, oldest first. */
export function MentionsTab({ active, onChanged }: MentionsTabProps) {
  const [items, setItems] = useState<CorefContribution[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  // A failed read must not read as an empty queue.
  const [failed, setFailed] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  // Pending rows that change no label, counted by the server across the whole queue.
  const [noChange, setNoChange] = useState(0);
  const [confirmingBulk, setConfirmingBulk] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  const mounted = useMountedRef();

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const [queue, counts] = await Promise.all([CorefContributionService.fetchQueue(), CorefContributionService.fetchCounts()]);
      if (!mounted.current) return;
      setItems(queue);
      setNoChange(counts.noChange);
      setFailed(false);
    } catch (error) {
      if (!mounted.current) return;
      setFailed(true);
      toastError(error, 'Failed to load the contributions');
    } finally {
      if (mounted.current) setIsLoading(false);
    }
  }, [mounted]);

  useEffect(() => {
    if (active) void load();
  }, [active, load]);

  const decide = useCallback(async (item: CorefContribution, action: ContributionDecision) => {
    setBusyId(item.id);
    try {
      await (action === 'accept' ? CorefContributionService.accept(item.id) : CorefContributionService.reject(item.id));
      if (!mounted.current) return;
      setItems((prev) => prev.filter((i) => i.id !== item.id));
      if (item.changesLabels === false) setNoChange((n) => Math.max(0, n - 1));
      onChanged?.();
    } catch (error) {
      if (mounted.current) toastError(error, `Failed to ${action} the contribution`);
    } finally {
      if (mounted.current) setBusyId(null);
    }
  }, [mounted, onChanged]);

  const rejectNoChange = useCallback(async () => {
    setBulkBusy(true);
    try {
      await CorefContributionService.rejectNoChange();
      if (!mounted.current) return;
      setConfirmingBulk(false);
      onChanged?.();
      await load();
    } catch (error) {
      if (mounted.current) toastError(error, 'Failed to reject the contributions');
    } finally {
      if (mounted.current) setBulkBusy(false);
    }
  }, [mounted, onChanged, load]);

  if (isLoading && items.length === 0) {
    return (
      <div className="py-4 space-y-2">
        {[0, 1, 2].map((row) => <Skeleton key={row} className="h-24 w-full" />)}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="py-12 text-center text-helper text-muted-foreground">
        <MessageSquareQuote className="mx-auto mb-2 h-6 w-6 opacity-50" />
        {failed ? 'The contributions didn’t load' : 'No contributions waiting'}
      </div>
    );
  }

  return (
    <div className={cn("py-4 space-y-2 min-w-0", isLoading && "opacity-60")}>
      <div className="flex flex-wrap items-center gap-2">
        {noChange > 0 && (
          <Button variant="outline" size="sm" disabled={bulkBusy} onClick={() => setConfirmingBulk(true)}>
            Reject {noChange} With No Label Change
          </Button>
        )}
        <Meta as="p">Corrected passages from players. Accepted passages join the training corpus.</Meta>
      </div>
      <ul className="space-y-2" aria-label="Mentions">
        {items.map((item) => (
          <ContributionItem key={item.id} item={item} busy={busyId === item.id} onDecide={(i, a) => void decide(i, a)} />
        ))}
      </ul>
      <AlertDialog open={confirmingBulk} onOpenChange={(isOpen) => { if (!isOpen && !bulkBusy) setConfirmingBulk(false); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject {noChange} {noChange === 1 ? 'contribution' : 'contributions'}?</AlertDialogTitle>
            <AlertDialogDescription>
              {noChange === 1 ? 'It changes' : 'They change'} no label.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkBusy}>Keep Them</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); void rejectNoChange(); }} disabled={bulkBusy}>
              Reject {noChange}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
