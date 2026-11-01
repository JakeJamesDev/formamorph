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
import { ScrollArea } from '@/components/ui/scroll-area';
import { FieldError, Hint } from '@/components/ui/typography';

interface AgeGateDialogProps {
  open: boolean;
  onAccept: () => void;
  onDecline: () => void;
  /** What Decline does on this surface, shown above the buttons. */
  declineNote: string;
  busy?: boolean;
  error?: string | null;
  acceptLabel?: string;
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
export function AgeGateDialog({
  open,
  onAccept,
  onDecline,
  declineNote,
  busy = false,
  error = null,
  acceptLabel = 'Accept',
}: AgeGateDialogProps) {
  return (
    <Dialog open={open}>
      <DialogContent
        surface="ageGate"
        className="sm:max-w-[480px] max-h-[85dvh] flex flex-col"
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
            Community Creations holds worlds, entities, dictionaries, avatars, mascots and prompts that other
            players publish. Some of it is adult content.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 min-h-0" focusable>
          <div className="space-y-4">
            <p className="text-label font-medium text-balance py-2">
              By choosing Accept, you confirm that you are at least 18 years old and of legal age to view
              adult content where you live.
            </p>

            <Hint>{declineNote}</Hint>

            {error && <FieldError role="alert">{error}</FieldError>}
          </div>
        </ScrollArea>

        <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
          <Button variant="outline" onClick={onDecline} disabled={busy}>Decline</Button>
          <Button onClick={onAccept} disabled={busy}>{acceptLabel}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
