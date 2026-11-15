import { useCallback, useEffect, useState } from "react";
import { ArrowRight, MessageSquareQuote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Meta } from "@/components/ui/typography";
import { passageRuns, reviewedCorrections } from "@/lib/coref/contributionReview";
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
  return (
    <li className="rounded-lg border border-border p-3 min-w-0 space-y-2">
      <Meta as="p">
        by {item.contributorUsername ?? 'Deleted account'} · {formatServerDateTime(item.createdAt)} · {item.modelId} model v{item.modelVersion}
      </Meta>
      <p className="whitespace-pre-wrap rounded-md bg-muted/40 p-2 text-body">
        {passageRuns(item.passage, corrections).map((run, i) => (run.corrected
          ? <mark key={i} className="rounded-sm bg-primary/20 text-foreground">{run.text}</mark>
          : <span key={i}>{run.text}</span>))}
      </p>
      <ul className="space-y-1" aria-label="Corrections">
        {corrections.map((c) => (
          <li key={`${c.kind}:${c.start}:${c.end}`} className="flex flex-wrap items-center gap-1.5 text-helper min-w-0">
            <span className="font-semibold">{c.kind === 'quote' ? 'Quote' : 'Mention'}</span>
            {/* A quote span holds its own quotation marks. */}
            <span className="truncate max-w-[16rem]">{c.kind === 'quote' ? c.text : `“${c.text}”`}</span>
            {c.kind === 'mention' && <span className="text-muted-foreground">{c.from ?? 'Unlinked'}</span>}
            <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-label="corrected to" />
            <span>{c.to ?? 'Someone Else'}</span>
          </li>
        ))}
      </ul>
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
  const mounted = useMountedRef();

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const queue = await CorefContributionService.fetchQueue();
      if (!mounted.current) return;
      setItems(queue);
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
      onChanged?.();
    } catch (error) {
      if (mounted.current) toastError(error, `Failed to ${action} the contribution`);
    } finally {
      if (mounted.current) setBusyId(null);
    }
  }, [mounted, onChanged]);

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
      <Meta as="p">Corrected passages from players. Accepted passages join the training corpus.</Meta>
      <ul className="space-y-2" aria-label="Mentions">
        {items.map((item) => (
          <ContributionItem key={item.id} item={item} busy={busyId === item.id} onDecide={(i, a) => void decide(i, a)} />
        ))}
      </ul>
    </div>
  );
}
