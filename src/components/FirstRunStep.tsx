import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { MascotPiece } from '@/components/formaquestion/MascotPiece';
import { composeMascot, DEFAULT_MASCOT_RIG } from '@/lib/formaquestion/mascot';
import type { MascotSize } from '@/lib/formaquestion/mascotMask';

/** Morphie's drawn height in px; her width follows the base image's aspect. */
const MORPHIE_HEIGHT = 144;

interface FirstRunStepProps {
  open: boolean;
  /** False when the player deleted Emberwatch: the step then offers Browse Worlds alone. */
  canPlay: boolean;
  onPlay: () => void;
  onBrowse: () => void;
}

/**
 * The step a new player meets when the intro ends: Morphie, one clear start and a way to look around first.
 * Escape and an outside press both mean Browse Worlds.
 */
export function FirstRunStep({ open, canPlay, onPlay, onBrowse }: FirstRunStepProps) {
  const [base, setBase] = useState<MascotSize | null>(null);
  // Always the stock Morphie, whatever Mascot the player picks later.
  const images = useMemo(() => composeMascot(DEFAULT_MASCOT_RIG, 'initial', null), []);
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onBrowse(); }}>
      <DialogContent surface="firstRun" className="sm:max-w-[480px]" hideClose>
        <div className="flex justify-center">
          <MascotPiece
            images={images}
            size={base && { w: Math.round((MORPHIE_HEIGHT * base.width) / base.height), h: MORPHIE_HEIGHT }}
            onBase={setBase}
          />
        </div>
        <DialogHeader>
          <DialogTitle>Welcome to Formamorph</DialogTitle>
          <DialogDescription>
            {canPlay
              ? 'Emberwatch is a fantasy world that is ready to play. Start there, or look through the other worlds first.'
              : 'Look through the worlds to find one to play.'}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onBrowse}>Browse Worlds</Button>
          {canPlay && <Button onClick={onPlay}>Play Emberwatch</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
