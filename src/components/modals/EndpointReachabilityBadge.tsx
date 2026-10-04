import { useEndpointReachable, type ReachabilityTarget } from '@/lib/useEndpointReachable';
import { cn } from '@/lib/utils';

/**
 * Whether one named endpoint is actually answering. `unknownModel` is a reachable server that can't serve the
 * configured model, so it reads as a warning rather than an outage.
 */
export function EndpointReachabilityBadge({ target }: { target: ReachabilityTarget }) {
  const { status, checking, recheck } = useEndpointReachable(
    target.url, target.apiToken, target.model, target.enabled, target.provider ?? 'text',
  );
  if (!target.enabled) return null;

  const state = checking
    ? { dot: 'bg-muted-foreground animate-pulse', text: 'Checking…', tone: 'text-muted-foreground' }
    : status === 'ok'
      ? { dot: 'bg-success', text: 'Reachable', tone: 'text-muted-foreground' }
      : status === 'unknownModel'
        ? {
          dot: 'bg-warning',
          text: target.model.trim() ? `Reachable, but no "${target.model}"` : 'Reachable, but no model',
          tone: 'text-warning',
        }
        : status === 'unreachable'
          ? { dot: 'bg-destructive', text: "Didn't answer", tone: 'text-destructive' }
          : { dot: 'bg-muted-foreground', text: 'Not checked', tone: 'text-muted-foreground' };

  return (
    <div className="flex items-center gap-2 text-meta">
      <span aria-hidden className={cn('size-2 shrink-0 rounded-full', state.dot)} />
      <span className={state.tone}>{state.text}</span>
      <button
        type="button"
        onClick={recheck}
        disabled={checking}
        className="text-muted-foreground underline underline-offset-2 hover:text-foreground disabled:opacity-50"
      >
        Recheck
      </button>
    </div>
  );
}
