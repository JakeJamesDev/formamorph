import { Button } from '@/components/ui/button';
import type { AuthoringTour } from '@/lib/authoringTour/useAuthoringTour';

/** The editor header's tour row: where the tour is, the way back to its step, and the way out. */
export function TourBar({ tour, onBackToTour }: { tour: AuthoringTour; onBackToTour: () => void }) {
  return (
    <div role="region" aria-label="Authoring Tour" className="flex flex-wrap items-center gap-2 pt-2">
      <span className="mr-auto text-label font-medium tabular-nums">
        Authoring Tour · {tour.stepNumber} / {tour.total}
      </span>
      <Button size="sm" variant="outline" onClick={onBackToTour}>Back to Tour</Button>
      <Button size="sm" variant="ghost" onClick={tour.end}>End Tour</Button>
    </div>
  );
}
