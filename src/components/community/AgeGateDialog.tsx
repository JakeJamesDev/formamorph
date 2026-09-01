import { ShieldAlert } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface AgeGateDialogProps {
  open: boolean;
  onAccept: () => void;
  onDecline: () => void;
}

/**
 * The attestation that stands in front of every user-written community surface.
 *
 * Both buttons are meaningful answers, so — like the publish policy gate it is modeled on — a stray
 * click or an Escape is neither one: no backdrop dismiss, no Escape, no close button.
 *
 * The copy is versioned in `ageGate.ts`. Changing what a player is agreeing to means raising
 * `AGE_GATE_VERSION` in the same edit, so everyone is asked again against the new wording.
 */
export function AgeGateDialog({ open, onAccept, onDecline }: AgeGateDialogProps) {
  return (
    <Dialog open={open}>
      <DialogContent
        className="sm:max-w-[480px] max-h-[85dvh] overflow-y-auto"
        hideClose
        onEscapeKeyDown={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-500" aria-hidden />
            Adult Content Ahead
          </DialogTitle>
          <DialogDescription>
            Community Creations carries worlds, characters, and dictionaries written by other players.
            Some of what they write is adult.
          </DialogDescription>
        </DialogHeader>

        <p className="text-label font-medium text-balance py-2">
          By choosing Accept, you confirm that you are at least 18 years old and of legal age to view
          adult content where you live.
        </p>

        <p className="text-helper text-muted-foreground">
          If you decline, nothing else changes. Your library, your worlds, and everything you have made
          stay yours.
        </p>

        <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
          <Button variant="outline" onClick={onDecline}>Decline</Button>
          <Button onClick={onAccept}>Accept</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
