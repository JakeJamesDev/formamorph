import { useState } from "react";
import { toast } from "react-toastify";
import { toastError } from "@/lib/linkToast";
import { useMountedRef } from "@/lib/useMountedRef";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { MarkdownRenderer } from "@/components/game/MarkdownRenderer";
import { ChangelogEntryDialog } from "@/components/community/ChangelogEntryDialog";
import WorldStorageService from "@/services/WorldStorageService";
import {
  CHANGELOG_MAX_ENTRIES,
  formatChangelogDate,
  sortChangelogEntries,
  type ChangelogDraft,
  type ChangelogEntry,
} from "@/lib/listingChangelog";
import {
  HELD_CHANGE_TOAST, changelogCountAfter, withHeldCreate, type HeldChangelogEntry, type PendingUpdate,
} from "@/lib/listingModeration";

interface ChangelogPanelProps {
  /** The listing these entries belong to, as the server knows it. */
  worldId: string;
  entries: ChangelogEntry[];
  /** Hands the panel's edits back to the modal holding the list. */
  onEntriesChange: (entries: ChangelogEntry[]) => void;
  /** Whether the reader is the listing's author (or staff), and so may write here. */
  canEdit: boolean;
  /** Entries a pending update adds, listed first with a Pending tag. */
  held?: HeldChangelogEntry[];
  /** The listing's pending update, which a held write joins. */
  pendingUpdate?: PendingUpdate | null;
  /** Hands back the pending update after a write the server held for review. */
  onPendingUpdateChange?: (update: PendingUpdate) => void;
}

/** A held entry in the shape the list and the popup read. */
const asEntry = (worldId: string, entry: HeldChangelogEntry): ChangelogEntry => ({
  id: entry.id, world_id: worldId, title: entry.title, body: entry.body, entry_date: entry.date,
  created_at: '', updated_at: '',
});

/**
 * A listing's update history, and — for its author — the controls that maintain it.
 *
 * Entries are re-sorted after every write rather than appended, because an author backfilling history
 * dates entries into the middle of it.
 */
export function ChangelogPanel({
  worldId, entries, onEntriesChange, canEdit, held = [], pendingUpdate, onPendingUpdateChange,
}: ChangelogPanelProps) {
  const [editing, setEditing] = useState<ChangelogEntry | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<ChangelogEntry | null>(null);
  const mounted = useMountedRef();

  const heldIds = new Set(held.map((entry) => entry.id));
  const shown = [...held.map((entry) => asEntry(worldId, entry)), ...entries];
  const full = changelogCountAfter(entries.map((entry) => entry.id), pendingUpdate) >= CHANGELOG_MAX_ENTRIES;

  const openAdd = () => { setEditing(null); setDialogOpen(true); };
  const openEdit = (entry: ChangelogEntry) => { setEditing(entry); setDialogOpen(true); };

  // A held write leaves the live entries as they are: the server answers the pending update instead.
  const heldWrite = (update: PendingUpdate, entryId: string) => {
    onPendingUpdateChange?.(update);
    if (!heldIds.has(entryId)) toast.info(HELD_CHANGE_TOAST);
  };

  // Thrown rather than caught: the popup keeps the draft on screen and shows the refusal beside the field.
  const handleSubmit = async (draft: ChangelogDraft) => {
    if (editing) {
      const updated = await WorldStorageService.updateChangelogEntry(worldId, editing.id, draft);
      if (!mounted.current) return;
      if (updated.pending_update) return heldWrite(updated.pending_update, editing.id);
      onEntriesChange(sortChangelogEntries(entries.map((e) => (e.id === updated.id ? updated : e))));
      return;
    }

    const created = await WorldStorageService.createChangelogEntry(worldId, draft);
    if (!mounted.current) return;
    if (created.pending) {
      onPendingUpdateChange?.(withHeldCreate(pendingUpdate, {
        id: created.id, title: created.title, body: created.body, date: created.entry_date,
      }));
      return;
    }
    onEntriesChange(sortChangelogEntries([...entries, created]));
  };

  const handleDelete = async (entry: ChangelogEntry) => {
    try {
      const update = await WorldStorageService.deleteChangelogEntry(worldId, entry.id);
      if (!mounted.current) return;
      if (update) heldWrite(update, entry.id);
      else onEntriesChange(entries.filter((e) => e.id !== entry.id));
    } catch (error) {
      if (mounted.current) toastError(error, 'Failed to delete the entry');
    }
  };

  return (
    <div className="space-y-3">
      {canEdit && (
        <div className="space-y-1">
          <Button size="sm" variant="outline" onClick={openAdd} disabled={full}>
            <Plus className="mr-2 h-4 w-4" /> Add Entry
          </Button>
          {full && (
            <p className="text-meta text-muted-foreground">
              A changelog holds {CHANGELOG_MAX_ENTRIES} entries. Delete one to add another.
            </p>
          )}
        </div>
      )}

      {shown.length === 0 ? (
        <p className="text-helper text-muted-foreground">
          {canEdit
            ? 'No entries yet. Add one to start this listing’s history — including updates you made before now.'
            : 'No changelog yet.'}
        </p>
      ) : (
        shown.map((entry) => (
          <div key={entry.id} className="border-b border-border/50 pb-2 last:border-0 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span className="flex min-w-0 items-center gap-2">
                <span className="min-w-0 truncate text-title font-semibold">{entry.title}</span>
                {heldIds.has(entry.id) && (
                  <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-meta">Pending</span>
                )}
              </span>
              <span className="flex shrink-0 items-center gap-1 text-meta text-muted-foreground">
                {formatChangelogDate(entry.entry_date)}
                {canEdit && (
                  <span className="flex items-center">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      aria-label={`Edit ${entry.title}`}
                      onClick={() => openEdit(entry)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive/80"
                      aria-label={`Delete ${entry.title}`}
                      onClick={() => setPendingDelete(entry)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </span>
                )}
              </span>
            </div>
            <div className="mt-1 min-w-0 text-muted-foreground"><MarkdownRenderer text={entry.body} /></div>
          </div>
        ))
      )}

      <ChangelogEntryDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        entry={editing ? { title: editing.title, body: editing.body, date: editing.entry_date } : null}
        onSubmit={handleSubmit}
      />

      <ConfirmDialog
        open={!!pendingDelete}
        onOpenChange={(isOpen) => { if (!isOpen) setPendingDelete(null); }}
        title="Delete this entry?"
        description="It goes for good. The rest of the changelog stays as it is."
        onConfirm={() => {
          const entry = pendingDelete;
          setPendingDelete(null);
          if (entry) void handleDelete(entry);
        }}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}
