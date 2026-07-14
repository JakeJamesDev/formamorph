import { randomUUID } from "@/lib/uuid";
import { SortableList } from '@/components/SortableList';
import { EmptyListHint } from '@/components/EmptyListHint';
import { usePlaceholderStore } from '@/contexts/PlaceholderStoreContext';

/** Left-hand list of the scoped store's placeholders: select, drag-reorder, duplicate, delete. Adding is the
 *  caller's concern (a toolbar button), mirroring how the World Editor and library editor place their own. */
const PlaceholderList = ({ selectedId, onSelect }: { selectedId: string | null; onSelect: (id: string | null) => void }) => {
  const { placeholders, setPlaceholders, removePlaceholder } = usePlaceholderStore();

  const remove = (id: string) => { removePlaceholder(id); if (selectedId === id) onSelect(null); };
  const duplicate = (id: string) => {
    setPlaceholders((prev) => {
      const i = prev.findIndex((p) => p.id === id);
      if (i === -1) return prev;
      const copy = { ...prev[i], id: randomUUID(), name: `${prev[i].name} (Copy)` };
      onSelect(copy.id);
      return [...prev.slice(0, i + 1), copy, ...prev.slice(i + 1)];
    });
  };

  if (placeholders.length === 0) return <EmptyListHint noun="placeholders" />;
  return (
    <SortableList
      items={placeholders}
      selectedId={selectedId}
      onSelect={onSelect}
      onRemove={remove}
      onDuplicate={duplicate}
      onReorder={setPlaceholders}
    />
  );
};

export default PlaceholderList;
