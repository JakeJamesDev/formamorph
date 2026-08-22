import { useCallback, useState, type ReactNode } from 'react';
import { toast } from 'react-toastify';
import { Trophy } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useClosingSnapshot } from '@/lib/useClosingSnapshot';
import WorldStorageService, { CONTEST_PLACED } from '@/services/WorldStorageService';

/** The listing a withdrawal is being asked about. */
interface WithdrawTarget {
  id: string;
  name: string;
}

interface ContestWithdrawal {
  /** Ask about a listing. Nothing is sent until the confirmation is answered. */
  ask: (target: WithdrawTarget) => void;
  /** Whether a withdrawal is in flight, so a surface can quiet its own controls. */
  busy: boolean;
  /** The confirmation, rendered by the surface that owns the control. */
  dialog: ReactNode;
}

/**
 * The withdraw-an-entry flow, shared by the two places it is offered: the publish modal's already-entered
 * card and the author's own card in the contest tab.
 *
 * Guarded by a confirmation rather than done on the click, because it is the one contest action with
 * nothing to undo it — there is no re-enter route, and a contest past its deadline would refuse one
 * anyway. A world on the podium cannot be withdrawn at all; the server says so and the refusal is
 * repeated as it came rather than as a generic failure.
 *
 * @param onWithdrawn - Called with the listing's id once the server has released it, for whatever the
 *                      surface needs to re-read
 */
export function useContestWithdrawal(onWithdrawn?: (listingId: string) => void): ContestWithdrawal {
  const [pending, setPending] = useState<WithdrawTarget | null>(null);
  const [busy, setBusy] = useState(false);

  const ask = useCallback((target: WithdrawTarget) => setPending(target), []);

  const confirm = useCallback(async () => {
    if (!pending) return;
    setBusy(true);
    try {
      await WorldStorageService.withdrawFromContest(pending.id);
      toast.success(`${pending.name} is out of the contest.`);
      onWithdrawn?.(pending.id);
    } catch (error) {
      const failure = error as Error & { code?: string };
      toast.error(failure.code === CONTEST_PLACED
        ? 'A world that placed cannot be withdrawn. Delete the listing if you want it gone.'
        : failure.message || 'Failed to withdraw the entry');
    } finally {
      setBusy(false);
      setPending(null);
    }
  }, [pending, onWithdrawn]);

  // Held through the fade-out, so the name in the sentence doesn't blank for the closing frames.
  const shown = useClosingSnapshot(Boolean(pending), pending);

  const dialog = (
    <AlertDialog open={Boolean(pending)} onOpenChange={(isOpen) => { if (!isOpen) setPending(null); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-gold" aria-hidden />
            Withdraw “{shown?.name}”?
          </AlertDialogTitle>
          <AlertDialogDescription>
            It stays published with its likes and comments — it simply stops being an entry. Re-entering
            means publishing it again, which a contest past its deadline will not take.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Keep It Entered</AlertDialogCancel>
          <AlertDialogAction disabled={busy} onClick={(e) => { e.preventDefault(); void confirm(); }}>
            Withdraw It
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  return { ask, busy, dialog };
}
