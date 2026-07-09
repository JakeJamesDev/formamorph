import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { User } from 'lucide-react';
import EntityStorageService from '@/services/EntityStorageService';
import type { Entity, EntityMetadata } from '@/types';

/**
 * Pick one or more characters from the local library and add a copy of each to the world being edited.
 * Every copy gets a fresh id so it's independent of the library original.
 */
const AddEntityModal = ({ open, onOpenChange, onAdd }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (entity: Entity) => void;
}) => {
  const [list, setList] = useState<EntityMetadata[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open) return;
    setSelectedIds(new Set());
    setLoading(true);
    EntityStorageService.getEntityMetadata()
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
    const ordered = list.filter((e) => selectedIds.has(e.id));
    const loaded = await Promise.all(
      ordered.map((e) => EntityStorageService.getEntityData(e.id).catch(() => null)),
    );
    for (const entity of loaded) {
      if (!entity) continue;
      onAdd({ ...entity, id: crypto.randomUUID() });
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Add Character</DialogTitle>
          <DialogDescription>Add copies of saved characters from your library to this world.</DialogDescription>
        </DialogHeader>
        {loading ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Loading…</p>
        ) : list.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No saved characters yet — import one from the Entities tab on the main menu first.
          </p>
        ) : (
          <ScrollArea className="max-h-[50vh] pr-2">
            <div className="space-y-1">
              {list.map((e) => (
                <div
                  key={e.id}
                  onClick={() => toggle(e.id, !selectedIds.has(e.id))}
                  className="flex items-center gap-2 rounded-md p-2 cursor-pointer hover:bg-secondary"
                >
                  <Checkbox
                    checked={selectedIds.has(e.id)}
                    onCheckedChange={(v) => toggle(e.id, v === true)}
                    onClick={(ev) => ev.stopPropagation()}
                    className="shrink-0"
                  />
                  <div className="h-8 w-8 shrink-0 overflow-hidden rounded bg-muted flex items-center justify-center">
                    {e.image ? (
                      <img src={e.image} alt={e.name} className="h-full w-full object-cover" />
                    ) : (
                      <User className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                  <span className="min-w-0 flex-grow truncate">{e.name}</span>
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

export default AddEntityModal;
