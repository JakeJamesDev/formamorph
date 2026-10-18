import { useState } from "react";
import { UserX } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Hint } from "@/components/ui/typography";
import { useResetOnOpen } from "@/lib/useResetOnOpen";
import { DEFAULT_QUARANTINE_DAYS, QUARANTINE_DAY_OPTIONS } from "@/lib/quarantine";

/** The Select value for a suspension with no end. Day options use their number. */
const UNTIL_LIFTED = 'lifted';

interface SuspendDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Whose account this is. */
  username: string;
  /** Whether the account is suspended already, which changes what the length does. */
  alreadySuspended: boolean;
  /** Confirms with the chosen length: a number of days, or null for no end. */
  onConfirm: (days: number | null) => void;
  /** Disables both buttons while the request runs. */
  busy?: boolean;
}

/**
 * Asks how long to suspend an account. Shares the quarantine dialog's day options.
 */
export function SuspendDialog({
  open, onOpenChange, username, alreadySuspended, onConfirm, busy = false,
}: SuspendDialogProps) {
  const [choice, setChoice] = useState<string>(String(DEFAULT_QUARANTINE_DAYS));

  useResetOnOpen(open, () => setChoice(String(DEFAULT_QUARANTINE_DAYS)));

  const untilLifted = choice === UNTIL_LIFTED;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserX className="h-4 w-4" /> Suspend This Account?
          </DialogTitle>
          <DialogDescription>
            {username} can sign in and read, but can’t change anything until the suspension ends.
            {alreadySuspended && ' The length you pick replaces the current end.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-2">
          <label htmlFor="suspend-length" className="text-label font-medium">Length</label>
          <Hint>
            {untilLifted
              ? 'Stays in place until you activate the account'
              : 'Ends on its own, or sooner when you activate the account'}
          </Hint>
          <Select value={choice} onValueChange={setChoice}>
            <SelectTrigger id="suspend-length"><SelectValue /></SelectTrigger>
            <SelectContent>
              {QUARANTINE_DAY_OPTIONS.map((option) => (
                <SelectItem key={option} value={String(option)}>
                  {option} days{option === DEFAULT_QUARANTINE_DAYS ? ' (default)' : ''}
                </SelectItem>
              ))}
              <SelectItem value={UNTIL_LIFTED}>Until Lifted</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
          <Button
            variant="destructive"
            onClick={() => onConfirm(untilLifted ? null : Number(choice))}
            disabled={busy}
          >
            {busy ? 'Suspending…' : 'Suspend'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
