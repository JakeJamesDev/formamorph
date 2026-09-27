import { useEffect, useSyncExternalStore } from 'react';
import { Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { copyWithToast } from '@/lib/clipboard';
import { useDevRoute } from '@/lib/devRouter';
import {
  closeErrorDetails, errorDetailsText, getErrorDetailsState, subscribeErrorDetails,
} from '@/lib/errorDetails';
import { toastError } from '@/lib/linkToast';

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

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) closeErrorDetails(); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Error Details</DialogTitle>
          <DialogDescription>{entry?.message}</DialogDescription>
        </DialogHeader>
        <pre className="max-h-[50vh] overflow-auto whitespace-pre-wrap break-words rounded-md border bg-muted/40 p-3 font-mono text-meta">
          {entry?.details}
        </pre>
        <DialogFooter>
          <Button onClick={() => { if (entry) copyWithToast(errorDetailsText(entry)); }}>
            <Copy className="mr-2 h-4 w-4" />
            Copy
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
