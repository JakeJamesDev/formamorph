import { useState } from 'react';
import { Trophy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ContestRulesDialog } from '@/components/community/ContestRulesDialog';
import { cn } from '@/lib/utils';
import { formatServerDate } from '@/lib/serverDate';
import type { ServerEvent } from '@/types';

interface ContestEntryCardProps {
  /** The contest taking entries. */
  contest: ServerEvent;
  /** Whether this publish is going in as an entry. */
  checked: boolean;
  onCheckedChange: (next: boolean) => void;
  /** The listing this author already has in the contest, when they have one. */
  enteredName?: string | null;
  /** Take that entry back out. Absent leaves the card's advice to be acted on elsewhere. */
  onWithdraw?: () => void;
  /** Whether a withdrawal is in flight, which quiets the control. */
  withdrawing?: boolean;
  /** A refusal the server gave, shown where the switch was. */
  error?: string | null;
}

/**
 * The opt-in that turns a publish into a contest entry.
 *
 * Entering is a decision about this upload rather than about the world, which is why it lives here and
 * not in the editor: the switch arms one publish, and the flag rides the request beside the tags rather
 * than inside the content.
 *
 * An author who already has an entry is told so instead of being offered a switch the server would
 * refuse. The rules sit behind the same dialog the contest tab shows, because publishing into a contest
 * is the moment they are agreed to.
 */
export function ContestEntryCard({
  contest, checked, onCheckedChange, enteredName, onWithdraw, withdrawing, error,
}: ContestEntryCardProps) {
  const [rulesOpen, setRulesOpen] = useState(false);
  // Either one takes the switch away: there is nothing this publish can still opt into.
  const armed = !enteredName && !error;

  return (
    <div
      className={cn(
        'mt-4 flex items-center gap-3 rounded-lg border p-3 transition-colors',
        checked && armed ? 'border-warning/60 bg-warning/10' : 'bg-card',
      )}
    >
      <Trophy className="h-5 w-5 shrink-0 text-warning" aria-hidden />

      <div className="flex-1 min-w-0">
        {/* Nothing here truncates: on a narrow screen the clip takes the contest's own name, or the
            one-entry-per-creator half of the line under it. Both are what an author is agreeing to. */}
        <div className="text-label font-semibold">{contest.title}</div>
        {enteredName ? (
          <div className="text-meta text-muted-foreground">
            You already entered {enteredName}. Withdraw it first to enter something else.
          </div>
        ) : error ? (
          <div className="text-meta text-destructive">{error}</div>
        ) : (
          <div className="text-meta text-muted-foreground">
            Enter this world · closes {formatServerDate(contest.endsAt)} · one entry per creator
          </div>
        )}
        <div className="flex items-center gap-3">
          <Button variant="link" className="px-0 h-auto text-meta" onClick={() => setRulesOpen(true)}>
            Contest Rules
          </Button>
          {/* Beside the line that advises it, so "withdraw it first" is something to press rather than a
              trip to another screen. */}
          {enteredName && onWithdraw && (
            <Button
              variant="link"
              className="px-0 h-auto text-meta text-destructive"
              disabled={withdrawing}
              onClick={onWithdraw}
            >
              {withdrawing ? 'Withdrawing…' : 'Withdraw Entry'}
            </Button>
          )}
        </div>
      </div>

      {armed && (
        <button
          type="button"
          role="switch"
          aria-checked={checked}
          aria-label={`Enter into ${contest.title}`}
          onClick={() => onCheckedChange(!checked)}
          className={cn(
            'relative h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
            checked ? 'bg-warning' : 'bg-input',
          )}
        >
          <span
            className={cn(
              'block h-5 w-5 rounded-full bg-background shadow transition-transform',
              checked ? 'translate-x-5' : 'translate-x-0',
            )}
          />
        </button>
      )}

      <ContestRulesDialog contest={contest} open={rulesOpen} onOpenChange={setRulesOpen} />
    </div>
  );
}
