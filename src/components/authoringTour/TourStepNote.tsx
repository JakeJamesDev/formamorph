import { Button } from '@/components/ui/button';
import { TutorialNote } from '@/components/TutorialPopover';
import { useTutorialScreenOnTop } from '@/lib/tutorials';
import { useTourAnchor } from '@/lib/authoringTour/useTourAnchor';
import type { AuthoringTour } from '@/lib/authoringTour/useAuthoringTour';

/** The current tour step's note, beside its field. Hidden while the field is off screen or covered.
 *  `onShowEffect` adds Show Effect, which opens In Play on mobile. */
export function TourStepNote({ tour, onShowEffect }: { tour: AuthoringTour; onShowEffect?: () => void }) {
  const onTop = useTutorialScreenOnTop('worldEditor');
  const anchor = useTourAnchor(tour.step?.anchor ?? null);
  const { step } = tour;
  const last = tour.stepNumber >= tour.total;
  return (
    <TutorialNote
      open={!!step && onTop && !tour.showSaveNote}
      title={step?.title ?? ''}
      body={step?.body}
      anchor={anchor}
      side="bottom"
      align="start"
      action={onShowEffect && (
        <Button size="xs" variant="secondary" className="w-full" onClick={onShowEffect}>Show Effect</Button>
      )}
      footer={(
        <>
          <span className="mr-auto text-meta text-muted-foreground tabular-nums">
            {tour.stepNumber} / {tour.total}
          </span>
          <Button size="xs" variant="ghost" onClick={tour.prev} disabled={tour.stepNumber === 1}>Previous</Button>
          {tour.canUseExample && (
            <Button size="xs" variant="outline" onClick={tour.applyExample}>Use Example</Button>
          )}
          <Button
            size="xs"
            variant={last && tour.play ? 'outline' : 'default'}
            onClick={() => { void tour.next(); }}
            disabled={!tour.complete || tour.saving}
          >
            {last ? 'Finish' : 'Next'}
          </Button>
          {last && tour.play && (
            <Button size="xs" onClick={() => { void tour.play?.(); }} disabled={!tour.complete || tour.saving}>
              Play
            </Button>
          )}
        </>
      )}
    />
  );
}
