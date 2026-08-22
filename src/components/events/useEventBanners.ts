/**
 * The dismissed-or-not state a stack of event banners shares between its two surfaces.
 *
 * Its own module because the cards and the chips render in different places on the page, so the answer
 * cannot live inside either of them.
 */
import { useCallback, useState } from 'react';
import { eventPhase, isContestEvent } from '@/lib/serverEvents';
import { parseServerDate } from '@/lib/serverDate';
import { isEventBannerDismissed, markEventBannerDismissed } from '@/lib/eventSeenStore';
import type { ServerEvent } from '@/types';

/**
 * The two surfaces of a stack of banners and the state they share.
 *
 * Cards and chips render in different places on the page — the chips fold into a host's existing top
 * row — so the dismissed answer lives here rather than inside a card, and collapsing one moves it from
 * the first list to the second in the same render.
 */
export interface EventBanners {
  /** The events still showing as a full card, in reading order. */
  cards: ServerEvent[];
  /** The events collapsed to a chip, in the same order. */
  chips: ServerEvent[];
  /** Collapse an event's card to its chip, and remember it on this device. */
  dismiss: (event: ServerEvent) => void;
  /** Put a collapsed event's card back, for this session only. */
  expand: (event: ServerEvent) => void;
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
 * What the dismissal is keyed by: id *and* phase, so an event that reaches its ending is announced
 * again, however thoroughly its opening was dismissed.
 */
function bannerKey(event: ServerEvent): string {
  return `${event.id}:${eventPhase(event)}`;
}

/**
 * Splits the running events into the ones still showing a card and the ones collapsed to a chip.
 *
 * The answer is read straight out of storage rather than settled by an effect after the first paint,
 * which would flash the full card at everyone who dismissed it. This session's clicks override it.
 *
 * @param events - Everything running; an empty list yields two empty lists
 */
export function useEventBanners(events: ServerEvent[]): EventBanners {
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});

  const collapsed = (event: ServerEvent) => (
    overrides[bannerKey(event)] ?? isEventBannerDismissed(event.id, eventPhase(event))
  );

  const override = useCallback((event: ServerEvent, value: boolean) => {
    setOverrides((prev) => ({ ...prev, [bannerKey(event)]: value }));
  }, []);

  const ordered = bannerOrder(events);

  return {
    cards: ordered.filter((event) => !collapsed(event)),
    chips: ordered.filter(collapsed),
    dismiss: useCallback((event: ServerEvent) => {
      markEventBannerDismissed(event.id, eventPhase(event));
      override(event, true);
    }, [override]),
    expand: useCallback((event: ServerEvent) => override(event, false), [override]),
  };
}

