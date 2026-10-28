import { useMemo } from 'react';
import { Copy, X } from 'lucide-react';
import { Hint } from '@/components/ui/typography';
import type { ListEditorAdapter } from '@/components/listEditorHooks';
import { useGameData } from '@/contexts/GameDataContext';
import { arrayMove } from '@dnd-kit/sortable';
import { blankItem, duplicateItem } from '@/lib/items';
import { randomUUID } from '@/lib/uuid';
import type { ItemPanelTab } from '@/views/itemPanelTabs';
import ItemManager from './ItemManager';

/**
 * The World Editor's Items tab as a List Editor adapter: a flat list in authored order (Q71), drag to
 * reorder, and the item panel. The panel's tab and open placeholder are held by the host, so they survive a
 * switch between items.
 */
export function useWorldItemsAdapter({ selectedId, onSelect, tab, onTabChange, placeholderId, onPlaceholderIdChange, onOpenWorldPlaceholder }: {
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  tab: ItemPanelTab;
  onTabChange: (tab: ItemPanelTab) => void;
  placeholderId: string | null;
  onPlaceholderIdChange: (id: string | null) => void;
  onOpenWorldPlaceholder: (id: string) => void;
}): ListEditorAdapter {
  const { items, setItems, removeItem, placeholders, placementLetters, placeholderOwners } = useGameData();
  const byId = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);

  const add = (typed: string) => {
    const id = randomUUID();
    setItems([...items, blankItem(id, typed || undefined)]);
    onSelect(id);
  };
  const duplicate = (id: string) => {
    const next = duplicateItem(items, id);
    setItems(next.items);
    onSelect(next.newId);
  };
  const remove = (id: string) => {
    removeItem(id);
    if (selectedId === id) onSelect(null);
  };

  const detail = (id: string | null) => {
    const item = id ? byId.get(id) : undefined;
    if (item) {
      return (
        <ItemManager
          key={item.id}
          item={item}
          tab={tab}
          onTabChange={onTabChange}
          placeholderId={placeholderId}
          onPlaceholderIdChange={onPlaceholderIdChange}
          onOpenWorldPlaceholder={onOpenWorldPlaceholder}
        />
      );
    }
    return (
      <div className="space-y-2">
        <span className="font-medium">Items</span>
        <Hint>Lists the objects the player and entities can own</Hint>
      </div>
    );
  };

  return {
    rows: () => items.map((item) => ({
      id: item.id,
      name: item.name,
      sortable: true,
      actions: [
        { icon: <Copy className="h-4 w-4" />, title: 'Duplicate', onClick: () => duplicate(item.id) },
        { icon: <X className="h-4 w-4" />, destructive: true, title: 'Delete', onClick: () => remove(item.id) },
      ],
    })),
    names: { placeholders, letters: placementLetters, owners: placeholderOwners },
    noun: 'items',
    detail,
    // The tabbed item panel keeps its strip above a body that scrolls itself.
    fills: (id) => byId.has(id),
    onReorder: (activeId, overId) => {
      const from = items.findIndex((i) => i.id === activeId);
      const to = items.findIndex((i) => i.id === overId);
      if (from !== -1 && to !== -1 && from !== to) setItems(arrayMove(items, from, to));
    },
    add: { label: 'Add Item', onAdd: add },
    placeholder: 'Filter Items',
    holds: (id) => byId.has(id),
    isEmpty: items.length === 0,
    emptyHint: <Hint className="p-3">Add an item the player or an entity can own</Hint>,
  };
}
