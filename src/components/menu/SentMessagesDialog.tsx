import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { SentMessageList } from "@/components/menu/SentMessageList";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { SentMessage } from "@/types";

interface SentMessagesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Narrows to this user's direct history. */
  userId?: string;
  /** The filtered user's name, for the dialog title. */
  username?: string;
  /** Bumped by the parent after a send, to pull the new message into an already-open list. */
  refreshNonce?: number;
  /** Opens the edit form for a message. Omit to hide the action. */
  onEdit?: (message: SentMessage) => void;
}

/** One user's direct-message history, opened from a row in the Users tab. Broadcasts have their own tab. */
export function SentMessagesDialog({ open, onOpenChange, userId, username, refreshNonce = 0, onEdit }: SentMessagesDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[720px] max-h-[85dvh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{username ? `Messages to ${username}` : 'All Messages'}</DialogTitle>
          <DialogDescription>
            Direct messages, including recalled ones. Broadcasts are under the Broadcasts tab.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 min-h-0">
          <div className="py-2">
            <SentMessageList audience="direct" userId={userId} refreshNonce={refreshNonce} onEdit={onEdit} />
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
