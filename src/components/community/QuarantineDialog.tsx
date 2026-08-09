import { useState } from "react";
import { ShieldAlert } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useResetOnOpen } from "@/lib/useResetOnOpen";
import { DEFAULT_QUARANTINE_DAYS, QUARANTINE_DAY_OPTIONS } from "@/lib/quarantine";

interface QuarantineDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** What is being quarantined, in the reader's terms — "world “Sedge Landing” by wren_hallow". */
  what: string;
  /** Whether the author will be written to afterwards; drives whether the copy promises a message. */
  willNotifyAuthor: boolean;
  /** Confirms the quarantine with the chosen length. */
  onConfirm: (days: number) => void;
  /** Disables both buttons while the quarantine is being recorded. */
  busy?: boolean;
}

/**
 * How long, before a listing is taken out of circulation.
 *
 * Deliberately not a free number field: the choice is "about a week" or "a bit longer", and a box that
 * accepts 43 invites a precision the decision does not have.
 */
export function QuarantineDialog({
  open, onOpenChange, what, willNotifyAuthor, onConfirm, busy = false,
}: QuarantineDialogProps) {
  const [days, setDays] = useState<number>(DEFAULT_QUARANTINE_DAYS);

  useResetOnOpen(open, () => setDays(DEFAULT_QUARANTINE_DAYS));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4" /> Quarantine This?
          </DialogTitle>
          <DialogDescription>
            {what} comes out of Community Creations. Only its author and the administrators will see it,
            and nobody can comment on it. Updating it buys the author another week.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-2">
          <label className="text-label font-medium">Delete it after</label>
          <Select value={String(days)} onValueChange={(value) => setDays(Number(value))}>
            <SelectTrigger aria-label="Quarantine length"><SelectValue /></SelectTrigger>
            <SelectContent>
              {QUARANTINE_DAY_OPTIONS.map((option) => (
                <SelectItem key={option} value={String(option)}>
                  {option} days{option === DEFAULT_QUARANTINE_DAYS ? ' (default)' : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-meta text-muted-foreground">
            {willNotifyAuthor
              ? 'You’ll write to the author next, so they know what to fix. Nothing is deleted before the deadline.'
              : 'Nothing is deleted before the deadline, and you can release it at any point.'}
          </p>
        </div>

        <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
          <Button onClick={() => onConfirm(days)} disabled={busy}>
            {busy ? 'Quarantining…' : 'Quarantine'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
