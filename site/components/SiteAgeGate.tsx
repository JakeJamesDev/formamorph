import { useState, type ReactNode } from 'react';
import { AgeGateDialog } from '@/components/community/AgeGateDialog';
import { acceptAgeGate, isAgeAttested } from '@/lib/ageGate';
import { leaveTo } from '../leaveSite';

/**
 * The attestation that stands in front of community content here, exactly as it does in the game.
 *
 * The record it reads and writes is the app's own, at the app's version, so a player who has answered
 * inside `/play/` is not asked again by a profile link, and answering here carries back the other way.
 * Both are one origin, so one `localStorage` record serves them.
 *
 * The children are not rendered at all until the answer is in, rather than hidden behind the dialog: a
 * mounted profile fetches, and a fetch is the page having already been visited.
 */
export function SiteAgeGate({ children }: { children: ReactNode }) {
  const [attested, setAttested] = useState(isAgeAttested);

  if (attested) return <>{children}</>;

  return (
    <AgeGateDialog
      open
      onAccept={() => { acceptAgeGate(); setAttested(true); }}
      // Declining is a refusal of the whole surface, not of this one profile, so it leaves for the
      // landing page rather than returning the reader to a link they have already said no to.
      onDecline={() => leaveTo('/')}
    />
  );
}
