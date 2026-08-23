import { useState } from "react";
import { toast } from "react-toastify";
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

interface ChangelogPanelProps {
  /** The listing these entries belong to, as the server knows it. */
  worldId: string;
  entries: ChangelogEntry[];
  /** Hands the panel's edits back to the modal holding the list. */
  onEntriesChange: (entries: ChangelogEntry[]) => void;
  /** Whether the reader is the listing's author (or staff), and so may write here. */
  canEdit: boolean;
}

/**
 * A listing's update history, and — for its author — the controls that maintain it.
 *
 * Entries are re-sorted after every write rather than appended, because an author backfilling history
 * dates entries into the middle of it.
 */
export function ChangelogPanel({ worldId, entries, onEntriesChange, canEdit }: ChangelogPanelProps) {
  const [editing, setEditing] = useState<ChangelogEntry | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<ChangelogEntry | null>(null);

  const full = entries.length >= CHANGELOG_MAX_ENTRIES;

  const openAdd = () => { setEditing(null); setDialogOpen(true); };
  const openEdit = (entry: ChangelogEntry) => { setEditing(entry); setDialogOpen(true); };

  // Thrown rather than caught: the popup keeps the draft on screen and shows the refusal beside the field.
  const handleSubmit = async (draft: ChangelogDraft) => {
    if (editing) {
      const updated = await WorldStorageService.updateChangelogEntry(worldId, editing.id, draft);
      onEntriesChange(sortChangelogEntries(entries.map((e) => (e.id === updated.id ? updated : e))));
      return;
    }

    const created = await WorldStorageService.createChangelogEntry(worldId, draft);
    onEntriesChange(sortChangelogEntries([...entries, created]));
  };

  const handleDelete = async (entry: ChangelogEntry) => {
    try {
      await WorldStorageService.deleteChangelogEntry(worldId, entry.id);
      onEntriesChange(entries.filter((e) => e.id !== entry.id));
    } catch (error) {
      toast.error((error as Error).message || 'Failed to delete the entry');
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

      {entries.length === 0 ? (
        <p className="text-helper text-muted-foreground">
          {canEdit
            ? 'No entries yet. Add one to start this listing’s history — including updates you made before now.'
            : 'No changelog yet.'}
        </p>
      ) : (
        entries.map((entry) => (
          <div key={entry.id} className="border-b border-border/50 pb-2 last:border-0 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span className="min-w-0 truncate text-title font-semibold">{entry.title}</span>
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
