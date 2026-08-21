import { Trophy } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { MarkdownRenderer } from '@/components/game/MarkdownRenderer';
import { EventPosterBand } from '@/components/events/EventPosterBand';
import type { ServerEvent } from '@/types';

interface ContestRulesDialogProps {
  contest: ServerEvent;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * What a contest asks of its entrants, in one dialog.
 *
 * Shared by the two places rules are read: above the entries, and beside the switch that enters one. An
 * author agrees to these by publishing into the contest, so the wording they see at that moment has to
 * be the same wording the tab shows everyone else.
 *
 * It opens under the poster's own header band, organizer color and all, so the rules are visibly the
 * same event the poster announced rather than a second thing with the same name.
 */
export function ContestRulesDialog({ contest, open, onOpenChange }: ContestRulesDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby={undefined} className="max-w-md p-0 gap-0 overflow-hidden">
        <EventPosterBand
          event={contest}
          icon={Trophy}
          eyebrow="Contest Rules"
          title={<DialogTitle className="text-display font-semibold text-balance">{contest.title}</DialogTitle>}
        />
        <div className="flex flex-col gap-3 px-6 py-5">
          {/* One line by construction, so it stays plain — the rules under it are the authored prose. */}
          <p className="text-label text-muted-foreground">{contest.bannerText}</p>
          {contest.rulesText && (
            <div className="text-label">
              <MarkdownRenderer text={contest.rulesText} />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
