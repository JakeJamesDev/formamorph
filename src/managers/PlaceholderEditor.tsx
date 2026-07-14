import { randomUUID } from "@/lib/uuid";
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus } from 'lucide-react';
import { usePlaceholderStore } from '@/contexts/PlaceholderStoreContext';
import PlaceholderList from './PlaceholderList';
import PlaceholderManager from './PlaceholderManager';
import type { Placeholder } from '@/types';

/**
 * Self-contained placeholder editor — the same two-column list + right-panel layout as the World Editor's
 * Placeholders tab (mirrors the standalone Dictionary editor's shape), bound to the scoped `PlaceholderStore`
 * from context. Fills its flex parent; the caller sizes it. Reuses `PlaceholderList` + `PlaceholderManager`.
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
    <div className="flex-1 min-h-0 flex">
      <ScrollArea className="w-1/2 min-w-0 border-r">
        <div className="p-2 space-y-2">
          <Button size="sm" onClick={add} className="w-full">
            <Plus className="h-4 w-4 mr-1" /> Add Placeholder
          </Button>
          <PlaceholderList selectedId={selectedId} onSelect={setSelectedId} />
        </div>
      </ScrollArea>
      <ScrollArea className="w-1/2 min-w-0">
        <div className="p-4">
          {selected ? (
            <PlaceholderManager key={selected.id} placeholder={selected} />
          ) : (
            <p className="text-sm text-muted-foreground">Select a placeholder on the left to edit it, or add one.</p>
          )}
        </div>
      </ScrollArea>
    </div>
  );
};

export default PlaceholderEditor;
