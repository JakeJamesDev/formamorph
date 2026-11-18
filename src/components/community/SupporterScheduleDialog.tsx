import { useState } from 'react';

import { useMountedRef } from '@/lib/useMountedRef';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Hint } from '@/components/ui/typography';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  SCHEDULE_ROW_TIERS,
  formFromListing,
  saveFromForm,
  type ScheduleForm,
  type SupporterScheduleSave,
} from '@/lib/supporterScheduleEdit';
import { useTierName } from '@/lib/tierNames';
import type { WorldRecord } from '@/components/WorldDetails';

interface SupporterScheduleDialogProps {
  /** The Supporter-only listing being edited; null closes the dialog. */
  world: WorldRecord | null;
  busy: boolean;
  onClose: () => void;
  /** Saves the schedule. Resolves to the server's refusal, or null once it is saved. */
  onSave: (world: WorldRecord, schedule: SupporterScheduleSave) => Promise<string | null>;
}

interface ScheduleBodyProps {
  world: WorldRecord;
  busy: boolean;
  onClose: () => void;
  onSave: SupporterScheduleDialogProps['onSave'];
}

/** The open dialog's content. It mounts only while a listing is open, so the tier names load then. */
function ScheduleBody({ world, busy, onClose, onSave }: ScheduleBodyProps) {
  const nameOf = useTierName();
  const mounted = useMountedRef();
  const [initial] = useState<ScheduleForm>(() => formFromListing(world));
  const [form, setForm] = useState<ScheduleForm>(initial);
  const [refusal, setRefusal] = useState<string | null>(null);

  const dates = saveFromForm(form, initial, world);
  const edit = (change: Partial<ScheduleForm>) => { setForm((prev) => ({ ...prev, ...change })); setRefusal(null); };
  const save = async () => {
    if (!dates) return;
    const answer = await onSave(world, dates);
    if (mounted.current) setRefusal(answer);
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Supporter-Only Schedule</DialogTitle>
        <DialogDescription>
          The top tier has the listing from the start. Set when each lower tier gets it, then when everyone does.
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-3">
        {SCHEDULE_ROW_TIERS.map((tier) => {
          const id = `edit-supporter-opens-${tier}`;

          return (
            <div key={tier} className="space-y-1.5">
              <Label htmlFor={id}>{`${nameOf(tier)} Opens`}</Label>
              <Input
                id={id}
                type="datetime-local"
                value={form.opensAt[tier] ?? ''}
                onChange={(e) => edit({ opensAt: { ...form.opensAt, [tier]: e.target.value } })}
                className="max-w-60"
              />
              <Hint as="div">{form.opensAt[tier] ? 'Opens at this time' : form.publicAt ? 'Opens with the public date' : 'Never opens'}</Hint>
            </div>
          );
        })}
        <div className="space-y-1.5">
          <Label htmlFor="edit-supporter-public">Everyone Opens</Label>
          <Input
            id="edit-supporter-public"
            type="datetime-local"
            value={form.publicAt}
            onChange={(e) => edit({ publicAt: e.target.value })}
            className="max-w-60"
          />
          <Hint as="div">{form.publicAt ? 'Opens to everyone at this time' : 'No end date'}</Hint>
        </div>
        {dates === null && <Hint as="div" role="alert">Enter a valid date and time, or clear the field</Hint>}
        {refusal && <Hint as="div" role="alert" className="text-destructive">{refusal}</Hint>}
      </div>
      <DialogFooter className="gap-2">
        <Button variant="outline" disabled={busy} onClick={onClose}>Cancel</Button>
        <Button disabled={busy || dates === null} onClick={() => void save()}>Save</Button>
      </DialogFooter>
    </>
  );
}

/** An admin's way to set, change or clear when each tier, then everyone, gets a Supporter-only listing. */
export function SupporterScheduleDialog({ world, busy, onClose, onSave }: SupporterScheduleDialogProps) {
  return (
    <Dialog open={!!world} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-md">
        {world && <ScheduleBody key={String(world._id || world.id)} world={world} busy={busy} onClose={onClose} onSave={onSave} />}
      </DialogContent>
    </Dialog>
  );
}
