import { useMemo, useState } from 'react';
import { Calendar, Trophy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { ContestRulesDialog } from '@/components/community/ContestRulesDialog';
import { formatServerDate } from '@/lib/serverDate';
import { contestPhase, contestSections, type ContestPhase } from '@/lib/contests';
import { daysRemaining, placementsOf } from '@/lib/serverEvents';
import { PLACE_COLORS, PLACE_LABELS } from '@/lib/placeLabels';
import type { ServerEvent } from '@/types';

interface ContestBarProps {
  /** The contest being browsed. */
  contest: ServerEvent;
  /** Every contest a player may switch to, running one first. A single one hides the selector. */
  contests: ServerEvent[];
  onSelect: (id: string) => void;
  /** How many listings the grid below is showing. */
  entryCount: number;
}

/** What the bar says about where the contest stands. */
function statusLine(contest: ServerEvent, phase: ContestPhase): string {
  if (phase === 'decided') {
    // The gold name with a count of the rest, rather than the whole podium: the band below spells it out,
    // and a bar that lists three worlds pushes the entries it sits above off the screen.
    const podium = placementsOf(contest);
    if (podium.length === 0) return 'Results announced';
    const [gold] = podium;
    const runnersUp = podium.length - 1;
    return `Won by ${gold.worldName} — ${gold.authorName}`
      + (runnersUp > 0 ? ` · ${runnersUp} more placed` : '');
  }
  if (phase === 'judging') return `Closed ${formatServerDate(contest.endsAt)} — being judged`;
  const days = daysRemaining(contest);
  return days === null ? 'Open for entries' : `${days} day${days === 1 ? '' : 's'} left to enter`;
}

/**
 * The slim bar above a contest's entries: which contest this is, where it stands, and its rules.
 *
 * The rules live behind a button rather than in the bar itself. They are what an author agrees to and
 * what a reader can check, but they are read once — a wall of them above every visit's grid pushes the
 * entries themselves off the screen the tab exists to show.
 *
 * The order the grid is in is never mentioned. That entries are shuffled while the contest runs is how
 * the tab is fair, not something a player is asked to think about.
 */
export function ContestBar({ contest, contests, onSelect, entryCount }: ContestBarProps) {
  const [rulesOpen, setRulesOpen] = useState(false);
  const phase = contestPhase(contest);
  const dates = `${formatServerDate(contest.startsAt)} – ${formatServerDate(contest.endsAt)}`;
  // The archive is permanent, so this list is a calendar rather than a menu: what has not concluded sits
  // on top and everything else is filed under the year it ran.
  const sections = useMemo(() => contestSections(contests), [contests]);

  return (
    <div className="shrink-0 border-b px-6 py-2 flex flex-wrap items-center gap-x-3 gap-y-2 text-label">
      <Trophy className="h-4 w-4 shrink-0 text-gold" aria-hidden />

      {contests.length > 1 ? (
        <Select value={contest.id} onValueChange={onSelect}>
          <SelectTrigger className="h-8 w-[16rem] max-w-full font-semibold" aria-label="Contest">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {sections.map((section) => (
              <SelectGroup key={section.label}>
                <SelectLabel>{section.label}</SelectLabel>
                {section.contests.map((option) => (
                  <SelectItem key={option.id} value={option.id}>{option.title}</SelectItem>
                ))}
              </SelectGroup>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <span className="font-semibold truncate">{contest.title}</span>
      )}

      <span className="text-meta text-muted-foreground truncate">{statusLine(contest, phase)}</span>
      <span className="hidden sm:inline-flex items-center gap-1 rounded-full bg-secondary text-secondary-foreground px-2 py-0.5 text-meta font-semibold">
        <Calendar className="h-3 w-3" aria-hidden /> {dates}
      </span>
      <span className="text-meta text-muted-foreground">
        {entryCount} {entryCount === 1 ? 'entry' : 'entries'}
      </span>

      <Button variant="outline" size="sm" className="ml-auto shrink-0" onClick={() => setRulesOpen(true)}>
        Rules
      </Button>

      <ContestRulesDialog contest={contest} open={rulesOpen} onOpenChange={setRulesOpen} />
    </div>
  );
}

interface ContestPodiumProps {
  contest: ServerEvent;
}

/**
 * The podium band under the slim bar, once a contest has announced its results.
 *
 * Every announced place in order, so results read like results rather than like one name with the rest
 * left implied. Reads the snapshots the announcement stamped onto the contest rather than the entry grid:
 * a placed world that has since been deleted still placed, and the archive says so.
 */
export function ContestPodium({ contest }: ContestPodiumProps) {
  const podium = placementsOf(contest);
  if (podium.length === 0) return null;

  return (
    <div className="shrink-0 mx-6 mt-4 grid gap-2 sm:grid-cols-3">
      {podium.map(({ place, worldName, authorName }) => (
        <div
          key={place}
          className="flex items-center gap-3 rounded-lg border bg-muted/40 px-4 py-3 min-w-0"
        >
          <Trophy className={cn('h-6 w-6 shrink-0', PLACE_COLORS[place])} aria-hidden />
          <div className="min-w-0">
            <div className={cn('text-meta font-semibold', PLACE_COLORS[place])}>{PLACE_LABELS[place]}</div>
            <div className="text-label font-semibold truncate">{worldName}</div>
            <div className="text-meta text-muted-foreground truncate">by {authorName}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
