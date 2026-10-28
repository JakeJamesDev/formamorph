import { useState } from "react";
import { toast } from "react-toastify";
import { GitCompare, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PendingUpdateTable } from "@/components/community/PendingUpdateTable";
import { toastError } from "@/lib/linkToast";
import type { PendingUpdate } from "@/lib/listingModeration";
import type { ChangelogEntry } from "@/lib/listingChangelog";
import { useMountedRef } from "@/lib/useMountedRef";
import ReviewService from "@/services/ReviewService";

interface PendingUpdateSectionProps {
  listingId: string;
  name: string;
  update: PendingUpdate;
  liveThumbnail?: string;
  approvedChangelog?: ChangelogEntry[] | null;
  /** Called once the server dropped the update. */
  onDiscarded: () => void;
  /** The viewer wrote the listing: shows Discard Update and words the compare for the author. */
  viewerIsAuthor?: boolean;
  /** Opens the compare view on mount, for the dev route. */
  initialCompareOpen?: boolean;
}

/** A waiting update's compare view, and for its author a way to withdraw it. */
export function PendingUpdateSection({
  listingId, name, update, liveThumbnail, approvedChangelog, onDiscarded, viewerIsAuthor = true, initialCompareOpen = false,
}: PendingUpdateSectionProps) {
  const [comparing, setComparing] = useState(initialCompareOpen);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const mounted = useMountedRef();

  const discard = async () => {
    setBusy(true);
    try {
      const dropped = await ReviewService.discardUpdate(listingId);
      if (!mounted.current) return;
      if (dropped) toast.success('Update discarded');
      else toast.info('This update is no longer waiting for review');
      onDiscarded();
    } catch (error) {
      if (mounted.current) toastError(error, 'Failed to discard the update');
    } finally {
      if (mounted.current) setBusy(false);
    }
  };

  return (
    <section className="space-y-1" aria-labelledby="pending-update-heading">
      <h3 id="pending-update-heading" className="text-helper font-semibold text-muted-foreground">Pending Update</h3>
      <div className="flex flex-wrap gap-2">
        {viewerIsAuthor && (
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setConfirming(true)} disabled={busy}>
            <Trash2 className="h-3.5 w-3.5" /> Discard Update
          </Button>
        )}
        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setComparing(true)}>
          <GitCompare className="h-3.5 w-3.5" /> Compare
        </Button>
      </div>

      <Dialog open={comparing} onOpenChange={setComparing}>
        <DialogContent className="sm:max-w-[720px] max-h-[85dvh] flex flex-col">
          <DialogHeader className="shrink-0">
            <DialogTitle className="truncate">Compare: {name}</DialogTitle>
            <DialogDescription>{viewerIsAuthor ? 'What players see now, beside what your update changes' : 'What players see now, beside what the update changes'}</DialogDescription>
          </DialogHeader>
          <ScrollArea className="flex-1 min-h-0">
            <PendingUpdateTable update={update} liveThumbnail={liveThumbnail} approvedChangelog={approvedChangelog} />
          </ScrollArea>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title="Discard your update?"
        description="Players keep the live version. You can't undo this."
        confirmLabel="Discard Update"
        destructive
        onConfirm={() => { setConfirming(false); void discard(); }}
        onCancel={() => setConfirming(false)}
      />
    </section>
  );
}
