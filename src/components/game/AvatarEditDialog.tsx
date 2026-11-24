import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogTitle, dialogFullHeight } from '@/components/ui/dialog';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { useGameplay } from '@/contexts/GameplayContext';
import type { AvatarEditTarget } from '@/lib/useAvatarEdit';
import { useIsMobile } from '@/lib/useIsMobile';
import { defaultCharacterData } from '@/lib/legacyVrm';
import { cn } from '@/lib/utils';
import CharacterCustomization from '@/views/CharacterCustomization';
import type { CharacterData } from '@/types';

/**
 * The Avatar customization screen over the game, filled with the save's look. A dialog on desktop and the full
 * screen on mobile. Save replaces the live look at once; the turn history is not touched.
 */
export function AvatarEditDialog({ target: { vrm, lock }, open, onOpenChange }: {
  target: AvatarEditTarget;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { characterData, setCharacterData } = useGameplay();
  const isMobile = useIsMobile();
  const [changed, setChanged] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const close = () => {
    setConfirming(false);
    setChanged(false);
    onOpenChange(false);
  };
  const requestClose = () => (changed ? setConfirming(true) : close());
  const save = (data: CharacterData) => {
    setCharacterData(data);
    close();
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) requestClose(); }}>
      <DialogContent
        hideClose
        surface="avatarEdit"
        className={cn(
          'block gap-0 overflow-hidden p-0',
          isMobile ? `${dialogFullHeight} w-screen max-w-none rounded-none border-0` : 'h-[90dvh] w-[95vw] max-w-[1280px]',
        )}
      >
        <DialogTitle className="sr-only">Edit Avatar</DialogTitle>
        <DialogDescription className="sr-only">Change your Avatar&apos;s look</DialogDescription>
        <CharacterCustomization
          vrm={vrm}
          lock={lock}
          edit={{ look: characterData ?? defaultCharacterData, onSave: save, onCancel: requestClose, onChangedChange: setChanged }}
        />
      </DialogContent>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title="Discard Changes?"
        description="You'll lose the changes you made to your Avatar."
        confirmLabel="Discard"
        destructive
        onConfirm={close}
        onCancel={() => setConfirming(false)}
      />
    </Dialog>
  );
}
