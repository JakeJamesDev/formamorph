import { Button } from '@/components/ui/button';
import { TutorialNote } from '@/components/TutorialPopover';
import { useTutorialScreenOnTop } from '@/lib/tutorials';
import { useTourAnchor } from '@/lib/authoringTour/useTourAnchor';
import type { AuthoringTour } from '@/lib/authoringTour/useAuthoringTour';

/** The one-time note on the Save button, after the tour's first save. It counts as no step. */
export function TourSaveNote({ tour }: { tour: AuthoringTour }) {
  const onTop = useTutorialScreenOnTop('worldEditor');
  const anchor = useTourAnchor(tour.showSaveNote ? 'save' : null);
  return (
    <TutorialNote
      open={tour.showSaveNote && onTop}
      title="Your World Is Saved"
      body="The tour saves after each step. After the tour, save your changes with this button."
      anchor={anchor}
      side="top"
      align="end"
      footer={<Button size="xs" onClick={tour.dismissSaveNote}>Got It</Button>}
    />
  );
}
