import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { ListDetail } from '@/components/ui/list-detail';
import { usePlaceholderStore } from '@/contexts/PlaceholderStoreContext';
import { newPlaceholder } from '@/lib/placeholders';
import { placeholderSelection } from '@/lib/placeholderTree';
import PlaceholderList from './PlaceholderList';
import PlaceholderManager from './PlaceholderManager';
import { Tip } from '@/components/ui/tooltip';

/**
 * Self-contained placeholder editor — a list of placeholders and the editor for the selected one, bound to the
 * scoped `PlaceholderStore` from context. `ListDetail` gives it the two-column split on desktop and a single-
 * panel push on mobile. Fills its flex parent; the caller sizes it.
 *
 * Selection speaks in **row ids** — the chain of placeholder ids that reached a row — because one shared
 * placeholder draws a row under every holder and each of those rows carries draw weights of its own. A bare
 * placeholder id still selects, so anything that names a placeholder rather than a row (a fresh duplicate,
 * the link to a shared row's original) lands on its first row.
 */
const PlaceholderEditor = () => {
  const { placeholders, addPlaceholder } = usePlaceholderStore();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selection = useMemo(() => placeholderSelection(placeholders, selectedId), [placeholders, selectedId]);
  const selected = selection?.row.placeholder ?? null;

  const add = () => {
    const p = newPlaceholder('New Placeholder');
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
          <Tip tip="Add Placeholder">
            <Button size="icon" onClick={add}>
              <Plus className="h-4 w-4" />
            </Button>
          </Tip>
          <PlaceholderList selectedId={selectedId} onSelect={setSelectedId} />
        </div>
      }
      detail={
        <div className="p-4">
          {selection ? (
            // Keyed by the row: two rows of one shared placeholder are two weight contexts, so the panel is
            // re-read rather than carried across.
            <PlaceholderManager
              key={selection.row.id}
              placeholder={selection.row.placeholder}
              share={selection.share}
            />
          ) : (
            <p className="text-helper text-muted-foreground">Select a placeholder to edit it, or add one.</p>
          )}
        </div>
      }
    />
  );
};

export default PlaceholderEditor;
