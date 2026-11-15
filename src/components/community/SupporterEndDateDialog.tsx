import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { SupporterEndFields } from '@/components/community/SupporterEndFields';
import { parseSupporterDays, supporterEndLabel } from '@/lib/supporterEndDate';
import type { WorldRecord } from '@/components/WorldDetails';

interface SupporterEndDateDialogProps {
  /** The Supporter-only listing being edited; null closes the dialog. */
  world: WorldRecord | null;
  busy: boolean;
  onClose: () => void;
  /** Days from now, or null to clear the end date. */
  onSave: (world: WorldRecord, days: number | null) => void;
}

/** An admin's way to set, change or clear when a Supporter-only listing opens to everyone. */
export function SupporterEndDateDialog({ world, busy, onClose, onSave }: SupporterEndDateDialogProps) {
  const [text, setText] = useState('');
  const worldKey = world ? String(world._id || world.id) : null;
  useEffect(() => { setText(''); }, [worldKey]);

  const days = parseSupporterDays(text);
  const invalid = text.trim() !== '' && days === null;
  const current = world ? supporterEndLabel(world) : null;

  return (
    <Dialog open={!!world} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Supporter-Only End Date</DialogTitle>
          <DialogDescription>
            {current ? `${current}. Enter days from now to move the date, or clear it.` : 'This listing has no end date. Enter days from now to set one.'}
          </DialogDescription>
        </DialogHeader>
        <SupporterEndFields id="edit-supporter-days" value={text} onChange={setText} blankHint="Enter days to set an end date" />
        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="outline" disabled={busy || !current} onClick={() => world && onSave(world, null)}>
            Clear End Date
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" disabled={busy} onClick={onClose}>Cancel</Button>
            <Button disabled={busy || days === null || invalid} onClick={() => world && days !== null && onSave(world, days)}>
              Save
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
