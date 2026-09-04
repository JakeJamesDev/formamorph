import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useResetOnOpen } from "@/lib/useResetOnOpen";
import { formatServerDate } from "@/lib/serverDate";
import AuthService from "@/services/AuthService";

/** Where the reader is in the flow. A suspended account never leaves the first one. */
type Step = 'what' | 'content' | 'password' | 'done';

interface DeleteAccountDialogProps {
  open: boolean;
  /** Close without asking for anything. The flow resets on its next opening. */
  onClose: () => void;
  /** A suspended account is sent to Feedback instead, and this sends nothing on its behalf. */
  suspended: boolean;
  /** Opens the Feedback hub, when a surface below has lent an opener. */
  onOpenFeedback?: () => void;
}

/**
 * Deleting your own account: what happens, what becomes of your published work, and your password.
 *
 * Three steps rather than one screen, because the middle one is a decision the account cannot be
 * assumed into — whether the listings and comments go too has no default anywhere, here or on the
 * server. The password is asked last and is the account's own: a stolen session must not be able to
 * end the account it stole.
 *
 * Nothing is hidden by the request. The account keeps everything for seven days and signing in during
 * them calls the whole thing off, so this is a slow door rather than a trapdoor.
 */
export function DeleteAccountDialog({ open, onClose, suspended, onOpenFeedback }: DeleteAccountDialogProps) {
  const [step, setStep] = useState<Step>('what');
  // Null until answered, which is what holds the flow at the choice.
  const [deleteContent, setDeleteContent] = useState<boolean | null>(null);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [scheduledFor, setScheduledFor] = useState('');

  // Reset on opening rather than on closing, so a half-typed password is not blanked in front of the
  // reader during the fade-out.
  useResetOnOpen(open, () => {
    setStep('what');
    setDeleteContent(null);
    setPassword('');
    setError('');
    setScheduledFor('');
  });

  const submit = async () => {
    if (deleteContent === null) return;

    setError('');
    setBusy(true);
    try {
      setScheduledFor(await AuthService.requestAccountDeletion(password, deleteContent));
      setStep('done');
      // Ended here rather than at the last button: the request stands whether or not the reader
      // dismisses this, and a live session left behind is one stray request from cancelling it.
      AuthService.logout();
    } catch (requestError) {
      // Verbatim: a wrong password and a suspension are the two answers, and both are actionable.
      setError((requestError as Error).message || 'Failed to request the deletion');
    } finally {
      setBusy(false);
    }
  };

  const openFeedback = () => {
    onOpenFeedback?.();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next && !busy) onClose(); }}>
      {/* No corner cross: every step ends on a button that says what it does, and the last one has
          already sent the request. */}
      <DialogContent className="sm:max-w-[480px]" hideClose>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-destructive" /> Delete Account
          </DialogTitle>
          <DialogDescription>
            {suspended
              ? 'Suspended accounts are deleted by the team.'
              : 'Three steps: what happens, then your published work, then your password.'}
          </DialogDescription>
        </DialogHeader>

        {suspended && (
          <>
            <div className="space-y-2 py-2 text-label">
              <p>Your account is suspended, so it cannot be deleted from here.</p>
              <p className="text-muted-foreground">
                Ask through Feedback and the team will handle it.
              </p>
            </div>

            <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
              <Button variant="outline" onClick={onClose}>Close</Button>
              {onOpenFeedback && <Button onClick={openFeedback}>Open Feedback</Button>}
            </DialogFooter>
          </>
        )}

        {!suspended && step === 'what' && (
          <>
            <div className="space-y-2 py-2 text-label">
              <p>Your account is erased seven days from now.</p>
              <p>Signing in during those seven days cancels the deletion.</p>
              <p className="text-muted-foreground">
                Nothing is hidden while you wait. Your listings, comments and profile stay exactly as
                they are until the day comes.
              </p>
            </div>

            <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              <Button onClick={() => setStep('content')}>Continue</Button>
            </DialogFooter>
          </>
        )}

        {!suspended && step === 'content' && (
          <>
            <div className="space-y-3 py-2">
              <p className="text-label font-medium">Also delete everything you published?</p>

              <RadioGroup
                value={deleteContent === null ? undefined : String(deleteContent)}
                onValueChange={(value) => setDeleteContent(value === 'true')}
              >
                <div className="flex items-start space-x-2 p-2 rounded-md hover:bg-accent">
                  <RadioGroupItem value="true" id="delete-content-yes" />
                  <div className="grid gap-1">
                    <Label htmlFor="delete-content-yes">Delete My Work</Label>
                    <p className="text-helper text-muted-foreground">
                      Your listings, their files and your comments go with the account.
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-2 p-2 rounded-md hover:bg-accent">
                  <RadioGroupItem value="false" id="delete-content-no" />
                  <div className="grid gap-1">
                    <Label htmlFor="delete-content-no">Keep My Work</Label>
                    <p className="text-helper text-muted-foreground">
                      Your listings and comments stay, under the name [deleted user]. Your name is gone
                      from them.
                    </p>
                  </div>
                </div>
              </RadioGroup>
            </div>

            <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
              <Button variant="outline" onClick={() => setStep('what')}>Back</Button>
              <Button onClick={() => setStep('password')} disabled={deleteContent === null}>
                Continue
              </Button>
            </DialogFooter>
          </>
        )}

        {!suspended && step === 'password' && (
          <>
            <div className="space-y-4 py-2">
              {error && (
                <div className="text-label text-destructive p-2 bg-destructive/10 rounded-md">
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="delete-password" className="text-label font-medium">Password</Label>
                <Input
                  id="delete-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                />
                <p className="text-helper text-muted-foreground">
                  {deleteContent
                    ? 'Your published work is deleted with the account.'
                    : 'Your published work stays, under the name [deleted user].'}
                </p>
              </div>
            </div>

            <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
              <Button variant="outline" onClick={() => setStep('content')} disabled={busy}>Back</Button>
              <Button variant="destructive" onClick={() => { void submit(); }} disabled={busy || !password}>
                Delete My Account
              </Button>
            </DialogFooter>
          </>
        )}

        {!suspended && step === 'done' && (
          <>
            <div className="space-y-2 py-2 text-label">
              <p>Your account will be erased on {formatServerDate(scheduledFor)}.</p>
              <p className="text-muted-foreground">
                Sign in before then and the deletion is called off.
              </p>
            </div>

            <DialogFooter>
              <Button onClick={onClose}>Done</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
