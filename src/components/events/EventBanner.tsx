import { Megaphone, Trophy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { formatServerDate } from '@/lib/serverDate';
import { eventChipMarker, eventPhase, isContestEvent, placementsOf, resultsAnnounced } from '@/lib/serverEvents';
import type { EventBanners } from './useEventBanners';
import type { ServerEvent } from '@/types';

interface SurfaceProps {
  /** The shared state, from `useEventBanners`. */
  banners: EventBanners;
  /** Open the place the event's content lives — the contest tab, for a contest. */
  onOpenEvent?: (event: ServerEvent) => void;
  /** Applied to each card, or to the chip cluster, so a host with its own padding can drop theirs. */
  className?: string;
}

/**
 * A contest is the celebratory one; anything else is a notice. Both are severity tokens, so the palette
 * handles either theme rather than a variant here.
 */
function bannerIcon(event: ServerEvent) {
  return isContestEvent(event) ? Trophy : Megaphone;
}

/**
 * The card announcing a running event: the title, its window and a blurb, plus what to do about it.
 *
 * An event this client doesn't have a type for renders as a plain announcement — every field it reads
 * is generic, and only a known type earns the extra action.
 */
function EventBannerCard(
  { event, onOpenEvent, onDismiss, className }:
  { event: ServerEvent; onOpenEvent?: (event: ServerEvent) => void; onDismiss: () => void; className?: string },
) {
  const contest = isContestEvent(event);
  const Icon = bannerIcon(event);

  const dateRange = `${formatServerDate(event.startsAt)} – ${formatServerDate(event.endsAt)}`;
  const [gold] = placementsOf(event);
  const line = eventPhase(event) === 'end' && resultsAnnounced(event)
    ? `Results announced${gold ? ` — ${gold.worldName} by ${gold.authorName}` : ''}`
    : `${dateRange} · ${event.bannerText}`;

  // The whole card leads where its own action does: a contest's entries. An announcement has nowhere to
  // be sent, so its body is inert rather than a navigation to nothing — and never a second Dismiss.
  const open = contest && onOpenEvent ? () => onOpenEvent(event) : undefined;

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
        <Button variant="outline" size="sm" onClick={onDismiss}>Dismiss</Button>
        {contest && onOpenEvent && (
          <Button size="sm" onClick={() => onOpenEvent(event)}>View Entries</Button>
        )}
      </div>
    </div>
  );
}

/** The collapsed form of one banner: a chip naming the event and how it stands. */
function EventBannerChip({ event, onClick }: { event: ServerEvent; onClick: () => void }) {
  const contest = isContestEvent(event);
  const Icon = bannerIcon(event);
  const marker = eventChipMarker(event);

  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex min-w-0 items-center gap-2 rounded-full border bg-card pl-3 pr-1.5 py-1 text-label font-medium shadow-sm hover:bg-accent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
    >
      <Icon className={cn('h-4 w-4 shrink-0', contest ? 'text-warning' : 'text-info')} aria-hidden />
      {/* Capped well short of the card's title: this rides a row of controls that were there first, so a
          long event name gives way to them rather than pushing one onto a second line. */}
      <span className="truncate max-w-[8rem]">{event.title}</span>
      {marker && (
        <span className={cn('rounded-full px-2 py-0.5 text-meta font-bold', contest ? 'bg-warning/20 text-warning' : 'bg-info/20 text-info')}>{marker}</span>
      )}
    </button>
  );
}

/**
 * Every running event still showing a card, stacked one card per event.
 *
 * All of them rather than the first: a contest and an announcement can run at once, and showing only
 * one hid whichever the server listed second. Nothing renders once they have all been dismissed — the
 * chips they collapsed to live in the host's top row instead, so this row costs nothing when empty.
 */
export function EventBanner({ banners, onOpenEvent, className }: SurfaceProps) {
  if (banners.cards.length === 0) return null;

  return (
    <div className="shrink-0">
      {banners.cards.map((event) => (
        <EventBannerCard
          key={event.id}
          event={event}
          onOpenEvent={onOpenEvent}
          onDismiss={() => banners.dismiss(event)}
          className={className}
        />
      ))}
    </div>
  );
}

/**
 * The dismissed banners as chips, for a host to drop into a row it already has.
 *
 * A contest chip is the way back to its entries; an announcement has nowhere else to go, so its chip
 * re-opens the card it was collapsed from, which reappears wherever the cards render.
 */
export function EventBannerChips({ banners, onOpenEvent, className }: SurfaceProps) {
  if (banners.chips.length === 0) return null;

  return (
    <div className={cn('flex min-w-0 items-center gap-2', className)}>
      {banners.chips.map((event) => (
        <EventBannerChip
          key={event.id}
          event={event}
          onClick={() => (isContestEvent(event) && onOpenEvent ? onOpenEvent(event) : banners.expand(event))}
        />
      ))}
    </div>
  );
}
