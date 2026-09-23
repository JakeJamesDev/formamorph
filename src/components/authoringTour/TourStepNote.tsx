import { Button } from '@/components/ui/button';
import { TutorialNote } from '@/components/TutorialPopover';
import { useTutorialScreenOnTop } from '@/lib/tutorials';
import { useTourAnchor } from '@/lib/authoringTour/useTourAnchor';
import type { AuthoringTour } from '@/lib/authoringTour/useAuthoringTour';

/** The current tour step's note, beside the field it points at. Hidden while its field is off screen. */
export function TourStepNote({ tour }: { tour: AuthoringTour }) {
  const onTop = useTutorialScreenOnTop('worldEditor');
  const anchor = useTourAnchor(tour.step?.anchor ?? null);
  const { step } = tour;
  const last = tour.stepNumber >= tour.total;
  return (
    <TutorialNote
      open={!!step && onTop}
      title={step?.title ?? ''}
      body={step?.body}
      anchor={anchor}
      side="bottom"
      align="start"
      footer={(
        <>
          <span className="mr-auto text-meta text-muted-foreground tabular-nums">
            {tour.stepNumber} / {tour.total}
          </span>
          <Button size="xs" variant="ghost" onClick={tour.prev} disabled={tour.stepNumber === 1}>Previous</Button>
          <Button size="xs" variant="outline" onClick={tour.applyExample}>Use Example</Button>
          <Button size="xs" onClick={() => { void tour.next(); }} disabled={!tour.complete || tour.saving}>
            {last ? 'Finish' : 'Next'}
          </Button>
        </>
      )}
    />
  );
}
