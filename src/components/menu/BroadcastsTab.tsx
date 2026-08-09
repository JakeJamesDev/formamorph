import { useState } from "react";
import { Megaphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MessageComposerDialog } from "@/components/menu/MessageComposerDialog";
import { SentMessageList } from "@/components/menu/SentMessageList";
import AuthService from "@/services/AuthService";
import type { SentMessage } from "@/types";

interface BroadcastsTabProps {
  /** Whether the tab is visible; the list only fetches while it is. */
  active: boolean;
}

/** Admin Panel → Broadcasts. Sends messages to everyone and lists what has already gone out. */
export function BroadcastsTab({ active }: BroadcastsTabProps) {
  const [composing, setComposing] = useState(false);
  // Set to the broadcast being rewritten; the composer serves both send and edit.
  const [editing, setEditing] = useState<SentMessage | null>(null);
  // Bumped after a send so the list below picks the new broadcast up.
  const [sentNonce, setSentNonce] = useState(0);

  const adminUsername = String(AuthService.getCurrentUser()?.username || 'Admin');

  return (
    <div className="py-4 min-w-0">
      <div className="flex items-center justify-between gap-4 mb-4">
        <p className="text-helper text-muted-foreground">
          Messages sent to every account. Pinned ones also reach accounts created later.
        </p>

        <Button size="sm" className="shrink-0" onClick={() => setComposing(true)}>
          <Megaphone className="mr-2 h-4 w-4" /> New Broadcast
        </Button>
      </div>

      {/* Always mounted, with `active` gating the fetch instead: the Admin Panel plays a close animation,
          and unmounting the list the moment `active` goes false empties the dialog while it is still on
          screen. Same reason the other tabs pass `active` down rather than rendering on it. */}
      <SentMessageList
        active={active}
        audience="broadcast"
        refreshNonce={sentNonce}
        emptyLabel="No broadcasts sent yet."
        onEdit={setEditing}
      />

      {composing && (
        <MessageComposerDialog
          open
          onOpenChange={(isOpen) => { if (!isOpen) setComposing(false); }}
          target={{ broadcast: true, recipients: [] }}
          adminUsername={adminUsername}
          onSent={() => setSentNonce((n) => n + 1)}
        />
      )}

      {editing && (
        <MessageComposerDialog
          open
          onOpenChange={(isOpen) => { if (!isOpen) setEditing(null); }}
          target={{ broadcast: true, recipients: [] }}
          adminUsername={adminUsername}
          editing={editing}
          onSent={() => setSentNonce((n) => n + 1)}
        />
      )}
    </div>
  );
}
