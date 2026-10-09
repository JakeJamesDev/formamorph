import { useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { WorldChange } from '@/lib/worldChangeSignal';

const COPY = {
  saved: {
    title: 'World Saved in Another Tab',
    body: 'Another tab saved this world. Close the other tab, then choose a copy. “Reload” opens the other tab’s'
      + ' save and discards your unsaved changes here. “Keep Mine” keeps this copy, and your next save replaces the other one.',
    leave: 'Reload',
  },
  deleted: {
    title: 'World Deleted in Another Tab',
    body: 'Another tab deleted this world. “Keep Mine” saves this copy back to your library. “Close” leaves the'
      + ' editor and discards your unsaved changes.',
    leave: 'Close',
  },
} as const;

/**
 * Asks what to do after another tab saved or deleted the open world. It takes no `onOpenChange`, so only an
 * answer closes it. `onLeave` is Reload after a save and Close after a delete; both discard this tab's edits.
 */
export function ChangedElsewhereDialog({ change, onLeave, onKeepMine }: {
  change: WorldChange | null;
  onLeave: () => void;
  onKeepMine: () => void;
}) {
  // The last kind stays on screen while the alert closes.
  const [shown, setShown] = useState<WorldChange>(change ?? 'saved');
  if (change && change !== shown) setShown(change);
  const kind = change ?? shown;
  const copy = COPY[kind];
  return (
    <AlertDialog open={change !== null}>
      <AlertDialogContent surface={kind === 'deleted' ? 'deletedElsewhere' : 'savedElsewhere'}>
        <AlertDialogHeader>
          <AlertDialogTitle>{copy.title}</AlertDialogTitle>
          <AlertDialogDescription>{copy.body}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction
            className={cn(buttonVariants({ variant: 'destructive' }))}
            onClick={(event) => { event.preventDefault(); onLeave(); }}
          >
            {copy.leave}
          </AlertDialogAction>
          <AlertDialogAction onClick={(event) => { event.preventDefault(); onKeepMine(); }}>Keep Mine</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
