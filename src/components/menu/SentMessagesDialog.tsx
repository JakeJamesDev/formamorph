import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { SentMessageList } from "@/components/menu/SentMessageList";

interface SentMessagesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Narrows to this user's direct history. */
  userId?: string;
  /** The filtered user's name, for the dialog title. */
  username?: string;
  /** Bumped by the parent after a send, to pull the new message into an already-open list. */
  refreshNonce?: number;
}

/** One user's direct-message history, opened from a row in the Users tab. Broadcasts have their own tab. */
export function SentMessagesDialog({ open, onOpenChange, userId, username, refreshNonce = 0 }: SentMessagesDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[720px] max-h-[85dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{username ? `Messages to ${username}` : 'All Messages'}</DialogTitle>
          <DialogDescription>
            Direct messages, including recalled ones. Broadcasts are under the Broadcasts tab.
          </DialogDescription>
        </DialogHeader>

        {/* `min-w-0`: DialogContent is a grid, and a grid item's `min-width: auto` lets a long subject
            widen the dialog past its max width instead of ellipsing. */}
        <div className="py-2 min-w-0">
          <SentMessageList audience="direct" userId={userId} refreshNonce={refreshNonce} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
