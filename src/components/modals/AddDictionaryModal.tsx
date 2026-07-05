import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import DictionaryStorageService from '@/services/DictionaryStorageService';
import type { Dictionary, DictionaryMetadata } from '@/types';

/**
 * Pick one or more dictionaries from the local library and add a copy of each to the world being edited.
 * Every copy gets fresh ids (book + entries) so it's independent of the library original.
 */
const AddDictionaryModal = ({ open, onOpenChange, onAdd }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (book: Dictionary) => void;
}) => {
  const [list, setList] = useState<DictionaryMetadata[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open) return;
    setSelectedIds(new Set());
    setLoading(true);
    DictionaryStorageService.getDictionaryMetadata()
      .then(setList)
      .catch(() => setList([]))
      .finally(() => setLoading(false));
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
    const ordered = list.filter((d) => selectedIds.has(d.id));
    const books = await Promise.all(
      ordered.map((d) => DictionaryStorageService.getDictionaryData(d.id).catch(() => null)),
    );
    for (const book of books) {
      if (!book) continue;
      onAdd({
        ...book,
        id: crypto.randomUUID(),
        entries: book.entries.map((e) => ({ ...e, id: crypto.randomUUID() })),
      });
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Add Dictionary</DialogTitle>
          <DialogDescription>Add copies of saved dictionaries from your library to this world.</DialogDescription>
        </DialogHeader>
        {loading ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Loading…</p>
        ) : list.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No saved dictionaries yet — import one from the Dictionaries tab on the main menu first.
          </p>
        ) : (
          <ScrollArea className="max-h-[50vh] pr-2">
            <div className="space-y-1">
              {list.map((d) => (
                <div
                  key={d.id}
                  onClick={() => toggle(d.id, !selectedIds.has(d.id))}
                  className="flex items-center gap-2 rounded-md p-2 cursor-pointer hover:bg-secondary"
                >
                  <Checkbox
                    checked={selectedIds.has(d.id)}
                    onCheckedChange={(v) => toggle(d.id, v === true)}
                    onClick={(e) => e.stopPropagation()}
                    className="shrink-0"
                  />
                  <span className="flex-grow truncate">{d.name}</span>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {d.entryCount ?? 0} {d.entryCount === 1 ? 'entry' : 'entries'}
                  </span>
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
};

export default AddDictionaryModal;
