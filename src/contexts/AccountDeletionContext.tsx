import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { DeleteAccountDialog } from '@/components/menu/DeleteAccountDialog';
import { useDevRoute } from '@/lib/devRouter';
import { clearDeletionCancellation, hasDeletionCancellation } from '@/lib/deletionCancellation';
import AuthService from '@/services/AuthService';

interface AccountDeletionValue {
  /** Open the deletion flow. Raised from the profile dialog and from the Privacy Policy prompt. */
  startDeletion: () => void;
  /** Say that a sign-in called off a pending deletion. Shown once, then dismissed for good. */
  noticeCancelled: () => void;
  /** Lend the Feedback opener from the surface that owns it, so the suspended step can offer a way in. */
  setFeedbackOpener: (open: (() => void) | null) => void;
}

const AccountDeletionContext = createContext<AccountDeletionValue | null>(null);

/**
 * Ending your own account, held above the view switch.
 *
 * One flow with two doors into it: the profile dialog, and the Privacy Policy prompt's third button. The
 * second is why this cannot live inside the menu — that prompt stands above every screen, and an account
 * that will not accept the policy still deserves the way out.
 *
 * It also carries the other half of the same story. A sign-in inside the grace period cancels the
 * deletion, and the server says so in the login reply; that notice is raised from here because this is
 * where the deletion is spoken about.
 */
export function AccountDeletionProvider({ children }: { children: ReactNode }) {
  const [flowOpen, setFlowOpen] = useState(false);
  const [cancelledOpen, setCancelledOpen] = useState(hasDeletionCancellation);
  // Lent by whoever owns the Feedback dialog, which is mounted far below this. Held in state rather
  // than a ref so the step re-renders into a working button the moment it arrives.
  const [feedbackOpener, setFeedbackOpener] = useState<(() => void) | null>(null);
  const devRoute = useDevRoute();

  const startDeletion = useCallback(() => setFlowOpen(true), []);
  const noticeCancelled = useCallback(() => setCancelledOpen(true), []);

  useEffect(() => {
    if (cancelledOpen) clearDeletionCancellation();
  }, [cancelledOpen]);

  // A function stored in state has to be set through a callback, or React reads the function itself as
  // an updater and calls it.
  const lendFeedbackOpener = useCallback(
    (open: (() => void) | null) => setFeedbackOpener(() => open),
    [],
  );

  // DEV: `#dev?modal=deleteAccount` and `#dev?modal=deletionCancelled` land on either surface, neither
  // of which a signed-out reader can reach by clicking.
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    if (devRoute?.modal === 'deleteAccount') setFlowOpen(true);
    if (devRoute?.modal === 'deletionCancelled') setCancelledOpen(true);
  }, [devRoute?.modal]);

  // Read as the flow opens rather than held: a suspension can be lifted while the app is running, and
  // the account that reaches this step should be the one the session knows about now.
  const suspended = AuthService.getCurrentUser()?.status === 'suspended';

  const value = useMemo(
    () => ({ startDeletion, noticeCancelled, setFeedbackOpener: lendFeedbackOpener }),
    [startDeletion, noticeCancelled, lendFeedbackOpener],
  );

  return (
    <AccountDeletionContext.Provider value={value}>
      {children}

      {/* After the children, so the flow portals above the Privacy Policy prompt that can raise it. */}
      <DeleteAccountDialog
        open={flowOpen}
        onClose={() => setFlowOpen(false)}
        suspended={suspended}
        onOpenFeedback={feedbackOpener ?? undefined}
      />

      <Dialog open={cancelledOpen} onOpenChange={setCancelledOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Deletion Cancelled</DialogTitle>
            <DialogDescription>Your account deletion was cancelled.</DialogDescription>
          </DialogHeader>

          <p className="text-label text-muted-foreground">
            Signing in called it off. Your account and everything in it are as they were.
          </p>

          <DialogFooter>
            <Button onClick={() => setCancelledOpen(false)}>OK</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AccountDeletionContext.Provider>
  );
}

/**
 * The account-deletion flow and the notice that a sign-in called one off.
 *
 * Throws without a provider above rather than answering with a flow that opens nothing: a Delete
 * button that silently does nothing is worse than a screen that fails loudly in development.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function useAccountDeletion(): AccountDeletionValue {
  const value = useContext(AccountDeletionContext);
  if (!value) throw new Error('useAccountDeletion must be used within an AccountDeletionProvider');
  return value;
}
