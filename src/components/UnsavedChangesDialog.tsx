import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./ui/alert-dialog";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Three-choice prompt shown when leaving the world editor with pending changes: save & exit, exit
 *  without saving (destructive), or cancel/keep editing. */
export function UnsavedChangesDialog({
  open,
  onOpenChange,
  onSave,
  onExit,
  autoSaved = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: () => void;
  onExit: () => void;
  /** An auto save wrote the world during this visit, so Exit drops only the changes since the last save. */
  autoSaved?: boolean;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Unsaved changes</AlertDialogTitle>
          <AlertDialogDescription>
            {autoSaved
              ? 'You have unsaved changes. “Exit Without Saving” drops only the changes since the last save. Auto Save kept the rest.'
              : 'You have unsaved changes. Save them before leaving, exit without saving, or keep editing.'}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className={cn(buttonVariants({ variant: "destructive" }))}
            onClick={onExit}
          >
            Exit Without Saving
          </AlertDialogAction>
          <AlertDialogAction onClick={onSave}>Save &amp; Exit</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
