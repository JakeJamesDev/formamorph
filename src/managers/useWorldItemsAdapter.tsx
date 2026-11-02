import { useMemo, useState, type ReactNode } from 'react';
import { Coins, Copy, Shield, X } from 'lucide-react';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Hint } from '@/components/ui/typography';
import { currencyItemKind } from '@/lib/currencyDeletes';
import { labelPlaceholders } from '@/lib/placementLetters';
import { usedByText } from '@/lib/usedByText';
import type { ListEditorAdapter } from '@/components/listEditorHooks';
import { useGameData } from '@/contexts/GameDataContext';
import { arrayMove } from '@dnd-kit/sortable';
import { defaultCurrencyPatch } from '@/lib/currency';
import { blankItem, duplicateItem } from '@/lib/items';
import { randomUUID } from '@/lib/uuid';
import type { ItemPanelTab } from '@/views/itemPanelTabs';
import { focusFieldForItem } from '@/views/findFocus';
import type { FocusFieldHint } from '@/types';
import ItemManager from './ItemManager';
import CurrenciesEditor from './CurrenciesEditor';
import EquipmentEditor from './EquipmentEditor';

/** The selection id of the pinned Equipment Settings entry; item ids are UUIDs, so it never meets one. */
export const EQUIPMENT_ID = 'equipment';
/** The selection id of the pinned Currencies entry. */
export const CURRENCIES_ID = 'currencies';

/**
 * The World Editor's Items tab as a List Editor adapter: a flat list in authored order (Q71), drag to
 * reorder, and the item panel. The panel's tab and open placeholder are held by the host, so they survive a
 * switch between items.
 */
export function useWorldItemsAdapter({ selectedId, onSelect, tab, onTabChange, placeholderId, onPlaceholderIdChange, onOpenWorldPlaceholder, focusField }: {
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  tab: ItemPanelTab;
  onTabChange: (tab: ItemPanelTab) => void;
  placeholderId: string | null;
  onPlaceholderIdChange: (id: string | null) => void;
  onOpenWorldPlaceholder: (id: string) => void;
  /** The search target the find bar just navigated to. */
  focusField?: FocusFieldHint | null;
}): { adapter: ListEditorAdapter; dialog: ReactNode } {
  const { items, setItems, removeItem, currencies, placeholders, placementLetters, placeholderOwners } = useGameData();
  const byId = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);
  const [pending, setPending] = useState<{ id: string; name: string; text: string } | null>(null);

  const add = (typed: string) => {
    const id = randomUUID();
    setItems([...items, { ...blankItem(id, typed || undefined), ...defaultCurrencyPatch(currencies) }]);
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
  // An item that is a Currency Item asks first, naming the Currency; any other item goes at once.
  const askRemove = (id: string) => {
    const item = byId.get(id);
    const text = usedByText([currencyItemKind(currencies, id, (name) => labelPlaceholders(name, placeholders))]);
    if (item && text) setPending({ id, name: item.name, text });
    else remove(id);
  };

  const detail = (id: string | null) => {
    if (id === EQUIPMENT_ID) return <EquipmentEditor />;
    if (id === CURRENCIES_ID) return <CurrenciesEditor />;
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
          focusField={focusFieldForItem(focusField ?? null, item.id)}
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

  const adapter: ListEditorAdapter = {
    pinned: [
      { id: EQUIPMENT_ID, name: 'Equipment Settings', icon: <Shield className="h-4 w-4" aria-hidden /> },
      { id: CURRENCIES_ID, name: 'Currencies', icon: <Coins className="h-4 w-4" aria-hidden /> },
    ],
    rows: () => items.map((item) => ({
      id: item.id,
      name: item.name,
      sortable: true,
      actions: [
        { icon: <Copy className="h-4 w-4" />, title: 'Duplicate', onClick: () => duplicate(item.id) },
        { icon: <X className="h-4 w-4" />, destructive: true, title: 'Delete', onClick: () => askRemove(item.id) },
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
    holds: (id) => id === EQUIPMENT_ID || id === CURRENCIES_ID || byId.has(id),
    isEmpty: items.length === 0,
    emptyHint: <Hint className="p-3">Add an item the player or an entity can own</Hint>,
  };
  const dialog = (
    <ConfirmDialog
      open={!!pending}
      onOpenChange={(open) => { if (!open) setPending(null); }}
      title={`Delete ${labelPlaceholders(pending?.name ?? '', placeholders) || 'Item'}?`}
      description={pending?.text ?? ''}
      confirmLabel="Delete"
      destructive
      onConfirm={() => {
        if (pending) remove(pending.id);
        setPending(null);
      }}
    />
  );
  return { adapter, dialog };
}
