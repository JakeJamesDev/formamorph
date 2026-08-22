import { useMemo, useState } from 'react';
import { Megaphone, Trophy } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { MarkdownRenderer } from '@/components/game/MarkdownRenderer';
import { EventPosterBand } from '@/components/events/EventPosterBand';
import MessageService from '@/services/MessageService';
import { eventPhase, isContestEvent, phaseMessageId, placementsOf, resultsAnnounced } from '@/lib/serverEvents';
import { isEventAcknowledged, markEventAcknowledged } from '@/lib/eventSeenStore';
import { useEventProse } from '@/lib/useEventProse';
import type { ServerEvent } from '@/types';

interface EventAckModalProps {
  /** The events to announce; the first one not yet acknowledged on this device is shown. */
  events: ServerEvent[];
  /** Whether a session is signed in, which is what decides if the linked broadcast can be marked read. */
  isAuthenticated: boolean;
  /** Open the place the event's content lives — the contest tab, for a contest. */
  onOpenEvent?: (event: ServerEvent) => void;
  /**
   * Hold the poster back while something else has the screen — the first-run intro animation.
   *
   * A poster that lands over the intro asks for attention before the menu it belongs to has arrived. It
   * is a hold rather than a delay: with no intro playing there is nothing to wait for, so a returning
   * player still gets it as soon as the menu is up.
   */
  held?: boolean;
}

/**
 * The poster a player is shown once per event phase: what started, or how it ended.
 *
 * It closes only by being acknowledged — no backdrop click, no Escape, no X — because its whole job is
 * to be seen rather than scrolled past. Acknowledgment is per-device, so it works signed out; a signed-in
 * player's acknowledgment also marks the event's broadcast read, so the inbox badge agrees with what
 * they just read.
 */
export function EventAckModal({ events, isAuthenticated, onOpenEvent, held = false }: EventAckModalProps) {
  // Acknowledgments made in this session, alongside the ones this device already had: keeping both
  // means answering one poster reveals the next rather than emptying the queue.
  const [acknowledged, setAcknowledged] = useState<string[]>([]);

  const unacknowledged = useMemo(
    () => events.find((candidate) => {
      const key = `${candidate.id}:${eventPhase(candidate)}`;
      return !acknowledged.includes(key) && !isEventAcknowledged(candidate.id, eventPhase(candidate));
    }) ?? null,
    [events, acknowledged],
  );

  // The poster is the one player-facing surface that shows an event's body, and the archive it may come
  // from is served without one — so the body is read back for the poster actually about to be shown.
  // It waits for that read the same way it waits for the intro: acknowledging is once and for good, and
  // a poster answered in the moment before its body landed is a body nobody ever sees.
  const { event, pending } = useEventProse(unacknowledged, !held);

  if (!event || held || pending) return null;

  const phase = eventPhase(event);
  const contest = isContestEvent(event);
  const Icon = phase === 'end' ? Trophy : Megaphone;

  const decided = resultsAnnounced(event);
  const [gold] = placementsOf(event);

  const eyebrow = phase === 'end'
    ? (decided ? 'Results Announced' : 'This Event Has Ended')
    : (contest ? 'A Contest Has Started' : 'An Announcement');

  const title = phase === 'end' && decided && gold
    ? `“${gold.worldName}” by ${gold.authorName}`
    : event.title;

  const acknowledge = () => {
    markEventAcknowledged(event.id, phase);
    setAcknowledged((prev) => [...prev, `${event.id}:${phase}`]);

    const messageId = phaseMessageId(event, phase);
    if (!isAuthenticated || !messageId) return;
    // The badge agreeing is a courtesy; failing to mark it read leaves an unread broadcast, which is
    // recoverable from the inbox and not worth interrupting the acknowledgment for.
    void MessageService.markRead(messageId).catch((error: unknown) => {
      console.error('Failed to mark the event broadcast read:', error);
    });
  };

  return (
    <Dialog open onOpenChange={() => { /* acknowledge-only: see the component doc */ }}>
      <DialogContent
        hideClose
        aria-describedby={undefined}
        className="max-w-md p-0 gap-0 overflow-hidden"
        onEscapeKeyDown={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <EventPosterBand
          event={event}
          icon={Icon}
          eyebrow={eyebrow}
          title={<DialogTitle className="text-display font-semibold text-balance">{title}</DialogTitle>}
        />
        <div className="flex flex-col gap-4 px-6 py-5">
          {/* The organizer writes this in the same markdown editor world prose is written in, so it is
              read the same way rather than as the symbols they typed. */}
          <div className="text-label text-muted-foreground">
            <MarkdownRenderer text={event.body ?? ''} />
          </div>
          <div className="flex justify-end gap-2">
            {contest && onOpenEvent && (
              <Button
                variant="outline"
                onClick={() => { acknowledge(); onOpenEvent(event); }}
              >
                {decided ? 'See The Results' : 'View Entries'}
              </Button>
            )}
            <Button onClick={acknowledge}>Got It</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
