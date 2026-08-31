import { useMemo, useState } from 'react';
import { Filter } from 'lucide-react';
import { randomUUID } from "@/lib/uuid";
import { collectPlaceholderParts, remintPlaceholderDef } from "@/lib/placeholders";
import { Button } from '@/components/ui/button';
import { Tip } from '@/components/ui/tooltip';
import { SortableList } from '@/components/SortableList';
import { reorderVisible } from '@/lib/sortableOrder';
import { EmptyListHint } from '@/components/EmptyListHint';
import { usePlaceholderStore } from '@/contexts/PlaceholderStoreContext';
import { cn } from '@/lib/utils';
import type { Placeholder } from '@/types';

// The brief label decides; this defines. A part is the same thing the kind selector's ⓘ names, worded for
// an author looking at a list rather than at one placeholder's values.
const PARTS_TIP = 'A part is a placeholder held as one whole value of another. Hiding them leaves the things you place in world text.';

/** Left-hand list of the scoped store's placeholders: select, drag-reorder, duplicate, delete. A filter hides
 *  the ones held as parts of others, and a part says how many placeholders hold it. Adding is the caller's
 *  concern (a toolbar button), mirroring how the World Editor and library editor place their own. */
const PlaceholderList = ({ selectedId, onSelect }: { selectedId: string | null; onSelect: (id: string | null) => void }) => {
  const { placeholders, setPlaceholders, removePlaceholder } = usePlaceholderStore();
  const [hideParts, setHideParts] = useState(false);
  // Who holds whom, read off the value lists themselves rather than scanned for a second time here.
  const parts = useMemo(() => collectPlaceholderParts(placeholders), [placeholders]);
  const names = useMemo(() => new Map(placeholders.map((p) => [p.id, p.name])), [placeholders]);
  // Counted over the rows, not over the map: a lone-chip value can name a placeholder that has since been
  // deleted, which keys `parts` without putting a part in front of the author. Offering the filter for one
  // of those is offering a control that visibly does nothing.
  const partRows = placeholders.filter((p) => parts.has(p.id)).length;
  const shown = hideParts ? placeholders.filter((p) => !parts.has(p.id)) : placeholders;

  const remove = (id: string) => { removePlaceholder(id); if (selectedId === id) onSelect(null); };
  const duplicate = (id: string) => {
    setPlaceholders((prev) => {
      const i = prev.findIndex((p) => p.id === id);
      if (i === -1) return prev;
      // Re-mint value-chip placements so the copy never shares a nested Unique roll with the original.
      const copy = { ...remintPlaceholderDef(prev[i]), id: randomUUID(), name: `${prev[i].name} (Copy)` };
      onSelect(copy.id);
      return [...prev.slice(0, i + 1), copy, ...prev.slice(i + 1)];
    });
  };

  // A drop lands in the list the author can see, which the filter may have thinned — so it is folded back
  // into the whole list rather than written over it.
  const reorder = (next: Placeholder[]) => setPlaceholders((prev) => reorderVisible(prev, next));

  if (placeholders.length === 0) return <EmptyListHint noun="placeholders" />;
  return (
    // `flex`, not `space-y`: the drag context between this and the rows draws no box, and a margin on a
    // `display: contents` element is not painted — the gap would silently be zero.
    <div className="flex flex-col gap-1">
      {partRows > 0 && (
        <div className="flex justify-end">
          <Tip tip={PARTS_TIP} labelsChild={false}>
            <Button
              type="button"
              // A ghost button says nothing about being pressed, and this one's whole job is to say whether
              // the list in front of the author is the whole list.
              variant={hideParts ? 'secondary' : 'ghost'}
              size="sm"
              aria-pressed={hideParts}
              className={cn('h-6 gap-1 px-2 text-helper', !hideParts && 'text-muted-foreground')}
              onClick={() => setHideParts((h) => !h)}
            >
              <Filter className="h-3.5 w-3.5" /> Hide Parts
            </Button>
          </Tip>
        </div>
      )}
      {shown.length === 0 ? (
        <p className="text-helper text-muted-foreground p-2">Every placeholder here is a part of another one.</p>
      ) : (
        <SortableList
          items={shown}
          selectedId={selectedId}
          meta={(p) => {
            const holders = parts.get(p.id);
            return holders && {
              text: `Used by ${holders.length}`,
              title: `Held as a value of ${holders.map((id) => names.get(id) ?? '?').join(', ')}`,
            };
          }}
          onSelect={onSelect}
          onRemove={remove}
          onDuplicate={duplicate}
          onReorder={reorder}
        />
      )}
    </div>
  );
};

export default PlaceholderList;
