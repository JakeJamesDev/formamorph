import { useEffect, useState, type ReactNode } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';

/**
 * Generic "add copies from the local library" picker: lists lightweight metadata records, lets the user
 * multi-select, loads the full record for each pick, and hands a fresh-id copy to `onAdd`. The concrete
 * modals (dictionaries, characters) supply the data source, the copy transform, and the per-row body.
 */
interface AddFromLibraryModalProps<TMeta extends { id: string }, TFull, TItem> {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (item: TItem) => void;
  title: string;
  description: string;
  /** Shown when the library has no records to pick from. */
  emptyMessage: string;
  loadMetadata: () => Promise<TMeta[]>;
  loadRecord: (id: string) => Promise<TFull | null | undefined>;
  /** Produce the independent copy (fresh ids) handed to `onAdd`. */
  copy: (record: TFull) => TItem;
  /** Row content after the checkbox — name plus any thumbnail/entry-count affordance. */
  renderRow: (meta: TMeta) => ReactNode;
}

function AddFromLibraryModal<TMeta extends { id: string }, TFull, TItem>({
  open,
  onOpenChange,
  onAdd,
  title,
  description,
  emptyMessage,
  loadMetadata,
  loadRecord,
  copy,
  renderRow,
}: AddFromLibraryModalProps<TMeta, TFull, TItem>) {
  const [list, setList] = useState<TMeta[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open) return;
    setSelectedIds(new Set());
    setLoading(true);
    loadMetadata()
      .then(setList)
      .catch(() => setList([]))
      .finally(() => setLoading(false));
    // loadMetadata is a stable service binding; re-run only when the modal (re)opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const toggle = (id: string, checked: boolean) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id); else next.delete(id);
      return next;
    });

  const handleAdd = async () => {
    if (selectedIds.size === 0) return;
    // Preserve list order; skip any record that vanished between listing and adding.
    const ordered = list.filter((m) => selectedIds.has(m.id));
    const loaded = await Promise.all(
      ordered.map((m) => loadRecord(m.id).catch(() => null)),
    );
    for (const record of loaded) {
      if (!record) continue;
      onAdd(copy(record));
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {loading ? (
          <p className="py-6 text-center text-helper text-muted-foreground">Loading…</p>
        ) : list.length === 0 ? (
          <p className="py-6 text-center text-helper text-muted-foreground">{emptyMessage}</p>
        ) : (
          <ScrollArea className="max-h-[50dvh] pr-2">
            <div className="space-y-1">
              {list.map((m) => (
                <div
                  key={m.id}
                  onClick={() => toggle(m.id, !selectedIds.has(m.id))}
                  className="flex items-center gap-2 rounded-md p-2 cursor-pointer hover:bg-secondary"
                >
                  <Checkbox
                    checked={selectedIds.has(m.id)}
                    onCheckedChange={(v) => toggle(m.id, v === true)}
                    onClick={(e) => e.stopPropagation()}
                    className="shrink-0"
                  />
                  {renderRow(m)}
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleAdd} disabled={selectedIds.size === 0}>Add</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default AddFromLibraryModal;
