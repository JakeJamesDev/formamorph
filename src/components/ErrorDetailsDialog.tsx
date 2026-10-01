import { useEffect, useSyncExternalStore } from 'react';
import { Bug, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { bugReportFromError, openBugReport } from '@/lib/bugReportStore';
import { copyWithToast } from '@/lib/clipboard';
import { useDevRoute } from '@/lib/devRouter';
import {
  closeErrorDetails, detailsWithDiagnostics, errorDetailsText, getErrorDetailsState, subscribeErrorDetails,
} from '@/lib/errorDetails';
import { COMMUNITY_ENABLED } from '@/lib/featureFlags';
import { toastError } from '@/lib/linkToast';
import { requestSignIn } from '@/lib/signInStore';
import AuthService from '@/services/AuthService';

/** The dialog a toast's View Details link opens; mounted once, beside the toast container. */
export function ErrorDetailsHost() {
  const { open, entry } = useSyncExternalStore(subscribeErrorDetails, getErrorDetailsState);

  // DEV: `#dev?modal=errorDetails` raises a canned ComfyUI rejection toast.
  const devRoute = useDevRoute();
  useEffect(() => {
    if (import.meta.env.DEV && devRoute?.modal === 'errorDetails') {
      void import('@/lib/devErrorDetailsSample').then(({ devErrorDetailsSample }) => toastError(devErrorDetailsSample(), ''));
    }
  }, [devRoute?.modal]);

  // Hands off rather than stacking: the report's description keeps the details.
  const reportBug = () => {
    if (!entry) return;
    const fill = bugReportFromError(entry);
    const handOff = () => {
      closeErrorDetails();
      openBugReport(fill);
    };
    // Bug reports are filed against an account. A canceled sign-in leaves this dialog open underneath.
    if (AuthService.token) handOff();
    else requestSignIn({ onSignedIn: handOff });
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) closeErrorDetails(); }}>
      <DialogContent surface="errorDetails" className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Error Details</DialogTitle>
          <DialogDescription>{entry?.message}</DialogDescription>
        </DialogHeader>
        <pre className="max-h-[50vh] overflow-auto whitespace-pre-wrap break-words rounded-md border bg-muted/40 p-3 font-mono text-meta">
          {entry && detailsWithDiagnostics(entry)}
        </pre>
        <DialogFooter>
          {/* Bug reports live on the community server. */}
          {COMMUNITY_ENABLED && (
            <Button variant="outline" onClick={reportBug}>
              <Bug className="mr-2 h-4 w-4" />
              Report Bug
            </Button>
          )}
          <Button onClick={() => { if (entry) copyWithToast(errorDetailsText(entry)); }}>
            <Copy className="mr-2 h-4 w-4" />
            Copy
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
