import { Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ServerEvent } from '@/types';

/**
 * The trophy line a contest winner wears — one per contest it won.
 *
 * The same node on the community card, the listing's details, the library card and the local details, so
 * a world that won reads identically wherever it is met. Renders nothing when there is nothing won,
 * which is also the offline answer: winner status is derived from the contest archive, and an archive
 * that could not be fetched is an empty list rather than an error.
 *
 * @param contests - The contests this world won, in the order they should read
 * @param className - Wrapper classes for the surface it sits on (spacing, or a plate over a thumbnail)
 */
export function WinnerBadges({ contests, className }: { contests: ServerEvent[]; className?: string }) {
  if (contests.length === 0) return null;

  return (
    <div className={cn('min-w-0 space-y-0.5', className)}>
      {contests.map((contest) => (
        <p
          key={contest.id}
          className="flex items-center gap-1 text-meta font-medium text-warning"
          title={contest.title}
        >
          <Trophy className="h-3 w-3 shrink-0" aria-hidden /> Winner — <span className="min-w-0 truncate">{contest.title}</span>
        </p>
      ))}
    </div>
  );
}
