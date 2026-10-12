import { useState } from 'react';
import { ExternalLink } from 'lucide-react';
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
import { Checkbox } from '@/components/ui/checkbox';
import { useClosingSnapshot } from '@/lib/useClosingSnapshot';
import { WIKI_CONFIRM_COPY } from './formaquestionSettingsTabs';

/** What the confirm names: the docs page Open Wiki goes to, or null for the wiki home. */
export interface WikiConfirm {
  /** The page as the player reads its title. */
  page: string | null;
}

/**
 * The confirm before Open Wiki leaves the app. Open reports whether Don't Ask Again was checked; Cancel and Escape
 * leave the checkbox unused, so a cancel never turns the confirm off. `confirm` is null while the dialog is shut.
 */
export function WikiConfirmDialog({ confirm, onOpen, onCancel, returnFocus }: {
  confirm: WikiConfirm | null;
  onOpen: (dontAskAgain: boolean) => void;
  onCancel: () => void;
  /** The control that opened the confirm. The layer under the dialog is inert as the dialog opens, so the dialog cannot find it alone. */
  returnFocus: () => HTMLElement | null;
}) {
  const [dontAsk, setDontAsk] = useState(false);
  const shown = useClosingSnapshot(confirm !== null, confirm);
  return (
    <AlertDialog
      open={confirm !== null}
      onOpenChange={(next) => {
        if (next) return;
        setDontAsk(false);
        onCancel();
      }}
    >
      <AlertDialogContent
        surface="formaquestionWikiConfirm"
        onCloseAutoFocus={(event) => {
          const opener = returnFocus();
          if (!opener?.isConnected) return;
          event.preventDefault();
          opener.focus();
        }}
      >
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <ExternalLink className="h-4 w-4 shrink-0" aria-hidden />
            {WIKI_CONFIRM_COPY.title}
          </AlertDialogTitle>
          <AlertDialogDescription>{WIKI_CONFIRM_COPY.description(shown?.page ?? null)}</AlertDialogDescription>
        </AlertDialogHeader>
        <label className="flex items-center gap-2 text-label">
          <Checkbox checked={dontAsk} onCheckedChange={(checked) => setDontAsk(checked === true)} />
          {WIKI_CONFIRM_COPY.dontAsk}
        </label>
        <AlertDialogFooter>
          <AlertDialogCancel>{WIKI_CONFIRM_COPY.cancel}</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              const skip = dontAsk;
              setDontAsk(false);
              onOpen(skip);
            }}
          >
            {WIKI_CONFIRM_COPY.open}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
