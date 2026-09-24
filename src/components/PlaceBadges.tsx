import { Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PLACE_CHIPS, PLACE_LABELS } from '@/lib/placeLabels';
import type { ContestPlacement } from '@/lib/contests';
import { Tip } from '@/components/ui/tooltip';

/**
 * The podium line a placed world wears — one per contest it placed in.
 *
 * The same node on the community card, the listing's details, the library card and the local details, so
 * a world that placed reads identically wherever it is met. Renders nothing when there is nothing to
 * show, which is also the offline answer: placement is derived from the contest archive, and an archive
 * that could not be fetched is an empty list rather than an error.
 *
 * The place is said and colored both. Color alone would ask a reader to remember which metal is second,
 * and the ordinal alone would drop the one cue that reads at card size without being read.
 *
 * @param placements - The contests this world placed in, in the order they should read
 * @param className - Wrapper classes for the surface it sits on (spacing, or a plate over a thumbnail)
 * @param shine - Sweep a sheen across each chip; for Community Creations, where a win should catch the eye
 */
export function PlaceBadges({ placements, className, shine = false }: {
  placements: ContestPlacement[];
  className?: string;
  shine?: boolean;
}) {
  if (placements.length === 0) return null;

  return (
    <div className={cn('min-w-0 space-y-1', className)}>
      {placements.map(({ contest, place }) => (
        <Tip key={contest.id} tip={contest.title} labelsChild={false}>
          <p className={cn('place-chip flex w-fit max-w-full items-center gap-1 text-meta font-semibold', shine && 'place-chip-shine', PLACE_CHIPS[place])}>
            <Trophy className="h-3 w-3 shrink-0" aria-hidden />
            <span className="shrink-0 whitespace-nowrap">{PLACE_LABELS[place]} —</span>{' '}
            <span className="min-w-0 truncate">{contest.title}</span>
          </p>
        </Tip>
      ))}
    </div>
  );
}
