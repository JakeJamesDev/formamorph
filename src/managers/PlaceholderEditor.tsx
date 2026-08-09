import { randomUUID } from "@/lib/uuid";
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { ListDetail } from '@/components/ui/list-detail';
import { usePlaceholderStore } from '@/contexts/PlaceholderStoreContext';
import PlaceholderList from './PlaceholderList';
import PlaceholderManager from './PlaceholderManager';
import type { Placeholder } from '@/types';

/**
 * Self-contained placeholder editor — a list of placeholders and the editor for the selected one, bound to the
 * scoped `PlaceholderStore` from context. `ListDetail` gives it the two-column split on desktop and a single-
 * panel push on mobile. Fills its flex parent; the caller sizes it.
 */
const PlaceholderEditor = () => {
  const { placeholders, addPlaceholder } = usePlaceholderStore();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = placeholders.find((p) => p.id === selectedId) ?? null;

  const add = () => {
    const p: Placeholder = { id: randomUUID(), name: 'New Placeholder', values: [] };
    addPlaceholder(p);
    setSelectedId(p.id);
  };

  return (
    <ListDetail
      showDetail={!!selected}
      onBack={() => setSelectedId(null)}
      backLabel="Placeholders"
      list={
        <div className="p-2 space-y-2">
          <Button size="sm" onClick={add} className="w-full">
            <Plus className="h-4 w-4 mr-1" /> Add Placeholder
          </Button>
          <PlaceholderList selectedId={selectedId} onSelect={setSelectedId} />
        </div>
      }
      detail={
        <div className="p-4">
          {selected ? (
            <PlaceholderManager key={selected.id} placeholder={selected} />
          ) : (
            <p className="text-helper text-muted-foreground">Select a placeholder to edit it, or add one.</p>
          )}
        </div>
      }
    />
  );
};

export default PlaceholderEditor;
