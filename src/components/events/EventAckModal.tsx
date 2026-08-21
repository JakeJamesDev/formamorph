import { useMemo, useState } from 'react';
import { Calendar, Megaphone, Trophy } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import MessageService from '@/services/MessageService';
import { formatServerDate } from '@/lib/serverDate';
import { eventPhase, hasWinner, isContestEvent, phaseMessageId } from '@/lib/serverEvents';
import { isEventAcknowledged, markEventAcknowledged } from '@/lib/eventSeenStore';
import type { ServerEvent } from '@/types';

interface EventAckModalProps {
  /** The events to announce; the first one not yet acknowledged on this device is shown. */
  events: ServerEvent[];
  /** Whether a session is signed in, which is what decides if the linked broadcast can be marked read. */
  isAuthenticated: boolean;
  /** Open the place the event's content lives — the contest tab, for a contest. */
  onOpenEvent?: (event: ServerEvent) => void;
}

/**
 * The poster a player is shown once per event phase: what started, or how it ended.
 *
 * It closes only by being acknowledged — no backdrop click, no Escape, no X — because its whole job is
 * to be seen rather than scrolled past. Acknowledgment is per-device, so it works signed out; a signed-in
 * player's acknowledgment also marks the event's broadcast read, so the inbox badge agrees with what
 * they just read.
 */
export function EventAckModal({ events, isAuthenticated, onOpenEvent }: EventAckModalProps) {
  // Acknowledgments made in this session, alongside the ones this device already had: keeping both
  // means answering one poster reveals the next rather than emptying the queue.
  const [acknowledged, setAcknowledged] = useState<string[]>([]);

  const event = useMemo(
    () => events.find((candidate) => {
      const key = `${candidate.id}:${eventPhase(candidate)}`;
      return !acknowledged.includes(key) && !isEventAcknowledged(candidate.id, eventPhase(candidate));
    }) ?? null,
    [events, acknowledged],
  );

  if (!event) return null;

  const phase = eventPhase(event);
  const contest = isContestEvent(event);
  const Icon = phase === 'end' ? Trophy : Megaphone;

  const decided = hasWinner(event);

  const eyebrow = phase === 'end'
    ? (decided ? 'Winner Announced' : 'This Event Has Ended')
    : (contest ? 'A Contest Has Started' : 'An Announcement');

  const title = phase === 'end' && decided
    ? `“${event.winnerName}”${event.winnerAuthorName ? ` by ${event.winnerAuthorName}` : ''}`
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
        <div className="flex flex-col items-center gap-2 bg-info text-info-foreground px-6 pt-8 pb-5 text-center">
          <Icon className="h-10 w-10" aria-hidden />
          <div className="text-meta font-semibold uppercase tracking-wider">{eyebrow}</div>
          <DialogTitle className="text-display font-semibold text-balance">{title}</DialogTitle>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-info-foreground/15 px-3 py-1 text-meta">
            <Calendar className="h-3 w-3" aria-hidden />
            {formatServerDate(event.startsAt)} – {formatServerDate(event.endsAt)}
          </span>
        </div>
        <div className="flex flex-col gap-4 px-6 py-5">
          <p className="text-label text-muted-foreground whitespace-pre-line">{event.body}</p>
          <div className="flex justify-end gap-2">
            {contest && onOpenEvent && (
              <Button
                variant="outline"
                onClick={() => { acknowledge(); onOpenEvent(event); }}
              >
                {decided ? 'See The Winner' : 'View Entries'}
              </Button>
            )}
            <Button onClick={acknowledge}>Got It</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
