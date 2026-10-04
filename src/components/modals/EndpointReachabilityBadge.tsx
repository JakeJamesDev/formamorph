import { useEndpointReachable, type ReachabilityTarget } from '@/lib/useEndpointReachable';
import type { EndpointProbe } from '@/lib/useAiReachable';
import { cn } from '@/lib/utils';

/**
 * One probe outcome as a dot, a line and Recheck. `unknownModel` is a reachable server that can't serve the
 * configured model, so it reads as a warning rather than an outage. A null `status` while not checking is
 * "Not checked".
 */
export function EndpointReachabilityView({ status, checking, model, onRecheck }: {
  status: EndpointProbe | null;
  checking: boolean;
  model: string;
  onRecheck: () => void;
}) {
  const state = checking
    ? { dot: 'bg-muted-foreground animate-pulse', text: 'Checking…', tone: 'text-muted-foreground' }
    : status === 'ok'
      ? { dot: 'bg-success', text: 'Reachable', tone: 'text-muted-foreground' }
      : status === 'unknownModel'
        ? {
          dot: 'bg-warning',
          text: model.trim() ? `Reachable, but no "${model}"` : 'Reachable, but no model',
          tone: 'text-warning',
        }
        : status === 'unreachable'
          ? { dot: 'bg-destructive', text: "Didn't answer", tone: 'text-destructive' }
          : { dot: 'bg-muted-foreground', text: 'Not checked', tone: 'text-muted-foreground' };

  return (
    <div className="flex min-w-0 items-center gap-2 text-meta">
      <span aria-hidden className={cn('size-2 shrink-0 rounded-full', state.dot)} />
      <span className={cn('min-w-0 truncate', state.tone)}>{state.text}</span>
      <button
        type="button"
        onClick={onRecheck}
        disabled={checking}
        className="shrink-0 text-muted-foreground underline underline-offset-2 hover:text-foreground disabled:opacity-50"
      >
        Recheck
      </button>
    </div>
  );
}

/** Whether one named endpoint is actually answering. A disabled target draws nothing and sends no probe. */
export function EndpointReachabilityBadge({ target }: { target: ReachabilityTarget }) {
  const { status, checking, recheck } = useEndpointReachable(
    target.url, target.apiToken, target.model, target.enabled, target.provider ?? 'text',
  );
  if (!target.enabled) return null;
  return <EndpointReachabilityView status={status} checking={checking} model={target.model} onRecheck={recheck} />;
}
