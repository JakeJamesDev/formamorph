import { useState } from 'react';
import { Megaphone, Trophy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { parseServerDate, formatServerDate } from '@/lib/serverDate';
import { eventChipMarker, eventPhase, hasWinner, isContestEvent } from '@/lib/serverEvents';
import { isEventBannerDismissed, markEventBannerDismissed } from '@/lib/eventSeenStore';
import type { ServerEvent } from '@/types';

interface EventBannerProps {
  /** The events to announce, one card each. Nothing renders when the list is empty. */
  events: ServerEvent[];
  /** Open the place the event's content lives — the contest tab, for a contest. */
  onOpenEvent?: (event: ServerEvent) => void;
  /** Applied to each card, so a host with its own padding can drop theirs. */
  className?: string;
}

/**
 * The reading order of a stack of banners: the contest first, then announcements oldest-started first.
 *
 * A contest is the one with a deadline attached to it, so it leads however many notices are running
 * alongside — and there is at most one, which the server enforces.
 */
function bannerOrder(events: ServerEvent[]): ServerEvent[] {
  return [...events].sort((a, b) => {
    const contest = Number(isContestEvent(b)) - Number(isContestEvent(a));
    if (contest !== 0) return contest;
    return (parseServerDate(a.startsAt)?.getTime() ?? 0) - (parseServerDate(b.startsAt)?.getTime() ?? 0);
  });
}

/**
 * The row announcing a running event: a card with the title, its window and a blurb, which the player
 * can collapse to a chip naming it. Read-only and public, so it shows signed out.
 *
 * An event this client doesn't have a type for renders as a plain announcement — every field it reads
 * is generic, and only a known type earns the extra action.
 */
function EventBannerCard(
  { event, onOpenEvent, className }: { event: ServerEvent; onOpenEvent?: (event: ServerEvent) => void; className?: string },
) {
  const phase = eventPhase(event);

  // What this render is showing, so the answer can be read straight out of storage rather than settled
  // by an effect after the first paint — which would flash the full card at everyone who dismissed it.
  // Keyed by phase as well as id: an event that reaches its ending is announced again, however
  // thoroughly its opening was dismissed.
  const key = `${event.id}:${phase}`;
  const [collapsed, setCollapsed] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

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
      <div className={cn('flex justify-end px-4 pb-2', className)}>
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
  const line = phase === 'end' && hasWinner(event)
    ? `Winner announced — ${event.winnerName}${event.winnerAuthorName ? ` by ${event.winnerAuthorName}` : ''}`
    : `${dateRange} · ${event.bannerText}`;

  // The whole card leads where its own action does: a contest's entries, an announcement's card back
  // open. Only the body is the target — the buttons beside it stop the click at themselves, so Dismiss
  // never doubles as the thing it is refusing.
  const open = () => (contest && onOpenEvent ? onOpenEvent(event) : setExpanded(key));

  return (
    <div className={cn('mx-4 mb-3 flex flex-col sm:flex-row sm:items-center gap-3 rounded-lg border bg-card px-4 py-3', className)}>
      <button
        type="button"
        onClick={open}
        className="flex flex-1 min-w-0 items-center gap-3 text-left rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
      >
        <span className={cn('hidden sm:flex h-11 w-11 shrink-0 items-center justify-center rounded-lg', contest ? 'bg-warning/15 text-warning' : 'bg-info/15 text-info')}>
          <Icon className="h-6 w-6" aria-hidden />
        </span>
        <span className="flex-1 min-w-0">
          <span className="block text-label font-semibold truncate">{event.title}</span>
          <span className="block text-meta text-muted-foreground truncate">{line}</span>
        </span>
      </button>
      <div className="flex shrink-0 gap-2">
        <Button variant="outline" size="sm" onClick={dismiss}>Dismiss</Button>
        {contest && onOpenEvent && (
          <Button size="sm" onClick={() => onOpenEvent(event)}>View Entries</Button>
        )}
      </div>
    </div>
  );
}

/**
 * Every running event, stacked one card per event.
 *
 * All of them rather than the first: a contest and an announcement can run at once, and showing only
 * one hid whichever the server listed second. Each card carries its own dismissed state, already keyed
 * per event in the store, so collapsing one leaves the rest standing.
 */
export function EventBanner({ events, onOpenEvent, className }: EventBannerProps) {
  if (events.length === 0) return null;

  return (
    <div className="shrink-0">
      {bannerOrder(events).map((event) => (
        <EventBannerCard key={event.id} event={event} onOpenEvent={onOpenEvent} className={className} />
      ))}
    </div>
  );
}
