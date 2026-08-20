import { Trophy } from 'lucide-react';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { formatServerDate } from '@/lib/serverDate';
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
 */
export function ContestRulesDialog({ contest, open, onOpenChange }: ContestRulesDialogProps) {
  const dates = `${formatServerDate(contest.startsAt)} – ${formatServerDate(contest.endsAt)}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-warning" aria-hidden /> {contest.title}
          </DialogTitle>
          <DialogDescription>{dates}</DialogDescription>
        </DialogHeader>
        <p className="text-label text-muted-foreground whitespace-pre-line">{contest.bannerText}</p>
        {contest.rulesText && (
          <p className="text-label whitespace-pre-line">{contest.rulesText}</p>
        )}
      </DialogContent>
    </Dialog>
  );
}
