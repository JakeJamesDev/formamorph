import { useState } from 'react';
import { Megaphone, Trophy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { formatServerDate } from '@/lib/serverDate';
import { eventChipMarker, eventPhase, isContestEvent } from '@/lib/serverEvents';
import { isEventBannerDismissed, markEventBannerDismissed } from '@/lib/eventSeenStore';
import type { ServerEvent } from '@/types';

interface EventBannerProps {
  /** The events to announce; the first one is shown. Nothing renders when the list is empty. */
  events: ServerEvent[];
  /** Open the place the event's content lives — the contest tab, for a contest. */
  onOpenEvent?: (event: ServerEvent) => void;
  className?: string;
}

/**
 * The row announcing a running event: a card with the title, its window and a blurb, which the player
 * can collapse to a chip naming it. Read-only and public, so it shows signed out.
 *
 * An event this client doesn't have a type for renders as a plain announcement — every field it reads
 * is generic, and only a known type earns the extra action.
 */
export function EventBanner({ events, onOpenEvent, className }: EventBannerProps) {
  const event = events[0] ?? null;
  const phase = event ? eventPhase(event) : 'start';

  // What this render is showing, so the answer can be read straight out of storage rather than settled
  // by an effect after the first paint — which would flash the full card at everyone who dismissed it.
  // Keyed by phase as well as id: an event that reaches its ending is announced again, however
  // thoroughly its opening was dismissed.
  const key = event && `${event.id}:${phase}`;
  const [collapsed, setCollapsed] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  if (!event || !key) return null;

  const dismissed = expanded !== key && (collapsed === key || isEventBannerDismissed(event.id, phase));

  const contest = isContestEvent(event);
  const Icon = contest ? Trophy : Megaphone;
  // A contest is the celebratory one; anything else is a notice. Both are severity tokens, so the
  // palette handles both themes rather than a variant here.
  const marker = eventChipMarker(event);

  const dismiss = () => {
    markEventBannerDismissed(event.id, phase);
    setExpanded(null);
    setCollapsed(key);
  };

  if (dismissed) {
    return (
      <div className={cn('shrink-0 flex justify-end px-4 pb-2', className)}>
        <button
          type="button"
          // A contest chip is the way back to its entries; an announcement has nowhere else to go, so
          // its chip re-opens the card it was collapsed from.
          onClick={() => (contest && onOpenEvent ? onOpenEvent(event) : setExpanded(key))}
          className="inline-flex items-center gap-2 rounded-full border bg-card pl-3 pr-1.5 py-1 text-label font-medium shadow-sm hover:bg-accent transition-colors"
        >
          <Icon className={cn('h-4 w-4 shrink-0', contest ? 'text-warning' : 'text-info')} aria-hidden />
          <span className="truncate max-w-[14rem]">{event.title}</span>
          {marker && (
            <span className={cn('rounded-full px-2 py-0.5 text-meta font-bold', contest ? 'bg-warning/20 text-warning' : 'bg-info/20 text-info')}>{marker}</span>
          )}
        </button>
      </div>
    );
  }

  const dateRange = `${formatServerDate(event.startsAt)} – ${formatServerDate(event.endsAt)}`;
  const line = phase === 'end' && event.winnerName
    ? `Winner announced — ${event.winnerName}${event.winnerAuthorName ? ` by ${event.winnerAuthorName}` : ''}`
    : `${dateRange} · ${event.bannerText}`;

  return (
    <div
      className={cn(
        'shrink-0 mx-4 mb-3 flex flex-col sm:flex-row sm:items-center gap-3 rounded-lg border bg-card px-4 py-3',
        className,
      )}
    >
      <div className={cn('hidden sm:flex h-11 w-11 shrink-0 items-center justify-center rounded-lg', contest ? 'bg-warning/15 text-warning' : 'bg-info/15 text-info')}>
        <Icon className="h-6 w-6" aria-hidden />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-label font-semibold truncate">{event.title}</div>
        <div className="text-meta text-muted-foreground truncate">{line}</div>
      </div>
      <div className="flex shrink-0 gap-2">
        <Button variant="outline" size="sm" onClick={dismiss}>Dismiss</Button>
        {contest && onOpenEvent && (
          <Button size="sm" onClick={() => onOpenEvent(event)}>View Entries</Button>
        )}
      </div>
    </div>
  );
}
